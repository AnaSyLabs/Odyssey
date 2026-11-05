import type { ReactNode } from "react";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="border-b border-[var(--st-line)] pb-3 text-2xl font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export const H3 = ({ children }: { children: ReactNode }) => <h3 className="pt-3 text-base font-semibold">{children}</h3>;
export const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed">{children}</p>;
export const Ul = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">{children}</ul>;
export const Ol = ({ children }: { children: ReactNode }) => <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">{children}</ol>;
export const Mono = ({ children }: { children: ReactNode }) => <code className="mono rounded bg-[var(--st-3)] px-1 py-0.5 text-[0.85em]">{children}</code>;

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="ui-card serial mono overflow-hidden">
      {label && <div className="eyebrow border-b border-[var(--st-line)] bg-[var(--st-2)] px-5 py-3">{label}</div>}
      <pre className="overflow-x-auto px-5 py-4 text-xs leading-5">{children.trim()}</pre>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="ui-card overflow-x-auto px-2 py-1">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-[var(--st-line)]">
            {head.map((h) => <th key={h} className="eyebrow px-4 pb-3 pt-4">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--st-line)] align-top last:border-0">
              {r.map((c, j) => <td key={j} className={`px-4 py-3.5 leading-relaxed ${j === 0 ? "font-medium" : "text-[var(--st-on-var)]"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ kind = "info", title, children }: { kind?: "info" | "warn"; title: string; children: ReactNode }) {
  const color = kind === "warn" ? "var(--wire-red)" : "var(--accent-teal)";
  return (
    <div className="ui-card p-5 text-sm" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 space-y-1 leading-relaxed">{children}</div>
    </div>
  );
}
