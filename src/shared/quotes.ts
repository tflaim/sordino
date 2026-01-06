export const FOCUS_QUOTES = [
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee"
  },
  {
    text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",
    author: "Alexander Graham Bell"
  },
  {
    text: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle"
  },
  {
    text: "The key to success is to focus our conscious mind on things we desire, not things we fear.",
    author: "Brian Tracy"
  },
  {
    text: "Focus on being productive instead of busy.",
    author: "Tim Ferriss"
  },
  {
    text: "Where focus goes, energy flows.",
    author: "Tony Robbins"
  },
  {
    text: "Lack of direction, not lack of time, is the problem. We all have twenty-four hour days.",
    author: "Zig Ziglar"
  },
  {
    text: "The main thing is to keep the main thing the main thing.",
    author: "Stephen Covey"
  },
  {
    text: "You can't depend on your eyes when your imagination is out of focus.",
    author: "Mark Twain"
  },
  {
    text: "Focus is a matter of deciding what things you're not going to do.",
    author: "John Carmack"
  },
  {
    text: "Starve your distractions and feed your focus.",
    author: "Unknown"
  },
  {
    text: "The art of being wise is the art of knowing what to overlook.",
    author: "William James"
  },
  {
    text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.",
    author: "Buddha"
  },
  {
    text: "Your focus determines your reality.",
    author: "Qui-Gon Jinn"
  },
  {
    text: "Multitasking is the opportunity to screw up more than one thing at a time.",
    author: "Steve Uzzell"
  },
  {
    text: "One reason so few of us achieve what we truly want is that we never direct our focus.",
    author: "Tony Robbins"
  },
  {
    text: "The ability to focus attention on important things is a defining characteristic of intelligence.",
    author: "Robert J. Shiller"
  },
  {
    text: "Always remember, your focus determines your reality.",
    author: "George Lucas"
  },
  {
    text: "Simplicity boils down to two steps: Identify the essential. Eliminate the rest.",
    author: "Leo Babauta"
  },
  {
    text: "If you chase two rabbits, you will catch neither one.",
    author: "Russian Proverb"
  },
  {
    text: "The shorter way to do many things is to do only one thing at a time.",
    author: "Mozart"
  },
  {
    text: "Attention is the rarest and purest form of generosity.",
    author: "Simone Weil"
  },
  {
    text: "Be where you are, not where you think you should be.",
    author: "Unknown"
  },
  {
    text: "Almost everything will work again if you unplug it for a few minutes, including you.",
    author: "Anne Lamott"
  },
  {
    text: "What you focus on expands.",
    author: "Oprah Winfrey"
  }
]

export function getRandomQuote(): { text: string; author: string } {
  const index = Math.floor(Math.random() * FOCUS_QUOTES.length)
  return FOCUS_QUOTES[index]
}
