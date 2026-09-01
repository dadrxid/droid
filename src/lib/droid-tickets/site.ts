import type {TicketRecord} from './store.js';

/**
 * Pushes ticket records and transcripts to droidfix.uk so the /staff dashboard
 * has them. Every failure is swallowed: Discord must keep working when the
 * site is down, redeploying, or the token is not set yet.
 */

function siteOrigin(): string {
  const configured = process.env.DROIDFIX_SITE_URL?.trim();
  const raw = configured ? configured : 'https://droidfix.uk';
  return raw.replace(/\/+$/, '');
}

function botToken(): string {
  return process.env.DROIDFIX_BOT_TOKEN?.trim() ?? '';
}

export function siteSyncEnabled(): boolean {
  return botToken().length > 0;
}

async function post(pathname: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const token = botToken();
  if (!token) {
    return undefined;
  }

  try {
    const res = await fetch(`${siteOrigin()}${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(`DroidFix site rejected ${pathname}: ${String(res.status)}`);
      return undefined;
    }

    return await res.json() as unknown;
  } catch (error: unknown) {
    console.warn(`DroidFix site call failed (${pathname}):`, error);
    return undefined;
  }
}

/** Returns the transcript URL the site would serve for this ticket, if it answered. */
export async function pushTicket(ticket: TicketRecord): Promise<string | undefined> {
  const payload = await post('/api/bot/tickets', {
    id: ticket.id,
    number: ticket.number,
    kind: ticket.kind,
    guildId: ticket.guildId,
    channelId: ticket.channelId,
    channelName: ticket.channelName,
    openerId: ticket.openerId,
    openerTag: ticket.openerTag,
    status: ticket.status,
    claimedById: ticket.claimedById,
    claimedByTag: ticket.claimedByTag,
    createdAt: ticket.createdAt,
    closedAt: ticket.closedAt,
    closedByTag: ticket.closedByTag,
    closeReason: ticket.closeReason,
    fields: ticket.fields,
    messageCount: ticket.messageCount,
  }, 6000);

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const url = (payload as {transcriptUrl?: unknown}).transcriptUrl;
  return typeof url === 'string' ? url : undefined;
}

export type TicketSiteAttachment = {
  name: string;
  url: string;
  contentType: string;
  width: number;
  height: number;
};

export type TicketSiteMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  bot: boolean;
  createdAt: string;
  editedAt: string;
  content: string;
  attachments: TicketSiteAttachment[];
  deleted: boolean;
};

/** Live conversation mirror. The site keeps the newest 500 per ticket. */
export async function pushTicketMessages(
  ticketId: string,
  messages: TicketSiteMessage[],
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  await post('/api/bot/tickets/messages', {ticketId, messages}, 8000);
}

export async function pushTranscript(
  ticketId: string,
  html: string,
  messageCount: number,
): Promise<string | undefined> {
  const payload = await post('/api/bot/tickets/transcript', {
    id: ticketId,
    html,
    messageCount,
  }, 20_000);

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const {url} = payload as {url?: unknown};
  return typeof url === 'string' ? url : undefined;
}

async function getJson(pathname: string, timeoutMs: number): Promise<unknown> {
  const token = botToken();
  if (!token) {
    return undefined;
  }

  try {
    const res = await fetch(`${siteOrigin()}${pathname}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(`DroidFix site rejected ${pathname}: ${String(res.status)}`);
      return undefined;
    }

    return await res.json() as unknown;
  } catch (error: unknown) {
    console.warn(`DroidFix site call failed (${pathname}):`, error);
    return undefined;
  }
}

export type BotStockRow = {
  id: string;
  group: string;
  groupLabel: string;
  name: string;
  qty: number;
  unit: string;
  inbound: boolean;
  status: 'bench' | 'inbound' | 'order';
  label: string;
};

export type BotStockPayload = {
  updatedAt: string;
  items: BotStockRow[];
};

/** Staff /droid-stock. Read only. */
export async function fetchDroidStock(): Promise<BotStockPayload | undefined> {
  const payload = await getJson('/api/bot/droid-rollers-stock', 6000);
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const data = payload as {updatedAt?: unknown; items?: unknown};
  if (!Array.isArray(data.items)) {
    return undefined;
  }

  const items: BotStockRow[] = [];
  for (const row of data.items) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const item = row as Record<string, unknown>;
    const {status} = item;
    if (status !== 'bench' && status !== 'inbound' && status !== 'order') {
      continue;
    }

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!name) {
      continue;
    }

    items.push({
      id: typeof item.id === 'string' ? item.id : name,
      group: typeof item.group === 'string' ? item.group : '',
      groupLabel: typeof item.groupLabel === 'string' ? item.groupLabel : '',
      name,
      qty: typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 0,
      unit: typeof item.unit === 'string' ? item.unit : 'pcs',
      inbound: item.inbound === true,
      status,
      label: typeof item.label === 'string' ? item.label : status,
    });
  }

  return {
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    items,
  };
}

export type QuotedBuildPayload = {
  customer: string;
  ticketId: string;
  totalGbp: number;
  lines: string[];
  notes: string;
  spec: {
    build: string;
    board: string;
    sticks: string;
    caps: string;
    shell: string;
    rear: string;
    faces: string;
    backs: string;
    click: string;
    shoulders: string;
    bbCount: string;
    extras: string[];
    shellNote: string;
    facesNote: string;
  };
};

/** Custom-build submit. Quoted job on the staff desk. Never takes stock. */
export async function pushQuotedBuild(payload: QuotedBuildPayload): Promise<void> {
  await post('/api/bot/droid-rollers-orders', payload, 8000);
}

export type TicketGates = {
  customOpen: boolean;
  repairOpen: boolean;
  customClosedNote: string;
  repairClosedNote: string;
};

const DEFAULT_GATES: TicketGates = {
  customOpen: false,
  repairOpen: true,
  customClosedNote:
    'Custom builds are closed until the HeliumStrike release. Repair tickets are still open if you need a fix or an 8K board swap on a pad you already own.',
  repairClosedNote:
    'Repair tickets are closed right now. Custom builds may still be open. Try again later or ask in Discord.',
};

let cachedGates: TicketGates = DEFAULT_GATES;

function asGates(raw: unknown): TicketGates | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const data = raw as Record<string, unknown>;
  const customNote = typeof data.customClosedNote === 'string' ? data.customClosedNote.trim() : '';
  const repairNote = typeof data.repairClosedNote === 'string' ? data.repairClosedNote.trim() : '';
  return {
    customOpen: data.customOpen === true,
    repairOpen: data.repairOpen !== false,
    customClosedNote: customNote.length > 0 ? customNote : DEFAULT_GATES.customClosedNote,
    repairClosedNote: repairNote.length > 0 ? repairNote : DEFAULT_GATES.repairClosedNote,
  };
}

/** Staff desk ticket locks. Cached so Discord still works if the site blips. */
export async function fetchTicketGates(): Promise<TicketGates> {
  const payload = await getJson('/api/bot/ticket-gates', 2500);
  const next = asGates(payload);
  if (next) {
    cachedGates = next;
  }

  return cachedGates;
}

export function ticketKindOpen(kind: 'custom' | 'repair', gates: TicketGates): boolean {
  return kind === 'custom' ? gates.customOpen : gates.repairOpen;
}

export function ticketKindClosedNote(kind: 'custom' | 'repair', gates: TicketGates): string {
  return kind === 'custom' ? gates.customClosedNote : gates.repairClosedNote;
}

