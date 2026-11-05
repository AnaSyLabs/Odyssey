import Link from "next/link";
import { LuChartNoAxesColumn, LuDatabase, LuGlasses, LuPlugZap } from "react-icons/lu";

const MOCKS = [
  ["/mockups/datasets", "Datasets", "Marketplace, mock subscriptions and the H3 hex consensus map.", LuDatabase],
  ["/mockups/analytics", "Analytics", "Contributor earnings and company spend.", LuChartNoAxesColumn],
  ["/mockups/devices", "My devices", "Registered capture devices.", LuGlasses],
  ["/mockups/enroll", "Enroll device", "Device enrollment flow.", LuPlugZap],
] as const;

export default function Mockups() {
  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mockups</h1>
        <p className="muted text-sm">Screens that run on mock data. No gateway, chain or payment is behind them yet.</p>
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
