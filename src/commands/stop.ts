import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {TYPES} from '../types.js';
import {inject, injectable} from 'inversify';
import PlayerManager from '../managers/player.js';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('stop')
    .setDescription('stop playback, disconnect, and clear all songs in the queue');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    const player = this.playerManager.get(interaction.guild!.id);

    if (!player.voiceConnection) {
      throw new Error('not in a voice channel');
    }

    // FIX: removed `status !== STATUS.PLAYING` check — that prevented stopping
    // while paused. voiceConnection check above is sufficient.

    player.stop();

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x0a1520)
          .setDescription('⏹  **stopped**')
          .setFooter({text: 'droidlab'}),
      ],
    });
  }
}
