import {SlashCommandBuilder} from '@discordjs/builders';
import {ChatInputCommandInteraction} from 'discord.js';
import {injectable} from 'inversify';
import {readPackageSync} from 'read-pkg';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('version')
    .setDescription('show the running bot build (use this to confirm deploy worked)');

  async execute(interaction: ChatInputCommandInteraction) {
    const pkg = readPackageSync();
    const commit = process.env.COMMIT_HASH ?? 'unknown';
    const buildDate = process.env.BUILD_DATE ?? 'unknown';

    await interaction.reply({
      content: [
        `**Droid bot** v${pkg.version}`,
        `commit: \`${commit.slice(0, 12)}\``,
        `built: ${buildDate}`,
        'If commit starts with `e117a89` or newer, welcome-droidfix and faq-droidfix are included.',
      ].join('\n'),
      ephemeral: true,
    });
  }
}
