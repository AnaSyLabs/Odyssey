import Link from "next/link";
import { LuChartNoAxesColumn, LuDatabase, LuGlasses, LuPlugZap } from "react-icons/lu";

const MOCKS = [
  ["/mockups/datasets", "Datasets", "Marketplace, a pretend 0G subscription and the H3 hex consensus map.", LuDatabase],
  ["/mockups/analytics", "Analytics", "Contributor earnings, lab spend and platform revenue.", LuChartNoAxesColumn],
  ["/mockups/devices", "My devices", "Enrolled glasses, their samples, earnings and strikes.", LuGlasses],
  ["/mockups/enroll", "Enroll device", "The two-step World ID enrollment, simulated.", LuPlugZap],
] as const;

export default function Mockups() {
  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mockups</h1>
        <p className="muted text-sm">The live pages on demo data, so you can look around without a wallet. Nothing here is sent anywhere.</p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {MOCKS.map(([href, title, blurb, Icon]) => (
          <Link key={href} href={href} className="ui-card flex flex-col gap-2 p-5">
            <Icon size={18} />
            <span className="font-medium">{title}</span>
            <span className="muted text-xs">{blurb}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
