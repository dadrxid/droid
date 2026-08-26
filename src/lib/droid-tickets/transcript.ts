import type {Message, TextChannel} from 'discord.js';
import type {TicketRecord} from './store.js';

/**
 * Self-hosted HTML transcript. Written by hand instead of pulling in
 * discord-html-transcripts so it stays on discord.js 14.11 and so every string
 * that ends up on droidfix.uk is escaped by us.
 */

const FETCH_PAGE = 100;
const MAX_MESSAGES = 3000;

export type TranscriptResult = {
  html: string;
  messageCount: number;
  users: string[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

function authorName(message: Message): string {
  const tag = message.author.discriminator === '0'
    ? message.author.username
    : `${message.author.username}#${message.author.discriminator}`;
  return message.author.bot ? `${tag} (bot)` : tag;
}

export function readableContent(message: Message): string {
  let {content} = message;

  for (const [id, user] of message.mentions.users) {
    content = content.replaceAll(`<@${id}>`, `@${user.username}`).replaceAll(`<@!${id}>`, `@${user.username}`);
  }

  for (const [id, role] of message.mentions.roles) {
    content = content.replaceAll(`<@&${id}>`, `@${role.name}`);
  }

  for (const [id, channel] of message.mentions.channels) {
    const name = 'name' in channel && typeof channel.name === 'string' ? channel.name : id;
    content = content.replaceAll(`<#${id}>`, `#${name}`);
  }

  return content;
}

function renderMessage(message: Message): string {
  const stamp = message.createdAt.toISOString().replace('T', ' ').slice(0, 16);
  const parts: string[] = [];
  const content = readableContent(message);

  if (content) {
    parts.push(`<div class="body">${escapeHtml(content).replaceAll('\n', '<br>')}</div>`);
  }

  for (const embed of message.embeds) {
    const rows: string[] = [];
    if (embed.title) {
      rows.push(`<div class="etitle">${escapeHtml(embed.title)}</div>`);
    }

    if (embed.description) {
      rows.push(`<div class="edesc">${escapeHtml(embed.description).replaceAll('\n', '<br>')}</div>`);
    }

    for (const field of embed.fields) {
      rows.push(
        `<div class="efield"><span>${escapeHtml(field.name)}</span>${escapeHtml(field.value).replaceAll('\n', '<br>')}</div>`,
      );
    }

    if (rows.length > 0) {
      parts.push(`<div class="embed">${rows.join('')}</div>`);
    }
  }

  for (const attachment of message.attachments.values()) {
    const url = escapeHtml(attachment.url);
    const name = escapeHtml(attachment.name);
    const isImage = (attachment.contentType ?? '').startsWith('image/');
    parts.push(
      isImage
        ? `<div class="att"><img src="${url}" alt="${name}" loading="lazy"><div class="attname">${name}</div></div>`
        : `<div class="att"><span class="attname">${name}</span></div>`,
    );
  }

  if (parts.length === 0) {
    parts.push('<div class="body muted">(no text content)</div>');
  }

  return [
    '<article class="msg">',
    `<header><span class="who">${escapeHtml(authorName(message))}</span><span class="when">${escapeHtml(stamp)}</span></header>`,
    parts.join(''),
    '</article>',
  ].join('');
}

const STYLE = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#07090d;color:#e7eaf2;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:28px 18px 64px}
h1{font-size:22px;margin:0 0 4px}
.meta{color:#9aa4b8;font-size:13px;margin:0 0 22px}
.meta b{color:#cfd6e6;font-weight:600}
.msg{border-top:1px solid rgba(255,255,255,.07);padding:14px 0}
.msg header{display:flex;gap:10px;align-items:baseline;margin-bottom:6px}
.who{font-weight:600;color:#7ec2ff}
.when{color:#78829a;font-size:12px}
.body{white-space:normal;word-wrap:break-word}
.muted{color:#78829a}
.embed{border-left:3px solid #0088ff;background:rgba(255,255,255,.04);padding:10px 12px;margin:8px 0;border-radius:6px}
.etitle{font-weight:600;margin-bottom:4px}
.edesc{color:#cfd6e6;font-size:14px}
.efield{margin-top:8px;font-size:14px;color:#cfd6e6}
.efield span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b95ab}
.att{margin:8px 0}
.att img{max-width:100%;border-radius:8px;display:block}
.attname{font-size:12px;color:#8b95ab;margin-top:4px}
.foot{margin-top:32px;color:#78829a;font-size:12px;border-top:1px solid rgba(255,255,255,.07);padding-top:14px}
`;

export async function buildTranscript(
  channel: TextChannel,
  ticket: TicketRecord,
): Promise<TranscriptResult> {
  const collected: Message[] = [];
  let before: string | undefined;

  while (collected.length < MAX_MESSAGES) {
    // eslint-disable-next-line no-await-in-loop -- Discord history is paginated
    const page = await channel.messages.fetch({
      limit: FETCH_PAGE,
      ...(before ? {before} : {}),
    });

    if (page.size === 0) {
      break;
    }

    collected.push(...page.values());
    before = page.last()?.id;

    if (page.size < FETCH_PAGE || !before) {
      break;
    }
  }

  const ordered = collected.reverse();
  const counts = new Map<string, number>();
  for (const message of ordered) {
    const name = authorName(message);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const users = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${String(count)} · ${name}`);

  const header = [
    `<h1>${escapeHtml(ticket.id)}</h1>`,
    '<p class="meta">',
    `<b>Channel</b> ${escapeHtml(ticket.channelName || channel.name)} · `,
    `<b>Opened by</b> ${escapeHtml(ticket.openerTag || 'unknown')} · `,
    `<b>Messages</b> ${String(ordered.length)}<br>`,
    `<b>Saved</b> ${escapeHtml(new Date().toISOString().replace('T', ' ').slice(0, 16))} UTC`,
    ticket.closedByTag ? ` · <b>Closed by</b> ${escapeHtml(ticket.closedByTag)}` : '',
    ticket.closeReason ? `<br><b>Reason</b> ${escapeHtml(ticket.closeReason)}` : '',
    '</p>',
  ].join('');

  const html = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex,nofollow">',
    `<title>DroidFix transcript ${escapeHtml(ticket.id)}</title>`,
    `<style>${STYLE}</style></head><body><div class="wrap">`,
    header,
    ordered.map(message => renderMessage(message)).join(''),
    '<p class="foot">DroidFix ticket transcript · droidfix.uk · attachments are hosted by Discord and may expire</p>',
    '</div></body></html>',
  ].join('');

  return {html, messageCount: ordered.length, users};
}
