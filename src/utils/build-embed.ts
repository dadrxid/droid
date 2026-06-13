import getYouTubeID from 'get-youtube-id';
import {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} from 'discord.js';
import Player, {MediaSource, QueuedSong, STATUS} from '../services/player.js';
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
  const isPlaying = player.status === STATUS.PLAYING;
  const loop = player.loopCurrentSong ? ' · 🔂 looping' : player.loopCurrentQueue ? ' · 🔁 queue loop' : '';
  const vol = typeof player.getVolume() === 'number' ? ` · 🔉 ${player.getVolume()!}%` : '';

  const message = new EmbedBuilder()
    .setColor(isPlaying ? 0x00d4ff : 0x00b4a0)
    .setAuthor({name: isPlaying ? `▶  now playing${loop}${vol}` : `⏸  paused${loop}${vol}`})
    .setTitle(currentlyPlaying.title.replace(/\[.*\]/u, '').trim())
    .setURL(`https://www.youtube.com/watch?v=${currentlyPlaying.url.length === 11 ? currentlyPlaying.url : getYouTubeID(currentlyPlaying.url) ?? ''}`)
    .addFields([
      {name: 'artist', value: artist || 'unknown', inline: true},
      {name: 'duration', value: duration, inline: true},
      {name: 'requested by', value: `<@${requestedBy}>`, inline: true},
    ])
    .setFooter({text: 'droidlab'});

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
  const maxQueuePage = Math.max(1, Math.ceil(queueSize / pageSize));

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

      return `\`${String(songNumber).padStart(2, '0')}.\` ${getSongTitle(song, true)} \`${duration}\``;
    })
    .join('\n');

  const {artist, thumbnailUrl, playlist} = currentlyPlaying;
  const playlistTitle = playlist ? ` · ${playlist.title}` : '';
  const totalLength = player.getQueue().reduce((accumulator, current) => accumulator + current.length, 0);
  const duration = currentlyPlaying.isLive ? 'live' : prettyTime(currentlyPlaying.length);
  const loop = player.loopCurrentSong ? ' · 🔂' : player.loopCurrentQueue ? ' · 🔁' : '';

  let description = `**${getSongTitle(currentlyPlaying)}** \`${duration}\`\n`;
  description += `*${artist || 'unknown artist'}*\n`;

  if (player.getQueue().length > 0) {
    description += `\n**up next**\n${queuedSongs}`;
  }

  const message = new EmbedBuilder()
    .setColor(player.status === STATUS.PLAYING ? 0x00d4ff : 0x0a1520)
    .setAuthor({name: player.status === STATUS.PLAYING ? `▶  now playing${loop}` : `⏸  paused${loop}`})
    .setTitle(`queue${playlistTitle}`)
    .setDescription(description)
    .addFields([
      {name: 'in queue', value: getQueueInfo(player), inline: true},
      {name: 'total length', value: totalLength > 0 ? prettyTime(totalLength) : '-', inline: true},
      {name: 'page', value: `${page} of ${maxQueuePage}`, inline: true},
    ])
    .setFooter({text: 'droidlab'});

  if (thumbnailUrl) {
    message.setThumbnail(thumbnailUrl);
  }

  return message;
};
