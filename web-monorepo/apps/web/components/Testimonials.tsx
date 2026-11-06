"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { short } from "@/lib/data";

type Testimonial = { key: string; hash: string; addedAt: number };

/** Every testimonial from Arkiv: the user's image on the left, their hash on the right. Change `version` to reload. */
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
  if (!list) return <p className="muted text-center text-sm">Loading testimonials from Arkiv…</p>;
  if (!list.length) return <p className="muted text-center text-sm">No testimonials yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {list.map((t) => (
        <figure key={t.key} className="glass flex items-center gap-4 p-4">
          <Image src={`/api/testimonials/${t.key}/image`} alt="" width={96} height={96} unoptimized className="size-24 shrink-0 rounded-xl object-cover" />
          <figcaption className="min-w-0">
            <p className="eyebrow">User hash</p>
            <code className="mt-1 block text-xs" title={t.hash}>{short(t.hash, 10, 8)}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
