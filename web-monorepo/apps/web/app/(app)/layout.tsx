"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuBookOpen, LuBox, LuChartNoAxesColumn, LuCircuitBoard, LuDatabase, LuMoon, LuPlugZap, LuSun } from "react-icons/lu";
import Logo from "@/components/Logo";
import { setDark, useDark } from "@/lib/theme";

const NAV = [
  ["/datasets", "Datasets", LuDatabase],
  ["/analytics", "Analytics", LuChartNoAxesColumn],
  ["/device", "Capture device", LuBox],
  ["/enroll", "Enroll device", LuPlugZap],
  ["/wiring", "Wiring & firmware", LuCircuitBoard],
  ["/docs", "Protocol docs", LuBookOpen],
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const dark = useDark();
  const here = NAV.find(([href]) => path === href || path.startsWith(`${href}/`));

  return (
    <div className={`lab studio ${dark ? "" : "light"}`}>
      <aside aria-label="App navigation" className="rail fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center pb-5 pt-2 lg:flex">
        <Link href="/" aria-label="Odyssey home" className="grid size-10 place-items-center rounded-full bg-[var(--st-lime)] text-[#07090e]">
          <Logo size={18} />
        </Link>
        <nav className="mt-10 flex flex-col gap-4">
          {NAV.map(([href, label, Icon]) => (
            <Link key={href} href={href} aria-label={label} title={label} aria-current={here?.[0] === href ? "page" : undefined}
              className={`grid size-10 place-items-center rounded-full bg-[var(--st-3)] transition-colors ${here?.[0] === href ? "text-[var(--st-on)] ring-1 ring-[var(--st-cyan)] ring-offset-2 ring-offset-[var(--st-0)]" : "text-[var(--st-on-var)] hover:text-[var(--st-on)]"}`}>
              <Icon size={18} />
            </Link>
          ))}
        </nav>
        <button className="icon-btn mt-auto" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
          {dark ? <LuSun size={18} /> : <LuMoon size={18} />}
        </button>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-16">
        <header className="topbar sticky top-0 z-20 flex h-14 items-center gap-3 px-4">
          {path === "/device" || path === "/wiring" ? (
            <div className="seg" role="tablist" aria-label="View">
              <Link role="tab" aria-selected={path === "/device"} href="/device" className={path === "/device" ? "on" : ""}>3D Model</Link>
              <Link role="tab" aria-selected={path === "/wiring"} href="/wiring" className={path === "/wiring" ? "on" : ""}>Schematics</Link>
            </div>
          ) : (
            <span className="eyebrow text-[var(--st-on)]">Odyssey / {here?.[1]}</span>
          )}
          <nav className="flex gap-3 text-xs text-[var(--st-on-var)] lg:hidden" aria-label="App">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="hover:text-[var(--st-on)]">{label.split(" ")[0]}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
              {dark ? <LuSun size={18} /> : <LuMoon size={18} />}
            </button>
          </div>
        </header>
        <div className="flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
