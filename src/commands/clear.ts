import {inject, injectable} from 'inversify';
import {ChatInputCommandInteraction, EmbedBuilder} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {TYPES} from '../types.js';
import PlayerManager from '../managers/player.js';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('clear')
    .setDescription('clears all songs in queue except currently playing song');

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction) {
    this.playerManager.get(interaction.guild!.id).clear();

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x0a1520)
          .setDescription('🗑️  **queue cleared**')
          .setFooter({text: 'droidlab'}),
      ],
    });
  }
}
