// Host self-check for odsy_crypto.h: known keccak/address vectors, then signatures that viem must recover.
// Needs mbedtls 3.6 (what the ESP32 Arduino core 3.x bundles). From the repo root:
//   git clone -b v3.6.2 --depth 1 --recurse-submodules https://github.com/Mbed-TLS/mbedtls /tmp/mbedtls && make -C /tmp/mbedtls lib
//   g++ -std=c++17 -I/tmp/mbedtls/include -Ifirmware/odsy_glasses_camera firmware/odsy_glasses_camera/test/crypto_test.cpp \
//       /tmp/mbedtls/library/libmbedcrypto.a -o /tmp/odsy_crypto_test
//   /tmp/odsy_crypto_test | node firmware/odsy_glasses_camera/test/verify.mjs
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include "odsy_crypto.h"

static int urandom(void *, unsigned char *out, size_t len) {
  FILE *f = fopen("/dev/urandom", "rb");
  size_t n = fread(out, 1, len, f);
  fclose(f);
  return n == len ? 0 : -1;
}

static void expect_keccak(const char *in, const char *hex) {
  uint8_t h[32];
  char got[65];
  odsy_keccak256((const uint8_t *)in, strlen(in), h);
  odsy_hex(h, 32, got);
  if (strcmp(got, hex)) fprintf(stderr, "keccak(%s) = %s, want %s\n", in, got, hex), exit(1);
}

int main() {
  expect_keccak("", "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  expect_keccak("abc", "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
  // 200 bytes: crosses the 136-byte rate boundary.
  char longIn[201];
  memset(longIn, 'a', 200);
  longIn[200] = 0;
  uint8_t h[32];
  odsy_keccak256((const uint8_t *)longIn, 200, h);

  // Private key 1 has a well-known address.
  uint8_t one[32] = {0};
  one[31] = 1;
  char addr[43];
  assert(odsy_address(one, addr, urandom, nullptr) == 0);
  if (strcmp(addr, "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf")) fprintf(stderr, "address(1) = %s\n", addr), exit(1);

  // Random keys and messages; verify.mjs recovers each with viem, as /api/ingest does.
  for (int i = 0; i < 50; i++) {
    uint8_t priv[32];
    char sig[133], msg[160];
    assert(odsy_new_key(priv, urandom, nullptr) == 0);
    assert(odsy_address(priv, addr, urandom, nullptr) == 0);
    snprintf(msg, sizeof msg, "odsy-sample:v1|0x%064d|image|image/jpeg|%d|12.5|-7.25|0x00", i, 1760000000 + i);
    assert(odsy_sign_message(priv, msg, sig, urandom, nullptr) == 0);
    printf("%s\t%s\t%s\n", addr, sig, msg);
  }
  fprintf(stderr, "keccak and address vectors OK\n");
  return 0;
}
