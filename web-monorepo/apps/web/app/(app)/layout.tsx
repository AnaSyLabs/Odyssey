"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LuBookOpen, LuBox, LuCamera, LuChartNoAxesColumn, LuCircuitBoard, LuDatabase, LuGlasses, LuHexagon, LuLayers, LuMapPinned, LuMoon, LuPlugZap, LuReceipt, LuShieldCheck, LuSun } from "react-icons/lu";
import Logo from "@/components/Logo";
import SignInGate from "@/components/SignInGate";
import { WalletButton, WalletProvider } from "@/components/wallet";
import { setDark, useDark } from "@/lib/theme";

const NAV = [
  ["/datasets", "Datasets", LuDatabase],
  ["/explore", "Explore samples", LuMapPinned],
  ["/activity", "Transactions", LuReceipt],
  ["/device", "Capture device", LuBox],
  ["/enroll", "Enroll device", LuShieldCheck],
  ["/capture", "Captures", LuCamera],
  ["/wiring", "Wiring & firmware", LuCircuitBoard],
  ["/docs", "Protocol docs", LuBookOpen],
  // Mockups: demo-data screens, kept for design until their backends exist.
  ["/mockups/datasets", "Mockup: consensus datasets", LuHexagon],
  ["/mockups/analytics", "Mockup: analytics", LuChartNoAxesColumn],
  ["/mockups/devices", "Mockup: my devices", LuGlasses],
  ["/mockups/enroll", "Mockup: enroll device", LuPlugZap],
  ["/mockups", "Mockups", LuLayers],
] as const;
// Pages backed by the gateway; everything else (landing, docs, device, wiring, /mockups) stays open.
const LIVE = ["/datasets", "/explore", "/activity", "/enroll", "/capture"];

// The dataset map route has a request-time param, so the shell reads usePathname() inside Suspense (Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}><AppShell>{children}</AppShell></Suspense>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const dark = useDark();
  const here = NAV.find(([href]) => path === href || path.startsWith(`${href}/`));
  // Mockup screens are reached through the single Mockups entry, not one icon each.
  const rail = NAV.filter(([href]) => !href.startsWith("/mockups/"));
  const active = path.startsWith("/mockups") ? "/mockups" : here?.[0];

  return (
    <WalletProvider>
    <div className={`lab studio ${dark ? "" : "light"}`}>
      <aside aria-label="App navigation" className="rail fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center pb-5 pt-2 lg:flex">
        <Link href="/" aria-label="Odyssey home" className="grid size-10 place-items-center rounded-full bg-[var(--st-lime)] text-[#07090e]">
          <Logo size={18} />
        </Link>
        <nav className="mt-10 flex flex-col gap-4">
          {rail.map(([href, label, Icon]) => (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={active === href ? "page" : undefined}
              className={`grid size-10 place-items-center rounded-full bg-[var(--st-3)] transition-colors ${active === href ? "text-[var(--st-on)] ring-1 ring-[var(--st-cyan)] ring-offset-2 ring-offset-[var(--st-0)]" : "text-[var(--st-on-var)] hover:text-[var(--st-on)]"}`}>
              <Icon size={18} />
            </Link>
          ))}
        </nav>
        <button className="icon-btn mt-auto" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
          {dark ? <LuSun size={18} /> : <LuMoon size={18} />}
        </button>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-16">
        <header className="topbar sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          {path === "/device" || path === "/wiring" || path === "/enroll" || path === "/capture" ? (
            <div className="seg" role="tablist" aria-label="View">
              <Link role="tab" aria-selected={path === "/device"} href="/device" className={path === "/device" ? "on" : ""}>3D Model</Link>
              <Link role="tab" aria-selected={path === "/wiring"} href="/wiring" className={path === "/wiring" ? "on" : ""}>Schematics</Link>
              <Link role="tab" aria-selected={path === "/enroll"} href="/enroll" className={path === "/enroll" ? "on" : ""}>Enroll</Link>
              <Link role="tab" aria-selected={path === "/capture"} href="/capture" className={path === "/capture" ? "on" : ""}>Captures</Link>
            </div>
          ) : (
            <span className="flex items-center gap-2">
              <span className="eyebrow text-[var(--st-on)]">Odyssey / {here?.[1]}</span>
              {path.startsWith("/mockups/") && <span className="pill status" style={{ "--tone": "var(--st-amber)" } as React.CSSProperties}>mockup · demo data</span>}
            </span>
          )}
          <nav className="flex min-w-0 gap-3 overflow-x-auto text-xs text-[var(--st-on-var)] lg:hidden" aria-label="App">
            {rail.map(([href, label]) => <Link key={href} href={href} className="shrink-0 hover:text-[var(--st-on)]">{label.split(" ")[0]}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <WalletButton />
            <button className="icon-btn lg:hidden" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
              {dark ? <LuSun size={18} /> : <LuMoon size={18} />}
            </button>
          </div>
        </header>
        <div className="flex-1 p-4">{LIVE.some((p) => path === p || path.startsWith(`${p}/`)) ? <SignInGate>{children}</SignInGate> : children}</div>
      </div>
    </div>
    </WalletProvider>
  );
}
