// "Mute this site": the context-menu handler, separate from the service worker
// entry so a test can run it without chrome. The listener itself is registered
// at background start and returns this promise, so the worker stays alive
// until the site is written.
import { muteThisSiteNotice } from '@/shared/muted-sites'
import type { Effect } from '@/store/effects'
import type { SordinoStore } from '@/store/store'

export const MUTE_THIS_SITE_ID = 'mute-this-site'

export function muteThisSiteMenu(): chrome.contextMenus.CreateProperties {
  return {
    id: MUTE_THIS_SITE_ID,
    title: 'Mute this site',
    contexts: ['page', 'frame', 'selection', 'link', 'image', 'video', 'audio'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  }
}

/** removeAll then create, so a second install or startup does not collide on the id. */
export function installMuteThisSiteMenu(): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError
      chrome.contextMenus.create(muteThisSiteMenu(), () => {
        void chrome.runtime.lastError
        resolve()
      })
    })
  })
}

/**
 * Adds the page through the same command as the popup. `open` is this service
 * worker's store; a restarted worker has none of the previous one's memory.
 */
export async function handleMuteThisSite(
  pageUrl: string,
  open: () => Promise<SordinoStore>
): Promise<{ effects: Effect[]; notice: string | null }> {
  const store = await open()
  const { result, effects } = await store.dispatch(
    { type: 'add-muted-site', input: pageUrl },
    { kind: 'background' }
  )
  return { effects, notice: muteThisSiteNotice(result) }
}
