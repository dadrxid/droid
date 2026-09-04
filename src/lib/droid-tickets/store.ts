import {mkdir, readFile, writeFile} from 'fs/promises';
import path from 'path';
import {DATA_DIR} from '../../services/config.js';

/**
 * Ticket state on disk. Portainer restarts the bot often, and the Close /
 * Open / Delete buttons must keep working afterwards, so nothing important
 * lives in memory only. Spec: DroidFix repo docs/DROID-TICKETS-SPEC.md
 */

export type TicketKind = string;
export type TicketStatus = 'open' | 'closed' | 'deleted';

export type TicketField = {
  label: string;
  value: string;
};

export type TicketRecord = {
  id: string;
  number: number;
  kind: TicketKind;
  guildId: string;
  channelId: string;
  channelName: string;
  openerId: string;
  openerTag: string;
  status: TicketStatus;
  claimedById: string;
  claimedByTag: string;
  createdAt: string;
  closedAt: string;
  closedByTag: string;
  closeReason: string;
  fields: TicketField[];
  messageCount: number;
  transcriptUrl: string;
};

export type GuildTicketSettings = {
  categoryId: string;
  staffRoleId: string;
  logChannelId: string;
  archiveCategoryId: string;
  panelChannelId: string;
  panelMessageId: string;
  panelStamp: string;
  counters: Record<string, number>;
};

type TicketState = {
  guilds: Record<string, GuildTicketSettings>;
  tickets: TicketRecord[];
};

const STATE_FILE = path.join(DATA_DIR, 'droid-tickets.json');
const KEEP_TICKETS = 500;

let state: TicketState | undefined;
let writeChain: Promise<unknown> = Promise.resolve();

function emptySettings(): GuildTicketSettings {
  return {
    categoryId: '',
    staffRoleId: '',
    logChannelId: '',
    archiveCategoryId: '',
    panelChannelId: '',
    panelMessageId: '',
    panelStamp: '',
    counters: {},
  };
}

function coerce(raw: unknown): TicketState {
  const parsed = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const guilds: Record<string, GuildTicketSettings> = {};
  const rawGuilds = parsed.guilds && typeof parsed.guilds === 'object'
    ? parsed.guilds as Record<string, unknown>
    : {};

  for (const [guildId, value] of Object.entries(rawGuilds)) {
    const entry = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const counters = entry.counters && typeof entry.counters === 'object'
      ? entry.counters as Record<string, unknown>
      : {};
    guilds[guildId] = {
      categoryId: typeof entry.categoryId === 'string' ? entry.categoryId : '',
      staffRoleId: typeof entry.staffRoleId === 'string' ? entry.staffRoleId : '',
      logChannelId: typeof entry.logChannelId === 'string' ? entry.logChannelId : '',
      archiveCategoryId: typeof entry.archiveCategoryId === 'string' ? entry.archiveCategoryId : '',
      panelChannelId: typeof entry.panelChannelId === 'string' ? entry.panelChannelId : '',
      panelMessageId: typeof entry.panelMessageId === 'string' ? entry.panelMessageId : '',
      panelStamp: typeof entry.panelStamp === 'string' ? entry.panelStamp : '',
      counters: Object.fromEntries(
        Object.entries(counters)
          .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
          .map(([key, value]) => [key, Math.max(0, Math.floor(value))]),
      ),
    };
  }

  const tickets = Array.isArray(parsed.tickets)
    ? (parsed.tickets as TicketRecord[]).filter(row => Boolean(row?.id) && Boolean(row?.channelId))
    : [];

  return {guilds, tickets};
}

async function load(): Promise<TicketState> {
  if (state) {
    return state;
  }

  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    state = coerce(JSON.parse(raw));
  } catch {
    state = {guilds: {}, tickets: []};
  }

  return state;
}

async function persist(): Promise<void> {
  const current = state;
  if (!current) {
    return;
  }

  const task = async () => {
    try {
      await mkdir(DATA_DIR, {recursive: true});
      await writeFile(STATE_FILE, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    } catch (error: unknown) {
      console.warn('Could not save ticket state:', error);
    }
  };

  writeChain = writeChain.then(task, task);
  await writeChain;
}

export async function getSettings(guildId: string): Promise<GuildTicketSettings> {
  const current = await load();
  return current.guilds[guildId] ?? emptySettings();
}

export async function listTrackedPanels(): Promise<Array<{
  guildId: string;
  channelId: string;
  messageId: string;
  stamp: string;
}>> {
  const current = await load();
  const rows: Array<{guildId: string; channelId: string; messageId: string; stamp: string}> = [];
  for (const [guildId, settings] of Object.entries(current.guilds)) {
    if (!settings.panelChannelId || !settings.panelMessageId) {
      continue;
    }

    rows.push({
      guildId,
      channelId: settings.panelChannelId,
      messageId: settings.panelMessageId,
      stamp: settings.panelStamp,
    });
  }

  return rows;
}

export type TicketSettingsPatch = {
  categoryId?: string;
  staffRoleId?: string;
  logChannelId?: string;
  archiveCategoryId?: string;
  panelChannelId?: string;
  panelMessageId?: string;
  panelStamp?: string;
};

export async function saveSettings(
  guildId: string,
  patch: TicketSettingsPatch,
): Promise<GuildTicketSettings> {
  const current = await load();
  const next = {...(current.guilds[guildId] ?? emptySettings()), ...patch};
  current.guilds[guildId] = next;
  await persist();
  return next;
}

export async function nextTicketNumber(guildId: string, kind: TicketKind): Promise<number> {
  const current = await load();
  const settings = current.guilds[guildId] ?? emptySettings();
  settings.counters[kind] = (settings.counters[kind] ?? 0) + 1;
  current.guilds[guildId] = settings;
  await persist();
  return settings.counters[kind];
}

export async function putTicket(record: TicketRecord): Promise<TicketRecord> {
  const current = await load();
  current.tickets = [record, ...current.tickets.filter(row => row.id !== record.id)]
    .slice(0, KEEP_TICKETS);
  await persist();
  return record;
}

export async function patchTicket(
  channelId: string,
  patch: Partial<TicketRecord>,
): Promise<TicketRecord | undefined> {
  const current = await load();
  const existing = current.tickets.find(row => row.channelId === channelId);
  if (!existing) {
    return undefined;
  }

  Object.assign(existing, patch);
  await persist();
  return existing;
}

export async function ticketForChannel(channelId: string): Promise<TicketRecord | undefined> {
  const current = await load();
  return current.tickets.find(row => row.channelId === channelId);
}

export async function openTicketFor(
  guildId: string,
  userId: string,
  kind: TicketKind,
): Promise<TicketRecord | undefined> {
  const current = await load();
  return current.tickets.find(row =>
    row.guildId === guildId
    && row.openerId === userId
    && row.kind === kind
    && row.status === 'open');
}

export function ticketId(kind: TicketKind, number: number): string {
  return `${kind}-${String(number).padStart(4, '0')}`;
}
