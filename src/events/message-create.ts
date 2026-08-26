import {Message} from 'discord.js';
import {tryReplyToDroidfixFaq} from '../utils/droidfix-faq-handler.js';
import {captureTicketMessage} from '../lib/droid-tickets/messages.js';

export default async (message: Message): Promise<void> => {
  void captureTicketMessage(message);

  try {
    await tryReplyToDroidfixFaq(message);
  } catch (error) {
    console.error('DroidFix FAQ auto-reply failed:', error);
  }
};
