import {SlashCommandBuilder} from '@discordjs/builders';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type Message,
} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {getBotOwnerId, requireGuildAdministrator} from '../utils/require-guild-admin.js';
import {bannerFile} from '../lib/droid-spec/assets.js';
import {isImageMessage, photoAttachments, storeChannelPhoto} from '../lib/droid-spec/photos.js';
import {
  CLICK_FACES,
  FACE_DROID_ROLLERS_STANDARD,
  SHELL_SOFT_TOUCH,
  type PhotoKind,
  applyBbPick,
  getSpec,
  isBb,
  isSoftTouch,
  resetSpec,
  syncBbSlots,
  type DroidSpec,
} from '../lib/droid-spec/state.js';
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
} from '../lib/droid-spec/ui.js';

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

async function showWizard(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  spec: DroidSpec,
): Promise<void> {
  await interaction.update(wizardPayload(spec) as never);
}

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('rollers-spec')
    .setDescription('Post the Droid Rollers spec starter in this ticket (Admin only)');

  public readonly handledButtonIds = [
    'droidspec:start',
    'droidspec:next',
    'droidspec:back',
    'droidspec:bbprev',
    'droidspec:photo-shell',
    'droidspec:photo-faces',
    'droidspec:photo-backs',
    'droidspec:photo-other',
    'droidspec:photocancel',
    'droidspec:shellnote',
    'droidspec:submit',
  ];

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireGuildAdministrator(interaction)) {
      return;
    }

    if (!interaction.channel?.isTextBased()) {
      await interaction.reply({content: 'Use this in a ticket text channel.', ephemeral: true});
      return;
    }

    resetSpec(interaction.channel.id);
    await interaction.reply({
      embeds: [startEmbed()],
      components: startRows(),
      files: startFiles(),
    });
    const start = await interaction.fetchReply();
    getSpec(interaction.channel.id).startMessageId = start.id;
  }

  async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.channelId) {
      return;
    }

    if (interaction.customId === 'droidspec:photokind') {
      return;
    }

    const spec = getSpec(interaction.channelId);
    if (!guardOwner(interaction, spec)) {
      return;
    }

    const value = interaction.values[0] ?? '';
    const id = interaction.customId;

    if (id === 'droidspec:board') {
      spec.board = value;
    } else if (id === 'droidspec:sticks') {
      spec.sticks = value;
    } else if (id === 'droidspec:caps') {
      spec.caps = value;
    } else if (id === 'droidspec:shell') {
      spec.shell = value;
      if (value !== SHELL_SOFT_TOUCH) {
        spec.shellNote = '';
      }
    } else if (id === 'droidspec:faces') {
      spec.faces = value;
    } else if (id === 'droidspec:backs') {
      spec.backs = value;
      if (isBb(spec)) {
        syncBbSlots(spec);
      }
    } else if (id === 'droidspec:click') {
      spec.click = value;
      if (value === CLICK_FACES) {
        spec.faces = FACE_DROID_ROLLERS_STANDARD;
      }
    } else if (id === 'droidspec:bbcount') {
      spec.bbCount = value;
      syncBbSlots(spec);
    } else if (id === 'droidspec:bbplace') {
      applyBbPick(spec, value);
    }

    await showWizard(interaction, spec);
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.channelId || !interaction.channel?.isTextBased()) {
      await interaction.reply({content: 'Use this in a ticket channel.', ephemeral: true});
      return;
    }

    const spec = getSpec(interaction.channelId);

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

      await this.startPhotoWait(interaction, kind);
      return;
    }

    if (interaction.customId === 'droidspec:shellnote') {
      if (!isSoftTouch(spec)) {
        await interaction.reply({
          content: 'Shell colour is only for Soft Touch. BO5 and Ghost need a shell photo instead.',
          ephemeral: true,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId('droidspec:modalshell')
        .setTitle('Shell colour')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('note')
              .setLabel('Colour or description')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(80)
              .setPlaceholder('e.g. mint'),
          ),
        );
      await interaction.showModal(modal as never);
      return;
    }

    if (interaction.customId === 'droidspec:submit') {
      const ownerId = getBotOwnerId();
      const files: AttachmentBuilder[] = [bannerFile(), ...photoAttachments(spec.photos)];
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
        content: `<@${ownerId}> custom build is in.\nAndrew will quote, then send a checkout link when the listing is ready.`,
        embeds: [submittedEmbed(spec), ...photoEmbeds],
        files,
        allowedMentions: {users: [ownerId]},
        ephemeral: false,
      });
    }
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.channelId) {
      return;
    }

    const spec = getSpec(interaction.channelId);
    if (!guardOwner(interaction, spec)) {
      return;
    }

    spec.shellNote = interaction.fields.getTextInputValue('note').trim();
    if (!isSoftTouch(spec)) {
      spec.shellNote = '';
      await interaction.reply({content: 'Shell colour is only for Soft Touch.', ephemeral: true});
      return;
    }
    await interaction.reply({
      content: spec.shellNote ? `Shell colour saved: ${spec.shellNote}` : 'Shell colour cleared.',
      ephemeral: true,
    });
  }

  private async startPhotoWait(interaction: ButtonInteraction, kind: PhotoKind): Promise<void> {
    const channel = interaction.channel;
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
}
