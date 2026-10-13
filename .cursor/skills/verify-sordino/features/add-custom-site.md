# Add custom site

From the popup, the user can add a domain to Custom Sites. That domain is then
muted whenever muting is in effect, same as category sites.

## Sub-features

- `add-open` opens the quick-add field from **Add site**.
- `add-save` stores a cleaned hostname (strips protocol, `www.`, paths).
- `add-settings-mirror` shows the same hostname under Custom Sites in settings.

## How to get to it (user POV)

- Popup → **Add site** → type a domain → confirm.
- Settings → Blocked Sites → Custom Sites → add field.

## Driving it with control-sordino

Preconditions:

- Session launched; doctor ok.
- No custom site named `example.com` yet (fresh profile).

- **Open popup.** `popup open` and `popup dismiss-tip`.
- **Open quick add.** `popup click --role button --name 'Add site'`.
  A textbox with placeholder `example.com` appears.
- **Enter domain.** `popup fill --selector 'input[placeholder="example.com"]' --value 'https://www.example.com/path'`.
- **Save.** `popup click --selector 'button[title="Add site"]'`.
  The quick-add row collapses back to the **Add site** button.
- **Confirm in settings.** `options open`, then assert Custom Sites lists
  `example.com` (protocol/www/path stripped). Use
  `aria --page options --path add-custom-site/options.aria.txt` and
  `screenshot --page options --path add-custom-site/options.png`.
- **Proof.** Options ARIA/screenshot show `example.com` under Custom Sites.
  Optional second view: with Mute now running, `site open --url http://example.com/`
  only proves mute if that host is mapped — default launch maps reddit, not
  example.com; do not claim overlay proof without mapping `example.com` at launch
  (`launch --map-host example.com`).

## Gotchas

- Input cleaning drops `https://`, leading `www.`, and paths — assert
  `example.com`, not the typed URL.
- Adding a site does not start Mute now by itself; overlay proof needs muting
  in effect and a mapped host.
- Remove `example.com` from Custom Sites during fixture cleanup if you reuse a
  profile; retain proof artifacts.
