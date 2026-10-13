import { describe, expect, it } from 'vitest'
import { toSender } from './runtime'

const self = { id: 'sordino-id', origin: 'chrome-extension://sordino-id/' }

describe('toSender', () => {
  it.each([
    {
      case: 'the popup',
      sender: { id: 'sordino-id', url: 'chrome-extension://sordino-id/popup.html' },
      expected: { kind: 'page' },
    },
    {
      case: 'the settings page opened in a tab',
      sender: {
        id: 'sordino-id',
        url: 'chrome-extension://sordino-id/options.html',
        tab: { id: 3 },
      },
      expected: { kind: 'page' },
    },
    {
      case: 'a content script, with its frame URL',
      sender: { id: 'sordino-id', url: 'https://www.reddit.com/r/x', tab: { id: 7 } },
      expected: { kind: 'tab', tabId: 7, url: 'https://www.reddit.com/r/x' },
    },
    {
      case: 'a Firefox extension page',
      sender: { id: 'sordino-id', url: 'moz-extension://uuid/popup.html' },
      self: { id: 'sordino-id', origin: 'moz-extension://uuid/' },
      expected: { kind: 'page' },
    },
    {
      case: 'another extension',
      sender: { id: 'other-id', url: 'chrome-extension://other-id/popup.html' },
      expected: null,
    },
    {
      case: 'a page whose URL only starts like ours',
      sender: { id: 'sordino-id', url: 'chrome-extension://sordino-id.evil/x', tab: { id: 1 } },
      expected: { kind: 'tab', tabId: 1, url: 'chrome-extension://sordino-id.evil/x' },
    },
    {
      case: 'no URL and no tab',
      sender: { id: 'sordino-id' },
      expected: null,
    },
  ])('$case', ({ sender, expected, ...rest }) => {
    expect(toSender(sender, rest.self ?? self)).toEqual(expected)
  })
})
