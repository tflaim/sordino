# Mute this site

Mute this site adds the page the user is on to the sites muted by hand. It is
the browser context menu, not a popup button. A new site is saved quietly.
A site that is already muted, or that is not a site, uses the same sentence
the popup shows for that outcome.

## Sub-features

- `mute-this-site-menu` is the context-menu item titled `Mute this site` on http and https pages.
- `mute-this-site-add` saves a new host under Added by hand and shows no notice.
- `mute-this-site-already` leaves an already-muted page unchanged and would show `already muted` or `already muted via <category>`.

## How to get to it (user POV)

- Right-click a page, frame, link, or image on an `http` or `https` page → **Mute this site**.
- Afterwards, Settings → Muted sites → Added by hand lists that host.

## Driving it with control-sordino

Preconditions:

- Session launched. For a site that is not already in a category, use
  `launch --run-id mute-this-site --map-host example.com`.
- `control-sordino doctor` reports `"ok": true`.

- **Open the mapped page.** Run `site open`. The fake page loads.
- **Open the context menu.** Right-click the page and choose **Mute this site**.
  `control-sordino` has no command for this. A page right-click does not put a
  `menuitem` named `Mute this site` in the accessibility tree; waiting for that
  role timed out after 5 seconds on the mapped page. This entry point is
  unverified.
- **Do not substitute the store.** `sw-eval` of `add-muted-site` is the same
  write the menu performs, and it is not this entry point.

## Gotchas

- Adding a new site is quiet: there is no success sentence. Already muted,
  refused, or a command that did not run uses the popup's sentence (`already
  muted`, `already muted via <category>`, `Enter a site.`, `That doesn't look
  like a site.`, or `Sordino is restarting. Try again in a moment.`).
- The menu does not start Mute now. Overlay proof still needs muting in effect.
- Category hosts such as `www.reddit.com` are already muted via Social, so a
  successful menu action there must not add a second Added-by-hand row.
