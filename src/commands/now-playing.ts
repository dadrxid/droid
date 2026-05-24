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
    .setName('now-playing')
    .setDescription('shows the currently played song');

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const player = this.playerManager.get(interaction.guild!.id);

    if (!player.getCurrent()) {
      throw new Error('nothing is currently playing');
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
          await p.play(); // FIX: was void p.play()
        }
      } else if (i.customId === 'player_skip') {
        await p.forward(1); // FIX: was void p.forward(1)
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

    collector.on('end', async () => {
      try {
        await msg.edit({components: []});
      } catch {}
    });
  }
}
