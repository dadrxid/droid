import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {BANNER_NAME, PLACEMENT_NAME, bannerFile, placementFile} from './assets.js';
import {
  BACKS_BB,
  CLICK_FACES,
  FACE_DROID_ROLLERS_STANDARD,
  FACE_STOCK_MEMBRANE,
  FACE_STOCK_WHITE_MEMBRANE,
  FACE_XBOX_MEMBRANE,
  type DroidSpec,
  type PhotoKind,
  type SpecPage,
  hasPhoto,
  isBb,
  isSoftTouch,
  specText,
} from './state.js';

export const SPEC_PREFIX = 'droidspec:';
export const BRAND_BLUE = 0x0088ff;

type SelectOpt = {label: string; value: string; description?: string};

function selectRow(
  customId: string,
  placeholder: string,
  options: SelectOpt[],
  selected?: string,
  disabled = false,
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setDisabled(disabled)
      .addOptions(options.map(opt => {
        const item = new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setValue(opt.value);
        if (opt.description) {
          item.setDescription(opt.description.slice(0, 100));
        }

        if (selected && selected === opt.value) {
          item.setDefault(true);
        }

        return item;
      })),
  );
}

function stepMeta(spec: DroidSpec): {step: number; total: number; title: string} {
  const extra = isBb(spec) ? 1 : 0;
  const total = 3 + extra;
  if (spec.page === 'core') {
    return {step: 1, total, title: 'Board and faces'};
  }

  if (spec.page === 'look') {
    return {step: 2, total, title: 'Shell, backs, click'};
  }

  if (spec.page === 'bb') {
    return {step: 3, total, title: 'Battle Beaver placements'};
  }

  return {step: total, total, title: 'Add photos. Paste them into this ticket.'};
}

export function startEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('Droid Rollers')
    .setDescription(
      'Custom 8K build spec.\nTap **Start build spec**. Only you will see the form until you submit.',
    )
    .setImage(`attachment://${BANNER_NAME}`)
    .setFooter({text: '8K custom boards only. Not a stock PS4 board.'});
}

export function startRows(): any[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SPEC_PREFIX}start`)
        .setLabel('Start build spec')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function startFiles() {
  return [bannerFile()];
}

export function wizardEmbed(spec: DroidSpec): EmbedBuilder {
  const {step, total, title} = stepMeta(spec);
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Droid Rollers · ${step} of ${total}`)
    .setDescription(`${title}\n\n${specText(spec)}`);

  if (spec.page === 'bb') {
    const current = spec.bbSlots[spec.bbCursor];
    const n = spec.bbCursor + 1;
    embed.addFields({
      name: spec.bbCount ? `Tick button ${String(n)} of ${spec.bbCount}` : 'How many buttons?',
      value: current?.height
        ? `This button: ${current.height} · ${current.side}`
        : 'Pick a height and side for this button. Same idea as Battle Beaver: each button gets its own spot.',
    });
    embed.setImage(`attachment://${PLACEMENT_NAME}`);
  }

  if (spec.page === 'look' && isSoftTouch(spec)) {
    embed.addFields({
      name: 'Soft Touch colour',
      value: spec.shellNote
        ? `Colour: ${spec.shellNote}. Add a shell photo on the next photo step.`
        : 'Tap **Shell colour**, then add a **shell photo** on the photo step.',
    });
  }

  if (spec.page === 'photos') {
    const shellDone = hasPhoto(spec, 'shell') ? 'saved' : 'needed';
    const facesDone = hasPhoto(spec, 'faces') ? 'saved' : 'optional';
    const backsDone = hasPhoto(spec, 'backs') ? 'saved' : (isBb(spec) ? 'needed' : 'optional');
    embed.addFields({
      name: 'How to add a photo',
      value: [
        '1. Tap **Add shell photo** (or faces / backs / other).',
        '2. **Paste or drag the image into this ticket.** Not a link.',
        '3. The bot copies it and deletes it from chat.',
        '',
        `Shell photo: **${shellDone}**`,
        `Faces photo: **${facesDone}**`,
        `Backs photo: **${backsDone}**`,
      ].join('\n'),
    });
    embed.setFooter({text: 'The ticket stays clean. Photos only show on the submitted custom build.'});
  } else if (spec.page !== 'bb') {
    embed.setFooter({text: 'Private until you submit. Andrew quotes, then sends a website checkout link.'});
  }

  return embed;
}

export function wizardFiles(spec: DroidSpec) {
  if (spec.page === 'bb') {
    return [placementFile()];
  }

  return [];
}

function navRow(spec: DroidSpec): ActionRowBuilder<ButtonBuilder> {
  const back = new ButtonBuilder()
    .setCustomId(`${SPEC_PREFIX}back`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(spec.page === 'core');

  if (spec.page === 'photos') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      back,
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}submit`).setLabel('Submit custom build').setStyle(ButtonStyle.Success),
    );
  }

  if (spec.page === 'look') {
    const buttons = [back];
    if (isSoftTouch(spec)) {
      buttons.push(
        new ButtonBuilder().setCustomId(`${SPEC_PREFIX}shellnote`).setLabel('Shell colour').setStyle(ButtonStyle.Secondary),
      );
    }

    buttons.push(
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}next`).setLabel('Next').setStyle(ButtonStyle.Primary),
    );
    return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
  }

  if (spec.page === 'bb') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      back,
      new ButtonBuilder()
        .setCustomId(`${SPEC_PREFIX}bbprev`)
        .setLabel('Prev button')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(spec.bbCursor <= 0),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}next`).setLabel('Next').setStyle(ButtonStyle.Primary),
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    back,
    new ButtonBuilder().setCustomId(`${SPEC_PREFIX}next`).setLabel('Next').setStyle(ButtonStyle.Primary),
  );
}

function coreRows(spec: DroidSpec): any[] {
  return [
    selectRow(`${SPEC_PREFIX}board`, spec.board || 'Board', [
      {label: 'SuiOvOi', value: 'SuiOvOi'},
      {label: 'HeliumStrike HS2 (Hyperstrike 2)', value: 'HeliumStrike HS2 (Hyperstrike 2)'},
    ], spec.board),
    selectRow(`${SPEC_PREFIX}sticks`, spec.sticks || 'Sticks', [
      {label: 'Ginfull RS13', value: 'Ginfull RS13'},
      {label: 'K-Silver JS13 Pro+', value: 'K-Silver JS13 Pro+'},
    ], spec.sticks),
    selectRow(`${SPEC_PREFIX}caps`, spec.caps || 'Stick caps', [
      {label: 'OEM', value: 'OEM'},
      {label: 'DSE style', value: 'DSE style'},
      {label: 'Leadjoy Magic n1', value: 'Leadjoy Magic n1'},
      {label: 'Leadjoy Magic n2', value: 'Leadjoy Magic n2'},
    ], spec.caps),
    selectRow(`${SPEC_PREFIX}faces`, spec.faces || 'Face buttons', [
      {label: 'Droid Rollers Standard', value: FACE_DROID_ROLLERS_STANDARD, description: 'Resin. Use this for mouse click on faces.'},
      {label: 'Xbox style', value: FACE_XBOX_MEMBRANE, description: 'Membrane only'},
      {label: 'Stock', value: FACE_STOCK_MEMBRANE, description: 'Membrane only'},
      {label: 'Stock white', value: FACE_STOCK_WHITE_MEMBRANE, description: 'Membrane only'},
    ], spec.faces),
    navRow(spec),
  ];
}

function lookRows(spec: DroidSpec): any[] {
  return [
    selectRow(`${SPEC_PREFIX}shell`, spec.shell || 'Shell', [
      {label: 'Soft Touch Shell', value: 'Soft Touch Shell', description: 'Type the colour, then add a shell photo'},
      {label: 'BO5 / themed', value: 'BO5 / themed', description: 'Add a photo of the shell'},
      {label: 'ExtremeRate Ghost', value: 'ExtremeRate Ghost', description: 'Add a photo of the shell'},
    ], spec.shell),
    selectRow(`${SPEC_PREFIX}backs`, spec.backs || 'Back buttons', [
      {label: 'None', value: 'None'},
      {label: 'DSE paddles (2)', value: 'DSE paddles (2)'},
      {label: 'Battle Beaver style', value: BACKS_BB},
    ], spec.backs),
    selectRow(`${SPEC_PREFIX}click`, spec.click || 'Click', [
      {label: 'None', value: 'None'},
      {label: 'Triggers + bumpers only', value: 'Triggers + bumpers only (L1/R1 + L2/R2)'},
      {label: 'Faces + triggers', value: CLICK_FACES, description: 'Needs Droid Rollers Standard resin faces'},
    ], spec.click),
    navRow(spec),
  ];
}

const HEIGHTS = ['High', 'Medium', 'Standard', "Buster's", 'Low', 'Lower'] as const;
const SIDES = ['Left', 'Right'] as const;

function bbRows(spec: DroidSpec): any[] {
  const current = spec.bbSlots[spec.bbCursor];
  const selected = current?.height ? `${current.height}|${current.side}` : undefined;
  const placeOpts: SelectOpt[] = [];
  for (const height of HEIGHTS) {
    for (const side of SIDES) {
      placeOpts.push({
        label: `${height} · ${side}`,
        value: `${height}|${side}`,
      });
    }
  }

  return [
    selectRow(`${SPEC_PREFIX}bbcount`, spec.bbCount ? `${spec.bbCount} buttons` : 'How many buttons? (1 to 8)', [
      {label: '1', value: '1'},
      {label: '2', value: '2'},
      {label: '3', value: '3'},
      {label: '4', value: '4'},
      {label: '5', value: '5'},
      {label: '6', value: '6'},
      {label: '7', value: '7'},
      {label: '8', value: '8'},
    ], spec.bbCount),
    selectRow(
      `${SPEC_PREFIX}bbplace`,
      selected ? `${selected.replace('|', ' · ')}` : `Button ${String(spec.bbCursor + 1)} placement`,
      placeOpts,
      selected,
      !spec.bbCount,
    ),
    navRow(spec),
  ];
}

function photoRows(spec: DroidSpec): any[] {
  const saved = (kind: PhotoKind, label: string) =>
    hasPhoto(spec, kind) ? `${label} (saved)` : label;

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photo-shell`).setLabel(saved('shell', 'Add shell photo')).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photo-faces`).setLabel(saved('faces', 'Add faces photo')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photo-backs`).setLabel(saved('backs', 'Add backs photo')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photo-other`).setLabel(saved('other', 'Add other photo')).setStyle(ButtonStyle.Secondary),
    ),
    navRow(spec),
  ];
}

export function wizardRows(spec: DroidSpec): any[] {
  if (spec.page === 'look') {
    return lookRows(spec);
  }

  if (spec.page === 'bb') {
    return bbRows(spec);
  }

  if (spec.page === 'photos') {
    return photoRows(spec);
  }

  return coreRows(spec);
}

export function photoWaitEmbed(kind: PhotoKind): EmbedBuilder {
  const label = kind === 'shell' ? 'SHELL' : kind.toUpperCase();
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Paste your ${label} photo now`)
    .setDescription(
      [
        `**Paste or drag the ${kind} photo into this ticket.**`,
        'Do it in the ticket chat, not here.',
        'You have **60 seconds**.',
        'The bot copies it, then deletes it from the ticket.',
      ].join('\n'),
    );
}

export function photoWaitRows(): any[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photocancel`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function photoKindRow(): any {
  return selectRow(`${SPEC_PREFIX}photokind`, 'What is this photo?', [
    {label: 'Shell', value: 'shell'},
    {label: 'Faces', value: 'faces'},
    {label: 'Backs', value: 'backs'},
    {label: 'Other', value: 'other'},
  ]);
}

export function nextPage(spec: DroidSpec): SpecPage {
  if (spec.page === 'core') {
    return 'look';
  }

  if (spec.page === 'look') {
    return isBb(spec) ? 'bb' : 'photos';
  }

  return 'photos';
}

export function prevPage(spec: DroidSpec): SpecPage {
  if (spec.page === 'photos') {
    return isBb(spec) ? 'bb' : 'look';
  }

  if (spec.page === 'bb') {
    return 'look';
  }

  if (spec.page === 'look') {
    return 'core';
  }

  return 'core';
}

export function submittedEmbed(spec: DroidSpec): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('Droid Rollers · custom build')
    .setDescription(specText(spec))
    .setImage(`attachment://${BANNER_NAME}`)
    .setFooter({text: 'Andrew will quote, then send a website checkout link.'});
}
