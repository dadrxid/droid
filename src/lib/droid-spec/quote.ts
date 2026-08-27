import {
  buildAmount,
  defaultBoard,
  defaultBuild,
  hasItem,
  itemLabel,
  liveItem,
  livePrices,
} from './menu.js';
import {
  CLICK_FACES,
  FACES_RESIN,
  MAX_BB,
  bbCount,
  isBb,
  isGhost,
  isLeadjoyCap,
  type DroidSpec,
} from './state.js';

export const QUOTE_DISCLAIMER
  = 'This is the price. Andrew will send a checkout link in this ticket.';

export function gbp(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `£${rounded}` : `£${rounded.toFixed(2)}`;
}

export function inBaseLabel(): string {
  return 'included';
}

export function plusLabel(amount: number): string {
  return `+${gbp(amount)}`;
}

export function priced(label: string, extra: string): string {
  const text = `${label} · ${extra}`;
  return text.length <= 100 ? text : text.slice(0, 100);
}

/** Last resort prices, used when the desk sends a row with a blank price. */
function fallbackAmount(id: string): number {
  const {addons} = livePrices();
  const table: Record<string, number> = {
    'build-ps5': addons.buildPs5,
    'board-suiovoi': addons.boardSuiovoi,
    'helium-hs2': addons.boardHelium,
    'caps-dse': addons.dseCaps,
    'caps-leadjoy': addons.leadjoyCaps,
    'caps-leadjoy-n1': addons.leadjoyCaps,
    'caps-leadjoy-n2': addons.leadjoyCaps,
    'shell-soft': addons.softTouchShell,
    'shell-bo5': addons.bo5Shell,
    'shell-ghost': addons.ghostShell,
    'rear-splatter-black': addons.rearSplatter,
    'rear-splatter-white': addons.rearSplatter,
    'faces-colour': addons.colouredFaces,
    'faces-resin': addons.resinFaces,
    'faces-xbox-ps': addons.xboxFaces,
    'faces-xbox-abxy': addons.xboxFaces,
    'click-triggers': addons.mouseClickTriggers,
    'click-bumpers': addons.mouseClickBumpersAndTriggers,
    'click-faces': addons.mouseClickFacesAndTriggers,
    'backs-bb-1': addons.bb1,
    'backs-bb-2': addons.bb2,
    'backs-bb-3': addons.bb3,
    'backs-bb-4': addons.bb4,
    'backs-dse': addons.dsePaddles,
    'tension-20': addons.tension20,
    'tension-40': addons.tension40,
    'shoulders-2': addons.shoulders2,
    'shoulders-4': addons.shoulders4,
  };
  return table[id] ?? 0;
}

type QuoteLine = {label: string; amount: number; ask?: boolean};

export type QuoteResult = {
  total: number;
  boardAsk: boolean;
  lines: QuoteLine[];
  headline: string;
  embedField: string;
  pingLine: string;
};

/** A priced line for a pick, or null when the row is off, included or free. */
function lineFor(id: string, label?: string): QuoteLine | null {
  if (!id || !hasItem(id)) {
    return null;
  }

  const row = liveItem(id);
  if (row?.inBase) {
    return null;
  }

  const amount = typeof row?.priceGbp === 'number' ? row.priceGbp : fallbackAmount(id);
  if (!amount) {
    return null;
  }

  return {label: label ? label : itemLabel(id), amount};
}

function amountFor(id: string): number {
  return lineFor(id)?.amount ?? 0;
}

/** L1mit qty table: 1, 2, 3 or 4 buttons, never more. */
export function bbStyleAmount(countRaw: string): number {
  const parsed = Number.parseInt(countRaw, 10);
  const count = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), MAX_BB) : 0;
  if (count < 1) {
    return 0;
  }

  return amountFor(`backs-bb-${String(count)}`);
}

/** The build itself. Always one line, defaulting to the normal in house build. */
function buildLine(spec: DroidSpec): QuoteLine {
  const picked = spec.build && buildAmount(spec.build) > 0 ? liveItem(spec.build) : defaultBuild();
  if (!picked) {
    return {label: 'Custom build, built in house', amount: livePrices().base};
  }

  const amount = buildAmount(picked.id);
  return {label: picked.label, amount: amount > 0 ? amount : livePrices().base};
}

/** Every build needs one board. Falls back to the cheapest one still switched on. */
function boardLine(spec: DroidSpec): QuoteLine {
  const picked = spec.board && hasItem(spec.board) ? liveItem(spec.board) : defaultBoard();
  if (!picked) {
    return {label: 'Custom 8K board', amount: 0, ask: true};
  }

  if (picked.priceGbp === null) {
    return {label: picked.label, amount: 0, ask: true};
  }

  return {label: picked.label, amount: picked.inBase ? 0 : picked.priceGbp};
}

/**
 * Face mouse click only actuates through the resin buttons, and the clicky full
 * kit price already carries them, so they are not charged twice.
 */
function resolvedFaces(spec: DroidSpec): string {
  if (spec.click === CLICK_FACES && spec.faces === FACES_RESIN) {
    return '';
  }

  return spec.faces;
}

function resolvedCaps(spec: DroidSpec): string {
  if (isGhost(spec) && isLeadjoyCap(spec.caps)) {
    return '';
  }

  return spec.caps;
}

function backsLine(spec: DroidSpec): QuoteLine | null {
  if (!isBb(spec)) {
    return lineFor(spec.backs);
  }

  const count = bbCount(spec);
  const id = count > 0 ? `backs-bb-${String(count)}` : 'backs-bb-2';
  const line = lineFor(id);
  if (!line) {
    return null;
  }

  return {
    label: count > 0 ? `${line.label} · ${String(count)} fitted` : line.label,
    amount: line.amount,
  };
}

function specLines(spec: DroidSpec): Array<QuoteLine | null> {
  return [
    lineFor(spec.sticks),
    lineFor(resolvedCaps(spec)),
    lineFor(spec.shell),
    lineFor(spec.rear),
    lineFor(resolvedFaces(spec)),
    lineFor(spec.click),
    backsLine(spec),
    lineFor(spec.shoulders),
    ...spec.extras.map(id => lineFor(id)),
  ];
}

export function quoteSpec(spec: DroidSpec): QuoteResult {
  const board = boardLine(spec);
  const lines: QuoteLine[] = [buildLine(spec), board];
  for (const line of specLines(spec)) {
    if (line) {
      lines.push(line);
    }
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const headline = board.ask ? `${gbp(total)} plus the board` : gbp(total);
  const breakdown = lines
    .map((line, index) => {
      if (line.ask) {
        return `ask · ${line.label}`;
      }

      const mark = index === 0 ? gbp(line.amount) : plusLabel(line.amount);
      return `${mark} · ${line.label}`;
    })
    .join('\n');
  const boardNote = board.ask
    ? `The ${board.label} price is not set yet. Andrew will add it to the total.`
    : '';
  const embedField = [
    `**${headline}**`,
    breakdown,
    boardNote,
    QUOTE_DISCLAIMER,
  ].filter(Boolean).join('\n');

  return {
    total,
    boardAsk: Boolean(board.ask),
    lines,
    headline,
    embedField,
    pingLine: `Total: ${headline}. ${QUOTE_DISCLAIMER}`,
  };
}
