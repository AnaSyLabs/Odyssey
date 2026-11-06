import Testimonials from "@/components/Testimonials";

export default function TestimonialsPage() {
  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Testimonials</h1>
        <p className="muted text-sm">What contributors, labs and validators say about Odyssey.</p>
      </header>
      <Testimonials />
    </main>
  );
}
