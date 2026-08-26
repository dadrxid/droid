import {Message, PartialMessage} from 'discord.js';
import {captureTicketMessageDelete} from '../lib/droid-tickets/messages.js';

export default async (message: Message | PartialMessage): Promise<void> => {
  await captureTicketMessageDelete(message);
};
