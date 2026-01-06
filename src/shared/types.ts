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
  lastEmergencyRefresh: string | null // "2026-01-06" format - tracks daily refresh availability
}

export interface SiteStats {
  [site: string]: {
    blocks: number
    bypasses: number
  }
}

export interface WeeklyStats {
  weekStart: string // "2026-01-06" - Monday of the week
  days: {
    date: string
    blocksTriggered: number
    bypassesUsed: number
  }[]
  siteStats: SiteStats // Per-site tracking for "most blocked/bypassed"
  emergencyRefreshesUsed: number // Count of emergency refreshes this week
}

export interface Stats {
  date: string // "2026-01-06"
  blocksTriggered: number
  bypassesUsed: number
  siteStats: SiteStats // Per-site tracking for today
}

export interface SordinoSettings {
  schedules: Schedule[]
  categories: Category[]
  customSites: string[]
  blockState: BlockState
  bypassState: BypassState
  stats: Stats
  weeklyStats: WeeklyStats
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

// Get local date string in YYYY-MM-DD format (uses local timezone, not UTC)
export function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD format
}

// Get Monday of the current week (local timezone)
function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  const monday = new Date(now)
  monday.setDate(diff)
  return getLocalDateString(monday)
}

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
    lastResetDate: getLocalDateString(),
    activeBypass: null,
    lastEmergencyRefresh: null,
  },
  stats: {
    date: getLocalDateString(),
    blocksTriggered: 0,
    bypassesUsed: 0,
    siteStats: {},
  },
  weeklyStats: {
    weekStart: getWeekStart(),
    days: [],
    siteStats: {},
    emergencyRefreshesUsed: 0,
  },
}

// Template schedule IDs that cannot be edited or deleted
export const TEMPLATE_SCHEDULE_IDS = ['work-hours', 'extended-work', 'evenings', 'always-on']

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
  | { type: 'EMERGENCY_REFRESH_BYPASSES' }
