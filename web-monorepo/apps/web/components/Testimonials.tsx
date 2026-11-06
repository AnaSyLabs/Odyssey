import Image from "next/image";
import TESTIMONIALS from "@/lib/testimonials.json";

export default function Testimonials() {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.hash} className="glass flex gap-4 p-6">
            <Image src={t.image} alt={t.name} width={56} height={56} className="size-14 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col">
              <blockquote className="flex-1 text-sm">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4">
                <span className="eyebrow block">{t.name} · {t.role}</span>
                <code className="mt-1 block text-xs text-[var(--st-on-var)]" title={t.hash}>{t.hash.slice(0, 10)}…{t.hash.slice(-8)}</code>
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-[var(--st-on-var)]">Illustrative quotes for the demo.</p>
    </>
  );
}
