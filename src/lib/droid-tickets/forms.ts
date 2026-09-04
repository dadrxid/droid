import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type {TicketField, TicketKind} from './store.js';
import {
  cachedTicketPanel,
  panelTypeById,
  type TicketFormField,
  type TicketPanelType,
} from './site.js';

export const FORM_PAGE_SIZE = 5;

export function ticketType(kind: TicketKind): TicketPanelType | undefined {
  return panelTypeById(cachedTicketPanel(), kind);
}

export function formPages(type: TicketPanelType): TicketFormField[][] {
  const fields = type.formFields.length > 0 ? type.formFields : [{
    id: 'details',
    label: 'What do you need?',
    placeholder: '',
    paragraph: true,
    required: true,
    maxLength: 900,
  }];
  const pages: TicketFormField[][] = [];
  for (let index = 0; index < fields.length; index += FORM_PAGE_SIZE) {
    pages.push(fields.slice(index, index + FORM_PAGE_SIZE));
  }

  return pages;
}

export function ticketModal(kind: TicketKind, page = 0): ModalBuilder {
  const type = ticketType(kind);
  const pages = type ? formPages(type) : [];
  const fields = pages[page] ?? pages[0] ?? [];
  const title = type?.formTitle ? type.formTitle : 'Ticket request';
  const modal = new ModalBuilder()
    .setCustomId(`dt:form:${kind}:${String(page)}`)
    .setTitle(title.slice(0, 45));

  for (const input of fields) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(input.id)
          .setLabel(input.label.slice(0, 45))
          .setStyle(input.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(input.required)
          .setMaxLength(Math.min(4000, Math.max(1, input.maxLength)))
          .setPlaceholder((input.placeholder || ' ').slice(0, 100)),
      ),
    );
  }

  return modal;
}

export function readTicketFormPage(
  kind: TicketKind,
  page: number,
  read: (id: string) => string,
): TicketField[] {
  const type = ticketType(kind);
  if (!type) {
    return [];
  }

  const fields = formPages(type)[page] ?? [];
  return fields
    .map(input => ({label: input.label, value: read(input.id).trim()}))
    .filter(field => field.value.length > 0);
}

/** Reads the submitted modal into label/value pairs for Discord, the site and the transcript. */
export function readTicketForm(
  kind: TicketKind,
  read: (id: string) => string,
): TicketField[] {
  return readTicketFormPage(kind, 0, read);
}
