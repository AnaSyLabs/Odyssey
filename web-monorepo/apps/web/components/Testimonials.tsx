import Image from "next/image";
import TESTIMONIALS from "@/lib/testimonials.json";

export default function Testimonials() {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure key={t.quote} className="glass flex flex-col p-6">
            <blockquote className="flex-1 text-sm">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <Image src={t.image} alt="" width={36} height={36} className="rounded-full" />
              <span className="eyebrow">{t.name} · {t.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-[var(--st-on-var)]">Illustrative quotes for the demo.</p>
    </>
  );
}
