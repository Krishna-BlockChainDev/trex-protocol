/**
 * Shared helpers for per-investor localStorage name storage.
 * Key format: trex_investor_name_${wallet.toLowerCase()}
 */

export const investorNameKey = (wallet: string) =>
  `trex_investor_name_${wallet.toLowerCase()}`;

/** Read the saved investor name for a wallet (SSR-safe). Returns '' if unset. */
export function readInvestorName(wallet: string): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(investorNameKey(wallet)) ?? '';
}

/** Write (or clear when name is blank) the investor name for a wallet. */
export function writeInvestorName(wallet: string, name: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(investorNameKey(wallet), trimmed);
  } else {
    localStorage.removeItem(investorNameKey(wallet));
  }
}
