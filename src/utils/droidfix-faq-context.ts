import {Guild, GuildBasedChannel} from 'discord.js';

export interface DroidfixFaqLinks {
  askChannelId?: string;
  ticketChannelId?: string;
  mailInChannelId?: string;
  welcomeChannelId?: string;
}

const CHANNEL_PATTERNS: Record<keyof DroidfixFaqLinks, RegExp[]> = {
  askChannelId: [/ask/i, /ᴀꜱᴋ/i],
  ticketChannelId: [/open-ticket/i, /open.ticket/i, /ᴏᴘᴇɴ-ᴛɪᴄᴋᴇᴛ/i, /ticket-info/i, /ᴛɪᴄᴋᴇᴛ/i],
  mailInChannelId: [/mail-in/i, /mail.in/i, /ᴍᴀɪʟ-ɪɴ/i, /mailin/i],
  welcomeChannelId: [/welcome/i, /ᴡᴇʟᴄᴏᴍᴇ/i],
};

function isTextChannel(channel: GuildBasedChannel): channel is GuildBasedChannel & {isTextBased(): true} {
  return channel.isTextBased();
}

export function scanDroidfixFaqLinks(guild: Guild): DroidfixFaqLinks {
  const textChannels = [...guild.channels.cache.values()].filter(isTextChannel);
  const links: DroidfixFaqLinks = {};

  const openTicket = textChannels.find(ch => /open-ticket|ᴏᴘᴇɴ-ᴛɪᴄᴋᴇᴛ/i.test(ch.name));
  if (openTicket) {
    links.ticketChannelId = openTicket.id;
  } else {
    const ticket = textChannels.find(ch => /ticket/i.test(ch.name) && !/info/i.test(ch.name));
    if (ticket) {
      links.ticketChannelId = ticket.id;
    }
  }

  for (const channel of textChannels) {
    const name = channel.name;

    if (!links.askChannelId && CHANNEL_PATTERNS.askChannelId.some(pattern => pattern.test(name))) {
      links.askChannelId = channel.id;
    }

    if (!links.mailInChannelId && CHANNEL_PATTERNS.mailInChannelId.some(pattern => pattern.test(name))) {
      links.mailInChannelId = channel.id;
    }

    if (!links.welcomeChannelId && CHANNEL_PATTERNS.welcomeChannelId.some(pattern => pattern.test(name))) {
      links.welcomeChannelId = channel.id;
    }
  }

  return links;
}

export function parseDroidfixFaqLinks(raw: string | null | undefined): DroidfixFaqLinks {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as DroidfixFaqLinks;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function serializeDroidfixFaqLinks(links: DroidfixFaqLinks): string {
  return JSON.stringify(links);
}

export interface DroidfixFaqContext {
  guildId: string;
  guildName: string;
  links: DroidfixFaqLinks;
}

export function mentionChannel(channelId: string | undefined, label: string): string {
  return channelId ? `<#${channelId}>` : label;
}

export function buildFaqContext(guild: Guild, linksJson: string | null | undefined): DroidfixFaqContext {
  const scanned = scanDroidfixFaqLinks(guild);
  const stored = parseDroidfixFaqLinks(linksJson);

  return {
    guildId: guild.id,
    guildName: guild.name,
    links: {
      askChannelId: stored.askChannelId ?? scanned.askChannelId,
      ticketChannelId: stored.ticketChannelId ?? scanned.ticketChannelId,
      mailInChannelId: stored.mailInChannelId ?? scanned.mailInChannelId,
      welcomeChannelId: stored.welcomeChannelId ?? scanned.welcomeChannelId,
    },
  };
}
