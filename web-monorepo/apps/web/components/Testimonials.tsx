"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

type Testimonial = { id: string; name: string; quote: string; addedAt: number };

/** Every testimonial: the person's image on the left, their name and words on the right. Change `version` to reload. */
export default function Testimonials({ version = 0 }: { version?: number }) {
  const [list, setList] = useState<Testimonial[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch("/api/testimonials")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`testimonials failed (${r.status})`))))
      .then((b) => setList(b.testimonials))
      .catch((e: Error) => setError(e.message));
  }, [version]);

  if (error) return <p className="text-center text-sm text-[var(--st-crimson)]" role="alert">{error}</p>;
  if (!list) return <p className="muted text-center text-sm">Loading testimonials…</p>;
  if (!list.length) return <p className="muted text-center text-sm">No testimonials yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((t) => (
        <figure key={t.id} className="glass flex gap-4 p-5">
          <Image src={`/api/testimonials/${t.id}/image`} alt={t.name} width={96} height={96} unoptimized className="size-24 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <blockquote className="text-sm">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="eyebrow mt-3">{t.name}</figcaption>
          </div>
        </figure>
      ))}
    </div>
  );
}
