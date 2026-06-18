import {Message} from 'discord.js';
import {tryReplyToDroidfixFaq} from '../utils/droidfix-faq-handler.js';

export default async (message: Message): Promise<void> => {
  try {
    await tryReplyToDroidfixFaq(message);
  } catch (error) {
    console.error('DroidFix FAQ auto-reply failed:', error);
  }
};
