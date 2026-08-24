// Resilient injected-wallet discovery for Quai.
//
// Modern Pelagus announces its provider via EIP-6963 rather than guaranteeing a
// `window.pelagus` global, so we listen for announcements AND fall back to the
// legacy global / window.ethereum. This is why the old single-global check said
// "Install Pelagus" even when Pelagus was installed.

export interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: any;
}

const announced: Eip6963Detail[] = [];
let initialized = false;

function isPelagus(detail: Eip6963Detail): boolean {
  const s = `${detail.info?.rdns ?? ""} ${detail.info?.name ?? ""}`.toLowerCase();
  return s.includes("pelagus") || Boolean(detail.provider?.isPelagus);
}

export function initWalletDiscovery() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    const detail = event.detail as Eip6963Detail;
    if (detail?.info?.uuid && !announced.some((p) => p.info.uuid === detail.info.uuid)) {
      announced.push(detail);
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/** Best available injected provider, preferring Pelagus. */
export function getInjectedProvider(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;

  // Nudge late-injecting wallets to (re)announce.
  if (initialized && announced.length === 0) {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  const pelagus6963 = announced.find(isPelagus);
  if (pelagus6963) return pelagus6963.provider;
  if (w.pelagus) return w.pelagus;
  if (w.ethereum?.isPelagus) return w.ethereum;
  if (announced.length > 0) return announced[0].provider;
  if (w.ethereum) return w.ethereum;
  return null;
}

/** Request accounts, trying Quai methods first then EVM fallbacks. */
export async function requestAccounts(provider: any, interactive: boolean): Promise<string[]> {
  const primary = interactive ? "quai_requestAccounts" : "quai_accounts";
  try {
    return (await provider.request({ method: primary })) || [];
  } catch (err) {
    const fallback = interactive ? "eth_requestAccounts" : "eth_accounts";
    try {
      return (await provider.request({ method: fallback })) || [];
    } catch {
      throw err;
    }
  }
}
