import {Message} from 'discord.js';
import {prisma} from './db.js';
import {buildDroidfixFaqReply, matchDroidfixFaq} from '../lib/droidfix-faq-entries.js';
import {buildFaqContext} from './droidfix-faq-context.js';

const FAQ_COOLDOWN_MS = 45_000;
const FAQ_EDIT_RETRY_MS = 120_000;

const faqCooldowns = new Map<string, number>();
const faqRepliedMessageIds = new Set<string>();

function cooldownKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function isOnCooldown(guildId: string, userId: string): boolean {
  const key = cooldownKey(guildId, userId);
  const until = faqCooldowns.get(key);

  if (!until) {
    return false;
  }

  if (Date.now() >= until) {
    faqCooldowns.delete(key);
    return false;
  }

  return true;
}

function setCooldown(guildId: string, userId: string): void {
  faqCooldowns.set(cooldownKey(guildId, userId), Date.now() + FAQ_COOLDOWN_MS);
}

function markMessageReplied(messageId: string): void {
  faqRepliedMessageIds.add(messageId);

  if (faqRepliedMessageIds.size > 500) {
    const keep = [...faqRepliedMessageIds].slice(-250);
    faqRepliedMessageIds.clear();
    for (const id of keep) {
      faqRepliedMessageIds.add(id);
    }
  }
}

export function hasFaqRepliedToMessage(messageId: string): boolean {
  return faqRepliedMessageIds.has(messageId);
}

function looksLikeQuestion(content: string): boolean {
  const trimmed = content.trim();

  if (trimmed.includes('?')) {
    return true;
  }

  const normalized = trimmed.toLowerCase();
  const questionStarts = [
    'how',
    'what',
    'which',
    'where',
    'when',
    'why',
    'do you',
    'can you',
    'will you',
    'is it',
    'are you',
    'does',
    'did',
    'anyone',
    'help',
  ];

  return questionStarts.some(prefix => normalized.startsWith(prefix));
}

function shouldAttemptFaq(message: Message): boolean {
  if (!message.guild || message.author.bot || message.system) {
    return false;
  }

  if (message.content.startsWith('/')) {
    return false;
  }

  const content = message.content.trim();

  if (content.length < 2) {
    return false;
  }

  if (message.mentions.everyone || message.mentions.roles.size > 2) {
    return false;
  }

  // Skip long rants unless they contain a question mark or common FAQ shape.
  if (content.length > 280 && !looksLikeQuestion(content)) {
    return false;
  }

  return true;
}

interface FaqReplyOptions {
  isEdit?: boolean;
}

export async function tryReplyToDroidfixFaq(message: Message, options: FaqReplyOptions = {}): Promise<boolean> {
  if (!shouldAttemptFaq(message)) {
    return false;
  }

  if (hasFaqRepliedToMessage(message.id)) {
    return false;
  }

  const setting = await prisma.setting.findUnique({where: {guildId: message.guild!.id}});

  if (!setting?.droidfixFaqChannelId || setting.droidfixFaqChannelId !== message.channel.id) {
    return false;
  }

  if (!options.isEdit && isOnCooldown(message.guild!.id, message.author.id)) {
    return false;
  }

  if (options.isEdit) {
    const ageMs = Date.now() - message.createdTimestamp;

    if (ageMs > FAQ_EDIT_RETRY_MS) {
      return false;
    }
  }

  const entry = matchDroidfixFaq(message.content);

  if (!entry) {
    return false;
  }

  const ctx = buildFaqContext(message.guild!, setting.droidfixFaqLinks);
  const reply = buildDroidfixFaqReply(entry, ctx);

  await message.reply({
    content: reply,
    allowedMentions: {repliedUser: true},
  });

  markMessageReplied(message.id);
  setCooldown(message.guild!.id, message.author.id);
  return true;
}

export async function previewDroidfixFaq(guildId: string, query: string, linksJson: string | null | undefined): Promise<string | null> {
  const entry = matchDroidfixFaq(query);

  if (!entry) {
    return null;
  }

  const {getActiveDiscordClient} = await import('./discord-client-holder.js');
  const guild = getActiveDiscordClient().guilds.cache.get(guildId);

  if (!guild) {
    return buildDroidfixFaqReply(entry, {
      guildId,
      guildName: 'this server',
      links: {},
    });
  }

  return buildDroidfixFaqReply(entry, buildFaqContext(guild, linksJson));
}
