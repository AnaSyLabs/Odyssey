// Ethereum-style device identity for the glasses: secp256k1 key, keccak-256 address, EIP-191 signatures.
// Pure mbedtls (bundled with the ESP32 Arduino core), so test/crypto_test.cpp runs the same code on a PC.
#pragma once
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "mbedtls/ecp.h"
#include "mbedtls/sha256.h"

typedef int (*odsy_rng_fn)(void *ctx, unsigned char *out, size_t len);

// ---------- keccak-256 (Ethereum's pre-standard SHA-3 padding, 0x01) ----------
static void odsy_keccakf(uint64_t st[25]) {
  static const uint64_t KECCAK_RC[24] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL, 0x8000000080008000ULL,
    0x000000000000808bULL, 0x0000000080000001ULL, 0x8000000080008081ULL, 0x8000000000008009ULL,
    0x000000000000008aULL, 0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL, 0x8000000000008003ULL,
    0x8000000000008002ULL, 0x8000000000000080ULL, 0x000000000000800aULL, 0x800000008000000aULL,
    0x8000000080008081ULL, 0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL};
  static const int KECCAK_ROT[24] = {1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44};
  static const int KECCAK_PI[24] = {10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1};
  uint64_t bc[5], t;
  for (int r = 0; r < 24; r++) {
    for (int i = 0; i < 5; i++) bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
    for (int i = 0; i < 5; i++) {
      t = bc[(i + 4) % 5] ^ ((bc[(i + 1) % 5] << 1) | (bc[(i + 1) % 5] >> 63));
      for (int j = 0; j < 25; j += 5) st[j + i] ^= t;
    }
    t = st[1];
    for (int i = 0; i < 24; i++) {
      int j = KECCAK_PI[i];
      bc[0] = st[j];
      st[j] = (t << KECCAK_ROT[i]) | (t >> (64 - KECCAK_ROT[i]));
      t = bc[0];
    }
    for (int j = 0; j < 25; j += 5) {
      for (int i = 0; i < 5; i++) bc[i] = st[j + i];
      for (int i = 0; i < 5; i++) st[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
    }
    st[0] ^= KECCAK_RC[r];
  }
}

// Byte-wise XOR into the lanes assumes little-endian, true for the ESP32 and x86.
static void odsy_keccak256(const uint8_t *in, size_t len, uint8_t out[32]) {
  uint64_t st[25] = {0};
  uint8_t *s = (uint8_t *)st;
  const size_t RATE = 136;
  while (len >= RATE) {
    for (size_t i = 0; i < RATE; i++) s[i] ^= in[i];
    odsy_keccakf(st);
    in += RATE;
    len -= RATE;
  }
  for (size_t i = 0; i < len; i++) s[i] ^= in[i];
  s[len] ^= 0x01;
  s[RATE - 1] ^= 0x80;
  odsy_keccakf(st);
  memcpy(out, s, 32);
}

static void odsy_hex(const uint8_t *b, size_t n, char *out) {  // out: 2n+1 chars
  for (size_t i = 0; i < n; i++) sprintf(out + 2 * i, "%02x", b[i]);
}

// "0x" + sha256 hex, as lib/sample.ts sha256() returns it. out: 67 chars.
static void odsy_sha256_hex(const uint8_t *data, size_t len, char out[67]) {
  uint8_t h[32];
  mbedtls_sha256(data, len, h, 0);
  out[0] = '0';
  out[1] = 'x';
  odsy_hex(h, 32, out + 2);
}

// ---------- secp256k1 ----------

// New private key in [1, n-1]. Returns 0 on success.
static int odsy_new_key(uint8_t priv[32], odsy_rng_fn rng, void *rng_ctx) {
  mbedtls_ecp_group grp;
  mbedtls_mpi d;
  mbedtls_ecp_group_init(&grp);
  mbedtls_mpi_init(&d);
  int ret = mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1);
  if (!ret) ret = mbedtls_ecp_gen_privkey(&grp, &d, rng, rng_ctx);
  if (!ret) ret = mbedtls_mpi_write_binary(&d, priv, 32);
  mbedtls_mpi_free(&d);
  mbedtls_ecp_group_free(&grp);
  return ret;
}

// Ethereum address of the key: last 20 bytes of keccak256(uncompressed pubkey without 0x04). out: "0x" + 40 hex.
static int odsy_address(const uint8_t priv[32], char out[43], odsy_rng_fn rng, void *rng_ctx) {
  mbedtls_ecp_group grp;
  mbedtls_mpi d;
  mbedtls_ecp_point Q;
  mbedtls_ecp_group_init(&grp);
  mbedtls_mpi_init(&d);
  mbedtls_ecp_point_init(&Q);
  uint8_t pub[65], h[32];
  size_t olen = 0;
  int ret = mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1);
  if (!ret) ret = mbedtls_mpi_read_binary(&d, priv, 32);
  if (!ret) ret = mbedtls_ecp_mul(&grp, &Q, &d, &grp.G, rng, rng_ctx);
  if (!ret) ret = mbedtls_ecp_point_write_binary(&grp, &Q, MBEDTLS_ECP_PF_UNCOMPRESSED, &olen, pub, sizeof pub);
  if (!ret) {
    odsy_keccak256(pub + 1, 64, h);
    out[0] = '0';
    out[1] = 'x';
    odsy_hex(h + 12, 20, out + 2);
  }
  mbedtls_ecp_point_free(&Q);
  mbedtls_mpi_free(&d);
  mbedtls_ecp_group_free(&grp);
  return ret;
}

// ECDSA over a 32-byte hash, low-s, with the recovery id Ethereum needs: sig = r || s || v (27/28).
// mbedtls_ecdsa_sign does not expose R, so this signs by hand to learn R.y's parity.
static int odsy_sign_hash(const uint8_t priv[32], const uint8_t hash[32], uint8_t sig[65], odsy_rng_fn rng, void *rng_ctx) {
  mbedtls_ecp_group grp;
  mbedtls_mpi d, k, e, r, s, t;
  mbedtls_ecp_point R;
  mbedtls_ecp_group_init(&grp);
  mbedtls_ecp_point_init(&R);
  mbedtls_mpi *all[] = {&d, &k, &e, &r, &s, &t};
  for (auto m : all) mbedtls_mpi_init(m);
  uint8_t pt[65];
  size_t olen = 0;
  int recid = 0;
  int ret = mbedtls_ecp_group_load(&grp, MBEDTLS_ECP_DP_SECP256K1);
  if (!ret) ret = mbedtls_mpi_read_binary(&d, priv, 32);
  if (!ret) ret = mbedtls_mpi_read_binary(&e, hash, 32);
  for (int tries = 0; !ret && tries < 8; tries++) {
    ret = mbedtls_ecp_gen_privkey(&grp, &k, rng, rng_ctx);  // fresh hardware-random nonce in [1, n-1]
    if (!ret) ret = mbedtls_ecp_mul(&grp, &R, &k, &grp.G, rng, rng_ctx);
    if (!ret) ret = mbedtls_ecp_point_write_binary(&grp, &R, MBEDTLS_ECP_PF_UNCOMPRESSED, &olen, pt, sizeof pt);
    if (!ret) ret = mbedtls_mpi_read_binary(&r, pt + 1, 32);
    if (ret) break;
    recid = pt[64] & 1;
    // R.x >= n would need recovery ids 2/3, which v=27/28 cannot carry; odds are ~2^-128, just retry.
    if (mbedtls_mpi_cmp_mpi(&r, &grp.N) >= 0 || mbedtls_mpi_cmp_int(&r, 0) == 0) continue;
    // s = k^-1 * (e + r*d) mod n
    ret = mbedtls_mpi_mul_mpi(&t, &r, &d);
    if (!ret) ret = mbedtls_mpi_add_mpi(&t, &t, &e);
    if (!ret) ret = mbedtls_mpi_mod_mpi(&t, &t, &grp.N);
    if (!ret) ret = mbedtls_mpi_inv_mod(&k, &k, &grp.N);
    if (!ret) ret = mbedtls_mpi_mul_mpi(&s, &k, &t);
    if (!ret) ret = mbedtls_mpi_mod_mpi(&s, &s, &grp.N);
    if (ret || mbedtls_mpi_cmp_int(&s, 0) == 0) continue;
    // Low-s (EIP-2): s > n/2 becomes n - s, which flips R's parity.
    if (!ret) ret = mbedtls_mpi_copy(&t, &grp.N);
    if (!ret) ret = mbedtls_mpi_shift_r(&t, 1);
    if (!ret && mbedtls_mpi_cmp_mpi(&s, &t) > 0) {
      ret = mbedtls_mpi_sub_mpi(&s, &grp.N, &s);
      recid ^= 1;
    }
    if (!ret) ret = mbedtls_mpi_write_binary(&r, sig, 32);
    if (!ret) ret = mbedtls_mpi_write_binary(&s, sig + 32, 32);
    if (!ret) {
      sig[64] = 27 + recid;
      break;
    }
  }
  for (auto m : all) mbedtls_mpi_free(m);
  mbedtls_ecp_point_free(&R);
  mbedtls_ecp_group_free(&grp);
  return ret;
}

// personal_sign: keccak256("\x19Ethereum Signed Message:\n" + len + msg), as viem's recoverMessageAddress expects.
// out: "0x" + 130 hex chars.
static int odsy_sign_message(const uint8_t priv[32], const char *msg, char out[133], odsy_rng_fn rng, void *rng_ctx) {
  size_t mlen = strlen(msg);
  char prefix[48];
  int plen = snprintf(prefix, sizeof prefix, "\x19" "Ethereum Signed Message:\n%u", (unsigned)mlen);
  uint8_t *buf = (uint8_t *)malloc(plen + mlen);
  if (!buf) return -1;
  memcpy(buf, prefix, plen);
  memcpy(buf + plen, msg, mlen);
  uint8_t h[32], sig[65];
  odsy_keccak256(buf, plen + mlen, h);
  free(buf);
  int ret = odsy_sign_hash(priv, h, sig, rng, rng_ctx);
  if (!ret) {
    out[0] = '0';
    out[1] = 'x';
    odsy_hex(sig, 65, out + 2);
  }
  return ret;
}
