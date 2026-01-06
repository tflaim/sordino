const m=[{text:"The successful warrior is the average man, with laser-like focus.",author:"Bruce Lee"},{text:"Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.",author:"Alexander Graham Bell"},{text:"It is during our darkest moments that we must focus to see the light.",author:"Aristotle"},{text:"The key to success is to focus our conscious mind on things we desire, not things we fear.",author:"Brian Tracy"},{text:"Focus on being productive instead of busy.",author:"Tim Ferriss"},{text:"Where focus goes, energy flows.",author:"Tony Robbins"},{text:"Lack of direction, not lack of time, is the problem. We all have twenty-four hour days.",author:"Zig Ziglar"},{text:"The main thing is to keep the main thing the main thing.",author:"Stephen Covey"},{text:"You can't depend on your eyes when your imagination is out of focus.",author:"Mark Twain"},{text:"Focus is a matter of deciding what things you're not going to do.",author:"John Carmack"},{text:"Starve your distractions and feed your focus.",author:"Unknown"},{text:"The art of being wise is the art of knowing what to overlook.",author:"William James"},{text:"Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.",author:"Buddha"},{text:"Your focus determines your reality.",author:"Qui-Gon Jinn"},{text:"Multitasking is the opportunity to screw up more than one thing at a time.",author:"Steve Uzzell"},{text:"One reason so few of us achieve what we truly want is that we never direct our focus.",author:"Tony Robbins"},{text:"The ability to focus attention on important things is a defining characteristic of intelligence.",author:"Robert J. Shiller"},{text:"Always remember, your focus determines your reality.",author:"George Lucas"},{text:"Simplicity boils down to two steps: Identify the essential. Eliminate the rest.",author:"Leo Babauta"},{text:"If you chase two rabbits, you will catch neither one.",author:"Russian Proverb"},{text:"The shorter way to do many things is to do only one thing at a time.",author:"Mozart"},{text:"Attention is the rarest and purest form of generosity.",author:"Simone Weil"},{text:"Be where you are, not where you think you should be.",author:"Unknown"},{text:"Almost everything will work again if you unplug it for a few minutes, including you.",author:"Anne Lamott"},{text:"What you focus on expands.",author:"Oprah Winfrey"}];function d(){const t=Math.floor(Math.random()*m.length);return m[t]}let n=null,a=!1;async function c(){return new Promise(t=>{chrome.runtime.sendMessage({type:"GET_BLOCK_STATUS",url:window.location.href},o=>{t(o||{isBlocked:!1})})})}async function u(){return new Promise(t=>{chrome.runtime.sendMessage({type:"USE_BYPASS",site:window.location.href},o=>{t(o||{success:!1,remaining:0})})})}function h(){try{return new URL(window.location.href).hostname.replace(/^www\./,"")}catch{return window.location.hostname}}function f(t){const o=d(),p=h(),r=document.createElement("div");r.id="sordino-overlay",r.innerHTML=`
    <div class="sordino-container">
      <div class="sordino-glow"></div>
      <div class="sordino-content">
        <div class="sordino-logo">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" class="sordino-icon">
            <!-- Trumpet icon -->
            <path d="M12 32C12 32 16 28 24 28C32 28 36 32 36 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M36 26V38" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M36 32H48C50 32 52 30 52 28V36C52 34 50 32 48 32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="48" cy="32" r="4" stroke="currentColor" stroke-width="2"/>
            <path d="M8 30V34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <path d="M4 28V36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="sordino-title">Sordino</span>
        </div>

        <div class="sordino-quote">
          <p class="sordino-quote-text">"${o.text}"</p>
          <p class="sordino-quote-author">— ${o.author}</p>
        </div>

        <div class="sordino-card">
          <p class="sordino-blocked-site">${p} is blocked</p>
          <p class="sordino-reason">
            <span class="sordino-reason-icon">📅</span>
            ${t.reason||"Blocked"} ${t.timeRemaining?`• ${t.timeRemaining}`:""}
          </p>
        </div>

        <button class="sordino-bypass-btn" id="sordino-bypass">
          Bypass for 5 min
        </button>
        <p class="sordino-bypass-count" id="sordino-bypass-count">
          ${t.bypassesRemaining} quick bypass${t.bypassesRemaining===1?"":"es"} left
        </p>
      </div>
      <div class="sordino-texture"></div>
    </div>
  `;const e=r.querySelector("#sordino-bypass"),s=r.querySelector("#sordino-bypass-count");return t.bypassesRemaining===0&&(e.disabled=!0,e.textContent="No bypasses left",s.textContent="Resets at midnight"),e.addEventListener("click",async()=>{e.disabled=!0,e.textContent="Using bypass...",(await u()).success?l():(e.textContent="No bypasses left",s.textContent="Resets at midnight")}),r}function g(){if(document.getElementById("sordino-styles"))return;const t=document.createElement("style");t.id="sordino-styles",t.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&display=swap');

    #sordino-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      font-family: 'DM Sans', -apple-system, sans-serif !important;
      animation: sordino-fade-in 0.4s ease-out !important;
    }

    @keyframes sordino-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes sordino-float {
      0%, 100% {
        transform: translateY(0) scale(1);
      }
      50% {
        transform: translateY(-8px) scale(1.02);
      }
    }

    @keyframes sordino-glow-pulse {
      0%, 100% {
        opacity: 0.4;
        transform: translate(-50%, -50%) scale(1);
      }
      50% {
        opacity: 0.6;
        transform: translate(-50%, -50%) scale(1.1);
      }
    }

    .sordino-container {
      position: relative !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: linear-gradient(145deg, #1a1612 0%, #2d2620 50%, #1f1a16 100%) !important;
      overflow: hidden !important;
    }

    .sordino-glow {
      position: absolute !important;
      top: 40% !important;
      left: 50% !important;
      width: 600px !important;
      height: 600px !important;
      background: radial-gradient(circle, rgba(205, 164, 104, 0.15) 0%, rgba(205, 164, 104, 0.05) 40%, transparent 70%) !important;
      transform: translate(-50%, -50%) !important;
      animation: sordino-glow-pulse 6s ease-in-out infinite !important;
      pointer-events: none !important;
    }

    .sordino-texture {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E") !important;
      opacity: 0.03 !important;
      pointer-events: none !important;
    }

    .sordino-content {
      position: relative !important;
      z-index: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      padding: 2rem !important;
      max-width: 480px !important;
      animation: sordino-float 8s ease-in-out infinite !important;
    }

    .sordino-logo {
      display: flex !important;
      align-items: center !important;
      gap: 0.75rem !important;
      margin-bottom: 2.5rem !important;
    }

    .sordino-icon {
      width: 36px !important;
      height: 36px !important;
      color: #cda468 !important;
    }

    .sordino-title {
      font-family: 'Cormorant Garamond', Georgia, serif !important;
      font-size: 1.75rem !important;
      font-weight: 500 !important;
      letter-spacing: 0.1em !important;
      color: #cda468 !important;
      text-transform: uppercase !important;
    }

    .sordino-quote {
      margin-bottom: 2.5rem !important;
      padding: 0 1rem !important;
    }

    .sordino-quote-text {
      font-family: 'Cormorant Garamond', Georgia, serif !important;
      font-size: 1.5rem !important;
      font-weight: 400 !important;
      font-style: italic !important;
      line-height: 1.6 !important;
      color: #e8dcc8 !important;
      margin: 0 0 1rem 0 !important;
    }

    .sordino-quote-author {
      font-family: 'DM Sans', sans-serif !important;
      font-size: 0.875rem !important;
      font-weight: 500 !important;
      color: #9a8b7a !important;
      letter-spacing: 0.05em !important;
      margin: 0 !important;
    }

    .sordino-card {
      background: rgba(205, 164, 104, 0.08) !important;
      border: 1px solid rgba(205, 164, 104, 0.2) !important;
      border-radius: 12px !important;
      padding: 1.25rem 2rem !important;
      margin-bottom: 2rem !important;
      backdrop-filter: blur(8px) !important;
    }

    .sordino-blocked-site {
      font-family: 'DM Sans', sans-serif !important;
      font-size: 1.125rem !important;
      font-weight: 600 !important;
      color: #e8dcc8 !important;
      margin: 0 0 0.5rem 0 !important;
    }

    .sordino-reason {
      font-family: 'DM Sans', sans-serif !important;
      font-size: 0.875rem !important;
      color: #9a8b7a !important;
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
    }

    .sordino-reason-icon {
      font-size: 0.875rem !important;
    }

    .sordino-bypass-btn {
      font-family: 'DM Sans', sans-serif !important;
      font-size: 0.9375rem !important;
      font-weight: 500 !important;
      color: #1a1612 !important;
      background: linear-gradient(135deg, #cda468 0%, #b8935d 100%) !important;
      border: none !important;
      border-radius: 8px !important;
      padding: 0.875rem 2rem !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      box-shadow: 0 4px 12px rgba(205, 164, 104, 0.3) !important;
    }

    .sordino-bypass-btn:hover:not(:disabled) {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px rgba(205, 164, 104, 0.4) !important;
    }

    .sordino-bypass-btn:active:not(:disabled) {
      transform: translateY(0) !important;
    }

    .sordino-bypass-btn:disabled {
      background: rgba(205, 164, 104, 0.3) !important;
      color: #9a8b7a !important;
      cursor: not-allowed !important;
      box-shadow: none !important;
    }

    .sordino-bypass-count {
      font-family: 'DM Sans', sans-serif !important;
      font-size: 0.8125rem !important;
      color: #6b5d4d !important;
      margin: 0.75rem 0 0 0 !important;
    }
  `,document.head.appendChild(t)}function y(t){n||(g(),n=f(t),document.body.appendChild(n),document.body.style.overflow="hidden")}function l(){n&&(n.remove(),n=null,document.body.style.overflow="")}async function i(){if(!a){a=!0;try{const t=await c();t.isBlocked?y(t):l()}catch(t){console.error("Sordino: Error checking block status",t)}finally{a=!1}}}i();document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&i()});setInterval(i,3e4);chrome.runtime.onMessage.addListener(t=>{t.type==="SETTINGS_UPDATE"&&i()});
