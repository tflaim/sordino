#!/usr/bin/env node
import './navigation.check.mjs'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { builtExtension, collectErrors, launchExtension } from './harness.mjs'

const { dist, manifest } = builtExtension()
const HOST = 'www.reddit.com'
// A real playable one-second PCM source, so pause/volume assertions exercise media.
const pcm = Buffer.alloc(44 + 16_000)
pcm.write('RIFF', 0)
pcm.writeUInt32LE(pcm.length - 8, 4)
pcm.write('WAVEfmt ', 8)
pcm.writeUInt32LE(16, 16)
pcm.writeUInt16LE(1, 20)
pcm.writeUInt16LE(1, 22)
pcm.writeUInt32LE(8000, 24)
pcm.writeUInt32LE(16000, 28)
pcm.writeUInt16LE(2, 32)
pcm.writeUInt16LE(16, 34)
pcm.write('data', 36)
pcm.writeUInt32LE(16000, 40)
const server = createServer((req, res) => {
  if (req.url === '/tone.wav') return res.writeHead(200, { 'content-type': 'audio/wav' }).end(pcm)
  if (req.url?.includes('favicon')) return res.writeHead(204).end()
  res.writeHead(200, { 'content-type': 'text/html' })
  res.write(`<!doctype html><html><head><title>fake reddit</title></head><body>
    <h1 id="feed">fake reddit</h1><button id="page-button">Page action</button>
    <audio id="audio" src="/tone.wav" autoplay loop></audio><video id="video"></video>
    <script>requestAnimationFrame(() => { window.firstFrameTop = document.elementFromPoint(100,100)?.id });</script>`)
  // Keep the parser streaming after the first content frame.
  setTimeout(() => res.end('</body></html>'), 300)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const { ctx, sw, close } = await launchExtension(dist, [
  `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port}, MAP unrelated.example 127.0.0.1:${port}`,
  '--autoplay-policy=no-user-gesture-required',
])
await ctx.route('https://www.google.com/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><h1>Search exit</h1>',
  })
)
const errors = []
let popup
let page
try {
  popup = await ctx.newPage()
  collectErrors(popup, errors, 'popup')
  await popup.goto(`chrome-extension://${new URL(sw.url()).host}/${manifest.action.default_popup}`)
  await popup.getByRole('button', { name: /^Mute now for 1 hour/ }).click()
  await popup.getByText(/^Muting until .* · Mute now$/).waitFor()
  assert.ok(await sw.evaluate(() => chrome.alarms.get('muting-change')))

  page = await ctx.newPage()
  collectErrors(page, errors)
  await page.goto(`http://${HOST}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#sordino-overlay', { state: 'attached' })
  await page.waitForFunction(() => window.firstFrameTop !== undefined)
  assert.equal(
    await page.evaluate(() => window.firstFrameTop),
    'sordino-overlay',
    'streamed page flashed before cover'
  )
  assert.equal(
    await page.evaluate(() => document.getElementById('sordino-overlay').shadowRoot),
    null
  )

  const cdp = await ctx.newCDPSession(page)
  const ax = async () =>
    (await cdp.send('Accessibility.getFullAXTree')).nodes.filter((n) => !n.ignored)
  const turnBack = async () =>
    (await ax()).find((n) => n.role?.value === 'button' && n.name?.value === 'Turn back')
  const focused = (node) => node.properties?.some((p) => p.name === 'focused' && p.value.value)
  assert.ok(
    (await ax()).some(
      (n) => n.role?.value === 'dialog' && /reddit.com is muted/.test(n.name?.value)
    ),
    'missing dialog/site accessible name'
  )
  assert.ok(focused(await turnBack()), 'initial focus is not Turn back')
  for (const key of ['Tab', 'Shift+Tab', 'Escape']) {
    await page.keyboard.press(key)
    assert.ok(focused(await turnBack()), `focus escaped on ${key}`)
  }

  await page.addStyleTag({
    content: 'html{font-size:40px} *{font-size:40px!important} button{display:none!important}',
  })
  const model = await cdp.send('DOM.getBoxModel', {
    backendNodeId: (await turnBack()).backendDOMNodeId,
  })
  assert.ok(model.model.height >= 48 && model.model.height < 80, 'page CSS changed action sizing')
  assert.equal(
    await page.evaluate(() => document.elementFromPoint(100, 100)?.id),
    'sordino-overlay'
  )

  await page.waitForFunction(
    () => document.querySelector('audio').paused && document.querySelector('audio').volume === 0
  )
  // Later page playback is suppressed too; Pause restores the original volume.
  await page.evaluate(() =>
    document
      .querySelector('audio')
      .play()
      .catch(() => {})
  )
  await page.waitForFunction(() => document.querySelector('audio').paused)

  await page.evaluate(() => document.querySelector('video').requestFullscreen())
  await page.waitForFunction(
    () =>
      document.fullscreenElement && document.elementFromPoint(100, 100)?.id === 'sordino-overlay'
  )
  assert.ok(focused(await turnBack()), 'fullscreen hid dialog focus')
  await page.evaluate(() => document.exitFullscreen())

  const beforeSynthetic = page.url()
  const resolved = await cdp.send('DOM.resolveNode', {
    backendNodeId: (await turnBack()).backendDOMNodeId,
  })
  await cdp.send('Runtime.callFunctionOn', {
    objectId: resolved.object.objectId,
    functionDeclaration: 'function() { this.click() }',
  })
  assert.equal(page.url(), beforeSynthetic, 'page-triggered synthetic click activated Turn back')

  const offeredAt = await sw.evaluate(
    async () =>
      Object.values((await chrome.storage.local.get('state')).state.muteOffers)[0].offeredAt
  )
  await page.evaluate(() => {
    document.body.replaceWith(document.createElement('body'))
    document.getElementById('sordino-overlay').remove()
  })
  await page.waitForSelector('#sordino-overlay', { state: 'attached' })
  assert.equal(
    await page.evaluate(() => document.elementFromPoint(100, 100)?.id),
    'sordino-overlay'
  )
  assert.ok(focused(await turnBack()), 'host repair did not restore modal focus')
  await page.evaluate(() => {
    const root = document.createElement('html')
    const body = document.createElement('body')
    const button = document.createElement('button')
    button.id = 'page-button'
    button.textContent = 'Page action'
    body.append(button)
    root.append(body)
    document.documentElement.replaceWith(root)
  })
  await page.waitForSelector('#sordino-overlay', { state: 'attached' })
  assert.ok(focused(await turnBack()), 'root repair did not restore modal focus')
  await page.evaluate(() => document.getElementById('page-button').focus())
  assert.ok(focused(await turnBack()), 'host repair did not restore page inertness')
  assert.equal(
    await sw.evaluate(
      async () =>
        Object.values((await chrome.storage.local.get('state')).state.muteOffers)[0].offeredAt
    ),
    offeredAt,
    'repair recorded another visit'
  )

  const navigationId = await sw.evaluate(
    async () =>
      Object.values((await chrome.storage.local.get('state')).state.muteOffers)[0].navigationId
  )
  await page.evaluate(() => history.pushState({}, '', '/quiet-spa'))
  await page.waitForFunction(() => location.pathname === '/quiet-spa')
  for (let i = 0; i < 50; i++) {
    const current = await sw.evaluate(
      async () =>
        Object.values((await chrome.storage.local.get('state')).state.muteOffers)[0].navigationId
    )
    if (current !== navigationId) break
    if (i === 49) throw new Error('quiet SPA navigation was not recorded')
    await page.waitForTimeout(20)
  }

  await popup.getByRole('button', { name: /^Pause for 1 hour/ }).click()
  await page.waitForSelector('#sordino-overlay', { state: 'detached' })
  await page.goto(`http://${HOST}/`)
  assert.equal(await page.$('#sordino-overlay'), null)
  await popup.getByRole('button', { name: /^Mute now for 1 hour/ }).click()
  await page.waitForSelector('#sordino-overlay', { state: 'attached' })
  await popup.getByRole('button', { name: /^Pause for 1 hour/ }).click()
  await page.waitForSelector('#sordino-overlay', { state: 'detached' })
  assert.equal(await page.evaluate(() => document.querySelector('audio').volume), 1)
  await popup.getByRole('button', { name: /^Mute now for 1 hour/ }).click()
  await page.waitForSelector('#sordino-overlay', { state: 'attached' })

  // Physical clicks into the closed shadow surface exercise trusted-event filtering.
  // Turn back from fresh and same-site-history tabs must leave the muted site.
  async function clickTurnBack(target) {
    const session = await ctx.newCDPSession(target)
    const nodes = (await session.send('Accessibility.getFullAXTree')).nodes
    const button = nodes.find(
      (n) => !n.ignored && n.role?.value === 'button' && n.name?.value === 'Turn back'
    )
    const { model } = await session.send('DOM.getBoxModel', {
      backendNodeId: button.backendDOMNodeId,
    })
    await target.mouse.click(
      (model.content[0] + model.content[4]) / 2,
      (model.content[1] + model.content[5]) / 2
    )
    await target.waitForURL(/^https:\/\/www.google.com\//)
    await target.getByRole('heading', { name: 'Search exit' }).waitFor()
  }
  await clickTurnBack(page)
  const fresh = await ctx.newPage()
  collectErrors(fresh, errors, 'fresh')
  await fresh.goto(`http://${HOST}/`)
  await fresh.waitForSelector('#sordino-overlay', { state: 'attached' })
  await clickTurnBack(fresh)
  const unrelated = await ctx.newPage()
  collectErrors(unrelated, errors, 'unrelated')
  await unrelated.goto('http://unrelated.example/')
  await unrelated.evaluate(() => document.querySelector('audio').play())
  await unrelated.waitForTimeout(900)
  assert.equal(await unrelated.$('#sordino-overlay'), null)
  assert.equal(
    await unrelated.evaluate(() => document.querySelector('audio').paused),
    false,
    'initial cover paused unrelated autoplay'
  )
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        dist,
        coverBeforePaint: true,
        closedShadow: true,
        modalFocus: true,
        hostileCss: true,
        fullscreen: true,
        media: true,
        bodyRecovery: true,
        quietSpa: true,
        pause: true,
        turnBackFreshAndSameSite: true,
        errors,
      },
      null,
      2
    )
  )
  console.log('PASS overlay session and renderer browser acceptance')
} finally {
  await close()
  server.close()
}
