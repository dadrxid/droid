import {Message, PartialMessage} from 'discord.js';
import {hasFaqRepliedToMessage, tryReplyToDroidfixFaq} from '../utils/droidfix-faq-handler.js';
import {captureTicketMessage} from '../lib/droid-tickets/messages.js';

async function resolveMessage(message: Message | PartialMessage): Promise<Message | null> {
  if (message.partial) {
    try {
      return await message.fetch();
    } catch {
      return null;
    }
  }

  return message;
}

export default async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> => {
  try {
    const resolved = await resolveMessage(newMessage);

    if (!resolved) {
      return;
    }

    // Only a real edit sets editedAt, not Discord attaching a link embed.
    if (resolved.editedAt) {
      void captureTicketMessage(resolved);
    }

    const oldContent = oldMessage.content ?? '';
    const newContent = resolved.content ?? '';

    if (!newContent || oldContent === newContent) {
      return;
    }

    if (hasFaqRepliedToMessage(resolved.id)) {
      return;
    }

    await tryReplyToDroidfixFaq(resolved, {isEdit: true});
  } catch (error) {
    console.error('DroidFix FAQ edit auto-reply failed:', error);
  }
};
