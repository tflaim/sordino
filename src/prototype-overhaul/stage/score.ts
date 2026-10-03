// PROTOTYPE — the score every genre stage performs (round 3, decision 52).
// Eagerly loaded and tiny: the overlay's beat dots and the lazily loaded WebGL stage
// read the same onsets, so the countable beat and the picture never disagree.
//
// The Metronome is the constant: the wait is N beats, beat k lands at onset k
// (beat 0 is the arrival itself), and the last onset is exactly the end of the wait,
// the moment Bypass opens. Only Romantic moves the inner onsets (tempo rubato:
// time stolen is given back inside the same bar, so N beats still take N seconds).

export type GenreKey = 'B' | 'R' | 'I' | 'J' | 'M'

export interface Plan {
  beats: number
  beatMs: number
  /** ms from arrival; onsets[0] = 0, onsets[beats] = beats * beatMs. */
  onsets: number[]
  marking: string
}

export interface Genre {
  key: GenreKey
  name: string
  /** One line per musical event, shown in the monitor and the report. */
  events: { inn: string; wait: string; release: string; turn: string }
  /** Tempo/character marking for the normal and spent waits. */
  marking: [string, string]
  /** How long the cadence keeps rendering after the final beat lands, then the stage is still. */
  settleMs: number
  portable: string
}

export const GENRES: Genre[] = [
  {
    key: 'B',
    name: 'Baroque',
    marking: ['Allegro moderato, ♩ = 60, terraced f · p · f', 'Grave, ♩ = 20, terraced mf · p · mf'],
    events: {
      inn: 'the ground is struck in one terrace step (no fade), the subject enters on the first sixteenth',
      wait: 'two-part invention: subject, then the answer an octave below one beat later, over a steady sixteenth motor; dynamics in terraces, no rubato',
      release: 'both voices land on D; a third sounds between them and is raised a semitone (Picardy third), silver turns to brass',
      turn: 'subito piano: the terrace drops and the counterpoint stops where it is',
    },
    settleMs: 520,
    portable: 'yes: lines, noteheads and ticks are evaluated per pixel from the note table; one draw call',
  },
  {
    key: 'R',
    name: 'Romantic',
    marking: ['Lento sostenuto, ♩ = 60 rubato, pp < mf', 'Più lento, ♩ = 20 rubato, pp < mp'],
    events: {
      inn: 'the left hand enters first: a rolled arpeggio out of the dark while the lamp rises to pp',
      wait: 'a cantilena drawn at rubato speed (held, pushed, broadened), arm on the same rubato, one long hairpin pp < mf',
      release: 'the appoggiatura sighs down onto the tonic on the final beat; the swell peaks there and relaxes (morendo)',
      turn: 'a falling sigh: the line drops a step and the lamp dims',
    },
    settleMs: 600,
    portable: 'yes: the rubato is a closed-form time warp; melody and arpeggios are SDF curves; one draw call',
  },
  {
    key: 'I',
    name: 'Impressionist',
    marking: ['Modéré, sans rigueur, ♩ = 60, pp', 'Très lent, ♩ = 20, ppp'],
    events: {
      inn: 'the colour comes into focus out of a blur, like a pedal held over a chord',
      wait: 'whole-tone washes on a water plane in perspective: each beat the wash planes a whole tone round the colour circle and one soft ripple spreads; the arm survives only as its reflection',
      release: 'the water stills, the washes gather into one pentatonic chord colour and the reflection stands upright',
      turn: 'the washes withdraw into the dark',
    },
    settleMs: 600,
    portable: 'yes: perspective water is a ray–plane intersection with value-noise washes; one draw call',
  },
  {
    key: 'J',
    name: 'Jazz',
    marking: ['Medium swing, ♩ = 60, ♪♪ = ♩♪ (2:1)', 'Ballad, brushes, ♩ = 20'],
    events: {
      inn: 'the spot comes up on the snare, the brushes start to stir and a chromatic pickup walks into beat 1',
      wait: 'walking bass, one dot per beat with swung skip notes, brushes circling with backbeat taps on 2 and 4, blue-note accent on beat 4 (the flat five; the flat three on beat 8 when spent); the arm swings long–short',
      release: 'tag and button: the last two notes are echoed, then one hit on the rim; the blue note bends up to the major third',
      turn: 'a fall-off: the last note slides down and the brushes stop',
    },
    settleMs: 560,
    portable: 'yes: brush grain is polar value noise on a projected disc; dots and arm are SDFs; one draw call',
  },
  {
    key: 'M',
    name: 'Minimalist',
    marking: ['Piano I ♩ = 60, Piano II ♩ = 75 from beat 1 → lock', 'Piano I ♩ = 20, Piano II ♩ = 22.2 → lock'],
    events: {
      inn: 'Piano I alone; Piano II fades in on the unison during beat 0',
      wait: 'the twelve-note Piano Phase pattern on two rings of lamps; Piano II pushes ahead and drifts through every offset',
      release: 'phase lock: both heads meet at twelve o’clock exactly on the final beat and the rings sound as one, in brass',
      turn: 'stops dead, as the ensemble does on a cue',
    },
    settleMs: 520,
    portable: 'yes: each lamp’s brightness is a closed-form function of its ring’s phase; one draw call',
  },
]

export const genreByKey = (k: string) => GENRES.find((g) => g.key === k) ?? GENRES[0]

/** Rubato warp: intervals longer at both ends (agogic first beat, broadening cadence), pushed in the middle. */
export function rubato(x: number, a = 0.25) {
  return x + (a * Math.sin(2 * Math.PI * x)) / (2 * Math.PI)
}

export function plan(g: Genre, spent: boolean): Plan {
  const beats = spent ? 10 : 5
  const beatMs = spent ? 3000 : 1000
  const total = beats * beatMs
  const onsets = Array.from({ length: beats + 1 }, (_, k) =>
    g.key === 'R' ? Math.round(total * rubato(k / beats)) : k * beatMs,
  )
  return { beats, beatMs, onsets, marking: g.marking[spent ? 1 : 0] }
}
