import {livePrices} from './menu.js';
import {
  CLICK_FACES,
  FACE_XBOX_MEMBRANE,
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

export const QUOTE_DISCLAIMER =
  'Just an estimate. Andrew will confirm the total when he is active, then send a checkout link.';

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
  const addons = livePrices().addons;
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
  const addons = prices.addons;
  const lines: QuoteLine[] = [
    {label: 'Base (8K, sticks, resin ABXY, OEM caps)', amount: prices.base},
  ];
  let total = prices.base;
  let hs2Ask = isHs2(spec);

  if (spec.faces === FACE_XBOX_MEMBRANE) {
    lines.push({label: 'Xbox-style buttons', amount: addons.xboxFaces});
    total += addons.xboxFaces;
  }

  if (isLeadjoyCap(spec.caps)) {
    lines.push({label: spec.caps, amount: addons.leadjoyCaps});
    total += addons.leadjoyCaps;
  } else if (spec.caps.startsWith('DSE')) {
    lines.push({label: 'DSE-style caps', amount: addons.dseCaps});
    total += addons.dseCaps;
  }

  if (isGhost(spec)) {
    lines.push({label: 'ExtremeRate Ghost', amount: addons.ghostShell});
    total += addons.ghostShell;
  } else if (spec.shell.startsWith('BO5')) {
    lines.push({label: 'BO5 / themed shell', amount: addons.bo5Shell});
    total += addons.bo5Shell;
  } else if (spec.shell === SHELL_SOFT_TOUCH) {
    lines.push({label: 'Soft Touch shell', amount: addons.softTouchShell});
    total += addons.softTouchShell;
  }

  if (spec.backs.startsWith('DSE paddles')) {
    lines.push({label: 'DSE paddles (2)', amount: addons.dsePaddles});
    total += addons.dsePaddles;
  } else if (isBb(spec)) {
    const amount = bbStyleAmount(spec.bbCount);
    const count = Number.parseInt(spec.bbCount, 10);
    const label = Number.isFinite(count) && count > 0
      ? `Battle Beaver style (${String(count)})`
      : 'Battle Beaver style';
    lines.push({label, amount});
    total += amount;
  }

  if (spec.click === CLICK_FACES) {
    lines.push({
      label: 'Mouse click faces + triggers',
      amount: addons.mouseClickFacesAndTriggers,
    });
    total += addons.mouseClickFacesAndTriggers;
  } else if (spec.click.startsWith('Triggers + bumpers')) {
    lines.push({
      label: 'Mouse click triggers + bumpers',
      amount: addons.mouseClickTriggers,
    });
    total += addons.mouseClickTriggers;
  }

  for (const extra of prices.extras) {
    if (spec.extras.includes(extra.id)) {
      lines.push({label: extra.label, amount: extra.priceGbp});
      total += extra.priceGbp;
    }
  }

  if (hs2Ask && prices.heliumGbp != null) {
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
