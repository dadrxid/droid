import {
  CLICK_FACES,
  SHELL_SOFT_TOUCH,
  isBb,
  isGhost,
  isLeadjoyCap,
  type DroidSpec,
} from './state.js';

/** Keep in sync with DroidFix src/lib/droid-rollers-estimate.ts */
export const QUOTE_BASE_GBP = 199;

export const QUOTE_ADDONS = {
  mouseClickTriggers: 20,
  mouseClickFacesAndTriggers: 35,
  bo5Shell: 25,
  ghostShell: 35,
  softTouchShell: 15,
  dsePaddles: 20,
  bbStyleBacks: 25,
  bbExtraButton: 6,
  leadjoyCaps: 15,
  dseCaps: 10,
} as const;

export const QUOTE_DISCLAIMER =
  'Just an estimate. Andrew will confirm the total when he is active, then send a checkout link.';

export function gbp(amount: number): string {
  return `£${amount}`;
}

export function inBaseLabel(): string {
  return `in the £${QUOTE_BASE_GBP}`;
}

export function plusLabel(amount: number): string {
  return `+£${amount}`;
}

export function priced(label: string, extra: string): string {
  const text = `${label} · ${extra}`;
  return text.length <= 100 ? text : text.slice(0, 100);
}

export function isHs2(spec: DroidSpec): boolean {
  return spec.board.includes('HeliumStrike');
}

export function bbStyleAmount(countRaw: string): number {
  const count = Number.parseInt(countRaw, 10);
  const extra = Number.isFinite(count) && count > 2
    ? (count - 2) * QUOTE_ADDONS.bbExtraButton
    : 0;
  return QUOTE_ADDONS.bbStyleBacks + extra;
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
  const lines: QuoteLine[] = [
    {label: 'Base (8K, sticks, resin ABXY, OEM caps)', amount: QUOTE_BASE_GBP},
  ];
  let total = QUOTE_BASE_GBP;
  const hs2Ask = isHs2(spec);

  if (isLeadjoyCap(spec.caps)) {
    lines.push({label: spec.caps, amount: QUOTE_ADDONS.leadjoyCaps});
    total += QUOTE_ADDONS.leadjoyCaps;
  } else if (spec.caps.startsWith('DSE')) {
    lines.push({label: 'DSE-style caps', amount: QUOTE_ADDONS.dseCaps});
    total += QUOTE_ADDONS.dseCaps;
  }

  if (isGhost(spec)) {
    lines.push({label: 'ExtremeRate Ghost', amount: QUOTE_ADDONS.ghostShell});
    total += QUOTE_ADDONS.ghostShell;
  } else if (spec.shell.startsWith('BO5')) {
    lines.push({label: 'BO5 / themed shell', amount: QUOTE_ADDONS.bo5Shell});
    total += QUOTE_ADDONS.bo5Shell;
  } else if (spec.shell === SHELL_SOFT_TOUCH) {
    lines.push({label: 'Soft Touch kit', amount: QUOTE_ADDONS.softTouchShell});
    total += QUOTE_ADDONS.softTouchShell;
  }

  if (spec.backs.startsWith('DSE paddles')) {
    lines.push({label: 'DSE paddles (2)', amount: QUOTE_ADDONS.dsePaddles});
    total += QUOTE_ADDONS.dsePaddles;
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
      amount: QUOTE_ADDONS.mouseClickFacesAndTriggers,
    });
    total += QUOTE_ADDONS.mouseClickFacesAndTriggers;
  } else if (spec.click.startsWith('Triggers + bumpers')) {
    lines.push({
      label: 'Mouse click triggers + bumpers',
      amount: QUOTE_ADDONS.mouseClickTriggers,
    });
    total += QUOTE_ADDONS.mouseClickTriggers;
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
