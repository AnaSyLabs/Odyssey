# Demo script, full length (3:50)

The long version of [script.md](script.md): the same story with more depth, for a submission that uses most of the 4 minutes. It runs **about 3:50**, because ETHGlobal rejects any upload over 4:00, so it keeps a 10-second margin. About 520 words at a calm 140 words a minute.

**Read it yourself.** ETHGlobal rejects AI or text-to-speech voiceover, so this must be a team member's own voice. Paraphrase freely; keep the facts, and keep "demo data" wherever the screen is a mockup.

**Footage:** the recorded takes from the production site ([tools](tools/)), held longer to fit the voice, plus two clips from the team:

- **2b · Real glasses** (about 15 s): a teammate taps capture, the OLED shows REC then SIGNED. Film with a laptop webcam or a camera, not a phone.
- **6b · Claude over MCP** (about 35 s): Claude Desktop or Claude Code connected with a lab wallet's token, answering the question in section 6. Needs a wallet that subscribed.

If either clip is missing, drop the lines marked *(clip)* and the video lands near 3:10, which is still fine.

Times are approximate; the edit follows the voice.

---

## 1 · The problem (0:00–0:20)

*Screen:* landing page; the 3D glasses slide apart into the Lineup view.

> AI is running out of internet. The next wave of models, especially robots, needs real first-person data: what a person actually sees and hears. Right now that data is either scraped without consent or locked inside a few big labs. Labs can't tell real data from synthetic fakes, and the people who capture it never get paid. This is Odyssey.

## 2 · Signed at the sensor (0:20–0:55)

*Screen:* `/device`, the glasses running the capture cycle. *(clip 2b: the real glasses capturing.)*

> These are our capture glasses: an ESP32 camera, a microphone and a small transparent display, with a private key that never leaves the device. When you capture, the glasses hash the clip and sign it right at the sensor, before it ever touches a server. *(clip)* Here's our prototype: one tap, and the display shows it's recording, signed, and uploaded. Our gateway checks the signature, encrypts the payload, and stores it.

## 3 · One human, one device (0:55–1:20)

*Screen:* `/mockups/enroll`, demo data.

> The easiest way to cheat a data network is to run a thousand fake devices, so every pair of glasses is tied to one real person. You enter the glasses' address and prove you're human with World ID. It reveals nothing about who you are, and the proof is bound to that exact device address, so it can't be reused. One human, one device. This screen is a demo; the live page runs the same two steps.

## 4 · Stored and checkable on Arkiv (1:20–1:50)

*Screen:* a sample's proof on the demo dataset, then a real sample on the Arkiv explorer.

> Every sample carries its own proof: which device took it, when and where, a content hash and the device's signature. And this one is real: a photo our glasses uploaded today, stored as an entity on Arkiv. Anyone can see the device address, the World ID that captured it, the location and the signature. The photo itself is encrypted, so only someone who paid can read it. Proof is public; data stays private.

## 5 · A lab pays in 0G (1:50–2:25)

*Screen:* demo subscribe, the hex coverage map, then OdsySubscriptions on 0G Galileo.

> Now the buyer's side. An AI lab picks an area and a kind of data, and subscribes for thirty days, paid in 0G. Once subscribed, it gets a live map of every hexagon its data covers and how validators scored each one. Payments go through our subscriptions contract on 0G Galileo; here it is, with a real subscription payment on-chain. Seventy percent of every payment is set aside for the people who captured the data, and only the rest goes to the platform.

## 6 · Ask an AI about the data (2:25–3:05)

*Screen:* docs, *Use it from an LLM (MCP)*. *(clip 6b: Claude answering.)*

> Labs don't even have to download anything to explore. Our hosted MCP server lets Claude, Cursor or any MCP client search the data a wallet has paid for, with three tools: list datasets, search samples, get a sample. *(clip)* Let me just ask Claude: what was captured near Bandra today? It finds our dataset, searches it, and answers from the real, signed photo, with the device and the proof attached.

## 7 · Cheaters get caught (3:05–3:30)

*Screen:* docs, *Two strikes and you're out*, then ConsensusRegistry on 0G Galileo.

> Checking every sample doesn't scale, so validators spot-check a small share, and only objective evidence counts. If someone re-uploads another person's clip, that's provable: a strike. Two strikes and that World ID is banned: no uploads, no new devices, and their data can't be decrypted. Bans live on our consensus contract on 0G, here with the validator votes and the bans we tested.

## 8 · Contributors get paid (3:30–3:50)

*Screen:* `/mockups/analytics`, demo data, then the deployed contracts on the docs page.

> Contributors see what they earned each reward epoch and claim it straight from the contract with a Merkle proof. Odyssey: real-world data, signed at the sensor, owned by the people who capture it. Everything you saw is open source, with links below.

---

**If it runs over 4:00:** cut the second half of section 6's clip, then the last sentence of section 3. Check the final length before uploading; the form rejects anything under 2:00 or over 4:00.
