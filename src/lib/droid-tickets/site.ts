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
