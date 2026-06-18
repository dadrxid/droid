import {SlashCommandBuilder} from '@discordjs/builders';
import {ChannelType, ChatInputCommandInteraction} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {prisma} from '../utils/db.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {
  buildFaqContext,
  scanDroidfixFaqLinks,
  serializeDroidfixFaqLinks,
  mentionChannel,
} from '../utils/droidfix-faq-context.js';
import {previewDroidfixFaq} from '../utils/droidfix-faq-handler.js';
import {DROIDFIX_FAQ_ENTRIES} from '../lib/droidfix-faq-entries.js';
import {requireGuildAdministrator} from '../utils/require-guild-admin.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('faq-droidfix')
    .setDescription('configure DroidFix FAQ auto-replies for this server (Administrator only)')
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('enable FAQ auto-replies in a channel (usually #ask)')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('channel where FAQ questions are answered')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('scan')
      .setDescription('rescan this server for ask, ticket, mail-in and welcome channels'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show FAQ setup for this server'))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable FAQ auto-replies'))
    .addSubcommand(subcommand => subcommand
      .setName('test')
      .setDescription('test which FAQ reply a message would trigger')
      .addStringOption(option => option
        .setName('question')
        .setDescription('example question to test')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('list all FAQ topics the bot can answer'));

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await requireGuildAdministrator(interaction)) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const guildId = guild.id;

    switch (subcommand) {
      case 'set': {
        const channel = interaction.options.getChannel('channel', true);

        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          await interaction.reply({content: '🚫 FAQ auto-reply must use a text channel', ephemeral: true});
          return;
        }

        await getGuildSettings(guildId);
        const links = scanDroidfixFaqLinks(guild);

        await prisma.setting.update({
          where: {guildId},
          data: {
            droidfixFaqChannelId: channel.id,
            droidfixFaqLinks: serializeDroidfixFaqLinks(links),
          },
        });

        await interaction.reply({
          content: [
            `✅ **DroidFix FAQ** enabled in ${mentionChannel(channel.id, channel.name)} on **${guild.name}**.`,
            `Linked channels: ask ${mentionChannel(links.askChannelId, 'not found')} · ticket ${mentionChannel(links.ticketChannelId, 'not found')} · mail-in ${mentionChannel(links.mailInChannelId, 'not found')} · welcome ${mentionChannel(links.welcomeChannelId, 'not found')}`,
            'Run `/faq-droidfix scan` after renaming channels if links look wrong.',
          ].join('\n'),
          ephemeral: true,
        });
        break;
      }

      case 'scan': {
        const setting = await prisma.setting.findUnique({where: {guildId}});

        if (!setting?.droidfixFaqChannelId) {
          await interaction.reply({content: 'FAQ is not enabled. Run `/faq-droidfix set` first.', ephemeral: true});
          return;
        }

        const links = scanDroidfixFaqLinks(guild);

        await prisma.setting.update({
          where: {guildId},
          data: {droidfixFaqLinks: serializeDroidfixFaqLinks(links)},
        });

        await interaction.reply({
          content: [
            `✅ Rescanned **${guild.name}** channel links.`,
            `Ask ${mentionChannel(links.askChannelId, 'not found')} · Ticket ${mentionChannel(links.ticketChannelId, 'not found')} · Mail-in ${mentionChannel(links.mailInChannelId, 'not found')} · Welcome ${mentionChannel(links.welcomeChannelId, 'not found')}`,
          ].join('\n'),
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        const setting = await prisma.setting.findUnique({where: {guildId}});

        if (!setting?.droidfixFaqChannelId) {
          await interaction.reply({content: `**DroidFix FAQ** is **disabled** on ${guild.name}.`, ephemeral: true});
          return;
        }

        const ctx = buildFaqContext(guild, setting.droidfixFaqLinks);

        await interaction.reply({
          content: [
            `**DroidFix FAQ on ${guild.name}**`,
            `Listening: ${mentionChannel(setting.droidfixFaqChannelId, 'unknown')}`,
            `Ask ${mentionChannel(ctx.links.askChannelId, 'not linked')} · Ticket ${mentionChannel(ctx.links.ticketChannelId, 'not linked')} · Mail-in ${mentionChannel(ctx.links.mailInChannelId, 'not linked')} · Welcome ${mentionChannel(ctx.links.welcomeChannelId, 'not linked')}`,
            `${DROIDFIX_FAQ_ENTRIES.length} topics loaded · 45s cooldown per user`,
          ].join('\n'),
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        await getGuildSettings(guildId);

        await prisma.setting.update({
          where: {guildId},
          data: {
            droidfixFaqChannelId: null,
            droidfixFaqLinks: null,
          },
        });

        await interaction.reply({content: `✅ **DroidFix FAQ** disabled on **${guild.name}**.`, ephemeral: true});
        break;
      }

      case 'test': {
        const question = interaction.options.getString('question', true);
        const setting = await prisma.setting.findUnique({where: {guildId}});
        const preview = await previewDroidfixFaq(guildId, question, setting?.droidfixFaqLinks ?? null);

        if (!preview) {
          await interaction.reply({content: `No FAQ match for: "${question}"`, ephemeral: true});
          return;
        }

        await interaction.reply({content: preview, ephemeral: true});
        break;
      }

      case 'list': {
        const topics = DROIDFIX_FAQ_ENTRIES.map(entry => `· ${entry.id}`).join('\n');

        await interaction.reply({
          content: `**${DROIDFIX_FAQ_ENTRIES.length} DroidFix FAQ topics:**\n${topics}`,
          ephemeral: true,
        });
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
