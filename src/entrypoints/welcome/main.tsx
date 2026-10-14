import React from 'react'
import ReactDOM from 'react-dom/client'
import { browser } from 'wxt/browser'
import { runtimeCommandPort } from '@/store/adapters/runtime'
import { chromeStorageReader } from '@/store/adapters/chrome-storage-reader'
import { openReader } from '@/store/reader'
import { askStoreReady } from '@/store/store-ready'
import { Welcome } from './App'
import '@/shared/fonts'
import './welcome.css'

const reader = openReader(chromeStorageReader(), askStoreReady())
const commands = runtimeCommandPort()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Welcome
      commands={commands}
      loadConfig={async () => (await reader.read('config')).config}
      checkPrivate={() => browser.extension.isAllowedIncognitoAccess()}
      openSettings={() => browser.runtime.openOptionsPage()}
    />
  </React.StrictMode>
)
