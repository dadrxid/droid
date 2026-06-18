import {SlashCommandBuilder} from '@discordjs/builders';
import {ChatInputCommandInteraction, GuildMember} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {sendWelcome} from '../utils/send-welcome.js';
import type {WelcomeTheme} from '../utils/welcome-image.js';

const OWNER_ID = process.env.BOT_OWNER_ID ?? '397068987000815616';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Test a welcome card (owner only)')
    .addStringOption(option => option
      .setName('theme')
      .setDescription('which welcome card to test')
      .setRequired(true)
      .addChoices(
        {name: 'DroidLab', value: 'droidlab'},
        {name: 'DroidFix', value: 'droidfix'},
      ));

  public readonly handledButtonIds = [];

  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({content: 'You don\'t have permission to use this command.', ephemeral: true});
      return;
    }

    const theme = interaction.options.getString('theme', true) as WelcomeTheme;
    await interaction.deferReply({ephemeral: true});

    const member = interaction.member as GuildMember;

    try {
      const sent = await sendWelcome(member, theme);

      if (!sent) {
        await interaction.editReply(
          `No channel configured for **${theme === 'droidfix' ? 'DroidFix' : 'DroidLab'}**. Use /welcome-${theme} set first.`,
        );
        return;
      }

      await interaction.editReply(`**${theme === 'droidfix' ? 'DroidFix' : 'DroidLab'}** welcome card sent.`);
    } catch (error) {
      await interaction.editReply(`Error: ${String(error)}`);
    }
  }
}
