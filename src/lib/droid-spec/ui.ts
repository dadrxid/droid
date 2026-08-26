import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {BANNER_NAME, PLACEMENT_NAME, TAGLINE_NAME, bannerFile, placementFile} from './assets.js';
import {hasItem, liveItem, livePrices} from './menu.js';
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
  BACKS_BB,
  CLICK_FACES,
  FACE_DROID_ROLLERS_STANDARD,
  FACE_STOCK_MEMBRANE,
  FACE_STOCK_WHITE_MEMBRANE,
  FACE_XBOX_ABXY,
  FACE_XBOX_PS,
  type DroidSpec,
  type PhotoKind,
  type SpecPage,
  hasPhoto,
  isBb,
  isGhost,
  isSoftTouch,
  lockGhostCaps,
  specText,
} from './state.js';

export const SPEC_PREFIX = 'droidspec:';
export const BRAND_BLUE = 0x0088ff;

type SelectOpt = {label: string; value: string; description?: string; order?: number};

function tagFor(id: string, fallback: string): string {
  const item = liveItem(id);
  if (!item) {
    return fallback;
  }

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

function liveOpt(
  id: string,
  label: string,
  value: string,
  fallbackTag: string,
  description?: string,
): SelectOpt | null {
  if (!hasItem(id)) {
    return null;
  }

  const item = liveItem(id);
  return {
    label: priced(item?.label ? item.label : label, tagFor(id, fallbackTag)),
    value,
    description,
    order: item?.sortOrder,
  };
}

function extraGroupOpts(group: string, knownIds: string[]): SelectOpt[] {
  const skip = new Set(knownIds);
  return livePrices().items
    .filter(item => item.group === group && item.id.startsWith('extra-') && !skip.has(item.id))
    .map(item => ({
      label: priced(item.label, tagFor(item.id, item.priceGbp === null ? 'ask' : plusLabel(item.priceGbp))),
      value: item.id,
      order: item.sortOrder,
    }));
}

function compactOpts(list: Array<SelectOpt | null>): SelectOpt[] {
  return list
    .filter((row): row is SelectOpt => Boolean(row))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
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
      [
        `Custom 8K build spec. From ${gbp(livePrices().base)}.`,
        'Tap **Start build spec**. Only you will see the form until you submit.',
        'The total at the end is an estimate. Andrew confirms it when he is active.',
        'UK tracked postage is included.',
        'Shoulder buttons (L1 / R1) are not on this form. Ask Andrew if you want a set.',
      ].join('\n'),
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
  const quote = quoteSpec(spec);
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Droid Rollers · ${step} of ${total}`)
    .setDescription(
      [
        title,
        '',
        `**Estimate: ${quote.headline}**`,
        QUOTE_DISCLAIMER,
        '',
        specText(spec),
      ].join('\n'),
    );

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

  if (spec.page === 'core') {
    embed.addFields({
      name: 'Shoulder buttons (L1 / R1)',
      value: 'Not on this form. Low demand, but Andrew can still supply a set. Ask him after you submit.',
    });
  }

  if (spec.page === 'look' && isGhost(spec)) {
    embed.addFields({
      name: 'Ghost caps',
      value: 'Stock / OEM caps only. Leadjoy Magic n1 and n2 do not fit the Ghost analog well. Both are taken off the list.',
    });
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
    embed.setFooter({text: 'Private until you submit. Estimate only. Andrew confirms when he is active.'});
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
  lockGhostCaps(spec);
  const helium = liveItem('helium-hs2');
  const heliumTag = helium ? tagFor(helium.id, 'ask') : 'ask';
  const boardOpts = compactOpts([
    liveOpt('base', 'SuiOvOi', 'SuiOvOi', inBaseLabel()) ?? {label: priced('SuiOvOi', inBaseLabel()), value: 'SuiOvOi'},
    helium
      ? liveOpt(helium.id, helium.label, 'HeliumStrike HS2 (Hyperstrike 2)', heliumTag, helium.note)
      : (livePrices().live ? null : {label: priced('HeliumStrike HS2', 'ask'), value: 'HeliumStrike HS2 (Hyperstrike 2)', description: 'Board extra not set yet. Andrew will add it.'}),
  ]);
  const stickOpts = compactOpts([
    liveOpt('sticks-ginfull', 'Ginfull RS13', 'Ginfull RS13', inBaseLabel()),
    liveOpt('sticks-ksilver', 'K-Silver JS13 Pro+', 'K-Silver JS13 Pro+', inBaseLabel()),
    ...extraGroupOpts('sticks', ['sticks-ginfull', 'sticks-ksilver']),
  ]);
  const capOpts = isGhost(spec)
    ? compactOpts([liveOpt('caps-oem', 'OEM (stock)', 'OEM', inBaseLabel(), 'Ghost: Magic n1 and n2 do not fit')])
    : compactOpts([
      liveOpt('caps-oem', 'OEM', 'OEM', inBaseLabel()),
      liveOpt('caps-dse', 'DSE style', 'DSE style', plusLabel(livePrices().addons.dseCaps)),
      liveOpt('caps-leadjoy', 'Leadjoy Magic n1', 'Leadjoy Magic n1', plusLabel(livePrices().addons.leadjoyCaps)),
      liveOpt('caps-leadjoy', 'Leadjoy Magic n2', 'Leadjoy Magic n2', plusLabel(livePrices().addons.leadjoyCaps), 'n1 and n2 do not fit ExtremeRate Ghost'),
      ...extraGroupOpts('caps', ['caps-oem', 'caps-dse', 'caps-leadjoy', 'caps-ghost-leadjoy']),
    ]);
  const faceOpts = compactOpts([
    liveOpt('faces-resin', 'Droid Rollers Standard', FACE_DROID_ROLLERS_STANDARD, inBaseLabel(), 'Resin PlayStation icons. Needed for face mouse click.'),
    liveOpt('faces-xbox-ps', 'Xbox shape · PS icons', FACE_XBOX_PS, plusLabel(livePrices().addons.xboxFaces)),
    liveOpt('faces-xbox-abxy', 'Xbox shape · ABXY', FACE_XBOX_ABXY, plusLabel(livePrices().addons.xboxFaces)),
    liveOpt('faces-stock', 'Stock', FACE_STOCK_MEMBRANE, '£0', 'Stock PlayStation buttons'),
    liveOpt('faces-stock', 'Stock white', FACE_STOCK_WHITE_MEMBRANE, '£0', 'Stock white PlayStation buttons'),
    liveOpt('faces-silicone', 'Silicone instead of resin', 'faces-silicone', '£0'),
    ...extraGroupOpts('faces', ['faces-resin', 'faces-stock', 'faces-xbox-ps', 'faces-xbox-abxy', 'faces-silicone']),
  ]);

  return [
    selectRow(`${SPEC_PREFIX}board`, spec.board || 'Board', boardOpts.length ? boardOpts : [{label: priced('SuiOvOi', inBaseLabel()), value: 'SuiOvOi'}], spec.board),
    selectRow(`${SPEC_PREFIX}sticks`, spec.sticks || 'Sticks', stickOpts.length ? stickOpts : [
      {label: priced('Ginfull RS13', inBaseLabel()), value: 'Ginfull RS13'},
      {label: priced('K-Silver JS13 Pro+', inBaseLabel()), value: 'K-Silver JS13 Pro+'},
    ], spec.sticks),
    selectRow(`${SPEC_PREFIX}caps`, spec.caps || (isGhost(spec) ? 'Stock caps only (Ghost)' : 'Stick caps'), capOpts.length ? capOpts : [{label: priced('OEM', inBaseLabel()), value: 'OEM'}], spec.caps),
    selectRow(`${SPEC_PREFIX}faces`, spec.faces || 'Face buttons', faceOpts.length ? faceOpts : [
      {label: priced('Droid Rollers Standard', inBaseLabel()), value: FACE_DROID_ROLLERS_STANDARD},
    ], spec.faces),
    navRow(spec),
  ];
}

function lookRows(spec: DroidSpec): any[] {
  const shellOpts = compactOpts([
    liveOpt('shell-soft', 'Soft Touch Shell', 'Soft Touch Shell', plusLabel(livePrices().addons.softTouchShell), 'Type the colour, then add a shell photo'),
    liveOpt('shell-bo5', 'BO5 / themed', 'BO5 / themed', plusLabel(livePrices().addons.bo5Shell), 'Add a photo of the shell'),
    liveOpt('shell-ghost', 'ExtremeRate Ghost', 'ExtremeRate Ghost', plusLabel(livePrices().addons.ghostShell), 'Stock caps only. Magic n1 and n2 do not fit'),
    ...extraGroupOpts('shell', ['shell-soft', 'shell-bo5', 'shell-ghost']),
  ]);
  const backOpts = compactOpts([
    liveOpt('backs-none', 'None', 'None', '£0'),
    liveOpt('backs-dse', 'DSE paddles (2)', 'DSE paddles (2)', plusLabel(livePrices().addons.dsePaddles)),
    liveOpt('backs-bb', 'Battle Beaver style', BACKS_BB, plusLabel(livePrices().addons.bbStyleBacks), `${gbp(livePrices().addons.bbStyleBacks)} for 1 or 2 buttons, then ${plusLabel(livePrices().addons.bbExtraButton)} each extra`),
    ...extraGroupOpts('backs', ['backs-none', 'backs-dse', 'backs-bb', 'backs-bb-extra']),
  ]);
  const clickOpts = compactOpts([
    liveOpt('click-none', 'None', 'None', '£0'),
    liveOpt('click-triggers', 'Triggers + bumpers', 'Triggers + bumpers only (L1/R1 + L2/R2)', plusLabel(livePrices().addons.mouseClickTriggers)),
    liveOpt('click-faces', 'Faces + triggers', CLICK_FACES, plusLabel(livePrices().addons.mouseClickFacesAndTriggers), 'Needs Droid Rollers Standard resin PlayStation buttons'),
    ...extraGroupOpts('click', ['click-none', 'click-triggers', 'click-faces']),
  ]);

  return [
    selectRow(`${SPEC_PREFIX}shell`, spec.shell || 'Shell', shellOpts.length ? shellOpts : [
      {label: priced('Soft Touch Shell', plusLabel(livePrices().addons.softTouchShell)), value: 'Soft Touch Shell'},
    ], spec.shell),
    selectRow(`${SPEC_PREFIX}backs`, spec.backs || 'Back buttons', backOpts.length ? backOpts : [
      {label: priced('None', '£0'), value: 'None'},
    ], spec.backs),
    selectRow(`${SPEC_PREFIX}click`, spec.click || 'Click', clickOpts.length ? clickOpts : [
      {label: priced('None', '£0'), value: 'None'},
    ], spec.click),
    ...extrasRows(spec),
    navRow(spec),
  ];
}

function extrasRows(spec: DroidSpec): Array<ActionRowBuilder<StringSelectMenuBuilder>> {
  const extras = livePrices().extras.slice(0, 25);
  if (extras.length === 0) {
    return [];
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${SPEC_PREFIX}extras`)
    .setPlaceholder('Optional extras')
    .setMinValues(0)
    .setMaxValues(Math.min(extras.length, 25));
  for (const extra of extras) {
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${extra.label} · ${plusLabel(extra.priceGbp)}`.slice(0, 100))
        .setValue(extra.id)
        .setDefault(spec.extras.includes(extra.id)),
    );
  }

  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

const HEIGHTS = ['High', 'Medium', 'Standard', 'Buster\'s', 'Low', 'Lower'] as const;
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
    selectRow(`${SPEC_PREFIX}bbcount`, spec.bbCount ? `${spec.bbCount} buttons` : 'How many buttons? (1 to 8)', (
      [1, 2, 3, 4, 5, 6, 7, 8] as const
    ).map(count => ({
      label: priced(String(count), plusLabel(bbStyleAmount(String(count)))),
      value: String(count),
    })), spec.bbCount),
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
  const quote = quoteSpec(spec);
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('Droid Rollers · custom build')
    .setDescription(specText(spec))
    .addFields(
      {name: 'Estimate', value: quote.embedField},
      {
        name: 'Shoulder buttons (L1 / R1)',
        value: 'Not on this form. If you want a set, ask Andrew. He will add them to the confirmed total.',
      },
    )
    .setImage(`attachment://${TAGLINE_NAME}`)
    .setFooter({text: QUOTE_DISCLAIMER});
}
