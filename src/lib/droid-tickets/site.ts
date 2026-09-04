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

export function panelThumbnailUrl(): string {
  return `${siteOrigin()}/brand/droid-rollers/dr-3d.png`;
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

export type TicketFormField = {
  id: string;
  label: string;
  placeholder: string;
  paragraph: boolean;
  required: boolean;
  maxLength: number;
};

export type TicketPanelType = {
  id: string;
  label: string;
  buttonLabel: string;
  buttonEmoji: string;
  buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
  enabled: boolean;
  accepting: boolean;
  closedNote: string;
  prefix: string;
  formTitle: string;
  formFields: TicketFormField[];
  welcomeTitle: string;
  welcomeBody: string;
  welcomeFooter: string;
  orderBuilderEnabled: boolean;
};

export type TicketPanelLook = {
  title: string;
  description: string;
  color: string;
  thumbnailUrl: string;
  footer: string;
  imageUrl: string;
};

export type TicketPanel = {
  updatedAt: string;
  panel: TicketPanelLook;
  types: TicketPanelType[];
};

const DEFAULT_GATES: TicketGates = {
  customOpen: false,
  repairOpen: true,
  customClosedNote:
    'Custom builds are closed until the HeliumStrike release. Repair tickets are still open if you need a fix or an 8K board swap on a pad you already own.',
  repairClosedNote:
    'Repair tickets are closed right now. Custom builds may still be open. Try again later or ask in Discord.',
};

function defaultPanel(): TicketPanel {
  return {
    updatedAt: '',
    panel: {
      title: 'DroidFix tickets',
      description: 'Pick a button and fill in the short form. Your private ticket opens straight after.',
      color: '#0088ff',
      thumbnailUrl: panelThumbnailUrl(),
      footer: 'droidfix.uk · only you and the DroidFix team can see your ticket',
      imageUrl: '',
    },
    types: [
      {
        id: 'custom',
        label: 'Custom build',
        buttonLabel: 'Custom build',
        buttonEmoji: '',
        buttonStyle: 'primary',
        enabled: true,
        accepting: false,
        closedNote: DEFAULT_GATES.customClosedNote,
        prefix: 'custom',
        formTitle: 'Custom build request',
        formFields: [
          {
            id: 'country',
            label: 'Which country are you in?',
            placeholder: 'e.g. UK, Ireland, Germany',
            paragraph: false,
            required: true,
            maxLength: 60,
          },
        ],
        welcomeTitle: '',
        welcomeBody: 'Pick your parts on the build sheet below and the price updates as you go.\n\nBuilt and shipped in house · 4 to 6 weeks, sometimes sooner · UK postage included.',
        welcomeFooter: '',
        orderBuilderEnabled: true,
      },
      {
        id: 'repair',
        label: 'Repair',
        buttonLabel: 'Repair',
        buttonEmoji: '🛠️',
        buttonStyle: 'secondary',
        enabled: true,
        accepting: true,
        closedNote: DEFAULT_GATES.repairClosedNote,
        prefix: 'repair',
        formTitle: 'Repair request',
        formFields: [
          {
            id: 'model',
            label: 'Which controller is it?',
            placeholder: 'e.g. PS5 DualSense, PS4 DualShock, Scuf, Xbox',
            paragraph: false,
            required: true,
            maxLength: 100,
          },
          {
            id: 'fault',
            label: 'What is it doing? Or what do you want?',
            placeholder: 'e.g. left stick drifts, R2 not clicking, 8K board swap on a pad you already own',
            paragraph: true,
            required: true,
            maxLength: 900,
          },
          {
            id: 'tried',
            label: 'When did it start? Tried anything?',
            placeholder: 'e.g. started last month, reset and new cable',
            paragraph: true,
            required: false,
            maxLength: 500,
          },
          {
            id: 'where',
            label: 'UK postcode area for return postage',
            placeholder: 'e.g. TS1. UK mail-in only',
            paragraph: false,
            required: true,
            maxLength: 60,
          },
          {
            id: 'order',
            label: 'Order number if you have one',
            placeholder: 'From your DroidFix confirmation email',
            paragraph: false,
            required: false,
            maxLength: 60,
          },
        ],
        welcomeTitle: '',
        welcomeBody: 'Post a photo or a short clip of the fault when you can.\n\nUK mail-in only.\nAlready own a custom pad, a Scuf or another modder\'s build? An 8K board swap is welcome here.',
        welcomeFooter: '',
        orderBuilderEnabled: false,
      },
    ],
  };
}

let cachedPanel: TicketPanel = defaultPanel();
let panelFetched = false;

function asText(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, max) || fallback : fallback;
}

function asPanel(raw: unknown): TicketPanel | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const data = raw as Record<string, unknown>;
  const look = data.panel && typeof data.panel === 'object' ? data.panel as Record<string, unknown> : {};
  const incoming = Array.isArray(data.types) ? data.types : [];
  const types: TicketPanelType[] = [];
  for (const row of incoming) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const item = row as Record<string, unknown>;
    const id = asText(item.id, 21).toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,20}$/.test(id)) {
      continue;
    }

    const fieldsRaw = Array.isArray(item.formFields) ? item.formFields : [];
    const formFields: TicketFormField[] = [];
    for (const field of fieldsRaw) {
      if (!field || typeof field !== 'object') {
        continue;
      }

      const entry = field as Record<string, unknown>;
      const fieldId = asText(entry.id, 32).toLowerCase();
      const label = asText(entry.label, 45);
      if (!fieldId || !label) {
        continue;
      }

      formFields.push({
        id: fieldId,
        label,
        placeholder: asText(entry.placeholder, 100),
        paragraph: entry.paragraph === true,
        required: entry.required !== false,
        maxLength: typeof entry.maxLength === 'number' && Number.isFinite(entry.maxLength)
          ? Math.min(4000, Math.max(1, Math.floor(entry.maxLength)))
          : 100,
      });
    }

    const style = item.buttonStyle;
    types.push({
      id,
      label: asText(item.label, 80, id),
      buttonLabel: asText(item.buttonLabel, 80, asText(item.label, 80, id)),
      buttonEmoji: asText(item.buttonEmoji, 64),
      buttonStyle: style === 'secondary' || style === 'success' || style === 'danger' ? style : 'primary',
      enabled: item.enabled !== false,
      accepting: item.accepting !== false,
      closedNote: asText(item.closedNote, 400, `${asText(item.label, 80, id)} tickets are closed right now.`),
      prefix: asText(item.prefix, 16, id).toLowerCase(),
      formTitle: asText(item.formTitle, 45, `${asText(item.label, 80, id)} request`),
      formFields,
      welcomeTitle: asText(item.welcomeTitle, 256),
      welcomeBody: asText(item.welcomeBody, 2000),
      welcomeFooter: asText(item.welcomeFooter, 2048),
      orderBuilderEnabled: item.orderBuilderEnabled === true || (item.orderBuilderEnabled !== false && id === 'custom'),
    });
  }

  if (types.length === 0) {
    return undefined;
  }

  return {
    updatedAt: asText(data.updatedAt, 40),
    panel: {
      title: asText(look.title, 256, 'DroidFix tickets'),
      description: asText(look.description, 4000, defaultPanel().panel.description),
      color: asText(look.color, 16, '#0088ff'),
      thumbnailUrl: asText(look.thumbnailUrl, 500, panelThumbnailUrl()),
      footer: asText(look.footer, 2048, defaultPanel().panel.footer),
      imageUrl: asText(look.imageUrl, 500),
    },
    types: types.slice(0, 10),
  };
}

function gatesFromPanel(panel: TicketPanel): TicketGates {
  const custom = panelTypeById(panel, 'custom');
  const repair = panelTypeById(panel, 'repair');
  return {
    customOpen: Boolean(custom?.enabled && custom.accepting),
    repairOpen: repair ? Boolean(repair.enabled && repair.accepting) : true,
    customClosedNote: custom?.closedNote ? custom.closedNote : DEFAULT_GATES.customClosedNote,
    repairClosedNote: repair?.closedNote ? repair.closedNote : DEFAULT_GATES.repairClosedNote,
  };
}

/** True after at least one successful read from droidfix.uk. */
export function ticketGatesLive(): boolean {
  return panelFetched;
}

export function cachedTicketPanel(): TicketPanel {
  return cachedPanel;
}

export function panelTypeById(panel: TicketPanel, id: string): TicketPanelType | undefined {
  return panel.types.find(row => row.id === id);
}

export function enabledPanelTypes(panel: TicketPanel): TicketPanelType[] {
  return panel.types.filter(row => row.enabled);
}

/** Staff desk panel. Cached so Discord still works if the site blips. */
export async function fetchTicketPanel(): Promise<TicketPanel> {
  const payload = await getJson('/api/bot/ticket-panel', 2500);
  const next = asPanel(payload);
  if (next) {
    cachedPanel = next;
    panelFetched = true;
  }

  return cachedPanel;
}

export async function fetchTicketGates(): Promise<TicketGates> {
  const panel = await fetchTicketPanel();
  if (panelFetched) {
    return gatesFromPanel(panel);
  }

  const payload = await getJson('/api/bot/ticket-gates', 2500);
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    panelFetched = true;
    return {
      customOpen: data.customOpen === true,
      repairOpen: data.repairOpen !== false,
      customClosedNote: asText(data.customClosedNote, 400, DEFAULT_GATES.customClosedNote),
      repairClosedNote: asText(data.repairClosedNote, 400, DEFAULT_GATES.repairClosedNote),
    };
  }

  return gatesFromPanel(cachedPanel);
}

export function ticketKindOpen(kind: string, panel: TicketPanel): boolean {
  const type = panelTypeById(panel, kind);
  return Boolean(type?.enabled && type.accepting);
}

export function ticketKindClosedNote(kind: string, panel: TicketPanel): string {
  const type = panelTypeById(panel, kind);
  return type?.closedNote ? type.closedNote : 'Tickets are closed right now. Try again later or ask in Discord.';
}

export function ticketPanelStamp(panel: TicketPanel): string {
  return [
    panel.updatedAt,
    panel.panel.title,
    panel.panel.description,
    panel.panel.color,
    ...panel.types.map(row => [row.id, row.enabled ? '1' : '0', row.accepting ? '1' : '0', row.buttonLabel, row.closedNote].join(':')),
  ].join('|');
}

export function ticketGateStamp(gates: TicketGates): string {
  return [
    gates.customOpen ? '1' : '0',
    gates.repairOpen ? '1' : '0',
    gates.customClosedNote,
    gates.repairClosedNote,
  ].join('|');
}

