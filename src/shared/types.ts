export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface Schedule {
  id: string
  name: string
  enabled: boolean
  days: DayOfWeek[]
  startTime: string // "09:00" (24h format)
  endTime: string   // "17:00"
}

export interface Category {
  id: string
  name: string
  enabled: boolean
  sites: string[]
}

export interface BlockState {
  isBlocking: boolean
  manualOverride: 'on' | 'off' | null // null = follow schedule
  pausedUntil: number | null // timestamp
  activeSchedule: string | null // schedule name if active
}

export interface BypassState {
  quickBypassesUsed: number
  lastResetDate: string // "2026-01-06" format
  activeBypass: {
    site: string
    expiresAt: number // timestamp
  } | null
}

export interface Stats {
  date: string // "2026-01-06"
  blocksTriggered: number
  bypassesUsed: number
}

export interface SordinoSettings {
  schedules: Schedule[]
  categories: Category[]
  customSites: string[]
  blockState: BlockState
  bypassState: BypassState
  stats: Stats
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'social',
    name: 'Social',
    enabled: true,
    sites: [
      'x.com',
      'twitter.com',
      'facebook.com',
      'instagram.com',
      'reddit.com',
      'linkedin.com',
      'threads.net',
      'tiktok.com',
    ],
  },
  {
    id: 'video',
    name: 'Video',
    enabled: true,
    sites: [
      'youtube.com',
      'twitch.tv',
      'netflix.com',
      'hulu.com',
      'disneyplus.com',
      'primevideo.com',
    ],
  },
  {
    id: 'news',
    name: 'News',
    enabled: false,
    sites: [
      'news.google.com',
      'cnn.com',
      'foxnews.com',
      'nytimes.com',
      'bbc.com',
    ],
  },
]

export const DEFAULT_SCHEDULES: Schedule[] = [
  {
    id: 'work-hours',
    name: 'Work hours',
    enabled: true,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '09:00',
    endTime: '17:00',
  },
  {
    id: 'extended-work',
    name: 'Extended work',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '08:00',
    endTime: '18:00',
  },
  {
    id: 'evenings',
    name: 'Evenings',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    startTime: '18:00',
    endTime: '22:00',
  },
  {
    id: 'always-on',
    name: 'Always on',
    enabled: false,
    days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    startTime: '00:00',
    endTime: '23:59',
  },
]

export const DEFAULT_SETTINGS: SordinoSettings = {
  schedules: DEFAULT_SCHEDULES,
  categories: DEFAULT_CATEGORIES,
  customSites: [],
  blockState: {
    isBlocking: false,
    manualOverride: null,
    pausedUntil: null,
    activeSchedule: null,
  },
  bypassState: {
    quickBypassesUsed: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    activeBypass: null,
  },
  stats: {
    date: new Date().toISOString().split('T')[0],
    blocksTriggered: 0,
    bypassesUsed: 0,
  },
}

// Message types for communication between components
export type MessageType =
  | { type: 'GET_BLOCK_STATUS'; url: string }
  | { type: 'BLOCK_STATUS'; isBlocked: boolean; reason?: string; timeRemaining?: string }
  | { type: 'USE_BYPASS'; site: string }
  | { type: 'BYPASS_RESULT'; success: boolean; remaining: number }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_UPDATE'; settings: SordinoSettings }
  | { type: 'RECORD_BLOCK' }
  | { type: 'TOGGLE_MANUAL_OVERRIDE'; state: 'on' | 'off' | null }
  | { type: 'PAUSE_BLOCKING'; until: number }
