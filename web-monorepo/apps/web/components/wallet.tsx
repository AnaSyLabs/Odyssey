"use client";
// Browser wallet (any injected EIP-1193 wallet, e.g. MetaMask), Sign-In with Ethereum, and 0G payments.
import { LuLogOut, LuWallet } from "react-icons/lu";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createWalletClient, custom, type EIP1193Provider, getAddress, type Hex, toHex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { galileo } from "@/lib/chains";
import { short } from "@/lib/data";

declare global {
  interface Window { ethereum?: EIP1193Provider }
}

export type Session = { address: Hex; admin: boolean } | null;
type Ctx = {
  session: Session;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Sends `value` wei of 0G to `to` on Galileo with `data`; resolves with the tx hash once submitted. */
  pay: (to: Hex, value: bigint, data: Hex) => Promise<Hex>;
};

const WalletCtx = createContext<Ctx | null>(null);
export const useWallet = () => useContext(WalletCtx)!;

/** A readable message from a wallet or fetch error. */
export const errorText = (e: unknown) => {
  const x = e as { shortMessage?: string; message?: string; details?: string; code?: number };
  const main = x?.shortMessage ?? x?.message ?? String(e);
  return x?.details && !main.includes(x.details) ? `${main} (${x.details}${x.code ? `, code ${x.code}` : ""})` : main;
};

const wallet = () => {
  if (!window.ethereum) throw new Error("No browser wallet found. Install MetaMask (or any EVM wallet) and reload.");
  return createWalletClient({ chain: galileo, transport: custom(window.ethereum) });
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(setSession).catch(() => setSession(null)).finally(() => setReady(true));
  }, []);

  const endSession = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
  }, []);

  // Sign out also disconnects this site in the wallet, so the next sign-in asks again.
  const signOut = useCallback(async () => {
    await endSession();
    // Wallets without EIP-2255 revoke (older MetaMask, some others) keep the site connected; the session is gone either way.
    await window.ethereum?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] } as never).catch(() => {});
  }, [endSession]);

  // Switching accounts in the wallet ends the session for the old one.
  useEffect(() => {
    const onChange = (accounts: string[]) => {
      if (session && accounts[0]?.toLowerCase() !== session.address.toLowerCase()) void endSession();
    };
    window.ethereum?.on?.("accountsChanged", onChange);
    return () => window.ethereum?.removeListener?.("accountsChanged", onChange);
  }, [session, endSession]);

  const signIn = useCallback(async () => {
    const w = wallet();
    const [account] = await w.requestAddresses();
    const { nonce } = await fetch("/api/auth/nonce").then((r) => r.json());
    const message = createSiweMessage({
      address: getAddress(account),
      chainId: galileo.id,
      domain: location.host,
      uri: location.origin,
      nonce,
      version: "1",
      statement: "Sign in to Odyssey. This does not send a transaction or cost gas.",
      issuedAt: new Date(),
      expirationTime: new Date(Date.now() + 10 * 60_000),
    });
    const signature = await w.signMessage({ account, message });
    const res = await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, signature }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "sign-in failed");
    setSession(body);
  }, []);

  const pay = useCallback(async (to: Hex, value: bigint, data: Hex) => {
    const w = wallet();
    const [account] = await w.requestAddresses();
    if (session && account.toLowerCase() !== session.address.toLowerCase()) {
      throw new Error(`Your wallet is on ${short(account)}, but you signed in as ${short(session.address)}. Switch account or sign in again.`);
    }
    // Raw EIP-1193 calls: the wallet fills gas and fees itself. viem's own fee/gas prep goes through the
    // 0G RPC, which rejects some of those calls with "Invalid parameters".
    const eth = window.ethereum!;
    const chainId = toHex(galileo.id);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e; // 4902: wallet doesn't know 0G Galileo yet
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId, chainName: galileo.name, nativeCurrency: galileo.nativeCurrency,
          rpcUrls: [...galileo.rpcUrls.default.http], blockExplorerUrls: [galileo.blockExplorers.default.url],
        }],
      });
    }
    return eth.request({ method: "eth_sendTransaction", params: [{ from: account, to, value: toHex(value), data }] });
  }, [session]);

  return <WalletCtx.Provider value={{ session, ready, signIn, signOut, pay }}>{children}</WalletCtx.Provider>;
}

/** Topbar control: connect + sign in, or the signed-in address with sign-out. */
export function WalletButton() {
  const { session, ready, signIn, signOut } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!ready) return null;
  if (session) {
    return (
      <div className="flex items-center gap-2">
        {session.admin && <span className="pill status" style={{ "--tone": "var(--st-cyan)" } as React.CSSProperties}>admin</span>}
        <span className="pill mono" title={session.address}>{short(session.address, 6, 4)}</span>
        <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><LuLogOut size={17} /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {error && <span className="max-w-64 truncate text-xs text-[var(--st-crimson)]" title={error} role="alert">{error}</span>}
      <button className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true);
        setError(undefined);
        try { await signIn(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
      }}>
        <LuWallet size={14} />{busy ? "Check your wallet…" : "Sign in with wallet"}
      </button>
    </div>
  );
}
