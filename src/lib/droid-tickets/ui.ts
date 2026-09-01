import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import {branded} from '../droid-brand.js';
import type {TicketField, TicketKind, TicketRecord} from './store.js';

export const BRAND_BLUE = 0x0088ff;
const CLOSED_AMBER = 0xffb020;

export const KIND_LABELS: Record<TicketKind, string> = {
  custom: 'Custom build',
  repair: 'Repair',
};

export function panelEmbed(
  emoji: string,
  logo?: string,
  gates?: {customOpen: boolean; repairOpen: boolean; customClosedNote: string; repairClosedNote: string},
): EmbedBuilder {
  const customLine = gates && !gates.customOpen
    ? '**Custom build** · closed until HeliumStrike. Press the button for why.'
    : '**Custom build** · instant price on your spec. Built and shipped in house, 4 to 6 weeks.';
  const repairLine = gates && !gates.repairOpen
    ? '**Repair** · closed right now. Press the button for why.'
    : '**Repair** · stick drift, dead buttons, charging, or an 8K board swap on a pad you already own. UK mail-in only.';

  const closed = Boolean(gates && (!gates.customOpen || !gates.repairOpen));
  const embed = new EmbedBuilder()
    .setColor(closed ? CLOSED_AMBER : BRAND_BLUE)
    .setTitle(branded(emoji, 'DroidFix tickets'))
    .setDescription([
      'Pick a button and fill in the short form. Your private ticket opens straight after.',
      '',
      customLine,
      repairLine,
    ].join('\n'))
    .setFooter({text: 'droidfix.uk · only you and the DroidFix team can see your ticket'});

  return logo ? embed.setThumbnail(logo) : embed;
}

export function panelRows(emoji: string): any[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('dt:new:custom')
        .setLabel('Custom build')
        .setEmoji(emoji ? emoji : '🎮')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('dt:new:repair')
        .setLabel('Repair')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** One tidy embed: greeting, the ground rules for that ticket type, and the form answers. */
export function welcomeEmbed(options: {
  kind: TicketKind;
  id: string;
  openerId: string;
  staffRoleId: string;
  fields: TicketField[];
  emoji: string;
  logo?: string;
}): EmbedBuilder {
  const {kind, id, openerId, staffRoleId, fields, emoji, logo} = options;
  const staff = staffRoleId ? `<@&${staffRoleId}>` : 'Andrew';

  const lines = kind === 'custom'
    ? [
      `Thanks <@${openerId}>. Pick your parts on the build sheet below and the price updates as you go.`,
      '',
      'Built and shipped in house · 4 to 6 weeks, sometimes sooner · UK postage included.',
      `${staff} will send the checkout link and can sort anything else in here.`,
    ]
    : [
      `Thanks <@${openerId}>. Post a photo or a short clip of the fault when you can.`,
      '',
      'UK mail-in only.',
      'Already own a custom pad, a Scuf or another modder\'s build? An 8K board swap is welcome here.',
      `${staff} will send you the postage details and price it up in here.`,
    ];

  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(branded(emoji, `${KIND_LABELS[kind]} · ${id}`))
    .setDescription(lines.join('\n'))
    .setFooter({text: 'droidfix.uk · press Close when you are finished'});

  for (const field of fields) {
    embed.addFields({
      name: field.label.slice(0, 256),
      value: field.value.slice(0, 1024),
      inline: field.value.length <= 40,
    });
  }

  return logo ? embed.setThumbnail(logo) : embed;
}

export function openControlsRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:close')
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:claim')
      .setLabel('Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
  );
}

export function closeConfirmRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:close-yes')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('dt:close-no')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function deleteConfirmRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:delete-yes')
      .setLabel('Delete for good')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('dt:delete-no')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function staffControlsRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:transcript')
      .setLabel('Transcript')
      .setEmoji('📄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:open')
      .setLabel('Open')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:delete')
      .setLabel('Delete')
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Danger),
  );
}

export function closedEmbed(closedByTag: string, reason: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(CLOSED_AMBER)
    .setDescription(`Ticket closed by **${closedByTag}**`);

  if (reason) {
    embed.addFields({name: 'Reason', value: reason.slice(0, 1024)});
  }

  return embed;
}

export function staffControlsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CLOSED_AMBER)
    .setDescription('```Support team ticket controls```');
}

export function logEmbed(ticket: TicketRecord, extra: {users: string[]}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Transcript · ${ticket.id}`)
    .addFields(
      {name: 'Ticket owner', value: ticket.openerId ? `<@${ticket.openerId}>` : 'unknown', inline: true},
      {name: 'Ticket name', value: ticket.channelName || ticket.id, inline: true},
      {name: 'Type', value: KIND_LABELS[ticket.kind], inline: true},
      {name: 'Messages', value: String(ticket.messageCount), inline: true},
      {
        name: 'Closed by',
        value: ticket.closedByTag || 'unknown',
        inline: true,
      },
    );

  if (ticket.claimedByTag) {
    embed.addFields({name: 'Claimed by', value: ticket.claimedByTag, inline: true});
  }

  if (ticket.closeReason) {
    embed.addFields({name: 'Reason', value: ticket.closeReason.slice(0, 1024)});
  }

  if (extra.users.length > 0) {
    embed.addFields({name: 'In transcript', value: extra.users.slice(0, 15).join('\n').slice(0, 1024)});
  }

  return embed;
}

export function directLinkRow(url: string): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Direct Link')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL(url),
  );
}
