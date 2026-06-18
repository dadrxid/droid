import {GuildMember, TextChannel} from 'discord.js';
import {prisma} from './db.js';
import {generateWelcomeImage, WelcomeTheme} from './welcome-image.js';
import {buildFaqContext, mentionChannel} from './droidfix-faq-context.js';

function channelIdForTheme(
  theme: WelcomeTheme,
  setting: {
    droidlabWelcomeChannelId: string | null;
    droidfixWelcomeChannelId: string | null;
  } | null,
): string | null {
  if (!setting) {
    return null;
  }

  return theme === 'droidfix'
    ? setting.droidfixWelcomeChannelId
    : setting.droidlabWelcomeChannelId;
}

async function buildWelcomeMessage(member: GuildMember, theme: WelcomeTheme): Promise<string> {
  if (theme === 'droidlab') {
    return `Hey <@${member.id}>, you're in.`;
  }

  const setting = await prisma.setting.findUnique({where: {guildId: member.guild.id}});
  const {links} = buildFaqContext(member.guild, setting?.droidfixFaqLinks ?? null);

  const welcome = links.welcomeChannelId ? mentionChannel(links.welcomeChannelId, 'welcome') : null;
  const ask = links.askChannelId ? mentionChannel(links.askChannelId, 'ask') : null;
  const ticket = links.ticketChannelId ? mentionChannel(links.ticketChannelId, 'open-ticket') : null;

  if (welcome && ask && ticket) {
    return `<@${member.id}> Welcome to **DroidFix UK**. Start in ${welcome} · ${ask} for repair questions · ${ticket} for orders and photos.`;
  }

  if (welcome && ask) {
    return `<@${member.id}> Welcome to **DroidFix UK**. Read ${welcome} first · ${ask} if you have a repair question.`;
  }

  if (ask) {
    return `<@${member.id}> Welcome to **DroidFix UK**. ${ask} if you need help with a repair.`;
  }

  return `<@${member.id}> Welcome to **DroidFix UK**. Check the INFO HUB pins if you are new here.`;
}

export async function sendWelcome(member: GuildMember, theme: WelcomeTheme): Promise<boolean> {
  const setting = await prisma.setting.findUnique({where: {guildId: member.guild.id}});
  const welcomeChannelId = channelIdForTheme(theme, setting);

  if (!welcomeChannelId) {
    return false;
  }

  const channel = member.guild.channels.cache.get(welcomeChannelId);
  if (!channel?.isTextBased()) {
    return false;
  }

  const attachment = await generateWelcomeImage(member, theme);
  await (channel as TextChannel).send({
    content: await buildWelcomeMessage(member, theme),
    files: [attachment],
  });

  return true;
}

export async function sendConfiguredWelcomes(member: GuildMember): Promise<void> {
  const setting = await prisma.setting.findUnique({where: {guildId: member.guild.id}});

  if (setting?.droidfixWelcomeChannelId) {
    try {
      await sendWelcome(member, 'droidfix');
    } catch (error) {
      console.error('Failed to send DroidFix welcome message:', error);
    }
  }

  if (setting?.droidlabWelcomeChannelId) {
    try {
      await sendWelcome(member, 'droidlab');
    } catch (error) {
      console.error('Failed to send DroidLab welcome message:', error);
    }
  }
}
