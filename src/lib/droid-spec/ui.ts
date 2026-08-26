import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {type DroidSpec, photoKindLabel, specText} from './state.js';

export const SPEC_PREFIX = 'droidspec:';

function selectRow(
  customId: string,
  placeholder: string,
  options: Array<{label: string; value: string}>,
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options.map(opt => new StringSelectMenuOptionBuilder().setLabel(opt.label).setValue(opt.value))),
  );
}

export function specEmbed(spec: DroidSpec): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x0088ff)
    .setTitle('Build spec for Andrew')
    .setDescription(
      `${specText(spec)}\n\n8K custom boards only. Not a stock PS4 board.\nPaste or drag photos in this ticket after **Add photo**.`,
    )
    .setFooter({text: 'Andrew will quote, then send a website checkout link.'});
}

export function formRows(): any[] {
  return [
    selectRow(`${SPEC_PREFIX}board`, 'Board', [
      {label: 'SuiOvOi', value: 'SuiOvOi'},
      {label: 'HeliumStrike HS2 (Hyperstrike 2)', value: 'HeliumStrike HS2 (Hyperstrike 2)'},
    ]),
    selectRow(`${SPEC_PREFIX}sticks`, 'Sticks', [
      {label: 'Ginfull RS13', value: 'Ginfull RS13'},
      {label: 'K-Silver JS13 Pro+', value: 'K-Silver JS13 Pro+'},
    ]),
    selectRow(`${SPEC_PREFIX}caps`, 'Stick caps', [
      {label: 'OEM', value: 'OEM'},
      {label: 'DSE style', value: 'DSE style'},
      {label: 'Leadjoy Magic n1', value: 'Leadjoy Magic n1'},
      {label: 'Leadjoy Magic n2', value: 'Leadjoy Magic n2'},
    ]),
    selectRow(`${SPEC_PREFIX}shell`, 'Shell', [
      {label: 'Soft Touch Shell', value: 'Soft Touch Shell'},
      {label: 'BO5 / themed', value: 'BO5 / themed'},
      {label: 'ExtremeRate Ghost', value: 'ExtremeRate Ghost'},
    ]),
    selectRow(`${SPEC_PREFIX}faces`, 'Face buttons', [
      {label: 'DR Standard (resin)', value: 'DR Standard (resin buttons)'},
      {label: 'Xbox style (membrane only)', value: 'Xbox style face buttons (membrane only)'},
      {label: 'Stock / standard', value: 'Stock / standard face buttons'},
      {label: 'Stock / standard white', value: 'Stock / standard face buttons but white'},
    ]),
  ];
}

export function extraRows(): any[] {
  return [
    selectRow(`${SPEC_PREFIX}backs`, 'Back buttons', [
      {label: 'None', value: 'None'},
      {label: 'DSE paddles (2)', value: 'DSE paddles (2)'},
      {label: 'Battle Beaver style', value: 'Battle Beaver style'},
    ]),
    selectRow(`${SPEC_PREFIX}click`, 'Click', [
      {label: 'None', value: 'None'},
      {label: 'Triggers + bumpers only', value: 'Triggers + bumpers only (L1/R1 + L2/R2)'},
      {label: 'Faces + triggers', value: 'Faces + triggers'},
    ]),
    selectRow(`${SPEC_PREFIX}bbcount`, 'Battle Beaver count (if BB)', [
      {label: '1', value: '1'},
      {label: '2', value: '2'},
      {label: '3', value: '3'},
      {label: '4', value: '4'},
      {label: '5', value: '5'},
      {label: '6', value: '6'},
      {label: '7', value: '7'},
      {label: '8', value: '8'},
    ]),
    selectRow(`${SPEC_PREFIX}bbplace`, 'Battle Beaver height (if BB)', [
      {label: 'High', value: 'High'},
      {label: 'Medium', value: 'Medium'},
      {label: 'Standard', value: 'Standard'},
      {label: 'Low', value: 'Low'},
      {label: 'Lower', value: 'Lower'},
    ]),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}photo`).setLabel('Add photo').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}shellnote`).setLabel('Shell colour').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}bbnote`).setLabel('BB left/right notes').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${SPEC_PREFIX}submit`).setLabel('Submit spec').setStyle(ButtonStyle.Success),
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

export function photoSummary(spec: DroidSpec): string {
  if (spec.photos.length === 0) {
    return 'No photos yet.';
  }

  return spec.photos.map(photo => `${photoKindLabel(photo.kind)}: ${photo.name}`).join('\n');
}
