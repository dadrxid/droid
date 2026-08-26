import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {branded} from '../droid-brand.js';
import {BANNER_NAME, PLACEMENT_NAME, TAGLINE_NAME, bannerFile, placementFile} from './assets.js';
import {
  buildItems,
  defaultBoard,
  defaultBuild,
  liveGroup,
  livePrices,
  type LiveItem,
} from './menu.js';
import {
  bbStyleAmount,
  gbp,
  inBaseLabel,
  plusLabel,
  priced,
  quoteSpec,
  QUOTE_DISCLAIMER,
} from './quote.js';
import {
  CLICK_FACES,
  FACES_RESIN,
  MAX_BB,
  SHOULDERS_NONE,
  TENSION_NONE,
  BACKS_BB,
  type DroidSpec,
  type PhotoKind,
  type SpecPage,
  bbCount,
  colourButtonLabel,
  hasPhoto,
  isBb,
  isBo5,
  isGhost,
  lockGhostCaps,
  missingColour,
  needsColour,
  needsFacesColour,
  needsShellColour,
  specText,
} from './state.js';

export const SPEC_PREFIX = 'droidspec:';
export const BRAND_BLUE = 0x0088ff;

/** A Discord message takes 5 action rows, and the nav row is always one of them. */
const MAX_SELECT_ROWS = 4;

type SelectOpt = {label: string; value: string; description?: string; order?: number};

/** Short customer lines. Staff desk notes stay on the website, they do not show here. */
const OPTION_NOTES: Record<string, string> = {
  base: 'We supply the pad, build it here, and fit one 8K board',
  'build-ps5': 'We supply the pad, build it here, and fit one 8K board',
  'caps-dse': 'DSE style stick caps',
  'caps-leadjoy': 'Magic n1 or n2. These do not fit the Ghost shell',
  'shell-soft': 'Tap Colour after this pick, then type the colour you want',
  'shell-bo5': 'Add a photo of the shell on the last page',
  'shell-ghost': 'Stock caps only. Leadjoy Magic caps do not fit this shell',
  'faces-colour': 'Tap Colour after this pick, then type the colour you want',
  'faces-resin': 'Resin PlayStation icons. Included with the clicky full kit',
  'click-triggers': 'Mouse click on the triggers only',
  'click-bumpers': 'Mouse click on the bumpers and triggers',
  'click-faces': 'Faces, bumpers and triggers. Resin buttons come with this',
  'backs-bb': 'Tactile paddles. Next you pick how many, then height and side',
  'backs-dse': 'DSE blades or domes included',
  'shoulders-2': 'Two extra mouse-click buttons on the shoulders',
  'shoulders-4': 'Four extra mouse-click buttons on the shoulders',
};

function tagFor(item: LiveItem): string {
  if (item.inBase) {
    return inBaseLabel();
  }

  if (item.priceGbp === null) {
    return 'ask';
  }

  if (item.priceGbp === 0) {
    return '£0';
  }

  return plusLabel(item.priceGbp);
}

function optNote(item: LiveItem): string | undefined {
  if (OPTION_NOTES[item.id]) {
    return OPTION_NOTES[item.id];
  }

  if (item.id.startsWith('extra-') && item.note) {
    return item.note;
  }

  return undefined;
}

function toOpt(item: LiveItem): SelectOpt {
  return {
    label: priced(item.label, tagFor(item)),
    value: item.id,
    description: optNote(item),
    order: item.sortOrder,
  };
}

function groupOpts(group: string, drop: string[] = []): SelectOpt[] {
  const skip = new Set(drop);
  return liveGroup(group)
    .filter(item => !skip.has(item.id))
    .map(item => toOpt(item));
}

const BB_QTY_IDS = ['backs-bb-1', 'backs-bb-2', 'backs-bb-3', 'backs-bb-4', 'backs-bb-extra'];

/** Qty rows are priced on the how-many page, so they stay off this picker. */
function backOpts(): SelectOpt[] {
  const opts = groupOpts('backs', BB_QTY_IDS);
  const hasTactile = liveGroup('backs').some(item => /^backs-bb-[1-4]$/.test(item.id) || item.id === BACKS_BB);
  if (!hasTactile) {
    return opts;
  }

  return [
    {
      label: priced('Tactile Battle Beaver style', plusLabel(bbStyleAmount('2'))),
      value: BACKS_BB,
      description: OPTION_NOTES[BACKS_BB],
      order: 1,
    },
    ...opts,
  ];
}

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
      .setPlaceholder(placeholder.slice(0, 100))
      .setDisabled(disabled)
      .addOptions(options.slice(0, 25).map(opt => {
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

/** Skips the row when the desk has every row in that group switched off. */
function groupRow(
  field: string,
  placeholder: string,
  options: SelectOpt[],
  selected: string,
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  if (options.length === 0) {
    return null;
  }

  return selectRow(`${SPEC_PREFIX}${field}`, placeholder, options, selected);
}

function boardFloor(): number {
  const board = defaultBoard();
  return typeof board?.priceGbp === 'number' ? board.priceGbp : 0;
}

/** The base is a baseline, never a price on its own, so quote it with a board in it. */
function buildFloor(item?: LiveItem): number {
  const amount = typeof item?.priceGbp === 'number' ? item.priceGbp : livePrices().base;
  return amount + boardFloor();
}

function buildOpts(): SelectOpt[] {
  return buildItems().map(item => ({
    label: priced(item.label, `from ${gbp(buildFloor(item))}`),
    value: item.id,
    description: optNote(item),
    order: item.sortOrder,
  }));
}

/** The build select only earns a row once Andrew sells more than one build type. */
function showsBuildPicker(): boolean {
  return buildOpts().length > 1;
}

function extrasRow(spec: DroidSpec): ActionRowBuilder<StringSelectMenuBuilder> | null {
  const extras = livePrices().extras.slice(0, 25);
  if (extras.length === 0) {
    return null;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${SPEC_PREFIX}extras`)
    .setPlaceholder('Optional extras')
    .setMinValues(0)
    .setMaxValues(extras.length);
  for (const extra of extras) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(priced(extra.label, plusLabel(extra.priceGbp)))
        .setValue(extra.id)
        .setDefault(spec.extras.includes(extra.id)),
    );
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function pageOrder(spec: DroidSpec): SpecPage[] {
  const pages: SpecPage[] = ['core', 'look', 'mods'];
  if (isBb(spec)) {
    pages.push('bb');
  }

  pages.push('photos');
  return pages;
}

const PAGE_TITLES: Record<SpecPage, string> = {
  core: 'Board and sticks',
  look: 'Shells, caps and face buttons',
  mods: 'Clicky buttons, back buttons, shoulders',
  bb: 'Back button placements',
  photos: 'Add photos of shells and extras',
};

function stepMeta(spec: DroidSpec): {step: number; total: number; title: string} {
  const pages = pageOrder(spec);
  const index = pages.indexOf(spec.page);
  const title = spec.page === 'core' && showsBuildPicker()
    ? 'Build type, board and sticks'
    : PAGE_TITLES[spec.page];
  return {
    step: index === -1 ? 1 : index + 1,
    total: pages.length,
    title,
  };
}

/** Cheapest complete build: the in house build plus the cheapest board. */
function fromPrice(): number {
  return buildFloor(defaultBuild());
}

export function startEmbed(emoji = ''): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(branded(emoji, 'Droid Rollers build sheet'))
    .setDescription(
      [
        `Custom 8K pads from **${gbp(fromPrice())}**. Tap below and pick your parts.`,
        'Andrew supplies the pad, builds it, tests it and posts it out. Nothing to send in.',
        'Only you see the sheet until you submit. The price updates as you go.',
        'At the end you can add photos of shells, buttons and extras with the photo buttons.',
      ].join('\n'),
    )
    .setImage(`attachment://${BANNER_NAME}`)
    .setFooter({
      text: '8K custom boards only · prices as shown · UK tracked postage included',
    });
}

export function startRows(emoji = ''): any[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SPEC_PREFIX}start`)
        .setLabel('Start build sheet')
        .setEmoji(emoji ? emoji : '🎮')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function startFiles() {
  return [bannerFile()];
}

function colourFieldValue(spec: DroidSpec): string {
  const lines: string[] = [];
  if (needsShellColour(spec)) {
    lines.push(spec.shellNote ? `Shell colour: **${spec.shellNote}**` : 'Shell colour: **not set**');
  }

  if (needsFacesColour(spec)) {
    lines.push(spec.facesNote ? `Button colour: **${spec.facesNote}**` : 'Button colour: **not set**');
  }

  const missing = missingColour(spec);
  lines.push(missing.length === 0
    ? 'We will build to these colours. Tap the button again if you want to change them.'
    : `Tap **${colourButtonLabel(spec)}** and type the ${missing.join(' and ')}.`);
  return lines.join('\n');
}

export function wizardEmbed(spec: DroidSpec): EmbedBuilder {
  const {step, total, title} = stepMeta(spec);
  const quote = quoteSpec(spec);
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Droid Rollers · ${String(step)} of ${String(total)}`)
    .setDescription(
      [
        title,
        '',
        `**Total: ${quote.headline}**`,
        '',
        specText(spec),
      ].join('\n'),
    );

  if (spec.page === 'core') {
    embed.addFields({
      name: 'Built in house',
      value: 'Andrew supplies the pad and builds it from scratch. Every build takes one 8K board.',
    });
  }

  if (spec.page === 'bb') {
    const current = spec.bbSlots[spec.bbCursor];
    const count = bbCount(spec);
    const n = spec.bbCursor + 1;
    embed.addFields({
      name: count > 0
        ? `Tick button ${String(n)} of ${String(count)}`
        : `How many buttons? (1 to ${String(MAX_BB)})`,
      value: current?.height
        ? `This button: ${current.height} · ${current.side}`
        : 'Pick a height and side for this button. Tactile, Battle Beaver style: each button gets its own spot.',
    });
    embed.setImage(`attachment://${PLACEMENT_NAME}`);
  }

  if (spec.page === 'look') {
    embed.addFields({
      name: 'Photos',
      value: 'On the last page you can add photos of shells, buttons and anything else. Tap a photo button, then paste the image into this ticket.',
    });
  }

  if (spec.page === 'look' && isGhost(spec)) {
    embed.addFields({
      name: 'Ghost shell',
      value: 'This shell only works with stock stick caps. Leadjoy Magic caps do not fit, so they come off the list.',
    });
  }

  if (spec.page === 'look' && needsColour(spec)) {
    embed.addFields({
      name: 'Colours',
      value: colourFieldValue(spec),
    });
  }

  if ((spec.page === 'mods' || spec.page === 'look') && spec.click === CLICK_FACES) {
    embed.addFields({
      name: 'Clicky full kit',
      value: 'This kit includes resin PlayStation buttons. You do not pay for those separately.',
    });
  }

  if (spec.page === 'photos') {
    const shellDone = hasPhoto(spec, 'shell') ? 'saved' : (isBo5(spec) ? 'needed' : 'optional');
    const facesDone = hasPhoto(spec, 'faces') ? 'saved' : 'optional';
    const backsDone = hasPhoto(spec, 'backs') ? 'saved' : (isBb(spec) ? 'needed' : 'optional');
    embed.addFields({
      name: 'How to add a photo',
      value: [
        'Use the buttons below for shells, face buttons, back buttons or anything else.',
        '1. Tap the button that matches what you are sending.',
        '2. Paste or drag the image into this ticket. Not a link.',
        '3. The bot saves it, then removes it from chat.',
        '',
        `Shell photo: **${shellDone}**`,
        `Faces photo: **${facesDone}**`,
        `Backs photo: **${backsDone}**`,
      ].join('\n'),
    });
    embed.setFooter({text: 'Photos only show on the submitted build. The ticket stays clean.'});
  } else if (spec.page !== 'bb') {
    embed.setFooter({text: 'Last page: add photos of shells and extras with the buttons. Private until you submit.'});
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
  const pages = pageOrder(spec);
  const back = new ButtonBuilder()
    .setCustomId(`${SPEC_PREFIX}back`)
    .setLabel('Prev')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pages.indexOf(spec.page) <= 0);
  const buttons = [back];

  if (spec.page === 'look' && needsColour(spec)) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${SPEC_PREFIX}shellnote`)
        .setLabel(colourButtonLabel(spec))
        .setStyle(missingColour(spec).length === 0 ? ButtonStyle.Secondary : ButtonStyle.Primary),
    );
  }

  if (spec.page === 'bb') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${SPEC_PREFIX}bbprev`)
        .setLabel('Prev button')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(spec.bbCursor <= 0),
    );
  }

  buttons.push(
    spec.page === 'photos'
      ? new ButtonBuilder().setCustomId(`${SPEC_PREFIX}submit`).setLabel('Submit custom build').setStyle(ButtonStyle.Success)
      : new ButtonBuilder().setCustomId(`${SPEC_PREFIX}next`).setLabel('Next').setStyle(ButtonStyle.Primary),
  );
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

function withNav(
  spec: DroidSpec,
  rows: Array<ActionRowBuilder<StringSelectMenuBuilder> | null>,
): any[] {
  const selects = rows.filter((row): row is ActionRowBuilder<StringSelectMenuBuilder> => Boolean(row));
  return [...selects.slice(0, MAX_SELECT_ROWS), navRow(spec)];
}

function coreRows(spec: DroidSpec): any[] {
  const tensionOpts = groupOpts('tension');
  const build = spec.build ? spec.build : (defaultBuild()?.id ?? '');
  return withNav(spec, [
    showsBuildPicker()
      ? groupRow('build', 'What are you after?', buildOpts(), build)
      : null,
    groupRow('board', '8K board', groupOpts('boards'), spec.board),
    groupRow('sticks', 'Stick modules', groupOpts('sticks'), spec.sticks),
    tensionOpts.length === 0
      ? null
      : groupRow('tension', 'Stick tension', [
        {label: priced('Standard tension', inBaseLabel()), value: TENSION_NONE, order: 0},
        ...tensionOpts,
      ], spec.tension),
  ]);
}

function lookRows(spec: DroidSpec): any[] {
  lockGhostCaps(spec);
  const capOpts = groupOpts('caps', isGhost(spec) ? ['caps-leadjoy'] : []);
  const fullKit = spec.click === CLICK_FACES;
  const faceOpts = fullKit
    ? groupOpts('faces').filter(opt => opt.value === FACES_RESIN)
    : groupOpts('faces');
  return withNav(spec, [
    groupRow('shell', 'Front shell', groupOpts('shell'), spec.shell),
    groupRow('rear', 'Rear shell', groupOpts('rear'), spec.rear),
    groupRow('caps', isGhost(spec) ? 'Stick caps (OEM only on Ghost)' : 'Stick caps', capOpts, spec.caps),
    groupRow('faces', fullKit ? 'Face buttons (resin, with the kit)' : 'Face buttons', faceOpts, spec.faces),
  ]);
}

function modsRows(spec: DroidSpec): any[] {
  const shoulderOpts = groupOpts('shoulders');
  return withNav(spec, [
    groupRow('click', 'Button style', groupOpts('click'), spec.click),
    groupRow('backs', 'Back buttons', backOpts(), isBb(spec) ? BACKS_BB : spec.backs),
    shoulderOpts.length === 0
      ? null
      : groupRow('shoulders', 'Shoulder buttons', [
        {label: priced('No shoulder buttons', '£0'), value: SHOULDERS_NONE, order: 0},
        ...shoulderOpts,
      ], spec.shoulders),
    extrasRow(spec),
  ]);
}

const HEIGHTS = ['High', 'Medium', 'Standard', 'Buster\'s', 'Low', 'Lower'] as const;
const SIDES = ['Left', 'Right'] as const;

function countOpts(): SelectOpt[] {
  const opts: SelectOpt[] = [];
  for (let count = 1; count <= MAX_BB; count++) {
    opts.push({
      label: priced(count === 1 ? '1 button' : `${String(count)} buttons`, plusLabel(bbStyleAmount(String(count)))),
      value: String(count),
    });
  }

  return opts;
}

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

  const count = bbCount(spec);
  return [
    selectRow(
      `${SPEC_PREFIX}bbcount`,
      count > 0 ? `${String(count)} of ${String(MAX_BB)}` : `How many buttons? (1 to ${String(MAX_BB)})`,
      countOpts(),
      count > 0 ? String(count) : undefined,
    ),
    selectRow(
      `${SPEC_PREFIX}bbplace`,
      selected ? selected.replace('|', ' · ') : `Button ${String(spec.bbCursor + 1)} placement`,
      placeOpts,
      selected,
      count === 0,
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

  if (spec.page === 'mods') {
    return modsRows(spec);
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
  const pages = pageOrder(spec);
  const index = pages.indexOf(spec.page);
  if (index === -1) {
    return 'core';
  }

  return pages[Math.min(index + 1, pages.length - 1)] ?? 'photos';
}

export function prevPage(spec: DroidSpec): SpecPage {
  const pages = pageOrder(spec);
  const index = pages.indexOf(spec.page);
  if (index <= 0) {
    return 'core';
  }

  return pages[index - 1] ?? 'core';
}

export function submittedEmbed(spec: DroidSpec): EmbedBuilder {
  const quote = quoteSpec(spec);
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('Droid Rollers · custom build')
    .setDescription(specText(spec))
    .addFields(
      {name: 'Total', value: quote.embedField},
      {name: 'Postage', value: livePrices().postageNote},
    )
    .setImage(`attachment://${TAGLINE_NAME}`)
    .setFooter({text: QUOTE_DISCLAIMER});
}
