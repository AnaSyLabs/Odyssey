// Checks that a 0G Galileo transaction is a valid subscription payment. Pure, so it is unit-tested.

export type PaymentTx = { from: string; to: string | null; value: bigint; input: string };
export type PaymentReceipt = { status: "success" | "reverted" };

/** Returns why the payment is invalid, or null if it is good. */
export function checkPayment(
  tx: PaymentTx,
  receipt: PaymentReceipt,
  want: { payer: string; treasury: string; dataset: string; price: bigint },
): string | null {
  if (receipt.status !== "success") return "transaction reverted";
  if (tx.from.toLowerCase() !== want.payer.toLowerCase()) return "payment was not sent by the signed-in wallet";
  if (tx.to?.toLowerCase() !== want.treasury.toLowerCase()) return "payment was not sent to the Odsy treasury";
  // The dataset key in the tx data binds the payment to one dataset.
  if (tx.input.toLowerCase() !== want.dataset.toLowerCase()) return "transaction data must be the dataset key";
  if (tx.value < want.price) return "amount is below the dataset price";
  return null;
}

export const PERIOD_SECONDS = 30 * 86_400;
// Arkiv keeps an entity at most ~182 days, so a subscription can't be prepaid past that.
export const MAX_PREPAID_SECONDS = 150 * 86_400;

/** A renewal continues from the current paid-until time, or starts now if it has lapsed. */
export const nextPaidUntil = (currentUntil: number, now: number) => Math.max(currentUntil, now) + PERIOD_SECONDS;
