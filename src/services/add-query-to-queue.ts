import {ChatInputCommandInteraction, EmbedBuilder, GuildMember} from 'discord.js';
import {inject, injectable} from 'inversify';
import shuffle from 'array-shuffle';
import {TYPES} from '../types.js';
import GetSongs from '../services/get-songs.js';
import {MediaSource, SongMetadata, STATUS} from './player.js';
import PlayerManager from '../managers/player.js';
import {buildPlayingMessageEmbed, buildPlayerButtons} from '../utils/build-embed.js';
import {getMemberVoiceChannel, getMostPopularVoiceChannel} from '../utils/channels.js';
import {getGuildSettings} from '../utils/get-guild-settings.js';
import {SponsorBlock} from 'sponsorblock-api';
import Config from './config.js';
import KeyValueCacheProvider from './key-value-cache.js';
import {ONE_HOUR_IN_SECONDS} from '../utils/constants.js';
import {prettyTime} from '../utils/time.js';

@injectable()
export default class AddQueryToQueue {
  private readonly sponsorBlock?: SponsorBlock;
  private sponsorBlockDisabledUntil?: Date;
  private readonly sponsorBlockTimeoutDelay;
  private readonly cache: KeyValueCacheProvider;

  constructor(@inject(TYPES.Services.GetSongs) private readonly getSongs: GetSongs,
    @inject(TYPES.Managers.Player) private readonly playerManager: PlayerManager,
    @inject(TYPES.Config) private readonly config: Config,
    @inject(TYPES.KeyValueCache) cache: KeyValueCacheProvider) {
    this.sponsorBlockTimeoutDelay = config.SPONSORBLOCK_TIMEOUT;
    this.sponsorBlock = config.ENABLE_SPONSORBLOCK
      ? new SponsorBlock('muse-sb-integration')
      : undefined;
    this.cache = cache;
  }

  public async addToQueue({
    query,
    addToFrontOfQueue,
    shuffleAdditions,
    shouldSplitChapters,
    skipCurrentTrack,
    interaction,
  }: {
    query: string;
    addToFrontOfQueue: boolean;
    shuffleAdditions: boolean;
    shouldSplitChapters: boolean;
    skipCurrentTrack: boolean;
    interaction: ChatInputCommandInteraction;
  }): Promise<void> {
    const guildId = interaction.guild!.id;
    const player = this.playerManager.get(guildId);
    const wasPlayingSong = player.getCurrent() !== null;

    const [targetVoiceChannel] = getMemberVoiceChannel(interaction.member as GuildMember) ?? getMostPopularVoiceChannel(interaction.guild!);

    const settings = await getGuildSettings(guildId);
    const {playlistLimit, queueAddResponseEphemeral} = settings;

    await interaction.deferReply({ephemeral: queueAddResponseEphemeral});

    let [newSongs, _extraMsg] = await this.getSongs.getSongs(query, playlistLimit, shouldSplitChapters);

    if (newSongs.length === 0) {
      throw new Error('no songs found');
    }

    if (shuffleAdditions) {
      newSongs = shuffle(newSongs);
    }

    if (this.config.ENABLE_SPONSORBLOCK) {
      newSongs = await Promise.all(newSongs.map(this.skipNonMusicSegments.bind(this)));
    }

    newSongs.forEach(song => {
      player.add({
        ...song,
        addedInChannelId: interaction.channel!.id,
        requestedBy: interaction.member!.user.id,
      }, {immediate: addToFrontOfQueue ?? false});
    });

    if (!wasPlayingSong) {
      await player.connect(targetVoiceChannel);
      void player.play();
    }

    if (skipCurrentTrack) {
      void player.forward(1);
    }

    const firstSong = newSongs[0];
    const queueSize = player.queueSize();
    const position = addToFrontOfQueue ? 1 : queueSize;
    const duration = firstSong.isLive ? 'live' : prettyTime(firstSong.length);

    if (!wasPlayingSong) {
      const msg = await interaction.editReply({
        embeds: [buildPlayingMessageEmbed(player)],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        components: [buildPlayerButtons(player)] as any,
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
            void p.play();
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

      return;
    }

    if (newSongs.length === 1) {
      const embed = new EmbedBuilder()
        .setColor(0x00d4ff)
        .setTitle('Track Queued')
        .setDescription(`${firstSong.title}`)
        .addFields([
          {name: 'Position', value: `#${position}`, inline: true},
          {name: 'Duration', value: duration, inline: true},
        ])
        .setFooter({text: `droidlab · ${firstSong.artist ?? 'unknown'}`});

      if (firstSong.thumbnailUrl) {
        embed.setThumbnail(firstSong.thumbnailUrl);
      }

      await interaction.editReply({embeds: [embed]});
    } else {
      const totalDuration = newSongs.reduce((acc, s) => acc + s.length, 0);
      const embed = new EmbedBuilder()
        .setColor(0x00d4ff)
        .setTitle('Playlist Queued')
        .setDescription(`**${firstSong.title}** and **${newSongs.length - 1}** other tracks`)
        .addFields([
          {name: 'Tracks', value: `${newSongs.length}`, inline: true},
          {name: 'Total Duration', value: prettyTime(totalDuration), inline: true},
        ])
        .setFooter({text: 'droidlab'});

      await interaction.editReply({embeds: [embed]});
    }
  }

  private async skipNonMusicSegments(song: SongMetadata) {
    if (!this.sponsorBlock
          || (this.sponsorBlockDisabledUntil && new Date() < this.sponsorBlockDisabledUntil)
          || song.source !== MediaSource.Youtube
          || !song.url) {
      return song;
    }

    try {
      const segments = await this.cache.wrap(
        async () => this.sponsorBlock?.getSegments(song.url, ['music_offtopic']),
        {
          key: song.url,
          expiresIn: ONE_HOUR_IN_SECONDS,
        },
      ) ?? [];
      const skipSegments = segments
        .sort((a, b) => a.startTime - b.startTime)
        .reduce((acc: Array<{startTime: number; endTime: number}>, {startTime, endTime}) => {
          const previousSegment = acc[acc.length - 1];

          if (previousSegment && previousSegment.endTime > startTime) {
            acc[acc.length - 1].endTime = endTime;
          } else {
            acc.push({startTime, endTime});
          }

          return acc;
        }, []);

      const intro = skipSegments[0];
      const outro = skipSegments.at(-1);

      if (outro && outro?.endTime >= song.length - 2) {
        song.length -= outro.endTime - outro.startTime;
      }

      if (intro?.startTime <= 2) {
        song.offset = Math.floor(intro.endTime);
        song.length -= song.offset;
      }

      return song;
    } catch (e) {
      if (!(e instanceof Error)) {
        console.error('Unexpected event occurred while fetching skip segments : ', e);

        return song;
      }

      if (!e.message.includes('404')) {
        console.warn(`Could not fetch skip segments for "${song.url}" :`, e);
      }

      if (e.message.includes('504')) {
        this.sponsorBlockDisabledUntil = new Date(new Date().getTime() + (this.sponsorBlockTimeoutDelay * 60_000));
      }

      return song;
    }
  }
}
