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

export type LiveItem = {
  id: string;
  group: string;
  label: string;
  note?: string;
  priceGbp: number | null;
  inBase: boolean;
  sortOrder: number;
};

export type LivePrices = {
  live: boolean;
  base: number;
  addons: LiveAddons;
  heliumGbp: number | null;
  extras: LiveExtra[];
  items: LiveItem[];
  postageNote: string;
};

export const FALLBACK_PRICES: LivePrices = {
  live: false,
  base: 179.99,
  heliumGbp: null,
  extras: [],
  items: [],
  postageNote: 'UK tracked postage is included on Droid Rollers customs.',
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
  group?: string;
  label?: string;
  note?: string;
  priceGbp?: number | null;
  inBase?: boolean;
  sortOrder?: number;
};

function money(items: ApiItem[], id: string, fallback: number): number {
  const row = items.find(item => item.id === id);
  if (row?.inBase) {
    return 0;
  }

  return typeof row?.priceGbp === 'number' ? row.priceGbp : fallback;
}

function mapPrices(payload: {postageNote?: string; items?: ApiItem[]}): LivePrices {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const heliumRow = items.find(item => item.id === 'helium-hs2');

  // The base row is flagged inBase, so money() would zero it like an included
  // add-on. Read its price straight off the row instead.
  const baseRow = items.find(item => item.id === 'base');
  const base = typeof baseRow?.priceGbp === 'number' && baseRow.priceGbp > 0
    ? baseRow.priceGbp
    : FALLBACK_PRICES.base;
  const mappedItems: LiveItem[] = items
    .filter((row): row is ApiItem & {id: string} => typeof row.id === 'string' && row.id.length > 0)
    .map((row, index) => ({
      id: row.id,
      group: row.group ? row.group : 'extras',
      label: row.label ? row.label : row.id,
      note: row.note,
      priceGbp: typeof row.priceGbp === 'number' ? row.priceGbp : null,
      inBase: row.inBase === true,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    live: true,
    base,
    heliumGbp: typeof heliumRow?.priceGbp === 'number' ? heliumRow.priceGbp : null,
    postageNote: payload.postageNote ? payload.postageNote : FALLBACK_PRICES.postageNote,
    extras: mappedItems
      .filter(row => row.group === 'extras' && typeof row.priceGbp === 'number')
      .map(row => ({
        id: row.id,
        label: row.label,
        priceGbp: row.priceGbp!,
      })),
    items: mappedItems,
    addons: {
      mouseClickTriggers: money(items, 'click-triggers', FALLBACK_PRICES.addons.mouseClickTriggers),
      mouseClickFacesAndTriggers: money(items, 'click-faces', FALLBACK_PRICES.addons.mouseClickFacesAndTriggers),
      bo5Shell: money(items, 'shell-bo5', FALLBACK_PRICES.addons.bo5Shell),
      ghostShell: money(items, 'shell-ghost', FALLBACK_PRICES.addons.ghostShell),
      softTouchShell: money(items, 'shell-soft', FALLBACK_PRICES.addons.softTouchShell),
      dsePaddles: money(items, 'backs-dse', FALLBACK_PRICES.addons.dsePaddles),
      bbStyleBacks: money(items, 'backs-bb', FALLBACK_PRICES.addons.bbStyleBacks),
      bbExtraButton: money(items, 'backs-bb-extra', FALLBACK_PRICES.addons.bbExtraButton),
      leadjoyCaps: money(items, 'caps-leadjoy', FALLBACK_PRICES.addons.leadjoyCaps),
      dseCaps: money(items, 'caps-dse', FALLBACK_PRICES.addons.dseCaps),
      xboxFaces: money(
        items,
        'faces-xbox-ps',
        money(items, 'faces-xbox-abxy', money(items, 'faces-xbox', FALLBACK_PRICES.addons.xboxFaces)),
      ),
    },
  };
}

let cache: LivePrices = FALLBACK_PRICES;
let inflight: Promise<LivePrices> | null = null;

export function livePrices(): LivePrices {
  return cache;
}

export function liveItem(id: string): LiveItem | undefined {
  return cache.items.find(row => row.id === id);
}

export function hasItem(id: string): boolean {
  if (!cache.live) {
    return true;
  }

  return cache.items.some(row => row.id === id);
}

export function priceTag(item: LiveItem): string {
  if (item.inBase) {
    return `in the £${String(livePrices().base)}`;
  }

  if (item.priceGbp === null) {
    return 'ask';
  }

  if (item.priceGbp === 0) {
    return '£0';
  }

  return `+£${Number.isInteger(item.priceGbp) ? String(item.priceGbp) : item.priceGbp.toFixed(2)}`;
}

export async function refreshLivePrices(): Promise<LivePrices> {
  if (inflight) {
    return inflight;
  }

  const configuredUrl = process.env.DROIDFIX_MENU_URL?.trim();
  const url = configuredUrl ? configuredUrl : 'https://droidfix.uk/api/droid-rollers-menu';
  inflight = (async () => {
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(2500)});
      if (!res.ok) {
        return cache;
      }

      const payload = (await res.json()) as {postageNote?: string; items?: ApiItem[]};
      cache = mapPrices(payload);
      return cache;
    } catch {
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
