"use client";
// Live pages need a signed-in wallet. Until then they show a placeholder page under a sign-in overlay.
import { useState } from "react";
import { LuWallet } from "react-icons/lu";
import { Loading, PageSkeleton } from "@/components/Skeleton";
import { useToastError } from "@/components/Toaster";
import { errorText, useWallet } from "@/components/wallet";

export default function SignInGate({ children }: { children: React.ReactNode }) {
  const { session, ready, signIn } = useWallet();
  const [busy, setBusy] = useState(false);
  const [, setError] = useToastError();

  if (!ready) return <Loading label="Checking your session"><PageSkeleton /></Loading>;
  if (session) return children;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-60 blur-[2px]" inert><PageSkeleton /></div>
      <div className="absolute inset-0 z-10 grid place-items-start justify-center pt-24">
        <div role="dialog" aria-modal="true" aria-labelledby="signin-title" className="glass w-[min(28rem,calc(100vw-2rem))] space-y-4 p-6 text-center shadow-2xl">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--st-3)] text-[var(--st-cyan)]"><LuWallet size={22} /></span>
          <h2 id="signin-title" className="text-xl font-semibold">Sign in with your wallet</h2>
          <p className="text-sm text-[var(--st-on-var)]">
            Datasets, samples and transactions are tied to your wallet. Signing a message proves it is yours. It does not send a transaction or cost gas.
          </p>
          <button className="btn primary w-full" autoFocus disabled={busy} onClick={async () => {
            setBusy(true);
            setError(undefined);
            try { await signIn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
          }}>
            <LuWallet size={15} />{busy ? "Check your wallet…" : "Sign in with wallet"}
          </button>
          <p className="text-xs text-[var(--st-on-var)]">No wallet? Install MetaMask or any EVM browser wallet, then reload.</p>
        </div>
      </div>
    </div>
  );
}
