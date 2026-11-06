"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

type Testimonial = { id: string; name: string; role: string; quote: string; src: string };

/** Every testimonial: image on the left, words and name on the right. `editable` adds an Edit button (admins). */
export default function Testimonials({ editable = false, version = 0 }: { editable?: boolean; version?: number }) {
  const [list, setList] = useState<Testimonial[]>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetch("/api/testimonials")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`testimonials failed (${r.status})`))))
      .then((b) => setList(b.testimonials))
      .catch((e: Error) => setError(e.message));
  }, [version, reload]);

  if (error) return <p className="text-center text-sm text-[var(--st-crimson)]" role="alert">{error}</p>;
  if (!list) return <p className="muted text-center text-sm">Loading testimonials…</p>;
  if (!list.length) return <p className="muted text-center text-sm">No testimonials yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((t) => editing === t.id ? (
        <TestimonialForm key={t.id} initial={t} onDone={() => { setEditing(undefined); setReload((n) => n + 1); }} onCancel={() => setEditing(undefined)} />
      ) : (
        <figure key={t.id} className="glass flex gap-4 p-5">
          <Image src={t.src} alt={t.name} width={96} height={96} unoptimized className="size-24 shrink-0 rounded-xl object-cover" />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {t.quote && <blockquote className="mb-3 text-sm">&ldquo;{t.quote}&rdquo;</blockquote>}
            <figcaption>
              <p className="font-medium">{t.name}</p>
              {t.role && <p className="eyebrow mt-0.5">{t.role}</p>}
            </figcaption>
          </div>
          {editable && <button className="btn self-start" onClick={() => setEditing(t.id)}>Edit</button>}
        </figure>
      ))}
    </div>
  );
}

/** Adds a testimonial, or edits `initial` when given (leave the image empty to keep the current one). */
export function TestimonialForm({ initial, onDone, onCancel }: { initial?: Testimonial; onDone: () => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(initial ? `/api/testimonials/${initial.id}` : "/api/testimonials", { method: initial ? "PATCH" : "POST", body: new FormData(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `saving failed (${res.status})`);
      form.reset();
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass flex flex-wrap items-end gap-3 p-4" onSubmit={submit}>
      <label className="block">
        <span className="label">{initial ? "New image (optional)" : "Image"} · JPEG, PNG or WebP, up to 512 KiB</span>
        <input className="field" type="file" name="image" accept="image/jpeg,image/png,image/webp" required={!initial} />
      </label>
      <label className="block min-w-40 flex-1">
        <span className="label">Name</span>
        <input className="field" name="name" required maxLength={80} autoComplete="off" defaultValue={initial?.name} />
      </label>
      <label className="block min-w-40 flex-1">
        <span className="label">Role (optional)</span>
        <input className="field" name="role" maxLength={80} autoComplete="off" defaultValue={initial?.role} />
      </label>
      <label className="block w-full">
        <span className="label">Testimonial (optional)</span>
        <textarea className="field" name="quote" maxLength={500} rows={3} defaultValue={initial?.quote} />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? "Saving…" : initial ? "Save" : "Add testimonial"}</button>
      {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      {error && <p className="w-full text-sm text-[var(--st-crimson)]" role="alert">{error}</p>}
    </form>
  );
}
