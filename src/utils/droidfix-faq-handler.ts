import {Message} from 'discord.js';
import {prisma} from './db.js';
import {buildDroidfixFaqReply, matchDroidfixFaq} from '../lib/droidfix-faq-entries.js';
import {buildFaqContext} from './droidfix-faq-context.js';

const FAQ_COOLDOWN_MS = 45_000;
const faqCooldowns = new Map<string, number>();

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

export async function tryReplyToDroidfixFaq(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || message.system) {
    return false;
  }

  if (message.content.startsWith('/')) {
    return false;
  }

  const setting = await prisma.setting.findUnique({where: {guildId: message.guild.id}});

  if (!setting?.droidfixFaqChannelId || setting.droidfixFaqChannelId !== message.channel.id) {
    return false;
  }

  if (isOnCooldown(message.guild.id, message.author.id)) {
    return false;
  }

  const entry = matchDroidfixFaq(message.content);

  if (!entry) {
    return false;
  }

  const ctx = buildFaqContext(message.guild, setting.droidfixFaqLinks);
  const reply = buildDroidfixFaqReply(entry, ctx);

  await message.reply({
    content: reply,
    allowedMentions: {repliedUser: true},
  });

  setCooldown(message.guild.id, message.author.id);
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
