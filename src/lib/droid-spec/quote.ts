import {hasItem, liveItem, livePrices} from './menu.js';
import {
  CLICK_FACES,
  FACE_XBOX_ABXY,
  FACE_XBOX_MEMBRANE,
  FACE_XBOX_PS,
  SHELL_SOFT_TOUCH,
  isBb,
  isGhost,
  isLeadjoyCap,
  type DroidSpec,
} from './state.js';

/** Keep in sync with DroidFix src/lib/droid-rollers-estimate.ts */
export const QUOTE_BASE_GBP = 179.99;

export const QUOTE_ADDONS = {
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
} as const;

export const QUOTE_DISCLAIMER
  = 'Just an estimate. Andrew will confirm the total when he is active, then send a checkout link.';

export function gbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `£${rounded}` : `£${rounded.toFixed(2)}`;
}

export function inBaseLabel(): string {
  return `in the ${gbp(livePrices().base)}`;
}

export function plusLabel(amount: number): string {
  return `+${gbp(amount)}`;
}

export function priced(label: string, extra: string): string {
  const text = `${label} · ${extra}`;
  return text.length <= 100 ? text : text.slice(0, 100);
}

export function isHs2(spec: DroidSpec): boolean {
  return spec.board.includes('HeliumStrike');
}

export function bbStyleAmount(countRaw: string): number {
  const {addons} = livePrices();
  const count = Number.parseInt(countRaw, 10);
  const extra = Number.isFinite(count) && count > 2
    ? (count - 2) * addons.bbExtraButton
    : 0;
  return addons.bbStyleBacks + extra;
}

type QuoteLine = {label: string; amount: number};

export type QuoteResult = {
  total: number;
  hs2Ask: boolean;
  lines: QuoteLine[];
  headline: string;
  embedField: string;
  pingLine: string;
};

export function quoteSpec(spec: DroidSpec): QuoteResult {
  const prices = livePrices();
  const {addons} = prices;
  const lines: QuoteLine[] = [
    {label: 'Base (8K, sticks, resin PlayStation buttons, OEM caps)', amount: prices.base},
  ];
  let total = prices.base;
  let hs2Ask = isHs2(spec);

  if (spec.faces === FACE_XBOX_PS || spec.faces === FACE_XBOX_ABXY || spec.faces === FACE_XBOX_MEMBRANE || spec.faces === 'faces-xbox-ps' || spec.faces === 'faces-xbox-abxy') {
    const faceId = spec.faces === FACE_XBOX_ABXY || spec.faces === 'faces-xbox-abxy' ? 'faces-xbox-abxy' : 'faces-xbox-ps';
    if (hasItem(faceId)) {
      const row = liveItem(faceId);
      const amount = row?.inBase ? 0 : (row?.priceGbp ?? addons.xboxFaces);
      if (amount) {
        const fallbackLabel = faceId === 'faces-xbox-abxy'
          ? 'Xbox-shaped buttons with Xbox icons (ABXY)'
          : 'Xbox-shaped buttons with PlayStation icons';
        const faceLabel = row?.label ? row.label : fallbackLabel;
        lines.push({label: faceLabel, amount});
        total += amount;
      }
    }
  }

  function extraFor(id: string, fallback: number): number {
    if (!hasItem(id)) {
      return 0;
    }

    const row = liveItem(id);
    if (row?.inBase) {
      return 0;
    }

    return typeof row?.priceGbp === 'number' ? row.priceGbp : fallback;
  }

  if (isLeadjoyCap(spec.caps)) {
    const amount = extraFor('caps-leadjoy', addons.leadjoyCaps);
    if (amount) {
      lines.push({label: spec.caps, amount});
      total += amount;
    }
  } else if (spec.caps.startsWith('DSE') || spec.caps === 'caps-dse') {
    const amount = extraFor('caps-dse', addons.dseCaps);
    if (amount) {
      lines.push({label: 'DSE-style caps', amount});
      total += amount;
    }
  }

  if (isGhost(spec)) {
    const amount = extraFor('shell-ghost', addons.ghostShell);
    if (amount) {
      lines.push({label: 'ExtremeRate Ghost', amount});
      total += amount;
    }
  } else if (spec.shell.startsWith('BO5') || spec.shell === 'shell-bo5') {
    const amount = extraFor('shell-bo5', addons.bo5Shell);
    if (amount) {
      lines.push({label: 'BO5 / themed shell', amount});
      total += amount;
    }
  } else if (spec.shell === SHELL_SOFT_TOUCH || spec.shell === 'shell-soft') {
    const amount = extraFor('shell-soft', addons.softTouchShell);
    if (amount) {
      lines.push({label: 'Soft Touch shell', amount});
      total += amount;
    }
  }

  if (spec.backs.startsWith('DSE paddles') || spec.backs === 'backs-dse') {
    const amount = extraFor('backs-dse', addons.dsePaddles);
    if (amount) {
      lines.push({label: 'DSE paddles (2)', amount});
      total += amount;
    }
  } else if (isBb(spec)) {
    const amount = extraFor('backs-bb', addons.bbStyleBacks)
      + (Number.parseInt(spec.bbCount, 10) > 2
        ? (Number.parseInt(spec.bbCount, 10) - 2) * extraFor('backs-bb-extra', addons.bbExtraButton)
        : 0);
    const count = Number.parseInt(spec.bbCount, 10);
    const label = Number.isFinite(count) && count > 0
      ? `Battle Beaver style (${String(count)})`
      : 'Battle Beaver style';
    if (amount) {
      lines.push({label, amount});
      total += amount;
    }
  }

  if (spec.click === CLICK_FACES || spec.click === 'click-faces') {
    const amount = extraFor('click-faces', addons.mouseClickFacesAndTriggers);
    if (amount) {
      lines.push({label: 'Mouse click faces + triggers', amount});
      total += amount;
    }
  } else if (spec.click.startsWith('Triggers + bumpers') || spec.click === 'click-triggers') {
    const amount = extraFor('click-triggers', addons.mouseClickTriggers);
    if (amount) {
      lines.push({label: 'Mouse click triggers + bumpers', amount});
      total += amount;
    }
  }

  const customPicks = new Set([
    spec.board,
    spec.sticks,
    spec.caps,
    spec.shell,
    spec.faces,
    spec.backs,
    spec.click,
  ]);
  for (const id of customPicks) {
    if (!id.startsWith('extra-')) {
      continue;
    }

    const row = liveItem(id);
    if (!row || row.inBase || row.priceGbp === null || row.priceGbp === 0) {
      continue;
    }

    lines.push({label: row.label, amount: row.priceGbp});
    total += row.priceGbp;
  }

  for (const extra of prices.extras) {
    if (spec.extras.includes(extra.id)) {
      lines.push({label: extra.label, amount: extra.priceGbp});
      total += extra.priceGbp;
    }
  }

  if (hs2Ask && prices.heliumGbp !== null) {
    lines.push({label: 'HeliumStrike HS2 extra', amount: prices.heliumGbp});
    total += prices.heliumGbp;
    hs2Ask = false;
  }

  const headline = hs2Ask ? `${gbp(total)} + HS2 board extra` : gbp(total);
  const breakdown = lines
    .map((line, index) => {
      const mark = index === 0 ? gbp(line.amount) : plusLabel(line.amount);
      return `${mark} · ${line.label}`;
    })
    .join('\n');
  const hs2Note = hs2Ask
    ? 'HeliumStrike HS2 board extra is not in this number yet. Andrew will add it.'
    : '';
  const embedField = [
    `**${headline}**`,
    breakdown,
    hs2Note,
    QUOTE_DISCLAIMER,
  ].filter(Boolean).join('\n');

  return {
    total,
    hs2Ask,
    lines,
    headline,
    embedField,
    pingLine: `Estimate: ${headline}. ${QUOTE_DISCLAIMER}`,
  };
}
