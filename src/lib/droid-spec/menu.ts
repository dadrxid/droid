export type LiveAddons = {
  mouseClickTriggers: number;
  mouseClickFacesAndTriggers: number;
  bo5Shell: number;
  ghostShell: number;
  softTouchShell: number;
  dsePaddles: number;
  bbStyleBacks: number;
  bbExtraButton: number;
  leadjoyCaps: number;
  dseCaps: number;
  xboxFaces: number;
};

export type LiveExtra = {
  id: string;
  label: string;
  priceGbp: number;
};

export type LivePrices = {
  base: number;
  addons: LiveAddons;
  heliumGbp: number | null;
  extras: LiveExtra[];
  postageNote: string;
};

export const FALLBACK_PRICES: LivePrices = {
  base: 179.99,
  heliumGbp: null,
  extras: [],
  postageNote: "UK tracked postage is included on Droid Rollers customs.",
  addons: {
    mouseClickTriggers: 19.99,
    mouseClickFacesAndTriggers: 34.99,
    bo5Shell: 24.99,
    ghostShell: 34.99,
    softTouchShell: 14.99,
    dsePaddles: 19.99,
    bbStyleBacks: 24.99,
    bbExtraButton: 4.99,
    leadjoyCaps: 14.99,
    dseCaps: 9.99,
    xboxFaces: 4.99,
  },
};

type ApiItem = {
  id?: string;
  label?: string;
  priceGbp?: number | null;
};

function money(items: ApiItem[], id: string, fallback: number): number {
  const row = items.find((item) => item.id === id);
  return typeof row?.priceGbp === "number" ? row.priceGbp : fallback;
}

function mapPrices(payload: {postageNote?: string; items?: ApiItem[]}): LivePrices {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const heliumRow = items.find((item) => item.id === "helium-hs2");
  return {
    base: money(items, "base", FALLBACK_PRICES.base),
    heliumGbp: typeof heliumRow?.priceGbp === "number" ? heliumRow.priceGbp : null,
    postageNote: payload.postageNote || FALLBACK_PRICES.postageNote,
    extras: items
      .filter((row) => typeof row.id === "string" && row.id.startsWith("extra-") && typeof row.priceGbp === "number")
      .map((row) => ({
        id: row.id as string,
        label: row.label || "Extra",
        priceGbp: row.priceGbp as number,
      })),
    addons: {
      mouseClickTriggers: money(items, "click-triggers", FALLBACK_PRICES.addons.mouseClickTriggers),
      mouseClickFacesAndTriggers: money(items, "click-faces", FALLBACK_PRICES.addons.mouseClickFacesAndTriggers),
      bo5Shell: money(items, "shell-bo5", FALLBACK_PRICES.addons.bo5Shell),
      ghostShell: money(items, "shell-ghost", FALLBACK_PRICES.addons.ghostShell),
      softTouchShell: money(items, "shell-soft", FALLBACK_PRICES.addons.softTouchShell),
      dsePaddles: money(items, "backs-dse", FALLBACK_PRICES.addons.dsePaddles),
      bbStyleBacks: money(items, "backs-bb", FALLBACK_PRICES.addons.bbStyleBacks),
      bbExtraButton: money(items, "backs-bb-extra", FALLBACK_PRICES.addons.bbExtraButton),
      leadjoyCaps: money(items, "caps-leadjoy", FALLBACK_PRICES.addons.leadjoyCaps),
      dseCaps: money(items, "caps-dse", FALLBACK_PRICES.addons.dseCaps),
      xboxFaces: money(items, "faces-xbox", FALLBACK_PRICES.addons.xboxFaces),
    },
  };
}

let cache: LivePrices = FALLBACK_PRICES;
let fetchedAt = 0;
const TTL_MS = 30_000;

export function livePrices(): LivePrices {
  return cache;
}

export async function refreshLivePrices(): Promise<LivePrices> {
  if (Date.now() - fetchedAt < TTL_MS) return cache;
  fetchedAt = Date.now();
  const url = process.env.DROIDFIX_MENU_URL?.trim() || "https://droidfix.uk/api/droid-rollers-menu";
  try {
    const res = await fetch(url, {signal: AbortSignal.timeout(2500)});
    if (!res.ok) return cache;
    const payload = (await res.json()) as {postageNote?: string; items?: ApiItem[]};
    cache = mapPrices(payload);
    return cache;
  } catch {
    return cache;
  }
}