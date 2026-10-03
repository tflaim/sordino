// PROTOTYPE — a fake, busy, light forum feed so the overlay is judged on top of a
// real-looking page rather than in a vacuum. Generic styling; no real branding.
const posts = [
  { sub: 'r/AskHistorians', t: 'Why did medieval monasteries keep such detailed weather records?', n: '4.1k', c: 312, img: false },
  { sub: 'r/pics', t: 'Found this old trumpet mute at a flea market, any idea how old it is?', n: '18.7k', c: 902, img: true },
  { sub: 'r/programming', t: 'We rewrote our build in a weekend and it only broke twice', n: '2.3k', c: 488, img: false },
  { sub: 'r/AskReddit', t: 'What is a small habit that changed your whole week?', n: '31.2k', c: 9411, img: false },
  { sub: 'r/EarthPorn', t: 'Morning fog over the valley, Dolomites [OC] [4032x3024]', n: '22.5k', c: 403, img: true },
  { sub: 'r/todayilearned', t: 'TIL a fermata tells the performer to hold a note for as long as they like', n: '9.8k', c: 611, img: false },
]

export function HostFeed() {
  return (
    <div className="min-h-screen bg-[#dae0e6] font-sans text-[#1a1a1b]" aria-hidden="true">
      <div className="flex items-center gap-2 border-b border-[#c8ccd0] bg-[#f3f3f3] px-3 py-1.5 text-[13px] text-[#444]">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-4 flex-1 rounded-md bg-white px-3 py-1 text-[#333]">reddit.com</span>
      </div>
      <header className="flex items-center gap-4 bg-white px-6 py-2 shadow-sm">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ff4500] font-bold text-white">r</span>
        <span className="text-[18px] font-semibold">feed</span>
        <span className="mx-auto w-[480px] rounded-full bg-[#f6f7f8] px-4 py-1.5 text-[14px] text-[#7c7c7c]">Search</span>
        <span className="rounded-full bg-[#0079d3] px-4 py-1.5 text-[14px] font-semibold text-white">Log in</span>
      </header>
      <div className="mx-auto flex max-w-[1000px] gap-6 px-4 py-5">
        <main className="flex-1 space-y-3">
          <div className="flex gap-2 rounded bg-white p-2 text-[14px] font-semibold text-[#0079d3]">
            <span className="rounded-full bg-[#f6f7f8] px-3 py-1">Hot</span>
            <span className="px-3 py-1 text-[#878a8c]">New</span>
            <span className="px-3 py-1 text-[#878a8c]">Top</span>
            <span className="px-3 py-1 text-[#878a8c]">Rising</span>
          </div>
          {posts.map((p, i) => (
            <article key={i} className="flex overflow-hidden rounded border border-[#ccc] bg-white">
              <div className="flex w-10 flex-col items-center bg-[#f8f9fa] py-2 text-[12px] font-bold">
                <span className="text-[#ff4500]">▲</span>
                {p.n}
                <span className="text-[#7193ff]">▼</span>
              </div>
              <div className="flex-1 p-2">
                <div className="text-[12px] text-[#787c7e]">
                  <b className="text-[#1c1c1c]">{p.sub}</b> · Posted by u/someone_{i} {i + 2}h ago
                </div>
                <h3 className="my-1 text-[18px] font-medium leading-snug">{p.t}</h3>
                {p.img && (
                  <div
                    className="my-2 h-[260px] rounded"
                    style={{
                      background:
                        i === 1
                          ? 'linear-gradient(135deg,#b87333,#e3b778 45%,#6d4c2f)'
                          : 'linear-gradient(180deg,#9ec5e8,#d9e6c3 55%,#5b7f4a)',
                    }}
                  />
                )}
                <div className="flex gap-4 text-[12px] font-bold text-[#878a8c]">
                  <span>💬 {p.c} Comments</span>
                  <span>Share</span>
                  <span>Save</span>
                </div>
              </div>
            </article>
          ))}
        </main>
        <aside className="hidden w-[310px] space-y-3 md:block">
          <div className="rounded border border-[#ccc] bg-white">
            <div className="h-12 rounded-t bg-[#0079d3]" />
            <div className="p-3 text-[14px]">
              <b>Home</b>
              <p className="mt-1 text-[#444]">Your personal front page. Come here to check in with your favourite communities.</p>
              <div className="mt-3 rounded-full bg-[#0079d3] py-1.5 text-center font-bold text-white">Create Post</div>
            </div>
          </div>
          <div className="rounded border border-[#ccc] bg-white p-3 text-[13px] text-[#444]">
            <b className="text-[#1a1a1b]">Trending today</b>
            <ul className="mt-2 space-y-2">
              <li>Transit strike enters day three</li>
              <li>New telescope images released</li>
              <li>The great sourdough debate returns</li>
              <li>Local orchestra plays silent piece</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
