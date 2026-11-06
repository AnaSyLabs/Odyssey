# Demo video

The ETHGlobal Mumbai submission video: a narrated screen recording of the live app, about 3 minutes. This folder holds the plan, the script and the recording notes. Rendered video files stay out of git (see [.gitignore](.gitignore)); upload the final cut to the submission form and link it here.

**Final video:** _not uploaded yet_

**Deadline:** submissions close **Saturday 7 Nov 2026, 09:00 IST**.

## The rules we have to meet

From [ETHGlobal Mumbai: rules, project submission and judging](https://ethglobal.com/events/mumbai/info/details).

| Rule | Detail |
|---|---|
| Length | **2 to 4 minutes.** Uploads outside that range are rejected |
| Quality | **720p or higher** (we export 1080p) |
| Content | Show the project working; cut out waiting; no more than **20 seconds** of backstory |
| Slides | No more than 4 bullet points per slide |
| Not allowed | AI or text-to-speech voiceover |
| Not allowed | Music with on-screen text describing the project instead of someone talking |
| Not allowed | Speeding the video up to fit the limit |
| Not allowed | Recording on a phone |

The same story is the 4-minute demo in the finalist session (4 min demo + 3 min Q&A), so recording this is also the rehearsal.

## Before recording

The video can only show what works. These are open in [PLAN.md](../PLAN.md) section 1; do them first.

- [ ] Turn off Vercel Deployment Protection so the live link opens for judges
- [ ] Set `SUBSCRIPTIONS_ADDRESS` and `SUBSCRIPTIONS_FROM_BLOCK` on Vercel and redeploy (signed-in pages fail without them)
- [ ] Run once, end to end, with [TESTING.md](../TESTING.md): subscribe with 0G, publish reward epoch 1 and claim it, enroll a device with World ID (staging simulator)
- [ ] One dataset around Bandra with 10+ samples
- [ ] Test wallets funded: lab, payout, admin
- [ ] Glasses charged and uploading, or `npm run simulate` ready (if we use the simulator, say so on camera)

## Script and shot list (about 3:00)

About 450 spoken words. Each row is recorded as its own take.

| # | Time | Screen | Say (roughly) | Track |
|---|---|---|---|---|
| 1 | 0:00–0:15 | Landing page, 3D glasses in the Lineup view | "AI is running out of internet. Robots need real first-person data, but labs can't tell real from fake, and the people who capture it aren't paid. Odyssey fixes that." | |
| 2 | 0:15–0:40 | The glasses capturing (or the simulator), then `/device` | "Our glasses sign every capture with a key that never leaves the device. Here's a photo going up, signed at the sensor." | |
| 3 | 0:40–1:05 | `/enroll`: device address, World ID approval, the Arkiv receipt | "One human, one device. World ID proves I'm a unique person without revealing who, and binds me to these glasses. A second device for me is refused." | World |
| 4 | 1:05–1:30 | `/explore`: the sample on the map; open it, show signature, hash and its Arkiv entity | "Every sample is an encrypted Arkiv entity with its location, signature and content hash. Anyone can check it; only paying labs can decrypt it." | Arkiv |
| 5 | 1:30–2:05 | `/datasets`: Bandra dataset, subscribe with 0G in the wallet, the payment on the Galileo explorer, the sample decrypts | "A lab subscribes to an area for 30 days in 0G through our subscriptions contract. 70 % goes to contributors. As soon as it confirms, the samples decrypt." | 0G |
| 6 | 2:05–2:25 | Terminal: `npm run lab:ingest`, or Claude querying the dataset over MCP | "Labs pull it straight into their own storage, checking every signature, or query it from an AI tool over MCP." | Arkiv |
| 7 | 2:25–2:45 | A replayed sample rejected with 403; `ConsensusRegistry` on the explorer | "Cheaters get caught: a replayed sample is a strike, and two strikes ban the World ID, on-chain." | 0G |
| 8 | 2:45–3:00 | `/analytics` contributor view, claim a reward, end on the repo and contract addresses | "And contributors claim their share. Real-world data, signed at the sensor, owned by the people who capture it." | |

If it runs long, shorten 6 or 7 first.

## Recording

- The person who will present at finalist judging narrates.
- Laptop screen at 1920×1080. QuickTime or OBS. A wired mic or AirPods in a quiet room.
- Notifications off, bookmarks bar hidden, browser zoom 110–125 %, dark theme.
- Tabs open, wallets unlocked, terminal commands typed in before each take.
- Skip the intro animation and don't start Odi's tour.
- Save raw takes here as `take-01.mov` … `take-08.mov` (ignored by git).

## Editing and export

- Join the takes in order. Cut out waiting (allowed); never speed up (not allowed).
- No music under the narration, and no caption-only sections.
- Title cards are optional; at most 4 bullets each.
- Export MP4, H.264, 1920×1080. Check the length is between 2:00 and 4:00.
- Save it as `odyssey-demo.mp4` here (ignored by git), upload it to the submission form, then put its link at the top of this file and in the main README.

## Submission form

- Title, description and the repo link.
- Up to **3 partner prizes** (several tracks from one partner count as one): Arkiv, World, 0G. For each, say how we used it and give feedback; the README's [Tracks](../README.md#tracks) section has most of it.
- Pick **Finalist and Partner Prizes** if we will present live.
