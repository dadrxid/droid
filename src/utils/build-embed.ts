import getYouTubeID from 'get-youtube-id';
import {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} from 'discord.js';
import Player, {MediaSource, QueuedSong, STATUS} from '../services/player.js';
import getProgressBar from './get-progress-bar.js';
import {prettyTime} from './time.js';
import {truncate} from './string.js';

const getMaxSongTitleLength = (title: string) => {
  // eslint-disable-next-line no-control-regex
  const nonASCII = /[^\u0000-\u007F]+/u;

  return nonASCII.test(title) ? 28 : 48;
};

const getSongTitle = ({title, url, offset, source}: QueuedSong, shouldTruncate = false) => {
  if (source === MediaSource.HLS) {
    return `[${title}](${url})`;
  }

  const cleanSongTitle = title.replace(/\[.*\]/u, '').trim();
  const songTitle = shouldTruncate ? truncate(cleanSongTitle, getMaxSongTitleLength(cleanSongTitle)) : cleanSongTitle;
  const youtubeId = url.length === 11 ? url : getYouTubeID(url) ?? '';

  return `[${songTitle}](https://www.youtube.com/watch?v=${youtubeId}${offset === 0 ? '' : '&t=' + String(offset)})`;
};

const getQueueInfo = (player: Player) => {
  const queueSize = player.queueSize();

  if (queueSize === 0) {
    return '-';
  }

  return queueSize === 1 ? '1 song' : `${queueSize} songs`;
};

const getPlayerUI = (player: Player) => {
  const song = player.getCurrent();

  if (!song) {
    return '';
  }

  const position = player.getPosition();
  const button = player.status === STATUS.PLAYING ? '⏸️' : '▶️';
  const progressBar = getProgressBar(10, position / song.length);
  const elapsedTime = song.isLive ? 'live' : `${prettyTime(position)}/${prettyTime(song.length)}`;
  const loop = player.loopCurrentSong ? '🔂' : player.loopCurrentQueue ? '🔁' : '';
  const vol: string = typeof player.getVolume() === 'number' ? `${player.getVolume()!}%` : '';

  return `${button} ${progressBar} \`[${elapsedTime}]\` 🔉 ${vol} ${loop}`;
};

export const buildPlayerButtons = (player: Player): ActionRowBuilder<any> => {
  const isPlaying = player.status === STATUS.PLAYING;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('player_pause')
      .setLabel(isPlaying ? 'Pause' : 'Resume')
      .setEmoji(isPlaying ? '⏸' : '▶️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_skip')
      .setLabel('Skip')
      .setEmoji('⏭')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('player_stop')
      .setLabel('Stop')
      .setEmoji('⏹')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('player_loop')
      .setLabel('Loop')
      .setEmoji('🔁')
      .setStyle(player.loopCurrentSong ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
};

export const buildPlayingMessageEmbed = (player: Player): EmbedBuilder => {
  const currentlyPlaying = player.getCurrent();

  if (!currentlyPlaying) {
    throw new Error('No playing song found');
  }

  const {artist, thumbnailUrl, requestedBy} = currentlyPlaying;
  const duration = currentlyPlaying.isLive ? 'live' : prettyTime(currentlyPlaying.length);
  const message = new EmbedBuilder();

  message
    .setColor(player.status === STATUS.PLAYING ? 0x00d4ff : 0x00b4a0)
    .setTitle(player.status === STATUS.PLAYING ? 'Now Playing' : 'Paused')
    .setDescription(`${getSongTitle(currentlyPlaying)}`)
    .addFields([
      {name: 'Duration', value: duration, inline: true},
      {name: 'Requested by', value: `<@${requestedBy}>`, inline: true},
    ])
    .setFooter({text: `droidlab · ${artist}`});

  if (thumbnailUrl) {
    message.setThumbnail(thumbnailUrl);
  }

  return message;
};

export const buildQueueEmbed = (player: Player, page: number, pageSize: number): EmbedBuilder => {
  const currentlyPlaying = player.getCurrent();

  if (!currentlyPlaying) {
    throw new Error('queue is empty');
  }

  const queueSize = player.queueSize();
  const maxQueuePage = Math.ceil((queueSize + 1) / pageSize);

  if (page > maxQueuePage) {
    throw new Error('the queue isn\'t that big');
  }

  const queuePageBegin = (page - 1) * pageSize;
  const queuePageEnd = queuePageBegin + pageSize;
  const queuedSongs = player
    .getQueue()
    .slice(queuePageBegin, queuePageEnd)
    .map((song, index) => {
      const songNumber = index + 1 + queuePageBegin;
      const duration = song.isLive ? 'live' : prettyTime(song.length);

      return `\`${songNumber}.\` ${getSongTitle(song, true)} \`[${duration}]\``;
    })
    .join('\n');

  const {artist, thumbnailUrl, playlist, requestedBy: _requestedBy} = currentlyPlaying;
  const playlistTitle = playlist ? `(${playlist.title})` : '';
  const totalLength = player.getQueue().reduce((accumulator, current) => accumulator + current.length, 0);
  const message = new EmbedBuilder();
  let description = `${getSongTitle(currentlyPlaying)}\n\n`;

  description += `${getPlayerUI(player)}\n\n`;

  if (player.getQueue().length > 0) {
    description += '**Up next:**\n';
    description += queuedSongs;
  }

  message
    .setTitle(player.status === STATUS.PLAYING ? `Now Playing ${player.loopCurrentSong ? '· 🔂' : ''}` : 'Queue')
    .setColor(player.status === STATUS.PLAYING ? 0x00d4ff : 0x0a1520)
    .setDescription(description)
    .addFields([
      {name: 'In Queue', value: getQueueInfo(player), inline: true},
      {name: 'Total Length', value: `${totalLength > 0 ? prettyTime(totalLength) : '-'}`, inline: true},
      {name: 'Page', value: `${page} of ${maxQueuePage}`, inline: true},
    ])
    .setFooter({text: `droidlab · ${artist} ${playlistTitle}`});

  if (thumbnailUrl) {
    message.setThumbnail(thumbnailUrl);
  }

  return message;
};
