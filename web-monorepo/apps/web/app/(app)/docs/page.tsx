import type { Metadata } from "next";
import { Code, H3, Mono, Note, Ol, P, Section, Table, Ul } from "@/components/docs";
import { Edge, Figure, Group, Node, Sequence } from "@/components/diagrams";

export const metadata: Metadata = { title: "Protocol · Odyssey" };

const TOC = [
  ["overview", "Overview"],
  ["pipeline", "The pipeline"],
  ["sample", "What a sample proves"],
  ["validation", "Validation"],
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

        <Section id="pipeline" title="The pipeline">
          <Figure n={1} title="From lens to ledger" w={1000} h={300}
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
          <Sequence n={2} title="One batch, from anchor to accepted"
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
            <li>Each batch has its own encryption key; destroying it forgets the data (<Mono>crypto-shredding</Mono>), so immutable storage and erasure rights can coexist.</li>
            <li>Contributors stay anonymous: the network knows a device belongs to <i>a</i> verified human, not <i>which</i> one.</li>
          </Ul>
        </Section>

        <Section id="roadmap" title="Roadmap">
          <H3>Phase 1 · Prove it</H3>
          <P>Device signing, uploads, batch roots on-chain, test-token rewards. The team does the spot-checks.</P>
          <H3>Phase 2 · Stake it</H3>
          <P>Permissioned staked validators, honeypots, challenge window and slashing.</P>
          <H3>Phase 3 · Open it</H3>
          <P>Permissionless validators, TEE gateways, rarity rewards and the lab marketplace with licensing.</P>
          <H3>Phase 4 · Value it</H3>
          <P>Reward data by how much it actually improves a model.</P>
        </Section>
      </main>
    </div>
  );
}
