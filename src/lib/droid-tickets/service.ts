import {
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type TextChannel,
  type User,
} from 'discord.js';
import {isBotOwner} from '../../utils/require-guild-admin.js';
import {buildTranscript} from './transcript.js';
import {pushTicket, pushTranscript} from './site.js';
import {
  getSettings,
  nextTicketNumber,
  patchTicket,
  putTicket,
  ticketId,
  type GuildTicketSettings,
  type TicketField,
  type TicketKind,
  type TicketRecord,
} from './store.js';
import {
  KIND_LABELS,
  answersEmbed,
  closedEmbed,
  directLinkRow,
  logEmbed,
  openControlsRow,
  staffControlsEmbed,
  staffControlsRow,
  welcomeEmbed,
} from './ui.js';

/** Discord caps a category at 50 channels and a guild at 500. */
const CATEGORY_LIMIT = 50;
const GUILD_CHANNEL_LIMIT = 500;
/** Safe under the 8 MB unboosted upload cap. */
const MAX_ATTACH_BYTES = 7_500_000;

export function userTag(user: User): string {
  return user.discriminator === '0' ? user.username : `${user.username}#${user.discriminator}`;
}

export function staffCanManage(member: GuildMember, settings: GuildTicketSettings): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwner(member.id)) {
    return true;
  }

  return Boolean(settings.staffRoleId) && member.roles.cache.has(settings.staffRoleId);
}

export function isTicketChannelName(name: string): boolean {
  return /^(custom|repair|closed)-\d{4}$/.test(name);
}

function categoryIsFull(guild: Guild, categoryId: string): boolean {
  if (!categoryId) {
    return false;
  }

  const category = guild.channels.cache.get(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) {
    return false;
  }

  return category.children.cache.size >= CATEGORY_LIMIT;
}

export type CreateTicketResult =
  | {ok: true; channel: TextChannel; ticket: TicketRecord}
  | {ok: false; reason: string};

export async function createTicket(options: {
  guild: Guild;
  opener: GuildMember;
  kind: TicketKind;
  fields: TicketField[];
}): Promise<CreateTicketResult> {
  const {guild, opener, kind, fields} = options;
  const settings = await getSettings(guild.id);

  if (!settings.categoryId) {
    return {ok: false, reason: 'Tickets are not set up yet. An admin needs to run `/droid-tickets setup`.'};
  }

  const {me} = guild.members;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return {ok: false, reason: 'I need the **Manage Channels** permission to open tickets. Tell Andrew.'};
  }

  if (guild.channels.cache.size >= GUILD_CHANNEL_LIMIT) {
    return {ok: false, reason: 'This server has hit the Discord channel limit. Old tickets need deleting first.'};
  }

  if (categoryIsFull(guild, settings.categoryId)) {
    return {ok: false, reason: 'The ticket category is full (50 channels). Andrew needs to clear some closed tickets.'};
  }

  const number = await nextTicketNumber(guild.id, kind);
  const id = ticketId(kind, number);
  const openerTag = userTag(opener.user);

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: opener.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AddReactions,
      ],
    },
    {
      id: me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (settings.staffRoleId) {
    overwrites.push({
      id: settings.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: id,
      type: ChannelType.GuildText,
      parent: settings.categoryId,
      topic: `${KIND_LABELS[kind]} ticket · ${openerTag} (${opener.id}) · ${id}`,
      reason: `Ticket ${id} opened by ${openerTag}`,
      permissionOverwrites: overwrites,
    });
  } catch (error: unknown) {
    console.error('Ticket channel create failed:', error);
    return {ok: false, reason: 'Discord would not let me make the channel. Try again in a minute, or tell Andrew.'};
  }

  const ticket: TicketRecord = {
    id,
    number,
    kind,
    guildId: guild.id,
    channelId: channel.id,
    channelName: channel.name,
    openerId: opener.id,
    openerTag,
    status: 'open',
    claimedById: '',
    claimedByTag: '',
    createdAt: new Date().toISOString(),
    closedAt: '',
    closedByTag: '',
    closeReason: '',
    fields,
    messageCount: 0,
    transcriptUrl: '',
  };

  await putTicket(ticket);

  const intro = await channel.send({
    content: settings.staffRoleId ? `<@${opener.id}> · <@&${settings.staffRoleId}>` : `<@${opener.id}>`,
    embeds: [welcomeEmbed(kind, opener.id, settings.staffRoleId), answersEmbed(id, fields)],
    components: [openControlsRow()],
    allowedMentions: {
      users: [opener.id],
      roles: settings.staffRoleId ? [settings.staffRoleId] : [],
    },
  });

  await intro.pin().catch(() => undefined);
  void pushTicket(ticket);

  return {ok: true, channel, ticket};
}

export async function saveTranscript(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  postToLog: boolean;
}): Promise<{url: string; messageCount: number}> {
  const {channel, ticket, postToLog} = options;
  const settings = await getSettings(ticket.guildId);
  const built = await buildTranscript(channel, ticket);

  const record = await patchTicket(channel.id, {messageCount: built.messageCount}) ?? ticket;
  const url = await pushTranscript(ticket.id, built.html, built.messageCount) ?? '';
  if (url) {
    await patchTicket(channel.id, {transcriptUrl: url});
  }

  if (postToLog && settings.logChannelId) {
    const logChannel = channel.guild.channels.cache.get(settings.logChannelId);
    if (logChannel?.isTextBased()) {
      const buffer = Buffer.from(built.html, 'utf8');
      const files = buffer.byteLength > MAX_ATTACH_BYTES
        ? []
        : [new AttachmentBuilder(buffer, {name: `transcript-${ticket.id}.html`})];

      await logChannel.send({
        embeds: [logEmbed({...record, messageCount: built.messageCount}, {users: built.users})],
        files,
        ...(url ? {components: [directLinkRow(url)]} : {}),
      }).catch((error: unknown) => {
        console.warn('Could not post the transcript to the log channel:', error);
      });
    }
  }

  return {url, messageCount: built.messageCount};
}

export async function closeTicket(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  closedBy: GuildMember;
  reason: string;
}): Promise<TicketRecord> {
  const {channel, ticket, closedBy, reason} = options;
  const settings = await getSettings(ticket.guildId);
  const closedByTag = userTag(closedBy.user);

  const updated = await patchTicket(channel.id, {
    status: 'closed',
    closedAt: new Date().toISOString(),
    closedByTag,
    closeReason: reason,
    channelName: `closed-${String(ticket.number).padStart(4, '0')}`,
  }) ?? ticket;

  if (ticket.openerId) {
    await channel.permissionOverwrites.edit(ticket.openerId, {
      ViewChannel: false,
      SendMessages: false,
    }).catch(() => undefined);
  }

  await channel.send({
    embeds: [closedEmbed(closedByTag, reason), staffControlsEmbed()],
    components: [staffControlsRow()],
  }).catch(() => undefined);

  // One edit call: Discord allows only 2 channel updates per 10 minutes.
  await channel.edit({
    name: `closed-${String(ticket.number).padStart(4, '0')}`,
    ...(settings.archiveCategoryId && !categoryIsFull(channel.guild, settings.archiveCategoryId)
      ? {parent: settings.archiveCategoryId, lockPermissions: false}
      : {}),
    reason: `Ticket ${ticket.id} closed by ${closedByTag}`,
  }).catch((error: unknown) => {
    console.warn(`Could not rename ${ticket.id}:`, error);
  });

  const saved = await saveTranscript({channel, ticket: updated, postToLog: true});
  const finalRecord = await patchTicket(channel.id, {messageCount: saved.messageCount}) ?? updated;
  void pushTicket(finalRecord);
  return finalRecord;
}

export async function reopenTicket(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  reopenedBy: GuildMember;
}): Promise<TicketRecord> {
  const {channel, ticket, reopenedBy} = options;
  const settings = await getSettings(ticket.guildId);
  const tag = userTag(reopenedBy.user);

  if (ticket.openerId) {
    await channel.permissionOverwrites.edit(ticket.openerId, {
      ViewChannel: true,
      SendMessages: true,
    }).catch(() => undefined);
  }

  await channel.edit({
    name: ticket.id,
    ...(settings.categoryId && !categoryIsFull(channel.guild, settings.categoryId)
      ? {parent: settings.categoryId, lockPermissions: false}
      : {}),
    reason: `Ticket ${ticket.id} reopened by ${tag}`,
  }).catch((error: unknown) => {
    console.warn(`Could not rename ${ticket.id}:`, error);
  });

  const updated = await patchTicket(channel.id, {
    status: 'open',
    closedAt: '',
    closedByTag: '',
    closeReason: '',
    channelName: ticket.id,
  }) ?? ticket;

  await channel.send({
    content: ticket.openerId ? `<@${ticket.openerId}> this ticket is open again.` : 'This ticket is open again.',
    components: [openControlsRow()],
    allowedMentions: {users: ticket.openerId ? [ticket.openerId] : []},
  }).catch(() => undefined);

  void pushTicket(updated);
  return updated;
}

export async function deleteTicket(options: {
  channel: TextChannel;
  ticket: TicketRecord;
  deletedBy: GuildMember;
}): Promise<void> {
  const {channel, ticket, deletedBy} = options;
  const tag = userTag(deletedBy.user);

  // Transcript first: once the channel is gone the history is gone with it.
  await saveTranscript({channel, ticket, postToLog: ticket.status === 'open'});
  const updated = await patchTicket(channel.id, {status: 'deleted'}) ?? {...ticket, status: 'deleted' as const};
  void pushTicket(updated);

  await channel.delete(`Ticket ${ticket.id} deleted by ${tag}`);
}
