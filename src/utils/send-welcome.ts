import {GuildMember, TextChannel} from 'discord.js';
import {prisma} from './db.js';
import {generateWelcomeImage, welcomeMessageForTheme, WelcomeTheme} from './welcome-image.js';

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
    content: welcomeMessageForTheme(theme, member),
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
