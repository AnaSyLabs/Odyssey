"use client";
import { useState } from "react";
import Testimonials, { TestimonialForm } from "@/components/Testimonials";
import { useWallet } from "@/components/wallet";

export default function TestimonialsPage() {
  const { session } = useWallet();
  const [version, setVersion] = useState(0);
  const admin = !!session?.admin;
  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Testimonials</h1>
        <p className="muted text-sm">What people say about Odyssey.</p>
      </header>
      {admin && <TestimonialForm onDone={() => setVersion((v) => v + 1)} />}
      <Testimonials editable={admin} version={version} />
    </main>
  );
}
