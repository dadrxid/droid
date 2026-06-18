import {DroidfixFaqContext, mentionChannel} from '../utils/droidfix-faq-context.js';

export interface DroidfixFaqEntry {
  id: string;
  triggers: string[];
  buildReply: (ctx: DroidfixFaqContext) => string;
}

function ticket(ctx: DroidfixFaqContext): string {
  return mentionChannel(ctx.links.ticketChannelId, '#open-ticket');
}

function ask(ctx: DroidfixFaqContext): string {
  return mentionChannel(ctx.links.askChannelId, '#ask');
}

function mailIn(ctx: DroidfixFaqContext): string {
  return mentionChannel(ctx.links.mailInChannelId, '#mail-in');
}

/** Most specific entries first. First match wins. */
export const DROIDFIX_FAQ_ENTRIES: DroidfixFaqEntry[] = [
  {
    id: 'xbox-one',
    triggers: ['xbox one', 'xbox 1', 'series one', 'old xbox controller'],
    buildReply: () => `**No.** Xbox **Series X|S Model 1914 only** (Share button between View and Menu on the front).

Xbox One controllers are not accepted.
Guide: https://droidfix.uk/services/xbox`,
  },
  {
    id: 'dualsense-edge',
    triggers: ['dualsense edge', 'ps5 edge', 'edge controller'],
    buildReply: () => `**No.** We do not accept DualSense Edge controllers.

Standard PS5 DualSense only.`,
  },
  {
    id: 'ps4-v1',
    triggers: ['ps4 v1', 'old dualshock', 'dualshock v1', 'v1 model'],
    buildReply: ctx => `PS4 **DualShock 4** only. Older PS4 V1 models are **not** accepted.

Not sure? Open ${ticket(ctx)} with a photo of the label before you order.`,
  },
  {
    id: 'third-party',
    triggers: ['scuf', 'third party', 'third-party', 'razr', 'razer', 'nacon', 'powera', 'aftermarket pad'],
    buildReply: ctx => `Third-party controllers are **not** accepted.

We repair official PS5 DualSense, PS4 DualShock 4, and Xbox Series Model 1914 only.
Ask in ${ask(ctx)} with a photo if unsure.`,
  },
  {
    id: 'track-order',
    triggers: ['track order', 'order status', 'where is my', 'df-s', 'df s', 'order reference', 'tracking number', 'tracking'],
    buildReply: ctx => `Track here: https://droidfix.uk/track

Use the **email you paid with** and your **DF-S** order reference (on your confirmation email).

Shows whether we have received your pad, work in progress, or dispatch.
For a specific update, open ${ticket(ctx)} with your DF-S ref.`,
  },
  {
    id: 'mail-in-address',
    triggers: ['mail in', 'mail-in', 'posting address', 'where do i send', 'send my controller', 'where to post', 'shipping address'],
    buildReply: ctx => `After you pay, your **confirmation email** has the posting address and your **DF-S** reference.

Quick steps (full pin in ${mailIn(ctx)}):
1. Pack securely · note inside with name + DF-S ref
2. **Tracked** UK post (Royal Mail Tracked 48/24)
3. Return postage already paid at checkout

We do not share the full address in public chat. Check your email or open ${ticket(ctx)}.`,
  },
  {
    id: 'packing',
    triggers: ['how to pack', 'how do i pack', 'tracked', 'royal mail', 'proof of postage', 'lost in post', 'lost in the mail'],
    buildReply: () => `Pack in bubble wrap or a small box inside a padded envelope. Remove batteries if you can.

Use **tracked** delivery and keep proof of postage.

If a parcel is lost without tracking, we cannot start work until the controller reaches us.`,
  },
  {
    id: 'cancel-before',
    triggers: ['cancel order', 'cancel before', 'changed my mind before', 'cancel my order'],
    buildReply: ctx => `You can cancel **before we start work**. If you already posted your controller, we return it unrepaired once received. You pay return postage.

Open ${ticket(ctx)} with your DF-S reference.`,
  },
  {
    id: 'returns',
    triggers: ['return', 'refund', 'change of mind', 'money back', 'cancel after', 'send it back'],
    buildReply: () => `**No change-of-mind returns** on completed repairs, mods, or refurbished stock. Each unit is tested before it leaves us.

You may cancel **before work starts**. No fix, no fee if we cannot complete the agreed repair.

Policy: https://droidfix.uk/returns`,
  },
  {
    id: 'turnaround',
    triggers: ['how long', 'turnaround', 'when will', 'how fast', 'delivery time', 'working days', 'how many days'],
    buildReply: () => `Most repairs (sticks, charging ports): **3 to 7 working days** from the day your controller **arrives** with us, not when you order.

Shell swaps and paddle kits: up to **5 weeks** (parts ordered per job).
Custom builds: **4 to 6 weeks**.

Track your order: https://droidfix.uk/track (email + DF-S reference)`,
  },
  {
    id: 'clock-start',
    triggers: ['when does the clock start', 'clock start', 'count from', 'starts when'],
    buildReply: () => `Turnaround starts when we **receive** your controller, not when you pay.

Most repairs: **3 to 7 working days** from arrival.`,
  },
  {
    id: 'shell-paddles',
    triggers: ['shell swap', 'shell change', 'paddle', 'back button', 'extreme rate', 'paddles'],
    buildReply: () => `Shell swaps and paddle kits take **up to 5 weeks** once we receive your controller. Parts are ordered per job.

Turnaround starts when your pad **arrives**, not when you order.`,
  },
  {
    id: 'custom-build',
    triggers: ['custom build', 'custom mod', 'custom controller', 'bespoke'],
    buildReply: ctx => `Custom builds need **4 to 6 weeks** from when your order is confirmed and we receive your controller.

No change-of-mind returns on completed custom work.
Quote via the site or open ${ticket(ctx)} before ordering if unsure.`,
  },
  {
    id: 'refurbished',
    triggers: ['refurbished', 'ready to ship', 'pre built', 'buy a controller', 'pre-built'],
    buildReply: () => `Refurbished controllers are **built, tested, and posted to you**. No mail-in needed.

Usually **2 to 3 working days** dispatch to UK addresses.
Every refurbished pad includes Hall effect or TMR sticks as standard.

Browse: https://droidfix.uk/services/refurbished`,
  },
  {
    id: 'stick-drift',
    triggers: ['stick drift', 'drifting', 'drift fix', 'hall effect', 'tmr', 'joystick', 'analog stick', 'thumbstick'],
    buildReply: () => `Stick drift is usually fixed with **Hall effect** or **TMR** stick replacements (both sticks).

Browse fixes: https://droidfix.uk
Typical turnaround once we receive your pad: **3 to 7 working days**.`,
  },
  {
    id: 'supported',
    triggers: ['what controllers', 'which controllers', 'do you fix', 'supported', 'what pads', 'what do you take', 'dualsense', 'dualshock', 'xbox series'],
    buildReply: ctx => `We repair:
· PS5 DualSense
· PS4 DualShock 4
· Xbox Wireless Controller **Model 1914** (Series X|S)

We do **not** accept Xbox One, DualSense Edge, third-party pads, or older PS4 V1 models.

Not sure? Ask in ${ask(ctx)} or open ${ticket(ctx)} with a photo of the label before you order.
Shop: https://droidfix.uk`,
  },
  {
    id: 'postage',
    triggers: ['postage', 'shipping cost', 'do i pay post', 'return postage', 'who pays shipping', 'postage cost'],
    buildReply: () => `Yes, **postage both ways**. You post to us from a **UK address** using tracked delivery.

Return postage (Royal Mail Tracked 24 or 48) is **added at checkout**, so your pad comes back tracked when work is done.`,
  },
  {
    id: 'warranty',
    triggers: ['warranty', 'guarantee', '90 day', '90-day', 'covered', 'guarantee period'],
    buildReply: () => `Every repair includes a **90-day guarantee** on our workmanship and the parts we fitted.

Does not cover wear, misuse, liquid damage, or unrelated faults.
Full policy: https://droidfix.uk/warranty

Claim: email **hello@droidfix.uk** with your name, DF-S reference, and what went wrong.`,
  },
  {
    id: 'no-fix',
    triggers: ['no fix', 'cannot fix', "can't fix", 'cant fix', 'unrepairable', 'if you cant fix', 'if you cannot fix'],
    buildReply: () => `**No fix, no fee.** If the agreed repair cannot be completed, you are not charged for that work.

We will explain why and return your controller. You pay return postage.`,
  },
  {
    id: 'payment',
    triggers: ['how do i pay', 'how to pay', 'payment', 'stripe', 'apple pay', 'google pay', 'card payment', 'pay with'],
    buildReply: () => `Pay securely online at checkout via **Stripe** (Visa, Mastercard, **Apple Pay**, **Google Pay**).

We never see or store your card details.`,
  },
  {
    id: 'bank-transfer',
    triggers: ['bank transfer', 'bacs', 'wire transfer'],
    buildReply: () => `Pay at checkout with card, **Apple Pay**, or **Google Pay** via Stripe.

We do not take manual bank transfers for shop orders.`,
  },
  {
    id: 'how-to-order',
    triggers: ['how to order', 'where to buy', 'shop', 'website', 'droidfix.uk', 'place an order', 'how do i order'],
    buildReply: ctx => `Order at **https://droidfix.uk** · pick your service · pay at checkout · post your controller tracked from a UK address.

Mail-in steps are pinned in ${mailIn(ctx)}. Address is in your **confirmation email** after payment.`,
  },
  {
    id: 'uk-only',
    triggers: ['international', 'outside uk', 'ireland', 'europe', 'ship to usa', 'non uk', 'overseas', 'abroad'],
    buildReply: () => `**UK mail-in only.** You must post from a **UK address**. We ship back to UK addresses.

We do not accept international mail-in at the moment.`,
  },
  {
    id: 'confirmation-email',
    triggers: ['confirmation email', 'receipt email', 'order email', 'didnt get email', "didn't get email"],
    buildReply: ctx => `Your confirmation email is sent after Stripe payment. It includes your **DF-S** reference and mail-in address.

Check spam. Still missing? Email **hello@droidfix.uk** or open ${ticket(ctx)} with the email you paid with.`,
  },
  {
    id: 'contact',
    triggers: ['contact', 'email', 'whatsapp', 'speak to andrew', 'hello@', 'get in touch', 'reach you'],
    buildReply: ctx => `Email: **hello@droidfix.uk** (quote your DF-S reference if you have one)
WhatsApp: link on https://droidfix.uk/contact

Discord: ${ask(ctx)} for general · ${ticket(ctx)} for orders and photos

Evenings and weekends for replies. Thanks for waiting.`,
  },
  {
    id: 'trustpilot',
    triggers: ['trustpilot', 'leave a review', 'write a review', 'review site'],
    buildReply: () => `If you are happy with your repair, a Trustpilot review helps a lot. Check your post-repair email if we sent an invite.`,
  },
  {
    id: 'charging-port',
    triggers: ['charging port', 'usb port', 'wont charge', "won't charge", 'not charging', 'charge port'],
    buildReply: () => `Charging port repairs are usually **3 to 7 working days** once we receive your controller.

Browse: https://droidfix.uk`,
  },
  {
    id: 'pricing',
    triggers: ['how much', 'price', 'cost', 'quote', 'what does it cost'],
    buildReply: ctx => `Fixed prices are on **https://droidfix.uk**. Pick your controller and service for the exact price at checkout.

Custom work: use the custom order form or open ${ticket(ctx)} for a quote.`,
  },
];

export function matchDroidfixFaq(message: string): DroidfixFaqEntry | null {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();

  if (normalized.length < 4) {
    return null;
  }

  for (const entry of DROIDFIX_FAQ_ENTRIES) {
    if (entry.triggers.some(trigger => normalized.includes(trigger))) {
      return entry;
    }
  }

  return null;
}

export function buildDroidfixFaqReply(entry: DroidfixFaqEntry, ctx: DroidfixFaqContext): string {
  return entry.buildReply(ctx);
}
