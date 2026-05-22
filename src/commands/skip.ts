import {ChatInputCommandInteraction} from 'discord.js';
import {TYPES} from '../types.js';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player.js';
import Command from './index.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {buildPlayingMessageEmbed, buildPlayerButtons} from '../utils/build-embed.js';
import {STATUS} from '../services/player.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('skip')
    .setDescription('skip the next songs')
    .addIntegerOption(option => option
      .setName('number')
      .setDescription('number of songs to skip [default: 1]')
      .setRequired(false));

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const numToSkip = interaction.options.getInteger('number') ?? 1;

    if (numToSkip < 1) {
      throw new Error('invalid number of songs to skip');
    }

    const player = this.playerManager.get(interaction.guild!.id);

    try {
      await player.forward(numToSkip);

      if (!player.getCurrent()) {
        await interaction.reply({content: 'track skipped'});

        return;
      }

      const msg = await interaction.reply({
        embeds: [buildPlayingMessageEmbed(player)],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        components: [buildPlayerButtons(player)] as any,
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({time: 5 * 60 * 1000});

      collector.on('collect', async i => {
        if (!i.guild) {
          return;
        }

        const p = this.playerManager.get(i.guild.id);

        if (i.customId === 'player_pause') {
          if (p.status === STATUS.PLAYING) {
            p.pause();
          } else {
            p.play();
          }
        } else if (i.customId === 'player_skip') {
          void p.forward(1);
        } else if (i.customId === 'player_stop') {
          p.stop();
        } else if (i.customId === 'player_loop') {
          p.loopCurrentSong = !p.loopCurrentSong;
        }

        await i.update({
          embeds: p.getCurrent() ? [buildPlayingMessageEmbed(p)] : [],
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          components: p.getCurrent() ? [buildPlayerButtons(p)] as any : [],
        });
      });
    } catch (_: unknown) {
      throw new Error('no song to skip to');
    }
  }
}
