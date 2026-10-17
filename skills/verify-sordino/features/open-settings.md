# Open settings

The popup gear opens Sordino's options page (Settings / Usage). Settings hold
schedules, muted-site categories, sites added by hand, and bypass options.

## Sub-features

- `settings-from-popup` opens options via the popup gear.
- `settings-tabs` switches between **Settings** and **Usage**.
- `settings-identity` shows the Sordino heading on the options page.

## How to get to it (user POV)

- Click the gear icon in the popup header.
- Or open the extension's Options entry from `chrome://extensions`.

## Driving it with control-sordino

Preconditions:

- Session launched; `control-sordino doctor` reports `"ok": true`.

- **Open popup.** Run `popup open` and `popup dismiss-tip`.
- **Open settings from gear.** Run
  `node skills/verify-sordino/scripts/control-sordino.mjs popup open-settings`.
  Options page loads with heading `Sordino`.
- **Switch tabs.** Run
  `options click --role button --name '^Usage$'` then
  `options click --role button --name '^Settings$'`.
  Headings such as `This Week` (Usage) and `Schedules` (Settings) appear.
- **Proof.** `screenshot --page options --path open-settings/options.png` and
  `aria --page options --path open-settings/options.aria.txt` showing Sordino
  and the Settings tab content.
- **Direct entry (second path).** On a fresh check,
  `options open` must also show heading `Sordino`. Report both entry points;
  do not count only the direct URL as proof of the gear path.

## Gotchas

- The gear button has no accessible name yet — the helper clicks
  `button:has(svg.lucide-settings)`, matching `tests/e2e/pages.smoke.mjs`.
- Options opened from the gear is a new tab; keep using `--page options` for
  screenshots after `popup open-settings`.
