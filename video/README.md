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

## Decisions

- **Filmed on the live Vercel site**, not localhost.
- **Real glasses** for the capture shot, filmed with a laptop webcam or a camera (not a phone).
- **World ID enrollment done live**, including a second device being refused.
- **Highlight: Claude answering from our data over MCP** (take 6).

## Before recording

The video can only show what works. Owners in brackets; fill in names.

**Vercel (needs the project owner's account)**
- [ ] Turn off Deployment Protection, so the live link opens for judges
- [ ] Set `SUBSCRIPTIONS_ADDRESS`, `SUBSCRIPTIONS_FROM_BLOCK` and `CONSENSUS_ADDRESS`, then redeploy (signed-in pages fail without them)

**World ID ([name])**
- [ ] At developer.world.org: create a **staging** app and a `register-device` action
- [ ] Set `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY` and `WORLD_ENVIRONMENT=staging` locally and on Vercel
- [ ] Enroll once through simulator.worldcoin.org, and try a second device with the same identity to see the refusal

**Glasses ([name])**
- [ ] Firmware flashed, Wi-Fi set, pointed at the Vercel URL, charged
- [ ] One capture uploads and shows on `/capture`

**0G flows ([name])**, with [TESTING.md](../TESTING.md)
- [ ] Wallets funded with Galileo 0G: lab, payout, admin
- [ ] Bandra dataset exists with 10+ samples
- [ ] Subscribe once as the lab; the sample unlocks
- [ ] Publish reward epoch 1 (`npm run rewards:publish`); claim it from the payout wallet
- [ ] Ban flow once (TESTING.md part 3), using a second World ID

**MCP ([name])**
- [ ] Create a token on `/datasets` as the lab wallet; connect Claude Desktop or Claude Code (README, *MCP server*)
- [ ] Ask the take 6 question once and check the answer uses the new photo

## Recorded footage

The screen takes are recorded automatically from the production site (`odyssey-blush-seven.vercel.app`) at 2880×1620, with the intro skipped, a visible cursor, and capture paused during page loads. While recording, each take logs where the important element is (a button, a field, a proof row, a transaction) at the moment it matters. The zoom renderer turns those into eased camera moves: 0.8 s ease-in-out zooms, a slow push-in while holding, and crossfades between takes. Output is a 1920×1080 silent cut.

Signed-in pages are shown through the `/mockups` demo screens; the real proof comes from a JPEG the glasses uploaded to Arkiv and the two contracts on 0G Galileo.

```bash
cd video/tools
npm i playwright-core@1.49.1   # uses your installed Chrome, downloads no browser
node rec.mjs                    # all 8 takes into takes/ (video + camera targets); or e.g. node rec.mjs 4
python3 zoom.py                 # zooms each take and joins them into silent-cut.mp4
```

### Guide-voice cut

A rehearsal version with an AI voice (ElevenLabs), so whoever narrates can hear the pacing. **Not for the ETHGlobal upload**: the rules reject AI or text-to-speech voiceover. Clips the team still has to film live get a placeholder card describing the shot.

```bash
# key in ~/.elevenlabs_key (sk_..., text-to-speech permission), never in the repo
STRETCH="$(cat stretch.json)" node rec.mjs   # optional: pace each take to its narration
python3 zoom.py
node cards.mjs                                # placeholder cards for the live clips (02b, 06b)
python3 voice.py                              # narration per section into vo/ (cached)
python3 assemble.py                           # takes + cards + voice -> odyssey-demo-AI-VOICE.mp4, checked against 2:00-4:00
```

The narration that fits this cut is in [script.md](script.md). A full-length version (about 3:50, with the glasses and Claude clips) is in [script-4min.md](script-4min.md).

## Takes

The words are in [script.md](script.md). About 3:10 in total; each take is recorded on its own.

| # | Time | Screen | Track |
|---|---|---|---|
| 1 | 0:00–0:15 | Landing page, 3D glasses into the Lineup view | |
| 2 | 0:15–0:45 | Real glasses capture (camera), then the photo on `/capture` | |
| 3 | 0:45–1:15 | `/enroll` with World ID, then a second device refused | World |
| 4 | 1:15–1:35 | `/explore`: the photo's proof and its Arkiv entity | Arkiv |
| 5 | 1:35–2:05 | `/datasets`: subscribe with 0G, payment on the explorer, sample unlocks | 0G |
| 6 | 2:05–2:40 | Claude answers a question from the dataset over MCP | Arkiv |
| 7 | 2:40–2:55 | Replayed photo: strike, ban on `ConsensusRegistry`, upload refused | 0G |
| 8 | 2:55–3:10 | Contributor claims the reward; end on repo and contract addresses | 0G |

If it runs long, trim take 7, then take 4.

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
