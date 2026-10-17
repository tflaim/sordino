# Add custom site

From the popup, the user can add a domain by hand. That domain is then muted
whenever muting is in effect, same as category sites. Settings lists it under
Muted sites → Added by hand.

## Sub-features

- `add-open` opens the quick-add field from **Add site**.
- `add-save` stores a cleaned hostname (strips protocol, `www.`, paths).
- `add-settings-mirror` shows the same hostname under Added by hand in settings.

## How to get to it (user POV)

- Popup → **Add site** → type a domain → confirm.
- Settings → Muted sites → Added by hand → add field.

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
- **Confirm in settings.** `options open`, then assert Added by hand lists
  `example.com` (protocol/www/path stripped) and a button `Remove example.com`.
  Use `aria --page options --path add-custom-site/options.aria.txt` and
  `screenshot --page options --path add-custom-site/options.png`.
- **Proof.** Options ARIA/screenshot show `example.com` under the heading
  Added by hand, inside Muted sites. The empty add field is also named
  `example.com`; the saved row is the text next to `Remove example.com`.
  Optional second view: with Mute now running, `site open --url http://example.com/`
  only proves mute if that host is mapped — default launch maps reddit, not
  example.com; do not claim overlay proof without mapping `example.com` at launch
  (`launch --map-host example.com`).

## Gotchas

- Input cleaning drops `https://`, leading `www.`, and paths — assert
  `example.com`, not the typed URL. The heading is Added by hand, not
  Custom Sites.
- The add field's accessible name is the placeholder `example.com`. A snapshot
  that only contains that textbox has not proved the site was saved.
- Adding a site does not start Mute now by itself; overlay proof needs muting
  in effect and a mapped host.
- Remove `example.com` from Added by hand during fixture cleanup if you reuse a
  profile; retain proof artifacts.
