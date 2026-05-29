import {SlashCommandBuilder} from '@discordjs/builders';
import {CommandInteraction, GuildMember} from 'discord.js';
import {injectable} from 'inversify';
import handleGuildMemberAdd from '../events/guild-member-add.js';

const OWNER_ID = '397068987000815616';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Test the welcome message (owner only)');

  public readonly handledButtonIds = [];

  async execute(interaction: CommandInteraction) {
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({content: 'You don\'t have permission to use this command.', ephemeral: true});
      return;
    }

    await interaction.deferReply({ephemeral: true});

    const member = interaction.member as GuildMember;

    try {
      await handleGuildMemberAdd(member);
      await interaction.editReply('Welcome message sent!');
    } catch (error) {
      await interaction.editReply(`Error: ${String(error)}`);
    }
  }
}
