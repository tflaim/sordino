// React hook for extension pages: the store's `state` doc, read through the
// read-only port and kept current by watching storage. Never writes.
import { useEffect, useState } from 'react'
import { chromeStorageReader } from '@/store/adapters/chrome-storage-reader'
import type { StateDoc } from '@/store/docs'
import { openReader } from '@/store/reader'

export function useSordinoState(): StateDoc | null {
  const [state, setState] = useState<StateDoc | null>(null)
  useEffect(() => {
    const reader = openReader(chromeStorageReader())
    let watched = false // a change seen before the first read resolves wins
    const stop = reader.watch(['state'], (docs) => {
      watched = true
      if (docs.state) setState(docs.state)
    })
    reader.read('state').then((docs) => watched || setState(docs.state))
    return stop
  }, [])
  return state
}

/** The current time, ticking every `everyMs` so end times and expiry stay true. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
