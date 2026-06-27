import {SlashCommandBuilder} from '@discordjs/builders';
import {ChannelType, ChatInputCommandInteraction, Guild} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {prisma} from '../utils/db.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {scanDroidfixFaqLinks} from '../utils/droidfix-faq-context.js';
import {requireGuildAdministrator} from '../utils/require-guild-admin.js';

function findSuggestedJoinChannel(guild: Guild | null): string | null {
  if (!guild) {
    return null;
  }

  const general = guild.channels.cache.find(
    ch => ch.isTextBased() && /general|ɢᴇɴᴇʀᴀʟ/i.test(ch.name),
  );

  return general?.id ?? null;
}

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('welcome-droidfix')
    .setDescription('configure DroidFix join announcements (Administrator only)')
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('channel for join announcements — use #general, not #welcome')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('#general or a dedicated joins channel')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable DroidFix join announcements'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show join announcement channel and setup tips'));

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await requireGuildAdministrator(interaction)) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    switch (subcommand) {
      case 'set': {
        const channel = interaction.options.getChannel('channel', true);

        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          await interaction.reply({content: '🚫 Join announcements must go to a text channel', ephemeral: true});
          return;
        }

        const welcomeChannel = scanDroidfixFaqLinks(interaction.guild!).welcomeChannelId;
        const isWelcomeChannel = welcomeChannel === channel.id
          || /welcome|ᴡᴇʟᴄᴏᴍᴇ/i.test(channel.name ?? '');

        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {droidfixJoinChannelId: channel.id},
        });

        let reply = `✅ **Join announcements** will post in <#${channel.id}> with the welcome card.`;

        if (isWelcomeChannel) {
          reply += '\n\n⚠️ **Tip:** `#welcome` works best as **read-only pins** (rules, links, how it works). '
            + 'Pick `#general` instead so joins don\'t clutter your info channel.';
        } else {
          reply += '\n\nKeep `#welcome` for pinned info only — joins go here now.';
        }

        await interaction.reply({content: reply, ephemeral: true});
        break;
      }

      case 'disable': {
        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {droidfixJoinChannelId: null},
        });

        await interaction.reply({content: '✅ DroidFix join announcements disabled', ephemeral: true});
        break;
      }

      case 'status': {
        const setting = await prisma.setting.findUnique({where: {guildId}});

        if (!setting?.droidfixJoinChannelId) {
          const suggested = findSuggestedJoinChannel(interaction.guild);
          const hint = suggested
            ? `\n\nSuggested: \`/welcome-droidfix set channel:<#${suggested}>\``
            : '\n\nUse `/welcome-droidfix set channel:#general` — not `#welcome`.';

          await interaction.reply({
            content: `DroidFix join announcements are **disabled**.${hint}`,
            ephemeral: true,
          });
          return;
        }

        const welcomePin = scanDroidfixFaqLinks(interaction.guild!).welcomeChannelId;

        await interaction.reply({
          content: [
            `**Join announcements:** <#${setting.droidfixJoinChannelId}>`,
            welcomePin ? `**Pinned info channel:** <#${welcomePin}> (keep this for rules/links only)` : '',
            '',
            '**Setup:** joins → `#general` · onboarding → `#welcome` pins · questions → `#ask`',
          ].filter(Boolean).join('\n'),
          ephemeral: true,
        });
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
