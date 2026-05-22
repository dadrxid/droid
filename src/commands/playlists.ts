import {ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, ComponentType, GuildMember, ButtonBuilder, ButtonStyle} from 'discord.js';
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
    .setDescription('view and queue your droidlab playlists')
    .addUserOption(option => option
      .setName('user')
      .setDescription('view playlists for another user')
      .setRequired(false));

  public requiresVC = true;

  private readonly playerManager: PlayerManager;

  constructor(@inject(TYPES.Managers.Player) playerManager: PlayerManager) {
    this.playerManager = playerManager;
  }

  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const discordId = targetUser.id;
    const isSelf = targetUser.id === interaction.user.id;

    await interaction.deferReply();

    let playlists: Array<{id: number; name: string; track_count: number}> = [];

    try {
      const res = await fetch(`${PLAYLIST_API}/api/bot/user/${discordId}/playlists`);
      if (res.ok) {
        playlists = await res.json() as typeof playlists;
      } else {
        const websiteBtn = new ButtonBuilder()
          .setLabel('open playlist.droidlab.org')
          .setURL('https://playlist.droidlab.org')
          .setStyle(ButtonStyle.Link);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(websiteBtn) as any;

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x0a1520)
              .setTitle('no playlists found')
              .setDescription(isSelf
                ? '> you haven\'t created any playlists yet.\n> head to the website to get started.'
                : `> <@${discordId}> hasn't created any playlists yet.`)
              .setFooter({text: 'droidlab'}),
          ],
          components: isSelf ? [row] : [],
        });
        return;
      }
    } catch {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x0a1520)
            .setTitle('connection error')
            .setDescription('> could not reach the playlist service.')
            .setFooter({text: 'droidlab'}),
        ],
      });
      return;
    }

    if (playlists.length === 0) {
      const websiteBtn = new ButtonBuilder()
        .setLabel('open playlist.droidlab.org')
        .setURL('https://playlist.droidlab.org')
        .setStyle(ButtonStyle.Link);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(websiteBtn) as any;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x0a1520)
            .setTitle('no playlists found')
            .setDescription(isSelf
              ? '> you haven\'t created any playlists yet.\n> head to the website to get started.'
              : `> <@${discordId}> hasn't created any playlists yet.`)
            .setFooter({text: 'droidlab'}),
        ],
        components: isSelf ? [row] : [],
      });
      return;
    }

    // Deduplicate by id, truncate to 25 for Discord limit
    const unique = Array.from(new Map(playlists.map(p => [p.id, p])).values()).slice(0, 25);

    const embed = new EmbedBuilder()
      .setColor(0x00d4ff)
      .setAuthor({name: isSelf ? 'your playlists' : `${targetUser.username}'s playlists`})
      .setDescription(
        unique.map((p, i) =>
          `\`${String(i + 1).padStart(2, ' ')}.\` **${p.name}** · \`${p.track_count} track${p.track_count === 1 ? '' : 's'}\``,
        ).join('\n'),
      )
      .setFooter({text: 'droidlab · select a playlist below to queue it'});

    const select = new StringSelectMenuBuilder()
      .setCustomId('playlist_select')
      .setPlaceholder('choose a playlist...')
      .addOptions(unique.map(p => ({
        label: p.name.slice(0, 100),
        description: `${p.track_count} track${p.track_count === 1 ? '' : 's'}`,
        value: `${discordId}:${p.id}`,
      })));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as any;

    const msg = await interaction.editReply({embeds: [embed], components: [row]});

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 2 * 60 * 1000,
    });

    collector.on('collect', async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({content: 'only the person who ran this command can pick a playlist', ephemeral: true});
        return;
      }

      const [ownerId, playlistIdStr] = i.values[0].split(':');
      const playlistId = parseInt(playlistIdStr, 10);
      const selectedPlaylist = unique.find(p => p.id === playlistId);
      const playlistName = selectedPlaylist?.name ?? 'unknown';

      await i.deferUpdate();

      let tracks: Array<{title: string; artist: string; url: string; source: string; duration: number; thumbnail: string}> = [];

      try {
        const res = await fetch(`${PLAYLIST_API}/api/bot/playlist/${encodeURIComponent(playlistName)}?user=${ownerId}`);
        if (res.ok) {
          const data = await res.json() as {name: string; tracks: typeof tracks};
          tracks = data.tracks;
        } else {
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
          artist: track.artist ?? '',
          url: track.url,
          playlist: {title: playlistName, source: 'playlist-app'},
          isLive: false,
          length: track.duration ?? 0,
          offset: 0,
          source: track.source === 'youtube' ? 0 : 1,
          thumbnailUrl: track.thumbnail ?? '',
          addedInChannelId: interaction.channel!.id,
          requestedBy: interaction.user.id,
        }, {immediate: false});
      }

      if (!wasPlaying) {
        await player.connect(targetVoiceChannel);
      }

      void player.play();

      const preview = tracks.slice(0, 10).map((t, idx) =>
        `\`${String(idx + 1).padStart(2, ' ')}.\` ${t.title}${t.artist ? ` — ${t.artist}` : ''}`,
      ).join('\n');
      const extra = tracks.length > 10 ? `\n\`    \` *and ${tracks.length - 10} more...*` : '';
      const pages = Math.ceil(tracks.length / 10);

      const doneEmbed = new EmbedBuilder()
        .setColor(0x00d4ff)
        .setAuthor({name: `now queuing`})
        .setTitle(`${playlistName}`)
        .setDescription(`${preview}${extra}`)
        .addFields({name: '\u200b', value: `\`${tracks.length}\` tracks · \`${pages}\` page${pages === 1 ? '' : 's'}`})
        .setFooter({text: 'droidlab'});

      await interaction.editReply({embeds: [doneEmbed], components: []});
      collector.stop();
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        await interaction.editReply({embeds: [embed], components: []}).catch(() => null);
      }
    });
  }
}
