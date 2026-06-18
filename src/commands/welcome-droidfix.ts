import {SlashCommandBuilder} from '@discordjs/builders';
import {ChannelType, ChatInputCommandInteraction} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {prisma} from '../utils/db.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {requireGuildAdministrator} from '../utils/require-guild-admin.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('welcome-droidfix')
    .setDescription('configure the DroidFix welcome card channel (Administrator only)')
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('set the channel for DroidFix welcome cards')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('text channel for DroidFix welcomes')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable DroidFix welcome cards'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show the current DroidFix welcome channel'));

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
          await interaction.reply({content: '🚫 welcome messages must be sent to a text channel', ephemeral: true});
          return;
        }

        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {droidfixWelcomeChannelId: channel.id},
        });

        await interaction.reply({
          content: `✅ **DroidFix** welcome cards will post in <#${channel.id}>`,
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {droidfixWelcomeChannelId: null},
        });

        await interaction.reply({content: '✅ **DroidFix** welcome cards disabled', ephemeral: true});
        break;
      }

      case 'status': {
        const setting = await prisma.setting.findUnique({where: {guildId}});

        if (!setting?.droidfixWelcomeChannelId) {
          await interaction.reply({content: '**DroidFix** welcome cards are **disabled**', ephemeral: true});
          return;
        }

        await interaction.reply({
          content: `**DroidFix** welcome cards post in <#${setting.droidfixWelcomeChannelId}>`,
          ephemeral: true,
        });
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
