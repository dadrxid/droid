import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type {TicketField, TicketKind} from './store.js';

/**
 * Discord caps a modal at 5 text inputs, labels at 45 characters and
 * placeholders at 100, so both forms are written to fit in one screen.
 */

type FormInput = {
  id: string;
  label: string;
  paragraph: boolean;
  required: boolean;
  max: number;
  placeholder: string;
};

type TicketForm = {
  title: string;
  inputs: FormInput[];
};

export const TICKET_FORMS: Record<TicketKind, TicketForm> = {
  custom: {
    title: 'Custom build request',
    inputs: [
      {
        id: 'want',
        label: 'What are you after?',
        paragraph: true,
        required: true,
        max: 900,
        placeholder: 'e.g. 8K pad, themed shell, back paddles, mouse click',
      },
      {
        id: 'have',
        label: 'Have you got the controller already?',
        paragraph: false,
        required: true,
        max: 100,
        placeholder: 'Yes / No, I need one supplying',
      },
      {
        id: 'country',
        label: 'Which country are you in?',
        paragraph: false,
        required: true,
        max: 60,
        placeholder: 'e.g. UK, Ireland, Germany',
      },
    ],
  },
  repair: {
    title: 'Repair request',
    inputs: [
      {
        id: 'model',
        label: 'Which controller is it?',
        paragraph: false,
        required: true,
        max: 100,
        placeholder: 'e.g. PS5 DualSense, PS4 DualShock, Xbox',
      },
      {
        id: 'fault',
        label: 'What is it doing?',
        paragraph: true,
        required: true,
        max: 900,
        placeholder: 'e.g. left stick drifts, R2 not clicking, no charge',
      },
      {
        id: 'tried',
        label: 'When did it start? Tried anything?',
        paragraph: true,
        required: false,
        max: 500,
        placeholder: 'e.g. started last month, reset and new cable',
      },
      {
        id: 'where',
        label: 'UK postcode area for return postage',
        paragraph: false,
        required: true,
        max: 60,
        placeholder: 'e.g. TS1. UK mail-in only',
      },
      {
        id: 'order',
        label: 'Order number if you have one',
        paragraph: false,
        required: false,
        max: 60,
        placeholder: 'From your DroidFix confirmation email',
      },
    ],
  },
};

export function ticketModal(kind: TicketKind): ModalBuilder {
  const form = TICKET_FORMS[kind];
  const modal = new ModalBuilder()
    .setCustomId(`dt:form:${kind}`)
    .setTitle(form.title);

  for (const input of form.inputs) {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(input.id)
          .setLabel(input.label)
          .setStyle(input.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(input.required)
          .setMaxLength(input.max)
          .setPlaceholder(input.placeholder),
      ),
    );
  }

  return modal;
}

/** Reads the submitted modal into label/value pairs for Discord, the site and the transcript. */
export function readTicketForm(
  kind: TicketKind,
  read: (id: string) => string,
): TicketField[] {
  return TICKET_FORMS[kind].inputs
    .map(input => ({label: input.label, value: read(input.id).trim()}))
    .filter(field => field.value.length > 0);
}
