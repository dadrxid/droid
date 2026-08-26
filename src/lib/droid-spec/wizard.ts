import {
  ActionRowBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Message,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextBasedChannel,
} from 'discord.js';
import {getBotOwnerId} from '../../utils/require-guild-admin.js';
import {brandEmoji} from '../droid-brand.js';
import {taglineFile} from './assets.js';
import {hasItem, refreshLivePrices} from './menu.js';
import {quoteSpec} from './quote.js';
import {isImageMessage, photoAttachments, storeChannelPhoto} from './photos.js';
import {
  CLICK_FACES,
  FACES_RESIN,
  BACKS_BB,
  applyBbPick,
  colourButtonLabel,
  getSpec,
  isBb,
  lockGhostCaps,
  missingColour,
  needsColour,
  needsFacesColour,
  needsShellColour,
  resetSpec,
  syncColourNotes,
  syncBbSlots,
  type DroidSpec,
  type PhotoKind,
} from './state.js';
import {
  nextPage,
  photoWaitEmbed,
  photoWaitRows,
  prevPage,
  startEmbed,
  startFiles,
  startRows,
  submittedEmbed,
  wizardEmbed,
  wizardFiles,
  wizardRows,
} from './ui.js';

/**
 * The Droid Rollers build sheet. It used to be behind the admin-only
 * /rollers-spec command, which was useless when nobody was online. It is now
 * posted automatically inside a custom build ticket.
 */

const PHOTO_WAIT_MS = 60_000;
const MAX_PHOTOS = 5;

type PhotoWait = {
  kind: PhotoKind;
  interaction: ButtonInteraction;
  collector: {stop: (reason?: string) => void};
};

const photoWait = new Map<string, PhotoWait>();

function waitKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

function wizardPayload(spec: DroidSpec) {
  return {
    content: '',
    embeds: [wizardEmbed(spec)],
    components: wizardRows(spec),
    files: wizardFiles(spec),
    attachments: wizardFiles(spec).length === 0 ? [] : undefined,
  };
}

function guardOwner(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  spec: DroidSpec,
): boolean {
  if (!spec.ownerId || spec.ownerId === interaction.user.id) {
    return true;
  }

  void interaction.reply({
    content: `This spec is being filled by <@${spec.ownerId}>.`,
    ephemeral: true,
  }).catch(() => undefined);
  return false;
}

const SHELL_NOTE_FIELD = 'shellnote';
const FACES_NOTE_FIELD = 'facesnote';

function colourInput(id: string, label: string, value: string, placeholder: string) {
  const input = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(80)
    .setPlaceholder(placeholder);
  if (value) {
    input.setValue(value);
  }

  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

/** One prompt for every colour this build needs. Two inputs at most, so it fits. */
function colourModal(spec: DroidSpec): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('droidspec:modalcolour')
    .setTitle(colourButtonLabel(spec));
  if (needsShellColour(spec)) {
    modal.addComponents(
      colourInput(SHELL_NOTE_FIELD, 'Soft touch shell colour', spec.shellNote, 'e.g. mint'),
    );
  }

  if (needsFacesColour(spec)) {
    modal.addComponents(
      colourInput(FACES_NOTE_FIELD, 'Face button colour', spec.facesNote, 'e.g. red, or red and white'),
    );
  }

  return modal;
}

/** The modal only carries the inputs that applied, so read them defensively. */
function modalValue(interaction: ModalSubmitInteraction, id: string): string {
  return interaction.fields.fields.get(id)?.value.trim() ?? '';
}

function applyShellPick(spec: DroidSpec): void {
  syncColourNotes(spec);
  lockGhostCaps(spec);
}

type SelectHandler = (spec: DroidSpec, value: string, values: string[]) => void;

const SELECT_HANDLERS: Record<string, SelectHandler> = {
  'droidspec:build': (spec, value) => {
    spec.build = value;
  },
  'droidspec:board': (spec, value) => {
    spec.board = value;
  },
  'droidspec:sticks': (spec, value) => {
    spec.sticks = value;
  },
  'droidspec:tension': (spec, value) => {
    spec.tension = value;
  },
  'droidspec:caps': (spec, value) => {
    spec.caps = value;
    lockGhostCaps(spec);
  },
  'droidspec:shell': (spec, value) => {
    spec.shell = value;
    applyShellPick(spec);
  },
  'droidspec:rear': (spec, value) => {
    spec.rear = value;
  },
  'droidspec:faces': (spec, value) => {
    spec.faces = value;
    syncColourNotes(spec);
  },
  'droidspec:click': (spec, value) => {
    spec.click = value;
    if (value === CLICK_FACES && hasItem(FACES_RESIN)) {
      spec.faces = FACES_RESIN;
      syncColourNotes(spec);
    }
  },
  'droidspec:backs': (spec, value) => {
    const qty = /^backs-bb-([1-4])$/.exec(value);
    if (qty) {
      spec.backs = BACKS_BB;
      spec.bbCount = qty[1];
      syncBbSlots(spec);
      return;
    }

    spec.backs = value;
    if (isBb(spec)) {
      syncBbSlots(spec);
    }
  },
  'droidspec:shoulders': (spec, value) => {
    spec.shoulders = value;
  },
  'droidspec:bbcount': (spec, value) => {
    spec.bbCount = value;
    syncBbSlots(spec);
  },
  'droidspec:bbplace': (spec, value) => {
    applyBbPick(spec, value);
  },
  'droidspec:extras': (spec, _value, values) => {
    spec.extras = [...values];
  },
};

async function showWizard(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  spec: DroidSpec,
): Promise<void> {
  await interaction.update(wizardPayload(spec) as never);
}

/** Posts the starter message in a ticket channel. */
export async function postSpecStarter(channel: TextBasedChannel): Promise<void> {
  if (!('send' in channel)) {
    return;
  }

  resetSpec(channel.id);
  await refreshLivePrices();
  const emoji = brandEmoji('guild' in channel ? channel.guild : undefined);
  const message = await channel.send({
    embeds: [startEmbed(emoji)],
    components: startRows(emoji),
    files: startFiles(),
  });
  getSpec(channel.id).startMessageId = message.id;
}

export async function handleSpecSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  if (!interaction.channelId || interaction.customId === 'droidspec:photokind') {
    return;
  }

  const spec = getSpec(interaction.channelId);
  if (!guardOwner(interaction, spec)) {
    return;
  }

  await refreshLivePrices();
  const apply = SELECT_HANDLERS[interaction.customId];
  if (apply) {
    apply(spec, interaction.values[0] ?? '', interaction.values);
  }

  await showWizard(interaction, spec);
}

export async function handleSpecButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.channelId || !interaction.channel?.isTextBased()) {
    await interaction.reply({content: 'Use this in a ticket channel.', ephemeral: true});
    return;
  }

  const spec = getSpec(interaction.channelId);
  await refreshLivePrices();

  if (interaction.customId === 'droidspec:start') {
    if (spec.ownerId && spec.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: `This spec is being filled by <@${spec.ownerId}>.`,
        ephemeral: true,
      });
      return;
    }

    spec.ownerId = interaction.user.id;
    spec.page = spec.page || 'core';
    await interaction.reply({
      ...wizardPayload(spec),
      ephemeral: true,
    } as never);
    return;
  }

  if (!guardOwner(interaction, spec)) {
    return;
  }

  if (interaction.customId === 'droidspec:next') {
    spec.page = nextPage(spec);
    if (spec.page === 'bb') {
      syncBbSlots(spec);
    }

    await showWizard(interaction, spec);
    return;
  }

  if (interaction.customId === 'droidspec:back') {
    spec.page = prevPage(spec);
    await showWizard(interaction, spec);
    return;
  }

  if (interaction.customId === 'droidspec:bbprev') {
    spec.bbCursor = Math.max(0, spec.bbCursor - 1);
    await showWizard(interaction, spec);
    return;
  }

  if (interaction.customId === 'droidspec:photocancel') {
    const wait = photoWait.get(waitKey(interaction.channelId, interaction.user.id));
    wait?.collector.stop('cancel');
    await showWizard(interaction, spec);
    return;
  }

  if (interaction.customId.startsWith('droidspec:photo-')) {
    const kind = interaction.customId.slice('droidspec:photo-'.length) as PhotoKind;
    if (!['shell', 'faces', 'backs', 'other'].includes(kind)) {
      return;
    }

    if (spec.photos.length >= MAX_PHOTOS) {
      await interaction.reply({content: `Max ${String(MAX_PHOTOS)} photos.`, ephemeral: true});
      return;
    }

    await startPhotoWait(interaction, kind);
    return;
  }

  if (interaction.customId === 'droidspec:shellnote') {
    if (!needsColour(spec)) {
      await interaction.reply({
        content: 'Nothing on this build needs a colour yet. Pick a soft touch shell or coloured buttons first.',
        ephemeral: true,
      });
      return;
    }

    await interaction.showModal(colourModal(spec) as never);
    return;
  }

  if (interaction.customId === 'droidspec:submit') {
    const missing = missingColour(spec);
    if (missing.length > 0) {
      await interaction.reply({
        content: `Andrew needs the ${missing.join(' and ')} first. Tap **Prev** back to the shells page, then tap **${colourButtonLabel(spec)}**.`,
        ephemeral: true,
      });
      return;
    }

    const ownerId = getBotOwnerId();
    const quote = quoteSpec(spec);
    const files: AttachmentBuilder[] = [taglineFile(), ...photoAttachments(spec.photos)];
    const photoEmbeds = spec.photos.map(photo =>
      new EmbedBuilder().setColor(0x0088ff).setTitle(`Photo · ${photo.kind}`).setImage(`attachment://${photo.name}`),
    );
    await interaction.update({
      content: 'Submitted. The custom build is now in the ticket.',
      embeds: [],
      components: [],
      attachments: [],
    });
    await interaction.followUp({
      content: `<@${ownerId}> custom build is in.\n${quote.pingLine}`,
      embeds: [submittedEmbed(spec), ...photoEmbeds],
      files,
      allowedMentions: {users: [ownerId]},
      ephemeral: false,
    });
  }
}

export async function handleSpecModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.channelId) {
    return;
  }

  const spec = getSpec(interaction.channelId);
  if (!guardOwner(interaction, spec)) {
    return;
  }

  if (needsShellColour(spec)) {
    spec.shellNote = modalValue(interaction, SHELL_NOTE_FIELD);
  }

  if (needsFacesColour(spec)) {
    spec.facesNote = modalValue(interaction, FACES_NOTE_FIELD);
  }

  syncColourNotes(spec);
  const saved = [
    spec.shellNote ? `shell ${spec.shellNote}` : '',
    spec.facesNote ? `buttons ${spec.facesNote}` : '',
  ].filter(Boolean);
  await interaction.reply({
    content: saved.length > 0 ? `Colour saved: ${saved.join(', ')}.` : 'Colour cleared.',
    ephemeral: true,
  });
}

async function startPhotoWait(interaction: ButtonInteraction, kind: PhotoKind): Promise<void> {
  const {channel} = interaction;
  if (!channel || !interaction.channelId || !('createMessageCollector' in channel)) {
    await interaction.update({content: 'Cannot collect photos here.', components: []});
    return;
  }

  const spec = getSpec(interaction.channelId);
  const key = waitKey(interaction.channelId, interaction.user.id);
  await interaction.update({
    content: '',
    embeds: [photoWaitEmbed(kind)],
    components: photoWaitRows(),
    attachments: [],
  });

  const collector = channel.createMessageCollector({
    filter: (message: Message) =>
      message.author.id === interaction.user.id && isImageMessage(message),
    max: 1,
    time: PHOTO_WAIT_MS,
  });
  photoWait.set(key, {kind, interaction, collector});

  collector.on('collect', message => {
    void (async () => {
      if (spec.photos.length >= MAX_PHOTOS) {
        await message.delete().catch(() => undefined);
        return;
      }

      const stored = await storeChannelPhoto(interaction.channelId, kind, message);
      photoWait.delete(key);
      if (!stored) {
        await interaction.editReply(wizardPayload(spec) as never).catch(() => undefined);
        await interaction.followUp({
          content: 'Could not save that photo. Try a smaller image, then tap Add again.',
          ephemeral: true,
        }).catch(() => undefined);
        return;
      }

      spec.photos.push(stored);
      await interaction.editReply(wizardPayload(spec) as never).catch(() => undefined);
    })();
  });

  collector.on('end', (collected, reason) => {
    photoWait.delete(key);
    if (reason === 'cancel' || reason === 'limit') {
      return;
    }

    if (collected.size === 0) {
      void interaction.editReply(wizardPayload(spec) as never).catch(() => undefined);
      void interaction.followUp({
        content: 'No photo in 60 seconds. Tap **Add shell photo** (or faces / backs / other) and paste it into the ticket.',
        ephemeral: true,
      }).catch(() => undefined);
    }
  });
}
