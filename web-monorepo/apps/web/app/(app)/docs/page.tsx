import type { Metadata } from "next";
import { Code, H3, Mono, Note, Ol, P, Section, Table, Ul } from "@/components/docs";
import { Edge, Figure, Group, Node, Sequence } from "@/components/diagrams";

export const metadata: Metadata = { title: "Protocol · Odyssey" };

const TOC = [
  ["overview", "Overview"],
  ["live", "What's live today"],
  ["tracks", "Tracks"],
  ["access", "Access and payments"],
  ["pipeline", "The pipeline"],
  ["sample", "What a sample proves"],
  ["validation", "Validation"],
  ["consensus", "Checking a neighbourhood"],
  ["stake", "Stake and slash"],
  ["rewards", "Rewards"],
  ["scale", "Why it scales"],
  ["privacy", "Privacy and consent"],
  ["roadmap", "Roadmap"],
];

export default function Docs() {
  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-2 py-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 space-y-1 text-sm" aria-label="On this page">
          <p className="eyebrow mb-2 px-3">On this page</p>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[var(--st-on-var)] transition hover:bg-[var(--st-2)] hover:text-[var(--st-on)]">{label}</a>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 space-y-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Protocol</h1>
          <p className="muted max-w-2xl text-sm">
            How Odyssey turns first-person sensor data into a dataset AI labs can trust: signed at the sensor, anchored
            on-chain, verified by staked validators, and paid out to the people who captured it.
          </p>
        </header>

        <Section id="overview" title="Overview">
          <P>
            The next generation of models, especially robots and embodied agents, needs <b>real-world, first-person data</b>:
            what a person sees, hears, looks at and does. Odyssey is a network of capture devices, gateways and validators
            that produces that data with a <b>provenance proof per sample</b>.
          </P>
          <Table
            head={["Problem", "Odyssey's answer"]}
            rows={[
              ["Faked or synthetic uploads", "Every clip is signed by a hardware key inside the device at capture time."],
              ["One person running many devices", "One human, one device: each device is linked to a verified, anonymous human."],
              ["Datasets edited after the fact", "Batch Merkle roots on-chain: changing any sample breaks its proof."],
              ["Checking everything doesn't scale", "Optimistic acceptance plus random, staked spot-checks of 1 to 5 %."],
              ["Contributors aren't paid", "Every license pays the contributors whose clips are in it."],
            ]}
          />
        </Section>

        <Section id="live" title="What's live today">
          <P>
            The first slice runs end to end on testnets: devices sign samples, a gateway verifies and encrypts them, and
            every sample becomes an entity on <b>Arkiv</b> (Rabdi testnet). Labs sign in with a wallet, pay the
            <b> OdsySubscriptions</b> contract in test 0G on <b>0G Galileo</b>, and get per-sample keys to decrypt what
            their subscription covers. 70 % of every payment goes to the contributors behind the dataset.
          </P>
          <Figure n={1} title="Live today: device to lab" w={1000} h={300}
            caption="Metadata is public on Arkiv so anyone can search it and check signatures. Payloads and sensor readings are ciphertext; only admins and subscribers get the keys.">
            <Group x={10} y={20} w={220} h={260} label="DEVICE" />
            <Node x={25} y={60} w={190} h={80} title="Capture" tech="text · sensor · image" lines={["lat/lon · time"]} />
            <Node x={25} y={170} w={190} h={80} title="Sign" tech="device key" lines={["EIP-191 over hashes"]} tone="accent" />
            <Edge pts={[[120, 140], [120, 170]]} />
            <Group x={260} y={20} w={240} h={260} label="GATEWAY (Next.js API)" />
            <Node x={275} y={60} w={210} h={80} title="Verify" tech="signature · registry" lines={["dedupe by content hash"]} />
            <Node x={275} y={170} w={210} h={80} title="Encrypt" tech="AES-256-GCM" lines={["one key per sample"]} tone="accent" />
            <Edge pts={[[215, 210], [245, 210], [245, 100], [275, 100]]} label="POST /api/ingest" at={[245, 155]} />
            <Edge pts={[[380, 140], [380, 170]]} />
            <Group x={530} y={20} w={200} h={260} label="ARKIV · 0G" />
            <Node x={545} y={60} w={170} h={80} title="Arkiv" tech="readonly entity" lines={["metadata · geohash"]} tone="ext" />
            <Node x={545} y={170} w={170} h={80} title="0G Storage" tech="payloads > 96 KiB" lines={["root kept on Arkiv"]} tone="ext" />
            <Edge pts={[[485, 200], [545, 100]]} />
            <Edge pts={[[485, 220], [545, 210]]} />
            <Group x={760} y={20} w={230} h={260} label="LABS" />
            <Node x={775} y={60} w={200} h={80} title="Subscribe" tech="SIWE · contract" lines={["30 days · 70 % to contributors"]} tone="accent" />
            <Node x={775} y={170} w={200} h={80} title="Ingest" tech="keys from gateway" lines={["verify · decrypt locally"]} />
            <Edge pts={[[875, 140], [875, 170]]} />
            <Edge pts={[[715, 210], [775, 210]]} dashed label="read" />
          </Figure>
          <Table
            head={["Pipeline step", "Vision", "Today"]}
            rows={[
              ["Capture and sign", "Secure element signs hash, time and witnesses", "Device key signs content hash, kind, mime, time, lat/lon and sensors hash. Location is pinned to Bandra until GPS lands."],
              ["One human, one device", "World ID per device", "Registry on Arkiv binds a device key to a World ID nullifier, one device per human. The proof is checked by the registration page."],
              ["Filter", "TEE gateway: blur, dedupe, quality", "Signature, registration, ban and duplicate checks. A clip replayed from another human is a strike. No blurring or quality scoring yet."],
              ["Store", "Encrypted batches on 0G", "Encrypted per sample: inline on Arkiv up to 96 KiB, 0G Storage above that."],
              ["Anchor", "One Merkle root per batch on-chain", "Each sample is a readonly Arkiv entity. Batch roots on a long-lived chain are still to come."],
              ["Verify", "Staked VRF committee", "ConsensusRegistry is deployed on Galileo: allowlisted validators vote on each hex tile and two provable strikes ban a World ID. No staking or VRF yet; the consensus map under /mockups shows the design."],
              ["Pay", "Rewards root per epoch", "Labs pay the subscriptions contract in 0G. 70 % is split pro rata by samples to each device's payout wallet, published as a Merkle root per epoch, and claimed on-chain."],
            ]}
          />
          <H3>Each sample on Arkiv</H3>
          <Code label="odsy.samples entity">{`
{
  "device":      "0x2466…8D8E",       // recovered from the device signature
  "worldId":     "0x0235…200d",       // nullifier bound at registration
  "deviceType":  "esp32-cam-glasses",
  "mac":         "24:0A:C4:00:00:01",
  "kind":        "sensor",           // image · video · audio · text · sensor
  "capturedAt":  1793918858,
  "lat": "19.0596", "lon": "72.8295",
  "geohash":     "te7u3m8y4",         // precision 9, powers radius search
  "contentHash": "0x28d9…9571",       // sha256 of the plaintext payload
  "sensorsHash": "0x5c1e…a0f3",       // sha256 of the plaintext sensors JSON
  "storage":     "inline",           // or "0g" with "ogRoot"
  "enc":         "aes-256-gcm-v1",
  "signature":   "0x9b0e…41c",
  "data":        "<ciphertext>",     // inline payloads only
  "sensors":     "<ciphertext>"
}
`}</Code>
          <Note title="Searchable and checkable by anyone, readable by subscribers">
            <P>
              Anyone can re-check a sample&apos;s device signature, because it covers <Mono>contentHash</Mono> and{" "}
              <Mono>sensorsHash</Mono>. Checking the payload itself needs its key. Arkiv keeps an entity for about six
              months; a daily job extends what the retention policy keeps, and labs copy what they buy into their own
              storage.
            </P>
          </Note>
        </Section>

        <Section id="tracks" title="Tracks">
          <P>How the project maps to the sponsor tracks it targets: what is built, where, and where it stands.</P>
          <H3>Arkiv · the data layer</H3>
          <Table
            head={["What we built", "Where", "Status"]}
            rows={[
              ["Every sample is a readonly Arkiv entity: metadata, geohash, signature, encrypted payload up to 96 KiB", <Mono key="a1">lib/schema.ts</Mono>, "Live-tested"],
              ["Device registry, datasets, paid periods and reward epochs as gateway-owned entities", <Mono key="a2">app/api/*</Mono>, "Registry and datasets live-tested; rewards not yet run live"],
              ["Geo search on a geohash index", <Mono key="a3">lib/query.ts</Mono>, "Live-tested"],
              ["Retention job: extend what is worth keeping, let the rest and banned data expire", <Mono key="a4">app/api/cron/extend</Mono>, "Built, not scheduled yet"],
            ]}
          />
          <H3>0G · payments, contracts and storage</H3>
          <Table
            head={["What we built", "Where", "Status"]}
            rows={[
              ["OdsySubscriptions on Galileo: 30-day dataset access paid in 0G, 70 % to contributors, Merkle reward claims", <Mono key="g1">contracts/src/OdsySubscriptions.sol</Mono>, "Deployed, 14 tests; subscribe and claim not yet confirmed end to end"],
              ["ConsensusRegistry on Galileo: validator median per hex tile, two-strike ban", <Mono key="g2">contracts/src/ConsensusRegistry.sol</Mono>, "Deployed, 10 tests, hand-run live"],
              ["0G Storage for payloads over 96 KiB", <Mono key="g3">lib/og.ts</Mono>, "Built, not yet confirmed with a large payload"],
            ]}
          />
          <H3>World ID · one human, one device</H3>
          <Table
            head={["What we built", "Where", "Status"]}
            rows={[
              ["A device key bound to a World ID nullifier, one device per human", <Mono key="w1">app/api/devices</Mono>, "Built; the proof is checked by a separate registration page"],
              ["Every sample carries the World ID that captured it", <Mono key="w2">Samples.worldId</Mono>, "Live"],
              ["Two provable strikes ban a World ID: no uploads, no new device, data unreadable", <Mono key="w3">lib/consensus.ts</Mono>, "Contract run live; gateway path not yet end to end"],
            ]}
          />
          <Note kind="warn" title="Not built">
            <P>
              World ID proof verification is not done in this app; <Mono>POST /api/devices</Mono> trusts the registration page. The
              enrollment screen under /mockups is a demo of the flow.
            </P>
          </Note>
          <H3>Deployed contracts (0G Galileo testnet)</H3>
          <Table
            head={["Contract", "Address"]}
            rows={[
              ["OdsySubscriptions", <a key="d1" className="underline" href="https://chainscan-galileo.0g.ai/address/0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e"><Mono>0xc3a946516f2f0CE3fc2065543cb0a8E9b105A54e</Mono></a>],
              ["ConsensusRegistry", <a key="d2" className="underline" href="https://chainscan-galileo.0g.ai/address/0x83bea227e5D2C72f8F0F73E63175759D4E6055DC"><Mono>0x83bea227e5D2C72f8F0F73E63175759D4E6055DC</Mono></a>],
            ]}
          />
        </Section>

        <Section id="access" title="Access and payments">
          <Sequence n={2} title="A lab subscribes to a dataset"
            actors={[
              { id: "lab", label: "Lab wallet", tech: "MetaMask" },
              { id: "app", label: "Gateway", tech: "Next.js API" },
              { id: "og", label: "Contract", tech: "0G Galileo" },
              { id: "ark", label: "Arkiv", tech: "Rabdi" },
            ]}
            steps={[
              { section: "1 · SIGN IN" },
              { from: "lab", to: "app", label: "SIWE message + signature" },
              { from: "app", to: "lab", label: "session cookie", reply: true },
              { section: "2 · PAY" },
              { from: "lab", to: "og", label: "subscribe(dataset) + price" },
              { self: "og", label: "paidUntil += 30 days · 70 % to contributors" },
              { from: "app", to: "og", label: "read paidUntil" },
              { section: "3 · READ" },
              { from: "lab", to: "app", label: "per-sample keys" },
              { from: "lab", to: "ark", label: "ciphertext + metadata" },
              { self: "lab", label: "decrypt · verify hashes and signature" },
            ]}
          />
          <Ul>
            <li><b>Datasets</b> are saved filters (area, kind, device model, time range) with a price in 0G per 30 days. New captures that match are included automatically.</li>
            <li><b>Payments</b> go to the <Mono>OdsySubscriptions</Mono> contract, which enforces the exact price and records <Mono>paidUntil</Mono> in the same transaction. Renewals stack, up to 150 days ahead.</li>
            <li><b>Contributors</b> get 70 % of each payment (never less than 50 %). Each epoch the gateway splits it pro rata by samples to each device&apos;s payout wallet and publishes a Merkle root; contributors claim from Transactions. The treasury can never withdraw contributor funds.</li>
            <li><b>Keys</b> are released per sample and only while a subscription covers it. Admins can read everything.</li>
            <li><b>The app</b> asks for a wallet sign-in before Datasets, Explore, the dataset map and Transactions. Signing a message costs no gas; signing out also disconnects the site in the wallet.</li>
            <li><b>Lab ingest</b> (<Mono>npm run lab:ingest</Mono>) pulls subscribed datasets into the lab&apos;s own storage, re-checking every sample, with an option to keep only the samples the retention policy keeps.</li>
          </Ul>
        </Section>

        <Section id="pipeline" title="The pipeline">
          <P>The full design. The <a href="#live" className="text-[var(--st-cyan)] hover:underline">table above</a> shows which parts are live.</P>
          <Figure n={3} title="From lens to ledger" w={1000} h={300}
            caption="Data never goes on-chain. Encrypted clips live in decentralized storage; the chain holds one Merkle root per batch, the stakes, the challenges and the reward roots.">
            <Group x={10} y={20} w={230} h={260} label="DEVICE" />
            <Node x={30} y={60} w={190} h={80} title="Capture" tech="mic · camera · IMU · gaze" lines={["10 s clip"]} />
            <Node x={30} y={170} w={190} h={80} title="Sign" tech="secure element" lines={["hash · time · witnesses"]} tone="accent" />
            <Edge pts={[[125, 140], [125, 170]]} />
            <Group x={270} y={20} w={230} h={260} label="GATEWAY (TEE)" />
            <Node x={290} y={60} w={190} h={80} title="Filter" tech="signature · dedupe" lines={["blur · silence · faces"]} />
            <Node x={290} y={170} w={190} h={80} title="Batch" tech="Merkle tree" lines={["encrypt per batch"]} />
            <Edge pts={[[220, 210], [255, 210], [255, 100], [290, 100]]} label="upload" at={[255, 155]} />
            <Edge pts={[[385, 140], [385, 170]]} />
            <Group x={530} y={20} w={200} h={260} label="STORAGE · CHAIN" />
            <Node x={545} y={60} w={170} h={80} title="Storage" tech="encrypted clips" tone="ext" />
            <Node x={545} y={170} w={170} h={80} title="Chain" tech="batch root" lines={["stakes · rewards"]} tone="ext" />
            <Edge pts={[[480, 100], [545, 100]]} label="clips" />
            <Edge pts={[[480, 210], [545, 210]]} label="root" />
            <Group x={760} y={20} w={230} h={260} label="NETWORK" />
            <Node x={780} y={60} w={190} h={80} title="Validators" tech="VRF committee" lines={["score 1–5 % sample"]} tone="accent" />
            <Node x={780} y={170} w={190} h={80} title="Labs" tech="license" lines={["proof per sample"]} />
            <Edge pts={[[715, 210], [780, 100]]} dashed />
            <Edge pts={[[715, 220], [780, 210]]} />
          </Figure>
          <Ol>
            <li><b>Capture.</b> The wearer double-taps; the glasses record a short clip and show REC to bystanders.</li>
            <li><b>Sign.</b> The clip hash, timestamp and any witness co-signatures from nearby devices are signed inside the secure element.</li>
            <li><b>Filter.</b> A gateway in a TEE checks the signature, drops duplicates (perceptual hash), blur and silence, and blurs faces and plates.</li>
            <li><b>Store and anchor.</b> Clips are encrypted per batch and stored; one Merkle root per batch is anchored on-chain.</li>
            <li><b>Verify.</b> A challenge window opens and a random, staked committee scores a sample of the batch.</li>
            <li><b>Pay.</b> At the end of each epoch, a rewards root is published; contributors claim with a proof.</li>
          </Ol>
        </Section>

        <Section id="sample" title="What a sample proves">
          <P>Every sample a lab licenses comes with a record it can check on its own, without trusting Odyssey.</P>
          <Code label="sample record">{`
{
  "clip":      "0x3fa1…c09e",            // sha256 of the encrypted clip
  "device":    "glasses-7c21e0",          // device public key, linked to one verified human
  "capturedAt": "2026-11-02T08:14:03Z",
  "witnesses": ["glasses-a91f02", "glasses-55d0b3"],
  "signature": "0x9b0e…41c",               // secure-element signature over all of the above
  "batch":     "0x77d2…e810",              // Merkle root anchored on-chain
  "proof":     ["0x…", "0x…", "0x…"],      // Merkle path from clip to batch root
  "score":     0.91,                       // validator committee score
  "license":   "Commercial"
}
`}</Code>
          <Note title="Tamper-proof, not truth-proof">
            <P>
              The chain proves a sample hasn&apos;t changed since it was anchored. It cannot prove the scene was real; that
              comes from signing at the sensor, one-human-per-device, witnesses and validation. Each layer makes faking
              more expensive than capturing.
            </P>
          </Note>
        </Section>

        <Section id="validation" title="Validation">
          <Sequence n={4} title="One batch, from anchor to accepted"
            actors={[
              { id: "gw", label: "Gateway", tech: "TEE" },
              { id: "chain", label: "Chain", tech: "contracts" },
              { id: "val", label: "Validators", tech: "VRF committee" },
              { id: "any", label: "Anyone", tech: "challenger" },
            ]}
            steps={[
              { section: "1 · ANCHOR" },
              { from: "gw", to: "chain", label: "batch root + bond" },
              { self: "chain", label: "challenge window opens" },
              { section: "2 · SAMPLE" },
              { from: "chain", to: "val", label: "VRF picks committee + 1–5 % sample" },
              { from: "val", to: "chain", label: "commit(score hashes)" },
              { from: "val", to: "chain", label: "reveal scores" },
              { self: "chain", label: "honeypots grade validators" },
              { section: "3 · CHALLENGE" },
              { from: "any", to: "chain", label: "challenge + bond (optional)" },
              { self: "chain", label: "resolve on evidence" },
              { section: "4 · SETTLE" },
              { self: "chain", label: "accept batch · slash · reward" },
            ]}
          />
          <Ul>
            <li><b>Random committees.</b> A verifiable random function picks validators and samples, so nobody can predict what will be checked.</li>
            <li><b>Commit, then reveal.</b> Validators commit to hashed scores before seeing anyone else&apos;s, so they can&apos;t copy votes.</li>
            <li><b>Honeypots.</b> Known-answer samples are mixed in; validators who get them wrong lose reputation, then stake.</li>
            <li><b>Challenges.</b> Anyone can post a bond to challenge a batch during the window; a proven challenge slashes the gateway and pays the challenger.</li>
          </Ul>
        </Section>

        <Section id="consensus" title="Checking a neighbourhood">
          <P>
            The map is cut into hexagons. For each hexagon and each day, we check a small random handful of the clips, the way a
            teacher spot-checks homework instead of reading every page.
          </P>
          <Ol>
            <li>Too few clips or too few different devices in a hexagon? It waits. Nothing is decided yet.</li>
            <li>Otherwise the contract works out how many clips to check, and checkers (validators) look at them.</li>
            <li>Each validator says how many of the checked clips passed. The middle answer wins.</li>
            <li>If at least two thirds passed, the hexagon is accepted and its contributors get paid. If not, it is rejected.</li>
          </Ol>
          <H3>Two strikes and you&apos;re out</H3>
          <P>
            If a device is caught with provable bad data twice (a faked signature, a copied clip, an impossible location), its
            World ID is banned. Its data from the first strike onwards is left out, and it can&apos;t register another device. A
            wrongly banned person can be un-banned by the admins. Being outvoted is never a strike.
          </P>
          <Table
            head={["Setting", "Plain meaning", "Starting value"]}
            rows={[
              ["Hexagon size", "How big a neighbourhood is (set per dataset)", "about a street, res 8"],
              ["Time bucket", "How long one check covers", "1 day"],
              ["Minimum clips / devices", "Below this the hexagon waits", "20 clips, 3 devices"],
              ["Check rate", "Share of clips that get checked", "3%, never below 1% or 3 clips"],
              ["Pass mark", "Score a clip needs to count as good", "70 out of 100"],
              ["Needed to pass", "Share of checked clips that must pass", "two thirds"],
              ["Validators per hexagon", "Votes needed to finish", "5"],
              ["Strikes", "Provable alerts before a ban", "2"],
            ]}
          />
          <Note title="Where the numbers live">
            <P>
              The contract is <Mono>contracts/src/ConsensusRegistry.sol</Mono>. The shared settings are set once at deploy from{" "}
              <Mono>contracts/.env.example</Mono>; each dataset picks its own hexagon size, check rate and pass mark within them.
            </P>
            <P>
              It is live on 0G Galileo at{" "}
              <a className="underline" href="https://chainscan-galileo.0g.ai/address/0x83bea227e5D2C72f8F0F73E63175759D4E6055DC">
                <Mono>0x83be…55DC</Mono>
              </a>
              . The gateway checks it on every upload, registration and read, so a banned World ID can&apos;t upload, register a new
              device or have its data decrypted. It is a testnet deploy with three throwaway validators and has not been audited.
            </P>
          </Note>
        </Section>

        <Section id="stake" title="Stake and slash">
          <Table
            head={["Role", "Stakes", "Slashed for"]}
            rows={[
              ["Contributor", "Nothing: one-human-per-device and the device key are the spam filter", "Never slashed; rewards withheld and the device banned"],
              ["Gateway", "Medium", "Anchoring a batch that hides bad or duplicate data"],
              ["Validator", "Medium", "Failed honeypots, missed reveals, losing a challenge"],
              ["Challenger", "Bond per challenge", "Frivolous challenges"],
            ]}
          />
          <Note kind="warn" title="Slash on evidence, never on opinion">
            <P>
              Stake is only taken on objective evidence: a bad signature, a duplicate, a failed honeypot, or a sample proven
              fake. &ldquo;The majority disagreed&rdquo; is never enough. Voting weight per validator is capped to blunt whales and
              collusion.
            </P>
          </Note>
        </Section>

        <Section id="rewards" title="Rewards">
          <P>Each epoch publishes one Merkle root of everyone&apos;s rewards. Contributors claim with a proof, gaslessly.</P>
          <Code label="per verified clip">{`
reward = base × quality score × rarity
# rarity rewards under-covered places, activities and languages
`}</Code>
        </Section>

        <Section id="scale" title="Why it scales">
          <Ul>
            <li><b>On-chain cost is flat:</b> one root per batch, not one transaction per sample.</li>
            <li><b>Verification grows with the sample, not the dataset:</b> 1 to 5 % is checked, at random.</li>
            <li><b>No real-time coordination:</b> gateways and validators scale out independently.</li>
            <li><b>An existing chain:</b> Odyssey is a data protocol on an L2, not a new blockchain.</li>
          </Ul>
        </Section>

        <Section id="privacy" title="Privacy and consent">
          <Ul>
            <li>The glasses show <b>REC</b> while capturing, so bystanders know.</li>
            <li>Gateways blur faces and number plates before anything is stored.</li>
            <li>Each sample has its own encryption key, derived from one gateway secret. Destroying that secret forgets every sample at once (<Mono>crypto-shredding</Mono>); per-batch keys will make it selective.</li>
            <li>Today, metadata (time, place, device, MAC, World ID nullifier) is public on Arkiv so it can be searched. Hashing the MAC and blurring faces at the gateway are next.</li>
            <li>Contributors stay anonymous: the network knows a device belongs to <i>a</i> verified human, not <i>which</i> one.</li>
          </Ul>
        </Section>

        <Section id="roadmap" title="Roadmap">
          <H3>Phase 1 · Prove it</H3>
          <P>Device signing, uploads, batch roots on-chain, test-token rewards. The team does the spot-checks.</P>
          <P><b>Done:</b> signed uploads, device registry, encrypted storage on Arkiv and 0G, geo search, dataset subscriptions on a contract with a contributor split, and lab ingest. <b>Next:</b> batch roots on a long-lived chain, real hardware with GPS.</P>
          <H3>Phase 2 · Stake it</H3>
          <P>Permissioned staked validators, honeypots, challenge window and slashing.</P>
          <P><b>Done:</b> the consensus contract on Galileo (validator median per tile, two-strike ban) and its enforcement in the gateway. <b>Next:</b> staking and slashing, commit-reveal, honeypots and a challenge window.</P>
          <H3>Phase 3 · Open it</H3>
          <P>Permissionless validators, TEE gateways, rarity rewards and the lab marketplace with licensing.</P>
          <H3>Phase 4 · Value it</H3>
          <P>Reward data by how much it actually improves a model.</P>
        </Section>
      </main>
    </div>
  );
}
