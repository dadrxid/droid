import {ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {inject, injectable} from 'inversify';
import {TYPES} from '../types.js';
import PlayerManager from '../managers/player.js';
import Command from './index.js';
import {buildQueueEmbed} from '../utils/build-embed.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('show the current queue')
    .addIntegerOption(option => option
      .setName('page')
      .setDescription('page of queue to show [default: 1]')
      .setRequired(false))
    .addIntegerOption(option => option
      .setName('page-size')
      .setDescription('how many items to display per page [default: 10, max: 30]')
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(false));

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guild!.id;
    const player = this.playerManager.get(guildId);
    const pageSizeFromOptions = interaction.options.getInteger('page-size');
    const pageSize = pageSizeFromOptions ?? (await getGuildSettings(guildId)).defaultQueuePageSize;

    let currentPage = interaction.options.getInteger('page') ?? 1;
    const queueSize = player.queueSize();
    const maxPage = Math.ceil((queueSize + 1) / pageSize);

    const embed = buildQueueEmbed(player, currentPage, pageSize);
    const buttons = this.buildPageButtons(currentPage, maxPage);

    const msg = await interaction.reply({
      embeds: [embed],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      components: maxPage > 1 ? [buttons] as any : [],
      fetchReply: true,
    });

    if (maxPage <= 1) {
      return;
    }

    const collector = msg.createMessageComponentCollector({time: 5 * 60 * 1000});

    collector.on('collect', async i => {
      if (i.customId === 'queue_prev' && currentPage > 1) {
        currentPage--;
      } else if (i.customId === 'queue_next' && currentPage < maxPage) {
        currentPage++;
      }

      const newEmbed = buildQueueEmbed(player, currentPage, pageSize);
      const newButtons = this.buildPageButtons(currentPage, maxPage);

      await i.update({
        embeds: [newEmbed],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        components: [newButtons] as any,
      });
    });

    collector.on('end', async () => {
      try {
        await msg.edit({components: []});
      } catch {}
    });
  }

  private buildPageButtons(currentPage: number, maxPage: number) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('queue_prev')
        .setEmoji('⬅️')
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId('queue_next')
        .setEmoji('➡️')
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= maxPage),
    );
  }
}
