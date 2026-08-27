export type LiveAddons = {
  buildPs5: number;
  boardSuiovoi: number;
  boardHelium: number;
  mouseClickTriggers: number;
  mouseClickBumpersAndTriggers: number;
  mouseClickFacesAndTriggers: number;
  bo5Shell: number;
  ghostShell: number;
  softTouchShell: number;
  rearSplatter: number;
  dsePaddles: number;
  bb1: number;
  bb2: number;
  bb3: number;
  bb4: number;
  leadjoyCaps: number;
  dseCaps: number;
  colouredFaces: number;
  resinFaces: number;
  xboxFaces: number;
  tension20: number;
  tension40: number;
  shoulders2: number;
  shoulders4: number;
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
  extras: LiveExtra[];
  items: LiveItem[];
  postageNote: string;
  sheetTitle: string;
  sheetBlurb: string;
  sheetFooter: string;
  updatedAt: string;
};

export const BUILD_GROUP = 'base';

/** Staff price sheet row for repair tickets. Never a build sheet option. */
export const BOARD_SWAP_ID = 'service-board-swap';

const DEFAULT_ADDONS: LiveAddons = {
  buildPs5: 69.99,
  boardSuiovoi: 76.99,
  boardHelium: 94.99,
  mouseClickTriggers: 17.99,
  mouseClickBumpersAndTriggers: 28.99,
  mouseClickFacesAndTriggers: 36.99,
  bo5Shell: 21.99,
  ghostShell: 29.99,
  softTouchShell: 10.99,
  rearSplatter: 14.99,
  dsePaddles: 25.99,
  bb1: 14.99,
  bb2: 18.99,
  bb3: 21.99,
  bb4: 29.99,
  leadjoyCaps: 14.99,
  dseCaps: 9.99,
  colouredFaces: 6.99,
  resinFaces: 3.99,
  xboxFaces: 4.99,
  tension20: 6.99,
  tension40: 6.99,
  shoulders2: 14.99,
  shoulders4: 17.99,
};

/**
 * Offline catalogue. Rows Andrew keeps switched off on the price desk (PS5
 * builds, splatter rear, stick tension) are left out, so an unreachable API can
 * never sell something he is not doing yet. They appear on their own once the
 * desk switches them on, no code change needed.
 */
const DEFAULT_ITEMS: LiveItem[] = [
  {
    id: 'base',
    group: BUILD_GROUP,
    label: 'PS4 / DS4 custom build base (board required)',
    priceGbp: 58.99,
    inBase: true,
    sortOrder: 10,
  },
  {id: 'board-suiovoi', group: 'boards', label: 'SuiOvOi 8K', priceGbp: 76.99, inBase: false, sortOrder: 40},
  {id: 'helium-hs2', group: 'boards', label: 'HeliumStrike HS2', priceGbp: 94.99, inBase: false, sortOrder: 50},
  {id: 'sticks-ginfull', group: 'sticks', label: 'Ginfull RS13 V3', priceGbp: 0, inBase: true, sortOrder: 80},
  {id: 'sticks-ksilver', group: 'sticks', label: 'K-Silver JS13 Pro+', priceGbp: 0, inBase: true, sortOrder: 90},
  {id: 'caps-oem', group: 'caps', label: 'OEM caps', priceGbp: 0, inBase: true, sortOrder: 100},
  {id: 'caps-dse', group: 'caps', label: 'DSE style caps', priceGbp: 9.99, inBase: false, sortOrder: 110},
  {
    id: 'caps-leadjoy-n1',
    group: 'caps',
    label: 'Leadjoy Magic Cap NO.1',
    note: 'Leadjoy Magic NO.1 stick cap. Does not fit the Ghost shell.',
    priceGbp: 14.99,
    inBase: false,
    sortOrder: 120,
  },
  {
    id: 'caps-leadjoy-n2',
    group: 'caps',
    label: 'Leadjoy Magic Cap NO.2',
    note: 'Leadjoy Magic NO.2 stick cap. Does not fit the Ghost shell.',
    priceGbp: 14.99,
    inBase: false,
    sortOrder: 121,
  },
  {id: 'shell-oem', group: 'shell', label: 'OEM black', priceGbp: 0, inBase: true, sortOrder: 130},
  {id: 'shell-soft', group: 'shell', label: 'Premium soft touch', priceGbp: 10.99, inBase: false, sortOrder: 140},
  {id: 'shell-bo5', group: 'shell', label: 'BO5 or themed shell', priceGbp: 21.99, inBase: false, sortOrder: 150},
  {id: 'shell-ghost', group: 'shell', label: 'ExtremeRate Ghost', priceGbp: 29.99, inBase: false, sortOrder: 160},
  {id: 'rear-oem', group: 'rear', label: 'OEM black', priceGbp: 0, inBase: true, sortOrder: 170},
  {id: 'rear-splatter-black', group: 'rear', label: 'Splatter grip black', priceGbp: 14.99, inBase: false, sortOrder: 180},
  {id: 'rear-splatter-white', group: 'rear', label: 'Splatter grip white', priceGbp: 14.99, inBase: false, sortOrder: 190},
  {id: 'faces-stock', group: 'faces', label: 'OEM black', priceGbp: 0, inBase: true, sortOrder: 200},
  {id: 'faces-colour', group: 'faces', label: 'Coloured buttons', priceGbp: 6.99, inBase: false, sortOrder: 210},
  {
    id: 'faces-resin',
    group: 'faces',
    label: 'Droid Roller Buttons',
    note: 'Resin printed for mouse click face kits. No PlayStation icons. Included with the clicky full kit.',
    priceGbp: 3.99,
    inBase: false,
    sortOrder: 220,
  },
  {
    id: 'faces-xbox-ps',
    group: 'faces',
    label: 'Xbox shape, PlayStation icons',
    priceGbp: 4.99,
    inBase: false,
    sortOrder: 230,
  },
  {id: 'faces-xbox-abxy', group: 'faces', label: 'Xbox shape, Xbox icons', priceGbp: 4.99, inBase: false, sortOrder: 240},
  {id: 'click-none', group: 'click', label: 'OEM buttons', priceGbp: 0, inBase: true, sortOrder: 250},
  {id: 'click-triggers', group: 'click', label: 'Clicky triggers', priceGbp: 17.99, inBase: false, sortOrder: 260},
  {
    id: 'click-bumpers',
    group: 'click',
    label: 'Clicky bumpers and triggers',
    priceGbp: 28.99,
    inBase: false,
    sortOrder: 270,
  },
  {id: 'click-faces', group: 'click', label: 'Clicky full kit', priceGbp: 36.99, inBase: false, sortOrder: 280},
  {id: 'backs-none', group: 'backs', label: 'No back buttons', priceGbp: 0, inBase: false, sortOrder: 290},
  {id: 'backs-bb-1', group: 'backs', label: '1 tactile Battle Beaver style', priceGbp: 14.99, inBase: false, sortOrder: 300},
  {id: 'backs-bb-2', group: 'backs', label: '2 tactile Battle Beaver style', priceGbp: 18.99, inBase: false, sortOrder: 310},
  {id: 'backs-bb-3', group: 'backs', label: '3 tactile Battle Beaver style', priceGbp: 21.99, inBase: false, sortOrder: 320},
  {id: 'backs-bb-4', group: 'backs', label: '4 tactile Battle Beaver style', priceGbp: 29.99, inBase: false, sortOrder: 330},
  {id: 'backs-dse', group: 'backs', label: 'DSE buttons or domes', priceGbp: 25.99, inBase: false, sortOrder: 340},
  {
    id: 'shoulders-2',
    group: 'shoulders',
    label: '2 shoulder buttons (mouse click)',
    priceGbp: 14.99,
    inBase: false,
    sortOrder: 360,
  },
  {
    id: 'shoulders-4',
    group: 'shoulders',
    label: '4 shoulder buttons (mouse click)',
    priceGbp: 17.99,
    inBase: false,
    sortOrder: 370,
  },
];

export const DEFAULT_SHEET_TITLE = 'Droid Rollers build sheet';
export const DEFAULT_SHEET_BLURB
  = 'Custom 8K pads from {from}. Tap below and pick your parts.\nAndrew supplies the pad, builds it, tests it and posts it out. Nothing to send in.\nOnly you see the sheet until you submit. The price updates as you go.\nAt the end you can add photos of shells, buttons and extras with the photo buttons.';
export const DEFAULT_SHEET_FOOTER = '8K custom boards only · prices as shown · UK tracked postage included';

export const FALLBACK_PRICES: LivePrices = {
  live: false,
  base: 58.99,
  extras: [],
  items: DEFAULT_ITEMS,
  postageNote: 'UK tracked postage is included on Droid Rollers customs.',
  sheetTitle: DEFAULT_SHEET_TITLE,
  sheetBlurb: DEFAULT_SHEET_BLURB,
  sheetFooter: DEFAULT_SHEET_FOOTER,
  updatedAt: '',
  addons: DEFAULT_ADDONS,
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

function mapAddons(items: ApiItem[]): LiveAddons {
  const {addons} = FALLBACK_PRICES;
  return {
    buildPs5: money(items, 'build-ps5', addons.buildPs5),
    boardSuiovoi: money(items, 'board-suiovoi', addons.boardSuiovoi),
    boardHelium: money(items, 'helium-hs2', addons.boardHelium),
    mouseClickTriggers: money(items, 'click-triggers', addons.mouseClickTriggers),
    mouseClickBumpersAndTriggers: money(items, 'click-bumpers', addons.mouseClickBumpersAndTriggers),
    mouseClickFacesAndTriggers: money(items, 'click-faces', addons.mouseClickFacesAndTriggers),
    bo5Shell: money(items, 'shell-bo5', addons.bo5Shell),
    ghostShell: money(items, 'shell-ghost', addons.ghostShell),
    softTouchShell: money(items, 'shell-soft', addons.softTouchShell),
    rearSplatter: money(items, 'rear-splatter-black', money(items, 'rear-splatter-white', addons.rearSplatter)),
    dsePaddles: money(items, 'backs-dse', addons.dsePaddles),
    bb1: money(items, 'backs-bb-1', addons.bb1),
    bb2: money(items, 'backs-bb-2', addons.bb2),
    bb3: money(items, 'backs-bb-3', addons.bb3),
    bb4: money(items, 'backs-bb-4', addons.bb4),
    leadjoyCaps: money(items, 'caps-leadjoy-n1', money(items, 'caps-leadjoy-n2', money(items, 'caps-leadjoy', addons.leadjoyCaps))),
    dseCaps: money(items, 'caps-dse', addons.dseCaps),
    colouredFaces: money(items, 'faces-colour', addons.colouredFaces),
    resinFaces: money(items, 'faces-resin', addons.resinFaces),
    xboxFaces: money(
      items,
      'faces-xbox-ps',
      money(items, 'faces-xbox-abxy', money(items, 'faces-xbox', addons.xboxFaces)),
    ),
    tension20: money(items, 'tension-20', addons.tension20),
    tension40: money(items, 'tension-40', addons.tension40),
    shoulders2: money(items, 'shoulders-2', addons.shoulders2),
    shoulders4: money(items, 'shoulders-4', addons.shoulders4),
  };
}

function mapPrices(payload: {
  postageNote?: string;
  sheetTitle?: string;
  sheetBlurb?: string;
  sheetFooter?: string;
  updatedAt?: string;
  items?: ApiItem[];
}): LivePrices {
  const items = Array.isArray(payload.items) ? payload.items : [];

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

  // An empty payload would leave every select with nothing to show.
  if (mappedItems.length === 0) {
    return FALLBACK_PRICES;
  }

  return {
    live: true,
    base,
    postageNote: payload.postageNote ? payload.postageNote : FALLBACK_PRICES.postageNote,
    sheetTitle: payload.sheetTitle?.trim() ? payload.sheetTitle.trim() : FALLBACK_PRICES.sheetTitle,
    sheetBlurb: payload.sheetBlurb?.trim() ? payload.sheetBlurb.trim() : FALLBACK_PRICES.sheetBlurb,
    sheetFooter: payload.sheetFooter?.trim() ? payload.sheetFooter.trim() : FALLBACK_PRICES.sheetFooter,
    updatedAt: payload.updatedAt ? payload.updatedAt : '',
    extras: mappedItems
      .filter(row => row.group === 'extras' && typeof row.priceGbp === 'number')
      .map(row => ({
        id: row.id,
        label: row.label,
        priceGbp: row.priceGbp!,
      })),
    items: mappedItems,
    addons: mapAddons(items),
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
  return cache.items.some(row => row.id === id);
}

export function itemLabel(id: string): string {
  if (!id) {
    return '';
  }

  return liveItem(id)?.label ?? id;
}

export function liveGroup(group: string): LiveItem[] {
  return [...cache.items]
    .filter(row => row.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Build types the sheet can sell. Custom builds are in house only, so the board
 * swap row is dropped: it is a repair ticket price, quoted by hand.
 */
export function buildItems(): LiveItem[] {
  return liveGroup(BUILD_GROUP).filter(row => row.id !== BOARD_SWAP_ID);
}

/** The normal path. Falls back to whatever build row the desk has left switched on. */
export function defaultBuild(): LiveItem | undefined {
  const builds = buildItems();
  return builds.find(row => row.id === 'base') ?? builds[0];
}

/** Build rows carry the starting price, so inBase does not zero them. */
export function buildAmount(id: string): number {
  const row = liveItem(id);
  if (!row || row.group !== BUILD_GROUP || row.id === BOARD_SWAP_ID) {
    return 0;
  }

  return typeof row.priceGbp === 'number' ? row.priceGbp : 0;
}

/** Cheapest board still switched on. Used when the customer has not picked one. */
export function defaultBoard(): LiveItem | undefined {
  const boards = liveGroup('boards');
  const priced = boards.filter(row => typeof row.priceGbp === 'number');
  if (priced.length === 0) {
    return boards[0];
  }

  return priced.reduce((cheapest, row) => (row.priceGbp! < cheapest.priceGbp! ? row : cheapest));
}

export function priceTag(item: LiveItem): string {
  if (item.inBase) {
    return 'included';
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

      const payload = (await res.json()) as {
        postageNote?: string;
        sheetTitle?: string;
        sheetBlurb?: string;
        sheetFooter?: string;
        updatedAt?: string;
        items?: ApiItem[];
      };
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
