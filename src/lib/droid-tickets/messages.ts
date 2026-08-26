import type {Message, PartialMessage} from 'discord.js';
import {ticketForChannel} from './store.js';
import {pushTicketMessages, type TicketSiteAttachment, type TicketSiteMessage} from './site.js';
import {readableContent} from './transcript.js';

/**
 * Mirrors ticket-channel messages to droidfix.uk as they are posted, so the
 * /staff dashboard reads the conversation live and a record exists even if the
 * bot dies before the ticket is closed. Every failure is swallowed: Discord
 * must keep working when the site is down.
 */

const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 50;
const MAX_ATTACHMENTS = 10;

const pending = new Map<string, TicketSiteMessage[]>();
let flushTimer: NodeJS.Timeout | undefined;

async function flush(): Promise<void> {
  const batches = [...pending.entries()];
  pending.clear();

  for (const [ticketId, rows] of batches) {
    // eslint-disable-next-line no-await-in-loop -- keep the site calls serial
    await pushTicketMessages(ticketId, rows);
  }
}

function scheduleFlush(): void {
  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flush().catch((error: unknown) => {
      console.warn('DroidFix ticket message flush failed:', error);
    });
  }, FLUSH_DELAY_MS);

  flushTimer.unref();
}

function enqueue(ticketId: string, row: TicketSiteMessage): void {
  const rows = (pending.get(ticketId) ?? []).filter(held => held.id !== row.id);
  rows.push(row);
  // A burst bigger than one batch drops the oldest rows here. The close-time
  // transcript still captures the full history.
  pending.set(ticketId, rows.slice(-MAX_BATCH));
  scheduleFlush();
}

function displayName(message: Message): string {
  const nickname = message.member?.displayName;
  return nickname ? nickname : message.author.username;
}

function attachments(message: Message): TicketSiteAttachment[] {
  return [...message.attachments.values()].slice(0, MAX_ATTACHMENTS).map(attachment => ({
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType ?? '',
    width: attachment.width ?? 0,
    height: attachment.height ?? 0,
  }));
}

/** Bot posts in a ticket are mostly embeds, so flatten them or they arrive blank. */
function embedText(message: Message): string {
  const lines: string[] = [];

  for (const embed of message.embeds) {
    if (embed.title) {
      lines.push(embed.title);
    }

    if (embed.description) {
      lines.push(embed.description);
    }

    for (const field of embed.fields) {
      lines.push(`${field.name}: ${field.value}`);
    }
  }

  return lines.join('\n');
}

function toSiteMessage(message: Message): TicketSiteMessage {
  return {
    id: message.id,
    authorId: message.author.id,
    authorName: displayName(message),
    authorAvatar: message.author.displayAvatarURL({size: 64, extension: 'png'}),
    bot: message.author.bot,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : '',
    content: readableContent(message) || embedText(message),
    attachments: attachments(message),
    deleted: false,
  };
}

async function ticketIdForChannel(channelId: string): Promise<string | undefined> {
  const ticket = await ticketForChannel(channelId);
  if (!ticket || ticket.status === 'deleted') {
    return undefined;
  }

  return ticket.id;
}

/** Also used for edits: the site replaces a message when the id comes back. */
export async function captureTicketMessage(message: Message): Promise<void> {
  try {
    if (!message.guildId || message.system) {
      return;
    }

    const ticketId = await ticketIdForChannel(message.channelId);
    if (!ticketId) {
      return;
    }

    enqueue(ticketId, toSiteMessage(message));
  } catch (error: unknown) {
    console.warn('Could not queue a ticket message for DroidFix:', error);
  }
}

export async function captureTicketMessageDelete(message: Message | PartialMessage): Promise<void> {
  try {
    const ticketId = await ticketIdForChannel(message.channelId);
    if (!ticketId) {
      return;
    }

    enqueue(ticketId, {
      id: message.id,
      authorId: '',
      authorName: '',
      authorAvatar: '',
      bot: false,
      createdAt: new Date(message.createdTimestamp).toISOString(),
      editedAt: '',
      content: '',
      attachments: [],
      deleted: true,
    });
  } catch (error: unknown) {
    console.warn('Could not queue a ticket message delete for DroidFix:', error);
  }
}
