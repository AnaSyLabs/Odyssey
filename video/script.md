# Demo script

Word-for-word narration for the 8 takes in [README.md](README.md), about 3:10 at a calm pace (~140 words a minute). Read it in your own words if that sounds more natural; keep the facts. Square brackets are actions, not words to say.

Filmed on the live Vercel site, with the real glasses and a live World ID enrollment. The highlight is take 6: Claude answering from our data over MCP.

---

## 1 · Hook (0:00–0:15)

[Landing page. Click **Lineup** on the 3D glasses and let the parts slide apart.]

> AI is running out of internet. Robots need real, first-person data. But labs can't tell real data from fakes, and the people who capture it never get paid. This is Odyssey.

## 2 · Capture at the sensor (0:15–0:45)

[Camera on the glasses: a teammate taps capture, the OLED shows REC, then SIGNED. Cut to `/capture`: the new photo appears with its provenance panel.]

> These are our glasses: an ESP32 camera with its own key that never leaves the device. I tap to capture… it signs the photo right here, at the sensor, and uploads it. Here it is in the app, a few seconds later: the device that took it, where, when, and a signature anyone can check.

## 3 · One human, one device (0:45–1:15)

[`/enroll`: the glasses' address and MAC are filled in. Click **Verify with World ID**, approve in the World ID simulator, show the receipt with the Arkiv transaction. Then try enrolling a second device with the same World ID and show it being refused.]

> Fake devices are the easiest way to cheat, so every device is tied to one real person. I enter my glasses' address and prove I'm human with World ID. It doesn't reveal who I am, and the proof only works for this exact device. Now watch what happens if I try a second device with the same identity: refused. One human, one device.

## 4 · Stored and checkable on Arkiv (1:15–1:35)

[`/explore`: the photo from take 2 on the map. Open it: signature, content hash, World ID, and the link to its Arkiv entity.]

> Every capture is stored as an encrypted entity on Arkiv, with its location, content hash and signature. Anyone can verify where it came from. Only someone who paid can read it.

## 5 · A lab pays in 0G (1:35–2:05)

[`/datasets`: open the Bandra dataset. Click **Subscribe · … 0G / 30 days**, confirm in the wallet. Cut the wait. Show the payment on the Galileo explorer, then the sample unlocking.]

> Now I'm an AI lab. I want first-person data from this neighbourhood in Mumbai, so I subscribe for thirty days and pay in 0G, through our contract on 0G Galileo. Seventy percent of that goes to the people who captured it. The moment it confirms… the samples unlock for my wallet.

## 6 · Ask Claude about the data (2:05–2:40)

[Claude Desktop or Claude Code, already connected to Odyssey's MCP server with the lab's token. Type: *"What was captured near Bandra today? Show me the latest sample and who captured it."* Let it call `list_datasets`, `search_samples` and `get_sample`, and answer.]

> And here's my favourite part. Labs don't have to download anything to explore. Our MCP server lets any AI assistant search the data they've paid for. I'll just ask Claude what was captured near Bandra today… It finds our dataset, searches it, and answers from the real, signed photo we took a minute ago, with the device and the proof attached.

## 7 · Cheaters get caught (2:40–2:55)

[Terminal: a second World ID uploads the same file. Show the strike, then the ban on `ConsensusRegistry` in the explorer, and the next upload rejected with 403.]

> What if someone re-uploads another person's photo? That's provable, so it's a strike, recorded on-chain. Two strikes, and that World ID is banned: no uploads, no new devices.

## 8 · Contributors get paid (2:55–3:10)

[`/analytics`, Contributor earnings: the epoch reward. Click claim on Transactions, show it confirmed. End on the README with the contract addresses and repo link.]

> And the people behind the glasses claim their share, straight from the contract. Real-world data: signed at the sensor, checked by validators, paid to the people who capture it. That's Odyssey.

---

**Word count:** about 450. If a take runs long, trim take 7 first, then take 4.
