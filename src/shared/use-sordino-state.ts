// React hooks for extension pages: the store's docs, read through the
// read-only port and kept current by watching storage. Never writes.
import { useEffect, useState } from 'react'
import { chromeStorageReader } from '@/store/adapters/chrome-storage-reader'
import type { ConfigDoc, StateDoc } from '@/store/docs'
import { openReader } from '@/store/reader'
import { askStoreReady } from '@/store/store-ready'

export function useSordinoState(): StateDoc | null {
  const [state, setState] = useState<StateDoc | null>(null)
  useEffect(() => {
    const reader = openReader(chromeStorageReader())
    let watched = false // a change seen before the first read resolves wins
    const stop = reader.watch(['state'], (docs) => {
      watched = true
      if (docs.state) setState(docs.state)
    })
    // Migration writes state a moment after the worker starts. Wait for that
    // write so the first read is not the pre-migration doc.
    let cancel = false
    askStoreReady()
      .then(() => reader.read('state'))
      .then((docs) => {
        if (!cancel && !watched) setState(docs.state)
      })
    return () => {
      cancel = true
      stop()
    }
  }, [])
  return state
}

/** The store's `config` doc (schedules and own muted sites), kept current by watching storage. */
export function useSordinoConfig(): ConfigDoc | null {
  const [config, setConfig] = useState<ConfigDoc | null>(null)
  useEffect(() => {
    const reader = openReader(chromeStorageReader())
    let watched = false
    const stop = reader.watch(['config'], (docs) => {
      watched = true
      if (docs.config) setConfig(docs.config)
    })
    let cancel = false
    askStoreReady()
      .then(() => reader.read('config'))
      .then((docs) => {
        if (!cancel && !watched) setConfig(docs.config)
      })
    return () => {
      cancel = true
      stop()
    }
  }, [])
  return config
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
