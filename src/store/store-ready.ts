/** Popup and settings ask the background to finish opening the store before they read. */
export const WAIT_FOR_STORE = 'WAIT_FOR_STORE'

export function isWaitForStore(message: unknown): message is { type: typeof WAIT_FOR_STORE } {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type: unknown }).type === WAIT_FOR_STORE
  )
}

/** Resolves once the background has finished its open, including the migration write. */
export function askStoreReady(): Promise<void> {
  return chrome.runtime.sendMessage({ type: WAIT_FOR_STORE }).then(
    () => undefined,
    () => undefined
  )
}
