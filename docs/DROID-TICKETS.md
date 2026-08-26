# Droid tickets (Droid Rollers)

**The spec lives in the DroidFix site repo: `docs/DROID-TICKETS-SPEC.md`.** Read that before changing anything here. This file is the bot-side quick reference.

## Files

| Path | Job |
|---|---|
| `src/commands/droid-tickets.ts` | Slash command, panel buttons, modal submit, staff controls |
| `src/lib/droid-tickets/forms.ts` | The two intake forms (5 inputs each, the Discord modal limit) |
| `src/lib/droid-tickets/service.ts` | Create, close, reopen, delete, transcript, permissions |
| `src/lib/droid-tickets/store.ts` | Per-guild settings, counters and ticket records in `DATA_DIR/droid-tickets.json` |
| `src/lib/droid-tickets/transcript.ts` | HTML transcript, written here so every string is escaped by us |
| `src/lib/droid-tickets/site.ts` | Pushes records and transcripts to droidfix.uk |
| `src/lib/droid-tickets/ui.ts` | Embeds and button rows |
| `src/lib/droid-spec/wizard.ts` | The build sheet, posted automatically in custom build tickets |

## Commands

```
/droid-tickets setup    category, staff-role, log-channel, [archive-category]   (Administrator)
/droid-tickets panel    posts the Create ticket panel here                      (Administrator)
/droid-tickets status   shows the current settings                              (Administrator)
/droid-tickets close    closes this ticket, optional reason                     (staff or the opener)
/droid-tickets add      adds someone to this ticket                             (staff)
/droid-tickets remove   removes someone from this ticket                        (staff)
```

Staff controls (Claim, Transcript, Open, Delete) need the staff role, guild Administrator, or `BOT_OWNER_ID`.

## Env

```
DROIDFIX_BOT_TOKEN=   # same value as Railway. Unset = Discord works, website copy skipped
DROIDFIX_SITE_URL=https://droidfix.uk
DROIDFIX_MENU_URL=https://droidfix.uk/api/droid-rollers-menu
BOT_OWNER_ID=
```

## Notes

- `/rollers-spec` was removed. It was admin-only, so it was useless when nobody was online.
- Prices are never hardcoded here. They come from the staff desk through the menu API.
- Discord limits that the code already handles: 5 inputs per modal, 45 characters per label, 50 channels per category, 500 channels per guild, 2 channel renames per 10 minutes, 8 MB attachment.
