# Enrollment and capture: how a photo becomes trusted data

How a pair of Odyssey glasses is bound to one human with World ID, and how every photo it takes is checked. Everything here matches the code: `firmware/odsy_glasses_camera/`, `web-monorepo/apps/web/app/api/enroll/route.ts`, `app/api/ingest/route.ts` and `lib/arkiv.ts`. For the overall design see [odsy_provenance_network.md](odsy_provenance_network.md).

## The whole flow

```
[ Glasses (ESP32) ]      [ Odyssey web app ]                 [ World simulator / App ]   [ World API ]   [ Arkiv / 0G ]
       │                        │                                     │                     │               │
 1. First boot: key in NVS,     │                                     │                     │               │
    OLED shows address + MAC    │                                     │                     │               │
       │                  2. Wallet sign-in, type address + MAC       │                     │               │
       │                  3. Server signs the World ID request;       │                     │               │
       │                     IDKit shows QR (signal = address) ──────>│                     │               │
       │                        │<──── 4. Proof + nullifier ──────────│                     │               │
       │                  5. Server checks action, environment,       │                     │               │
       │                     signal, not enrolled, not banned         │                     │               │
       │                        │──────── 6. Verify proof ─────────────────────────────────>│               │
       │                        │──────── 7. Device record: address ↔ nullifier ↔ MAC ↔ wallet ───────────>│
 8. Touch IO13: JPEG, hash,     │                                     │                     │               │
    sign, HTTPS POST ──────────>│ /api/ingest                         │                     │               │
       │                  9. Recover signer → enrolled? → banned? →   │                     │               │
       │                     duplicate? → encrypt → store ───────────────────────────────────────────────>│
```

What this flow does **not** have: no handshake from the glasses, no `registerDevice()` smart contract, no `humanToDevice` mapping, and no video stream. The device registry lives on Arkiv, and photos are sent one per touch.

## Step 1: the key on the glasses

- On first boot the ESP32's hardware random number generator makes a **secp256k1 private key**. It is saved in flash (NVS, namespace `odsy`) and never leaves the chip.
- The **address** is the last 20 bytes of keccak-256 of the public key, the same as an Ethereum wallet.
- The OLED shows the address (two lines) and the Wi-Fi MAC for 15 seconds at boot, and Serial prints them.
- Both stay the same across reboots and reflashes. They change only if the flash is erased (Arduino IDE: *Erase All Flash Before Sketch Upload*) or a different board is used, because the MAC is burned into each chip.

## Step 2: entering the device

The user opens `/enroll` and signs in with a wallet. That wallet becomes the device's **payout** address and can view the device's photos. They type the address and MAC from the OLED. Nothing is sent from the glasses at this point.

## Step 3: World ID

### 3.1 The server signs the request

Clicking **Verify with World ID** calls `GET /api/enroll`:

- Only a signed-in wallet gets an answer, so nobody else can obtain requests signed as this app.
- The server builds a **request context**: a random one-time **nonce**, a **created** and an **expiry** time, and the hashed action `register-device`. It signs it with `WORLD_RP_SIGNING_KEY`.

Why: in World ID 4 every app is a **relying party (RP)** and must prove each request is really its own. The RP's **public key** is registered in the World developer portal, and World checks every request's signature against it. Another website cannot produce that signature, so it cannot pose as Odyssey. The nonce and expiry stop an old request from being replayed. The private key stays on the server; that is why this is a server call.

### 3.2 IDKit shows the QR code

IDKit (World's library, in the browser) adds:

- **`signal`**: the device address, hashed into a number the zero-knowledge maths can use (`hashSignal`).
- **`environment`**: `staging` (from `WORLD_ENVIRONMENT`), so only test identities, meaning the simulator, can answer.

It posts the request to **World's bridge** (`bridge.worldcoin.org`), an encrypted relay between the browser and the phone. The QR code links to that bridge request; the browser polls the bridge for the answer.

```
browser ──request──► World bridge ◄──scan QR── simulator
browser ◄──proof──── World bridge ◄──proof──── simulator
```

### 3.3 The simulator approves

The simulator holds a **test identity**: a secret, plus membership of World's list of Orb-verified humans. On approval it builds a **zero-knowledge proof** that says:

> "I own one of the identities in the verified-humans list, and I approve action `register-device` with signal `0x…device`."

It proves this without revealing which identity. The answer carries:

- **`merkle_root`**: which version of the verified-humans list the proof used.
- **`nullifier`**: derived from the identity's secret, the app and the action.
  - Same human and same action give the **same nullifier** every time. This is what lets the gateway enforce one device per human.
  - A different app or action gives a different nullifier, so a person cannot be tracked across apps.
  - It cannot be traced back to the person or their secret.
- **`signal_hash`**: the device address the proof is locked to.

## Step 4: registration (`POST /api/enroll`)

The browser sends `{device, mac, result}`. Cheap checks run **before** World is contacted, because World may record each verification it accepts: a check failing afterwards would waste the human's verification.

### Checks before World

1. **Right action and environment.** `result.action` must be `register-device` and `result.environment` must equal `WORLD_ENVIRONMENT`. A proof made for another action is refused, and a staging (test) identity is refused once the app runs in production.
2. **`signal_hash` matches this device.** The server computes `hashSignal(device)` itself and compares. This is the key check: World's API proves the proof is *valid*, but a valid proof could be for *other* glasses. Without this comparison, one human's proof for their own glasses could enroll somebody else's.
3. **Device not already enrolled.** One indexed lookup in Arkiv (`findDevice`); if found: `409 device already registered`.
4. **World ID not banned.** The nullifier (as hex) is looked up with `bannedFrom()` on the ConsensusRegistry contract on 0G Galileo. This read-only call is the only contract involved in enrollment.

### If all pass

1. **World verifies the proof.** The whole result goes to `developer.worldcoin.org/api/v4/verify/<rp_id>`. World checks the zero-knowledge maths, that `merkle_root` is a real recent list, that the request carries the RP's signature and nonce, and that the action has not been used more times than the app allows. Anything but `success` returns `400 World ID rejected the proof`.
2. **One human, one device.** `registerDevice` looks for a device with this nullifier; if one exists: `409 this World ID already has a device`. Known gap (marked in the code): two enrollments by the same human at the same instant could both pass before either is saved; acceptable at enrollment volume.
3. **Saved on Arkiv** as an `odsy.devices` record:

   | Field | Value |
   |---|---|
   | `device` | the glasses' address (indexed, for the per-upload lookup) |
   | `worldId` | the nullifier in hex (indexed, for one device per human) |
   | `deviceType` | `esp32-cam-glasses` |
   | `mac` | the MAC entered on `/enroll` |
   | `payout` | the signed-in wallet: receives rewards, can view the photos |

   - Arkiv records expire by default, so this one is written with the maximum expiry: effectively permanent.
   - The **gateway wallet** (`ARKIV_PRIVATE_KEY`) signs and pays for the write; the page shows the transaction hash.
   - Arkiv is public: anyone can write a record with the same `odsy.devices` label. Every lookup therefore only trusts records owned by the gateway wallet (`.ownedBy(gatewayAddress())`).

**Privacy:** the nullifier is public on Arkiv. Anyone can see "glasses 0x… belong to anonymous human N", but not who N is, nor link N to other apps.

## Step 5: capturing a photo

After enrollment the phone and World are not needed again.

1. Touching **IO13** to ground (for example the metal shield) fires once; it re-arms after the pin has been HIGH for 100 ms.
2. The glasses encode a 160×120 grayscale JPEG and sign, as an Ethereum signed message (EIP-191):
   `odsy-sample:v1|sha256(photo)|image|image/jpeg|time|19.0596|72.8295|sha256("{}")`
   The location is fixed to Bandra West, Mumbai until the glasses have GPS.
3. They HTTPS POST the photo and signature as JSON to `/api/ingest`.
4. The gateway checks it (next section). On success it encrypts the photo, stores it inline on Arkiv (or on 0G Storage if over 96 KB), and writes an `odsy.samples` record that keeps the signature so anyone can re-check it. It answers **201** and the OLED shows *Image sent*.
5. `/capture?device=0x…` shows the photo with its signature and image hash re-checked by the server.

| Answer | Meaning | OLED |
|---|---|---|
| 201 | Signed and stored | Image sent |
| 409 | This exact photo was already stored | Duplicate |
| 403 | Signer is not an enrolled device | Not enrolled |
| 403 (banned) | The device's World ID is banned | Banned |
| 400 | Bad signature or malformed upload | Not sent |

## How one upload is checked (no scanning)

The gateway never loops over registered devices. Each upload costs the same whether one device or a million are enrolled:

| Check | How | Cost as devices grow |
|---|---|---|
| Who signed it? | `recoverMessageAddress`: maths on the signature yields exactly one address (that is what the signature's `v` byte enables) | constant, no lookup |
| Enrolled? | Arkiv query on the indexed `device` field, owned by the gateway, limit 1 | constant |
| Banned? | `bannedFrom(worldId)` mapping read on ConsensusRegistry, cached 60 s per server instance | constant |
| Duplicate? | Arkiv query on the indexed `contentHash` field, limit 1 | constant |

A tampered photo or message recovers to a random address that matches no record, so it is refused as not enrolled. This is why the device signs with recoverable Ethereum signatures: with a shared-secret scheme such as HMAC, the server would have to try every device's key.

The real cost is network time to the Arkiv and 0G nodes, and the storage write is the slowest step; the firmware waits up to 30 s for the answer.
