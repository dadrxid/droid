import {DroidfixFaqContext, mentionChannel} from '../utils/droidfix-faq-context.js';
import {matchDroidfixFaq as matchFromEngine} from './droidfix-faq-matcher.js';

export interface DroidfixFaqEntry {
  id: string;
  triggers: string[];
  patterns?: RegExp[];
  requireAll?: string[];
  requireAny?: string[];
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

const EDGE_NOT_YET_LINE = 'DualSense Edge is **not accepted yet** (Edge module support is planned).';

/** Most specific entries first. Highest match score wins. */
export const DROIDFIX_FAQ_ENTRIES: DroidfixFaqEntry[] = [
  {
    id: 'xbox-one',
    triggers: [
      'xbox one',
      'xbox 1',
      'series one',
      'old xbox controller',
      'xboxone',
      'one controller',
      'xbox one pad',
      'original xbox controller',
    ],
    patterns: [
      /\bxbox\s*one\b/i,
      /\bxb1\b/i,
      /\bxbone\b/i,
      /\bxbox\s*360\b/i,
      /\bdo you (?:take|fix|repair|accept) (?:the )?xbox one\b/i,
    ],
    requireAny: ['xbox', 'xb1', 'xbone', 'series'],
    buildReply: () => `**No.** Xbox **Series X|S Model 1914 only** (Share button between View and Menu on the front).

Xbox One controllers are not accepted.
Guide: https://droidfix.uk/services/xbox`,
  },
  {
    id: 'xbox-elite',
    triggers: ['elite series', 'xbox elite', 'elite 2', 'elite controller', 'series 2 elite'],
    patterns: [/\belite\s*(?:series\s*)?2\b/i, /\bxbox\s*elite\b/i],
    buildReply: () => `**No.** Xbox Elite Series 2 is **not accepted** at the moment.

We repair Xbox Wireless Controller **Model 1914** (Series X|S) only.`,
  },
  {
    id: 'dualsense-edge',
    triggers: [
      'dualsense edge',
      'ps5 edge',
      'edge controller',
      'dual sense edge',
      'ds edge',
      'edge dualsense',
      'edge modules',
      'dualsense edge modules',
      'edge module',
    ],
    patterns: [/\bdual\s*sense\s*edge\b/i, /\bps5\s*edge\b/i, /\bedge\s*modules?\b/i],
    buildReply: ctx => `${EDGE_NOT_YET_LINE}

Standard PS5 DualSense only for now. We will announce in Discord and on the shop when Edge modules go live.
Questions? ${ask(ctx)} or ${ticket(ctx)}.`,
  },
  {
    id: 'ps4-v1',
    triggers: [
      'ps4 v1',
      'old dualshock',
      'dualshock v1',
      'v1 model',
      'v1 pad',
      'cuh-zct1',
      'cuh zct1',
      'black buttons',
      'first gen ps4',
      'old ps4',
      'ps4 version 1',
      'zct1',
    ],
    patterns: [
      /\bps4\s*v\s*1\b/i,
      /\bv1\s*(?:ps4|pad|controller|dualshock)\b/i,
      /\bcuh[- ]?zct1\b/i,
      /\bblack\s*buttons\b/i,
    ],
    requireAny: ['v1', 'zct1', 'black buttons', 'first gen'],
    buildReply: ctx => `**No.** Older PS4 **V1** pads (CUH-ZCT1, black face buttons, no light through the touchpad) are **not** accepted.

We need DualShock 4 **V2** with **JDM-040, JDM-050 or JDM-055** only.
Not sure? Open ${ticket(ctx)} with photos of the label and front before you order.`,
  },
  {
    id: 'ps4-jdm',
    triggers: [
      'jdm',
      'jdm-040',
      'jdm-050',
      'jdm-055',
      'jdm 040',
      'jdm 050',
      'jdm 055',
      'cuh-zct2',
      'cuh zct2',
      'zct2',
      'ps4 model',
      'which ps4',
      'what ps4 model',
      'ps4 version',
      'grey buttons',
      'gray buttons',
      'v2 pad',
      'dualshock 4 model',
      'what model ps4',
      'ps4 jdm',
      'jdm model',
    ],
    patterns: [
      /\bjdm\b/i,
      /\bjdm[- ]?0?(40|50|55)\b/i,
      /\bcuh[- ]?zct2\b/i,
      /what ps4 model/i,
      /which ps4 (?:model|version|pad|controller)/i,
      /ps4 model do i need/i,
    ],
    requireAny: ['ps4', 'jdm', 'dualshock', 'zct2'],
    buildReply: ctx => `PS4 **DualShock 4 V2 only** · **JDM-040, JDM-050 or JDM-055**.

Quick check (no need to open the shell):
· Back label starts **CUH-ZCT2**
· **Grey** face buttons, not black
· Light bar glows through the top edge of the touchpad

**Not accepted:** JDM-001/011/020/030, CUH-ZCT1 V1 pads, third-party pads.
Unsure? Open ${ticket(ctx)} with label + front photos before you post.`,
  },
  {
    id: 'ps5-bdm',
    triggers: [
      'bdm',
      'ps5 model',
      'which ps5',
      'dualsense model',
      'what ps5 model',
      'bdm model',
      'ps5 bdm',
    ],
    patterns: [
      /\bbdm\b/i,
      /which ps5 (?:model|version|controller)/i,
      /what ps5 model/i,
    ],
    requireAny: ['ps5', 'bdm', 'dualsense'],
    buildReply: () => `PS5 **Sony DualSense** only for now. ${EDGE_NOT_YET_LINE}

For shell swaps and some parts, **BDM model matters**. Check yours before ordering parts:
https://www.extremerate.com/blogs/replacement-guides/how-to-check-your-ps5-controller-bdm-model

Standard stick/charging repairs: any genuine DualSense.`,
  },
  {
    id: 'ps4-overview',
    triggers: ['ps4 controller', 'ps4 pad', 'ps4 dualshock', 'take ps4', 'fix ps4', 'repair ps4'],
    patterns: [
      /^ps4\s*\?*$/i,
      /^do you (?:take|fix|repair|accept) (?:my )?ps4\b/i,
      /^what about ps4\b/i,
      /^ps4\??$/i,
    ],
    buildReply: ctx => `Yes, **PS4 DualShock 4 V2** with **JDM-040, JDM-050 or JDM-055**.

**Not accepted:** PS4 V1 (black buttons), third-party pads.
Ask in ${ask(ctx)} or open ${ticket(ctx)} with a label photo if you are unsure.`,
  },
  {
    id: 'ps5-overview',
    triggers: ['ps5 controller', 'ps5 pad', 'take ps5', 'fix ps5', 'repair ps5'],
    patterns: [
      /^ps5\s*\?*$/i,
      /^do you (?:take|fix|repair|accept) (?:my )?ps5\b/i,
    ],
    buildReply: () => `Yes, standard **PS5 DualSense**. ${EDGE_NOT_YET_LINE}

Hall effect stick drift fixes, charging ports, shell swaps and more: https://droidfix.uk/services/ps5`,
  },
  {
    id: 'xbox-overview',
    triggers: ['xbox series', 'series x', 'series s', 'model 1914', '1914'],
    patterns: [
      /^xbox\s*\?*$/i,
      /^do you (?:take|fix|repair) (?:my )?xbox\b/i,
      /\bmodel\s*1914\b/i,
    ],
    requireAny: ['xbox', '1914', 'series'],
    buildReply: () => `Yes, **Xbox Wireless Controller Model 1914** (Series X|S) only.

Look for the **Share** button between View and Menu on the front. Xbox One pads are not accepted.
Guide: https://droidfix.uk/services/xbox`,
  },
  {
    id: 'third-party',
    triggers: [
      'scuf',
      'third party',
      'third-party',
      'razr',
      'razer',
      'nacon',
      'powera',
      'aftermarket pad',
      'fake controller',
      'clone controller',
      'knock off',
      'knockoff',
      'counterfeit',
      'hori',
      'pdp',
    ],
    buildReply: ctx => `Third-party controllers are **not** accepted.

We repair official PS5 DualSense, PS4 DualShock 4 (JDM-040/050/055), and Xbox Series Model 1914 only.
Ask in ${ask(ctx)} with a photo if unsure.`,
  },
  {
    id: 'track-order',
    triggers: [
      'track order',
      'order status',
      'where is my',
      'df-s',
      'dataf-s',
      'order reference',
      'tracking number',
      'tracking',
      'where is my order',
      'has it arrived',
      'status of my order',
      'where s my',
      'wheres my',
    ],
    patterns: [
      /\bdf[-\s]?s\b/i,
      /where(?:'s| is) my (?:order|controller|pad)/i,
      /track(?:ing)? (?:my )?order/i,
    ],
    buildReply: ctx => `Track here: https://droidfix.uk/track

Use the **email you paid with** and your **DF-S** order reference (on your confirmation email).

Shows whether we have received your pad, work in progress, or dispatch.
For a specific update, open ${ticket(ctx)} with your DF-S ref.`,
  },
  {
    id: 'mail-in-address',
    triggers: [
      'mail in',
      'mail-in',
      'posting address',
      'where do i send',
      'send my controller',
      'where to post',
      'shipping address',
      'where do i post',
      'what address',
      'send address',
      'postal address',
    ],
    patterns: [
      /where (?:do i|should i) (?:send|post)/i,
      /what(?:'s| is) the (?:address|posting address)/i,
    ],
    buildReply: ctx => `After you pay, your **confirmation email** has the posting address and your **DF-S** reference.

Quick steps (full pin in ${mailIn(ctx)}):
1. Pack securely · note inside with name + DF-S ref
2. **Tracked** UK post (Royal Mail Tracked 48/24)
3. Return postage already paid at checkout

We do not share the full address in public chat. Check your email or open ${ticket(ctx)}.`,
  },
  {
    id: 'packing',
    triggers: [
      'how to pack',
      'how do i pack',
      'tracked',
      'royal mail',
      'proof of postage',
      'lost in post',
      'lost in the mail',
      'pack my controller',
      'packing',
    ],
    buildReply: () => `Pack in bubble wrap or a small box inside a padded envelope. Remove batteries if you can.

Use **tracked** delivery and keep proof of postage.

If a parcel is lost without tracking, we cannot start work until the controller reaches us.`,
  },
  {
    id: 'cancel-before',
    triggers: [
      'cancel order',
      'cancel before',
      'changed my mind before',
      'cancel my order',
      'cancel if',
      'want to cancel',
    ],
    buildReply: ctx => `You can cancel **before we start work**. If you already posted your controller, we return it unrepaired once received. You pay return postage.

Open ${ticket(ctx)} with your DF-S reference.`,
  },
  {
    id: 'returns',
    triggers: [
      'return',
      'refund',
      'change of mind',
      'money back',
      'cancel after',
      'send it back',
      'get a refund',
      'want my money back',
    ],
    buildReply: () => `**No change-of-mind returns** on completed repairs, mods, or refurbished stock. Each unit is tested before it leaves us.

You may cancel **before work starts**. No fix, no fee if we cannot complete the agreed repair.

Policy: https://droidfix.uk/returns`,
  },
  {
    id: 'turnaround',
    triggers: [
      'how long',
      'turnaround',
      'when will',
      'how fast',
      'delivery time',
      'working days',
      'how many days',
      'repair time',
      'how long does',
      'how long will',
      'when will i get',
    ],
    patterns: [
      /how long (?:does|will|is)/i,
      /when will (?:it|i|my)/i,
    ],
    buildReply: () => `Most repairs (sticks, charging ports): **3 to 7 working days** from the day your controller **arrives** with us, not when you order.

Shell swaps and paddle kits: up to **5 weeks** (parts ordered per job).
Custom builds: **4 to 6 weeks**.

Track your order: https://droidfix.uk/track (email + DF-S reference)`,
  },
  {
    id: 'clock-start',
    triggers: ['when does the clock start', 'clock start', 'count from', 'starts when', 'countdown start'],
    buildReply: () => `Turnaround starts when we **receive** your controller, not when you pay.

Most repairs: **3 to 7 working days** from arrival.`,
  },
  {
    id: 'shell-paddles',
    triggers: [
      'shell swap',
      'shell change',
      'paddle',
      'back button',
      'extreme rate',
      'extremerate',
      'paddles',
      'back paddles',
      'paddle kit',
    ],
    buildReply: () => `Shell swaps and paddle kits take **up to 5 weeks** once we receive your controller. Parts are ordered per job.

Turnaround starts when your pad **arrives**, not when you order.`,
  },
  {
    id: 'custom-build',
    triggers: ['custom build', 'custom mod', 'custom controller', 'bespoke', 'custom order'],
    buildReply: ctx => `Custom builds need **4 to 6 weeks** from when your order is confirmed and we receive your controller.

No change-of-mind returns on completed custom work.
Quote via the site or open ${ticket(ctx)} before ordering if unsure.`,
  },
  {
    id: 'refurbished',
    triggers: [
      'refurbished',
      'ready to ship',
      'pre built',
      'buy a controller',
      'pre-built',
      'refurb',
      'ready made',
      'in stock controller',
    ],
    buildReply: () => `Refurbished controllers are **built, tested, and posted to you**. No mail-in needed.

Usually **2 to 3 working days** dispatch to UK addresses.
Every refurbished pad includes Hall effect or TMR sticks as standard.

Browse: https://droidfix.uk/services/refurbished`,
  },
  {
    id: 'stick-drift',
    triggers: [
      'stick drift',
      'drifting',
      'drift fix',
      'hall effect',
      'tmr',
      'joystick',
      'analog stick',
      'thumbstick',
      'thumb stick',
      'analogue drift',
      'left stick',
      'right stick',
      'sticks drifting',
      'stick drif',
    ],
    patterns: [/drif+\??$/i, /\bdrift(?:ing)?\b/i],
    buildReply: () => `Stick drift is usually fixed with **Hall effect** or **TMR** stick replacements (both sticks).

Browse fixes: https://droidfix.uk
Typical turnaround once we receive your pad: **3 to 7 working days**.`,
  },
  {
    id: 'supported',
    triggers: [
      'what controllers',
      'which controllers',
      'do you fix',
      'supported',
      'what pads',
      'what do you take',
      'dualsense',
      'dualshock',
      'xbox series',
      'what do you repair',
      'compatible',
      'compatibility',
      'accept my',
      'take my controller',
    ],
    patterns: [
      /what (?:controllers|pads) do you/i,
      /which (?:controllers|pads)/i,
    ],
    requireAny: ['controller', 'pad', 'dualsense', 'dualshock', 'xbox', 'ps4', 'ps5', 'fix', 'repair', 'take', 'accept'],
    buildReply: ctx => `We repair:
· PS5 DualSense (Edge not yet · modules planned)
· PS4 DualShock 4 **JDM-040/050/055** (V2 only)
· Xbox Wireless Controller **Model 1914** (Series X|S)

We do **not** accept Xbox One, Elite Series 2, third-party pads, or PS4 V1. ${EDGE_NOT_YET_LINE}

Not sure? Ask in ${ask(ctx)} or open ${ticket(ctx)} with a photo of the label before you order.
Shop: https://droidfix.uk`,
  },
  {
    id: 'postage',
    triggers: [
      'postage',
      'shipping cost',
      'do i pay post',
      'return postage',
      'who pays shipping',
      'postage cost',
      'postage both ways',
      'do i pay shipping',
      'shipping fee',
    ],
    buildReply: () => `Yes, **postage both ways**. You post to us from a **UK address** using tracked delivery.

Return postage (Royal Mail Tracked 24 or 48) is **added at checkout**, so your pad comes back tracked when work is done.`,
  },
  {
    id: 'warranty',
    triggers: [
      'warranty',
      'guarantee',
      '90 day',
      '90-day',
      'covered',
      'guarantee period',
      'warrantee',
      'warrenty',
    ],
    buildReply: () => `Every repair includes a **90-day guarantee** on our workmanship and the parts we fitted.

Does not cover wear, misuse, liquid damage, or unrelated faults.
Full policy: https://droidfix.uk/warranty

Claim: email **hello@droidfix.uk** with your name, DF-S reference, and what went wrong.`,
  },
  {
    id: 'no-fix',
    triggers: [
      'no fix',
      'cannot fix',
      'can\'t fix',
      'cant fix',
      'unrepairable',
      'if you cant fix',
      'if you cannot fix',
      'what if you cant',
    ],
    buildReply: () => `**No fix, no fee.** If the agreed repair cannot be completed, you are not charged for that work.

We will explain why and return your controller. You pay return postage.`,
  },
  {
    id: 'payment',
    triggers: [
      'how do i pay',
      'how to pay',
      'payment',
      'stripe',
      'apple pay',
      'google pay',
      'card payment',
      'pay with',
      'debit card',
      'credit card',
    ],
    buildReply: () => `Pay securely online at checkout via **Stripe** (Visa, Mastercard, **Apple Pay**, **Google Pay**).

We never see or store your card details.`,
  },
  {
    id: 'bank-transfer',
    triggers: ['bank transfer', 'bacs', 'wire transfer', 'pay by bank'],
    buildReply: () => `Pay at checkout with card, **Apple Pay**, or **Google Pay** via Stripe.

We do not take manual bank transfers for shop orders.`,
  },
  {
    id: 'how-to-order',
    triggers: [
      'how to order',
      'where to buy',
      'shop',
      'website',
      'droidfix.uk',
      'place an order',
      'how do i order',
      'how do i book',
    ],
    buildReply: ctx => `Order at **https://droidfix.uk** · pick your service · pay at checkout · post your controller tracked from a UK address.

Mail-in steps are pinned in ${mailIn(ctx)}. Address is in your **confirmation email** after payment.`,
  },
  {
    id: 'uk-only',
    triggers: [
      'international',
      'outside uk',
      'ireland',
      'europe',
      'ship to usa',
      'non uk',
      'overseas',
      'abroad',
      'ship abroad',
      'from america',
      'from canada',
    ],
    buildReply: () => `**UK mail-in only.** You must post from a **UK address**. We ship back to UK addresses.

We do not accept international mail-in at the moment.`,
  },
  {
    id: 'confirmation-email',
    triggers: [
      'confirmation email',
      'receipt email',
      'order email',
      'didnt get email',
      'didn\'t get email',
      'no email',
      'missing email',
      'email not received',
    ],
    buildReply: ctx => `Your confirmation email is sent after Stripe payment. It includes your **DF-S** reference and mail-in address.

Check spam. Still missing? Email **hello@droidfix.uk** or open ${ticket(ctx)} with the email you paid with.`,
  },
  {
    id: 'contact',
    triggers: [
      'contact',
      'email',
      'whatsapp',
      'speak to andrew',
      'hello@',
      'get in touch',
      'reach you',
      'talk to andrew',
      'message andrew',
    ],
    buildReply: ctx => `Email: **hello@droidfix.uk** (quote your DF-S reference if you have one)
WhatsApp: link on https://droidfix.uk/contact

Discord: ${ask(ctx)} for general · ${ticket(ctx)} for orders and photos

Evenings and weekends for replies. Thanks for waiting.`,
  },
  {
    id: 'trustpilot',
    triggers: ['trustpilot', 'leave a review', 'write a review', 'review site'],
    buildReply: () => 'If you are happy with your repair, a Trustpilot review helps a lot. Check your post-repair email if we sent an invite.',
  },
  {
    id: 'charging-port',
    triggers: [
      'charging port',
      'usb port',
      'wont charge',
      'won\'t charge',
      'not charging',
      'charge port',
      'won t charge',
      'doesnt charge',
      'dead port',
      'usb c port',
    ],
    patterns: [/won'?t charge/i, /not charging/i, /doesn'?t charge/i],
    buildReply: () => `Charging port repairs are usually **3 to 7 working days** once we receive your controller.

Browse: https://droidfix.uk`,
  },
  {
    id: 'pricing',
    triggers: [
      'how much',
      'price',
      'cost',
      'quote',
      'what does it cost',
      'how much is',
      'how much does',
      'pricing',
    ],
    patterns: [/how much/i, /what(?:'s| is) the price/i],
    buildReply: ctx => `Fixed prices are on **https://droidfix.uk**. Pick your controller and service for the exact price at checkout.

Custom work: use the custom order form or open ${ticket(ctx)} for a quote.`,
  },
];

export function matchDroidfixFaq(message: string): DroidfixFaqEntry | null {
  return matchFromEngine(message, DROIDFIX_FAQ_ENTRIES);
}

export function buildDroidfixFaqReply(entry: DroidfixFaqEntry, ctx: DroidfixFaqContext): string {
  return entry.buildReply(ctx);
}

export function listDroidfixFaqTopics(): Array<{id: string; sampleTriggers: string[]}> {
  return DROIDFIX_FAQ_ENTRIES.map(entry => ({
    id: entry.id,
    sampleTriggers: entry.triggers.slice(0, 4),
  }));
}
