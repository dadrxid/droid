import {SlashCommandBuilder} from '@discordjs/builders';
import {ChatInputCommandInteraction, PermissionFlagsBits} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {prisma} from '../utils/db.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('configure the welcome message channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString())
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('set the channel to send welcome messages to')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('the channel to send welcome messages to')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable welcome messages'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show the current welcome channel'));

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    switch (subcommand) {
      case 'set': {
        const channel = interaction.options.getChannel('channel')!;

        if (!channel.isTextBased()) {
          await interaction.reply({content: '🚫 welcome messages must be sent to a text channel', ephemeral: true});
          return;
        }

        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {welcomeChannelId: channel.id},
        });

        await interaction.reply({content: `✅ welcome messages will now be sent to <#${channel.id}>`, ephemeral: true});
        break;
      }

      case 'disable': {
        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {welcomeChannelId: null},
        });

        await interaction.reply({content: '✅ welcome messages disabled', ephemeral: true});
        break;
      }

      case 'status': {
        const setting = await prisma.setting.findUnique({where: {guildId}});

        if (!setting?.welcomeChannelId) {
          await interaction.reply({content: 'welcome messages are currently **disabled**', ephemeral: true});
          return;
        }

        await interaction.reply({content: `welcome messages are being sent to <#${setting.welcomeChannelId}>`, ephemeral: true});
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
