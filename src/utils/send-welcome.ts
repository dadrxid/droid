import {GuildMember, TextChannel} from 'discord.js';
import {prisma} from './db.js';
import {generateWelcomeImage, WelcomeTheme} from './welcome-image.js';

function channelIdForTheme(
  theme: WelcomeTheme,
  setting: {
    droidlabWelcomeChannelId: string | null;
    droidfixJoinChannelId: string | null;
  } | null,
): string | null {
  if (!setting) {
    return null;
  }

  return theme === 'droidfix'
    ? setting.droidfixJoinChannelId
    : setting.droidlabWelcomeChannelId;
}

function buildJoinMessage(member: GuildMember, theme: WelcomeTheme): string {
  if (theme === 'droidfix') {
    return `👋 <@${member.id}>`;
  }

  return `Hey <@${member.id}>, you're in.`;
}

export async function sendWelcome(member: GuildMember, theme: WelcomeTheme): Promise<boolean> {
  const setting = await prisma.setting.findUnique({where: {guildId: member.guild.id}});
  const joinChannelId = channelIdForTheme(theme, setting);

  if (!joinChannelId) {
    return false;
  }

  const channel = member.guild.channels.cache.get(joinChannelId);
  if (!channel?.isTextBased()) {
    return false;
  }

  const attachment = await generateWelcomeImage(member, theme);
  await (channel as TextChannel).send({
    content: buildJoinMessage(member, theme),
    files: [attachment],
  });

  return true;
}

export async function sendConfiguredWelcomes(member: GuildMember): Promise<void> {
  const setting = await prisma.setting.findUnique({where: {guildId: member.guild.id}});

  if (setting?.droidfixJoinChannelId) {
    try {
      await sendWelcome(member, 'droidfix');
    } catch (error) {
      console.error('Failed to send DroidFix join announcement:', error);
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
