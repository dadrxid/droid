import {ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {injectable} from 'inversify';
import Command from './index.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('import')
    .setDescription('learn how to import playlists into droidlab');

  public requiresVC = false;

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(0x00d4ff)
      .setAuthor({name: 'droidlab · playlist import'})
      .setTitle('how to import your playlists')
      .setDescription(
        '> droidlab uses **YouTube** playlists.\n> once imported, queue them instantly with `/playlists`.',
      )
      .addFields(
        {
          name: '▸ youtube playlist',
          value: '`1.` go to [playlist.droidlab.org](https://playlist.droidlab.org)\n`2.` click **import** and paste your YouTube playlist URL\n`3.` done — use `/playlists` to queue it',
        },
        {
          name: '▸ spotify playlist',
          value: '`1.` go to [tunemymusic.com](https://www.tunemymusic.com/transfer/spotify-to-youtube) (free)\n`2.` convert your Spotify playlist to YouTube\n`3.` paste the YouTube URL into the import page\n\n*spotify direct import is unavailable due to api restrictions introduced in february 2026*',
        },
      )
      .setFooter({text: 'droidlab · playlist.droidlab.org'});

    const websiteBtn = new ButtonBuilder()
      .setLabel('open playlist.droidlab.org')
      .setURL('https://playlist.droidlab.org')
      .setStyle(ButtonStyle.Link);

    const spotifyBtn = new ButtonBuilder()
      .setLabel('convert spotify → youtube')
      .setURL('https://www.tunemymusic.com/transfer/spotify-to-youtube')
      .setStyle(ButtonStyle.Link);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(websiteBtn, spotifyBtn) as any;

    await interaction.reply({embeds: [embed], components: [row]});
  }
}
