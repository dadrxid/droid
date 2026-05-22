import {ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, ComponentType, GuildMember} from 'discord.js';
import {SlashCommandBuilder} from '@discordjs/builders';
import {inject, injectable} from 'inversify';
import {TYPES} from '../types.js';
import Command from './index.js';
import PlayerManager from '../managers/player.js';
import {getMemberVoiceChannel, getMostPopularVoiceChannel} from '../utils/channels.js';

const PLAYLIST_API = process.env.PLAYLIST_API_URL ?? 'https://playlist.droidlab.org';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('playlists')
    .setDescription('view and queue playlists from droidlab')
    .addUserOption(option => option
      .setName('user')
      .setDescription('view playlists for another user (leave empty for your own)')
      .setRequired(false));

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(
    @inject(TYPES.Managers.Player) playerManager: PlayerManager,
  ) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const discordId = targetUser.id;
    const isSelf = targetUser.id === interaction.user.id;

    await interaction.deferReply();

    let playlists: Array<{id: number; name: string; track_count: number; private: number}> = [];

    try {
      const res = await fetch(`${PLAYLIST_API}/api/bot/user/${discordId}/playlists`);

      if (res.ok) {
        playlists = await res.json() as typeof playlists;
      } else {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0a1520)
              .setTitle('no playlists found')
              .setDescription(isSelf
                ? 'you don\'t have any public playlists yet.\ncreate one at [playlist.droidlab.org](https://playlist.droidlab.org)'
                : `<@${discordId}> has no public playlists.`)
              .setFooter({text: 'droidlab'}),
          ],
        });

        return;
      }
    } catch {
      await interaction.editReply('could not reach the playlist service — is it running?');

      return;
    }

    if (playlists.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x0a1520)
            .setTitle('no playlists found')
            .setDescription(isSelf
              ? 'you don\'t have any public playlists yet.\ncreate one at [playlist.droidlab.org](https://playlist.droidlab.org)'
              : `<@${discordId}> has no public playlists.`)
            .setFooter({text: 'droidlab'}),
        ],
      });

      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00d4ff)
      .setTitle(isSelf ? 'your playlists' : `${targetUser.username}'s playlists`)
      .setDescription(playlists.map((p, i) => `\`${i + 1}.\` **${p.name}** · ${p.track_count} track${p.track_count !== 1 ? 's' : ''}`).join('\n'))
      .setFooter({text: 'droidlab · select a playlist to queue it'});

    const select = new StringSelectMenuBuilder()
      .setCustomId('playlist_select')
      .setPlaceholder('choose a playlist to queue...')
      .addOptions(playlists.map(p => ({
        label: p.name,
        description: `${p.track_count} track${p.track_count !== 1 ? 's' : ''}`,
        value: `${discordId}:${p.name}`,
      })));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as any;

    const msg = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 2 * 60 * 1000,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({content: 'only the person who ran the command can pick a playlist', ephemeral: true});

        return;
      }

      const [ownerId, ...nameParts] = i.values[0].split(':');
      const playlistName = nameParts.join(':');

      await i.deferUpdate();

      let tracks: Array<{title: string; url: string; source: string}> = [];

      try {
        const res = await fetch(`${PLAYLIST_API}/api/bot/playlist/${encodeURIComponent(playlistName)}?user=${ownerId}`);

        if (res.ok) {
          const data = await res.json() as {name: string; tracks: typeof tracks};
          tracks = data.tracks;
        } else {
          await interaction.editReply({embeds: [embed], components: []});
          await i.followUp({content: 'could not load that playlist', ephemeral: true});

          return;
        }
      } catch {
        await i.followUp({content: 'could not reach the playlist service', ephemeral: true});

        return;
      }

      if (tracks.length === 0) {
        await i.followUp({content: 'that playlist is empty', ephemeral: true});

        return;
      }

      const player = this.playerManager.get(interaction.guild!.id);
      const [targetVoiceChannel] = getMemberVoiceChannel(interaction.member as GuildMember) ?? getMostPopularVoiceChannel(interaction.guild!);
      const wasPlaying = player.getCurrent() !== null;

      for (const track of tracks) {
        player.add({
          title: track.title,
          artist: '',
          url: track.url,
          playlist: {title: playlistName, source: 'playlist-app'},
          isLive: false,
          length: 0,
          offset: 0,
          source: track.source === 'youtube' ? 0 : 1,
          thumbnailUrl: '',
          addedInChannelId: interaction.channel!.id,
          requestedBy: interaction.user.id,
        }, {immediate: false});
      }

      if (wasPlaying) {
        const doneEmbed = new EmbedBuilder()
          .setColor(0x00d4ff)
          .setTitle('playlist queued')
          .setDescription(`**${playlistName}** — ${tracks.length} track${tracks.length !== 1 ? 's' : ''} added to the queue`)
          .setFooter({text: 'droidlab'});

        await interaction.editReply({embeds: [doneEmbed], components: []});
      } else {
        await player.connect(targetVoiceChannel);
        void player.play();

        const doneEmbed = new EmbedBuilder()
          .setColor(0x00d4ff)
          .setTitle('now playing playlist')
          .setDescription(`**${playlistName}** — ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`)
          .setFooter({text: 'droidlab'});

        await interaction.editReply({embeds: [doneEmbed], components: []});
      }

      collector.stop();
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({embeds: [embed], components: []}).catch(() => null);
      }
    });
  }
}
