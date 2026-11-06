"use client";
import { useState } from "react";
import Testimonials from "@/components/Testimonials";
import { errorText, useWallet } from "@/components/wallet";

export default function TestimonialsPage() {
  const { session } = useWallet();
  const [version, setVersion] = useState(0);
  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Testimonials</h1>
        <p className="muted text-sm">What people say about Odyssey.</p>
      </header>
      {session?.admin && <AddTestimonial onAdded={() => setVersion((v) => v + 1)} />}
      <Testimonials version={version} />
    </main>
  );
}

function AddTestimonial({ onAdded }: { onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/testimonials", { method: "POST", body: new FormData(form) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `adding failed (${res.status})`);
      form.reset();
      onAdded();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="glass flex flex-wrap items-end gap-3 p-4" onSubmit={add}>
      <label className="block">
        <span className="label">Image (JPEG, PNG or WebP, up to 512 KiB)</span>
        <input className="field" type="file" name="image" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <label className="block min-w-48">
        <span className="label">Name</span>
        <input className="field" name="name" required maxLength={80} autoComplete="off" />
      </label>
      <label className="block w-full">
        <span className="label">Testimonial</span>
        <textarea className="field" name="quote" required maxLength={500} rows={3} />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? "Adding…" : "Add testimonial"}</button>
      {error && <p className="w-full text-sm text-[var(--st-crimson)]" role="alert">{error}</p>}
    </form>
  );
}
