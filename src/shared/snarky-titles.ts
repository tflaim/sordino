// Music-themed snarky titles for the block screen
// Sordino = mute for brass instruments, so we lean into jazz/classical themes

export interface SnarkyTitle {
  title: string
  subtitle?: string // Snarky explanation for non-musicians
  icon?: string // SVG data URI for musical symbols
}

// SVG icons for musical symbols (rendered in cream color to match theme)
const WHOLE_REST_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" fill="#e8dcc8"><rect x="0" y="0" width="100" height="30"/><rect x="10" y="30" width="80" height="30"/></svg>')}`

const CODA_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" fill="none" stroke="#e8dcc8" stroke-width="6"><ellipse cx="50" cy="60" rx="30" ry="40"/><line x1="50" y1="5" x2="50" y2="115"/><line x1="10" y1="60" x2="90" y2="60"/></svg>')}`

export const SNARKY_TITLES: SnarkyTitle[] = [
  // With musical symbols + explanations
  { title: "𝄐 Fermata", subtitle: "That's music for 'you just got paused'" },
  { title: "🔇 Muted", subtitle: "For your own good" },
  { title: "Rest measure", subtitle: "Musicians stop here. So do you.", icon: WHOLE_REST_SVG },
  { title: "TACET", subtitle: "Latin for 'be quiet and focus'" },
  { title: "Fine.", subtitle: "That's 'the end' in music. And this scroll." },
  { title: "G.P.", subtitle: "Grand Pause. Very grand. Very paused." },
  { title: "D.S. al Focus", subtitle: "Go back to the sign that says 'work'" },
  { title: "♭ Flat out no", subtitle: "Even a half-step down is still no" },
  { title: "♯ Sharp decline", subtitle: "Your productivity, if you stay here" },
  { title: "Coda", subtitle: "Skip to the ending. The ending is work.", icon: CODA_SVG },
  { title: "Sforzando NO", subtitle: "That's a sudden, loud NO" },
  { title: "Pianissimo", subtitle: "Very, very quietly... leave" },
  { title: "Ritardando", subtitle: "Slowing down... your procrastination" },
  { title: "Decrescendo", subtitle: "Getting quieter until you're gone" },
  { title: "Da capo al focus", subtitle: "From the top: go do your work" },
  { title: "Crescendo elsewhere", subtitle: "Build up somewhere productive" },
  { title: "Allegro", subtitle: "Quickly now, back to work" },
  { title: "Andante", subtitle: "Walk away. At a moderate pace." },
  { title: "Con fuoco", subtitle: "With fire. Fire to focus." },
  { title: "Maestoso", subtitle: "Majestically... close this tab" },

  // Already clear, no subtitle needed
  { title: "Take five" },
  { title: "The conductor says no" },
  { title: "Not in the setlist" },
  { title: "This solo is over" },
  { title: "Back to the downbeat" },
  { title: "Wrong key, wrong time" },
  { title: "Stick to the score" },
  { title: "This isn't the encore" },
  { title: "Improvisation denied" },
  { title: "Wrong movement" },
  { title: "Cadence interrupted" },
  { title: "Resolution pending..." },
  { title: "A tempo, back to work" },
  { title: "The pit orchestra says no" },
  { title: "Dissonance detected" },
  { title: "Off the charts" },
  { title: "Intermission is over" },
  { title: "This phrase is over" },
  { title: "The arrangement says no" },
  { title: "Not on the program" },
]

export function getRandomSnarkyTitle(): SnarkyTitle {
  const index = Math.floor(Math.random() * SNARKY_TITLES.length)
  return SNARKY_TITLES[index]
}
