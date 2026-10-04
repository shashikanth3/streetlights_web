// api/index.js - the whole website + backend in one file.
// GET  /            -> the street light page
// GET  /api/state   -> latest device state (polled by the page)
// POST /api/event   -> called by the ESP8266 (header X-Device-Token)
//
// Env var needed: DEVICE_TOKEN (you choose it). There is no database: the latest
// state lives in the server's memory, which has no usage limits. The ESP8266
// re-sends its state at least once a minute, so it refills by itself if the
// server ever restarts.

const S = globalThis.__streetLight || (globalThis.__streetLight = { seen: 0, night: null, ir1At: 0, ir2At: 0 });

function event(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.DEVICE_TOKEN || req.headers['x-device-token'] !== process.env.DEVICE_TOKEN) {
    return res.status(401).json({ error: 'bad token' });
  }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const now = Date.now();
  S.seen = now;
  if (b.ir === 1 || b.ir === 2) S['ir' + b.ir + 'At'] = now;
  if (typeof b.night === 'boolean') S.night = b.night;
  res.status(200).json({ ok: true });
}

function state(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ now: Date.now(), seen: S.seen, night: S.night, ir1At: S.ir1At, ir2At: S.ir2At });
}

module.exports = function handler(req, res) {
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/';
  if (path === '/api/event') return event(req, res);
  if (path === '/api/state') return state(req, res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(HTML);
};

// ---------------- the page ----------------
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Automatic Street Light Control Using LDR and Arduino — Batch No. 1</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Figtree:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#eef1f8;--ink:#1b2140;--muted:#58607d;--panel:#fff;--line:#d5dae8;--lamp:#f2a900;--code:#1b2140;--codeink:#e6e9f5;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121734;--ink:#e8ebf7;--muted:#9aa2c4;--panel:#1a2146;--line:#2b3566;--lamp:#ffc83d;--code:#0d1128}}
:root[data-theme="dark"]{--bg:#121734;--ink:#e8ebf7;--muted:#9aa2c4;--panel:#1a2146;--line:#2b3566;--lamp:#ffc83d;--code:#0d1128}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,sans-serif;line-height:1.6;font-size:clamp(15px,1.1vw + 11px,18px)}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px;padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right))}
h1,h2,h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;line-height:1.1;margin:0}
h1{font-size:clamp(2rem,6.2vw,3.9rem);font-weight:800;letter-spacing:-.03em;max-width:19ch}
.batch{display:inline-block;margin-bottom:14px;padding:5px 14px;border-radius:999px;background:var(--lamp);color:#1b2140;font-weight:700;font-size:.85rem;letter-spacing:.04em;text-transform:uppercase}
h2{font-size:clamp(1.6rem,4vw,2.3rem);font-weight:700;letter-spacing:-.02em;margin-bottom:12px}
h3{font-size:1.15rem;font-weight:700;margin-bottom:6px}
p{margin:0 0 14px;max-width:62ch}
.lede{color:var(--muted);font-size:1.15rem;margin-top:18px}
header{padding:56px 0 28px}section{padding:36px 0}
.sim{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.scene{position:relative;background:linear-gradient(#6fa6e6 50%,#76876f 50%)}
.scene.night{background:linear-gradient(#101a37 50%,#283156 50%)}
.scene svg{display:block;width:100%;height:auto}
.dark{opacity:0;transition:opacity .6s}
.night .dark{opacity:.86}
.nt{opacity:0;transition:opacity .6s}.night .nt{opacity:1}
.dy{transition:opacity .6s}.night .dy{opacity:0}
.lt{opacity:var(--b,0);transition:opacity .4s}
.sn{fill:#2f375a;stroke:#aab3d6;stroke-width:3}.sn.hit{fill:#ff5d73;stroke:#ffd0d6}
.lbl{font:600 14px Figtree,system-ui,sans-serif;fill:#fff;stroke:#0009;stroke-width:3px;paint-order:stroke;text-anchor:middle}
.ctl{display:flex;flex-wrap:wrap;gap:10px;padding:16px;border-top:1px solid var(--line)}
button{font:inherit;font-weight:600;border:1px solid var(--line);background:transparent;color:var(--ink);padding:10px 16px;border-radius:10px;cursor:pointer;min-height:44px}
button:hover{border-color:var(--ink)}
button:focus-visible{outline:3px solid var(--lamp);outline-offset:2px}
button.primary{background:var(--lamp);border-color:var(--lamp);color:#1b2140}
.bars{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 16px 16px}
.bar small{display:block;color:var(--muted);font-size:.85rem;margin-bottom:4px}
.track{height:8px;background:var(--line);border-radius:4px;overflow:hidden}
.fill{height:100%;width:0;background:var(--lamp)}
.status{padding:0 16px 16px;color:var(--muted);font-size:.95rem}.status b{color:var(--ink)}
.three{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:18px}
.box{border:1px solid var(--line);border-radius:12px;padding:18px;background:var(--panel)}
.box p{margin:0;color:var(--muted);font-size:.97rem}
table{width:100%;border-collapse:collapse;font-size:.95rem}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
tr:last-child td{border-bottom:0}th{color:var(--muted);font-weight:600}
pre{margin:0;background:var(--code);color:var(--codeink);padding:18px;border-radius:12px;overflow-x:auto;font-size:.82rem;line-height:1.55}
code{font-family:ui-monospace,Menlo,Consolas,monospace}
footer{padding:36px 0 56px;color:var(--muted);font-size:.9rem}
button:disabled{opacity:.5;cursor:not-allowed}
.pill{position:absolute;left:12px;top:12px;z-index:2;font:600 .8rem Figtree,system-ui,sans-serif;padding:5px 10px;border-radius:999px;background:rgba(20,25,60,.75);color:#cfd6f5}
.pill.on{background:#1f7a4d;color:#fff}
@media (max-width:560px){.bars{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

/* ---- adaptive layout + full screen ---- */
button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.fsb{position:absolute;right:12px;top:12px;z-index:3;min-height:34px;padding:5px 12px;font-size:.8rem;border:0;border-radius:999px;background:rgba(20,25,60,.75);color:#cfd6f5}
.fsb:hover{background:rgba(20,25,60,.92)}
html.fs-lock,html.fs-lock body{overflow:hidden}
.sim.fs{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;height:100vh;height:100dvh;border:0;border-radius:0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
.sim.fs .scene{flex:1 1 auto;min-height:0;align-self:stretch}
.sim.fs .scene svg{position:absolute;inset:0;width:100%;height:100%}
.sim.fs .panel{flex:0 0 auto;max-height:42%;overflow-y:auto}
.sim.fs .ctl{display:flex;flex-wrap:wrap;padding:10px 12px;gap:8px}
.sim.fs .ctl button{min-height:44px;padding:10px 16px;font-size:1rem}
.sim.fs .bars{grid-template-columns:1fr 1fr;padding:0 12px 10px}
.sim.fs .status{padding:0 12px 10px;font-size:.95rem;line-height:1.6}
.rot{display:none}
@media (orientation:landscape) and (max-height:540px) and (min-aspect-ratio:8/5){
  header{padding:18px 0 6px}section{padding:16px 0}footer{padding:18px 0 28px}
  h1{font-size:clamp(1.7rem,4.2vw,2.6rem);max-width:none}
  h2{font-size:1.4rem;margin-bottom:8px}
  .lede{font-size:1rem;margin-top:8px}
  .sim{display:flex}
  .sim .scene{flex:1 1 0;min-width:0;align-self:flex-start}
  .sim .panel{flex:0 0 clamp(200px,30vw,270px);border-left:1px solid var(--line)}
  .sim .ctl{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;border-top:0}
  .sim .ctl button{min-height:40px;padding:8px 10px;font-size:.9rem}
  .sim .bars{grid-template-columns:1fr 1fr;gap:10px;padding:0 10px 8px}
  .sim .status{padding:0 10px 10px;font-size:.88rem;line-height:1.4}
}
@media (orientation:portrait){
  .sim.fs .scene{flex:0 0 auto;width:100%;aspect-ratio:2/1}
  .sim.fs .panel{flex:1 1 auto;max-height:none}
  .sim.fs .ctl button{flex:1 1 42%;min-height:54px}
  .sim.fs .status{font-size:1.05rem}
  .sim.fs .rot{display:block;padding:0 12px 14px;color:var(--muted);font-size:.9rem}
}
@media (orientation:landscape) and (min-aspect-ratio:8/5){
  .sim.fs{flex-direction:row}
  .sim.fs .panel{flex:0 0 clamp(210px,28vw,290px);max-height:none;border-left:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;overflow-y:auto}
  .sim.fs .ctl{flex-direction:column;border-top:0}
  .sim.fs .bars{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="batch">Batch No. 1</div>
  <h1>Automatic Street Light Control Using LDR and Arduino</h1>
  <p class="lede">An ESP8266 reads a light sensor and two infrared sensors. By day the lights are off. At night every lamp glows at 50% to save power, and when something passes a lamp's sensor, that lamp goes to full brightness for five seconds.</p>
</header>

<section aria-labelledby="try">
  <h2 id="try">Try it</h2>
  <p>Switch to night, then send a car down the road. It drives toward you, so lamp 1 is the farthest one. When the ESP8266 is online, this page follows its day/night sensor and both IR sensors in real time. Tap Full screen for a bigger view, in portrait or landscape.</p>
  <div class="sim" id="sim">
    <div class="scene night" id="scene">
      <div class="pill" id="pill">Demo mode</div>
      <button class="fsb" id="fs" type="button" aria-label="Full screen">Full screen</button>
      <svg id="svg" viewBox="0 0 800 400" role="img" aria-label="A road with two street lights in front of the Siddhartha Institute of Technology &amp; Sciences college building">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa6e6"/><stop offset="1" stop-color="#dbe8f6"/></linearGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe8f6" stop-opacity="0"/><stop offset="1" stop-color="#dbe8f6" stop-opacity=".95"/></linearGradient>
          <linearGradient id="darkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#01031a"/><stop offset=".5" stop-color="#0a1034"/><stop offset="1" stop-color="#1b2352"/></linearGradient>
          <linearGradient id="rd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#343b50"/><stop offset="1" stop-color="#5a627a"/></linearGradient>
          <linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8590b5"/><stop offset=".5" stop-color="#566087"/><stop offset="1" stop-color="#363e5e"/></linearGradient>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6594"/><stop offset="1" stop-color="#2b3355"/></linearGradient>
          <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a66b0" stop-opacity="0"/><stop offset="1" stop-color="#5a66b0" stop-opacity=".5"/></linearGradient>
          <radialGradient id="gl"><stop offset="0" stop-color="#fff2b8" stop-opacity=".95"/><stop offset=".3" stop-color="#ffd25e" stop-opacity=".4"/><stop offset="1" stop-color="#ffd25e" stop-opacity="0"/></radialGradient>
          <radialGradient id="pool"><stop offset="0" stop-color="#ffdc82" stop-opacity=".8"/><stop offset="1" stop-color="#ffdc82" stop-opacity="0"/></radialGradient>
          <radialGradient id="mg"><stop offset="0" stop-color="#dfe6ff" stop-opacity=".5"/><stop offset="1" stop-color="#dfe6ff" stop-opacity="0"/></radialGradient>
          <radialGradient id="cgw"><stop offset="0" stop-color="#ffb066" stop-opacity=".5"/><stop offset="1" stop-color="#ffb066" stop-opacity="0"/></radialGradient>
          <radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>
          <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe49a" stop-opacity=".5"/><stop offset="1" stop-color="#ffe49a" stop-opacity=".04"/></linearGradient>
          <filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
          <filter id="gr"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/><feColorMatrix type="saturate" values="0"/></filter>
          <clipPath id="rc"><polygon points="394,190 406,190 672,400 128,400"/></clipPath>
        </defs>
        <rect width="800" height="190" fill="url(#sky)"/>
        <circle class="dy" cx="130" cy="62" r="24" fill="#ffd45c"/>
        <g id="skyA" fill="#8fa0bf"></g>
        <rect y="120" width="800" height="70" fill="url(#haze)"/>
        <g id="skyB" fill="#6c7c9c"></g>
        <rect y="160" width="800" height="30" fill="url(#haze)" opacity=".45"/>
        <g id="college" transform="translate(350 0)">
          <rect x="80" y="130" width="30" height="60" fill="#a8947c"/><rect x="350" y="130" width="30" height="60" fill="#a8947c"/>
          <rect x="78" y="126" width="34" height="5" fill="#8a7560"/><rect x="348" y="126" width="34" height="5" fill="#8a7560"/>
          <rect x="110" y="104" width="240" height="86" fill="#c4af96"/>
          <rect x="106" y="99" width="248" height="6" fill="#8a7560"/>
          <rect x="188" y="76" width="84" height="114" fill="#cdb9a0"/>
          <rect x="184" y="73" width="92" height="5" fill="#8a7560"/>
          <polygon points="178,74 230,48 282,74" fill="#8a6a52"/>
          <line x1="230" y1="48" x2="230" y2="26" stroke="#5a5f70" stroke-width="1.6"/>
          <polygon points="230,26 248,31 230,37" fill="#e0742e"/>
          <g id="cWd" fill="#6f8dbb" opacity=".9"></g>
          <g fill="#ece3d2"><rect x="195" y="150" width="6" height="40"/><rect x="207" y="150" width="6" height="40"/><rect x="247" y="150" width="6" height="40"/><rect x="259" y="150" width="6" height="40"/></g>
          <rect x="219" y="164" width="22" height="26" rx="2" fill="#3a2e2a"/>
          <rect x="150" y="110" width="160" height="28" rx="2.5" fill="#17306b" stroke="#f0d58a" stroke-width="1"/>
          <g font-family="Figtree,system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#fff" letter-spacing=".25">
            <text x="230" y="122.5" font-size="9">SIDDHARTHA INSTITUTE OF</text>
            <text x="230" y="133.5" font-size="9">TECHNOLOGY &amp; SCIENCES</text>
          </g>
        </g>
        <rect y="190" width="800" height="210" fill="#76876f"/>
        <polygon points="394,190 128,400 0,400" fill="#9097a8"/>
        <polygon points="406,190 672,400 800,400" fill="#9097a8"/>
        <g id="slabs" fill="none"></g>
        <polygon points="394,190 406,190 672,400 128,400" fill="url(#rd)"/>
        <g clip-path="url(#rc)"><rect width="800" height="400" filter="url(#gr)" opacity=".16"/></g>
        <polyline points="394,190 128,400" stroke="#c4c9d6" stroke-width="2" fill="none"/>
        <polyline points="406,190 672,400" stroke="#c4c9d6" stroke-width="2" fill="none"/>
        <g id="dash" fill="#e9edf7"></g>
        <g id="trees"></g>
        <g id="bodies"></g>
        <g id="car" style="display:none">
          <ellipse cy="2" rx="98" ry="9" fill="#000" opacity=".45"/>
          <rect x="-88" y="-40" width="176" height="26" rx="10" fill="url(#cg)"/>
          <path d="M-80-40L-62-62H62L80-40Z" fill="#3b4570"/>
          <path d="M-56-62L-44-92H44L56-62Z" fill="#2c3354"/>
          <path d="M-48-64L-38-88H38L48-64Z" fill="#6f8dbb" opacity=".9"/>
          <path d="M-48-64L-38-88H-12L-24-64Z" fill="#fff" opacity=".14"/>
          <rect x="-30" y="-34" width="60" height="10" rx="3" fill="#11152a"/>
          <rect x="-14" y="-22" width="28" height="8" fill="#e8e8e8"/>
          <ellipse cx="-62" cy="-30" rx="14" ry="7" fill="#fff6c4"/><ellipse cx="62" cy="-30" rx="14" ry="7" fill="#fff6c4"/>
          <rect x="-80" y="-14" width="22" height="16" rx="3" fill="#0c0f1f"/><rect x="58" y="-14" width="22" height="16" rx="3" fill="#0c0f1f"/>
        </g>
        <rect class="dark" width="800" height="400" fill="url(#darkg)"/>
        <ellipse class="nt" cx="400" cy="190" rx="520" ry="70" fill="url(#cgw)"/>
        <rect class="nt" y="130" width="800" height="60" fill="url(#fg)"/>
        <g class="nt" id="stars" fill="#fff"></g>
        <circle class="nt" cx="130" cy="62" r="70" fill="url(#mg)"/>
        <circle class="nt" cx="130" cy="62" r="18" fill="#eef1ff"/>
        <g class="nt" id="winA" fill-opacity=".25"></g>
        <g class="nt" id="winB" fill-opacity=".4"></g>
        <g class="nt" id="collegeN" transform="translate(350 0)">
          <ellipse cx="230" cy="160" rx="170" ry="46" fill="url(#pool)" opacity=".28"/>
          <rect x="150" y="110" width="160" height="28" rx="2.5" fill="#ffd25e" opacity=".4" filter="url(#bl)"/>
          <rect x="150" y="110" width="160" height="28" rx="2.5" fill="#1c3f8f" stroke="#ffe9a8" stroke-width="1"/>
          <g font-family="Figtree,system-ui,sans-serif" font-weight="700" text-anchor="middle" fill="#fff4c7" letter-spacing=".25">
            <text x="230" y="122.5" font-size="9">SIDDHARTHA INSTITUTE OF</text>
            <text x="230" y="133.5" font-size="9">TECHNOLOGY &amp; SCIENCES</text>
          </g>
          <rect x="219" y="164" width="22" height="26" rx="2" fill="#ffd980" opacity=".8"/>
          <g id="cWn" fill="#ffd980"></g>
        </g>
        <g id="lights"></g>
        <g id="carL" class="nt" style="display:none"><ellipse cx="0" cy="26" rx="190" ry="40" fill="url(#pool)"/><circle cx="-62" cy="-30" r="80" fill="url(#gl)"/><circle cx="62" cy="-30" r="80" fill="url(#gl)"/><ellipse cx="-62" cy="-30" rx="14" ry="7" fill="#fffbe0"/><ellipse cx="62" cy="-30" rx="14" ry="7" fill="#fffbe0"/></g>
        <rect width="800" height="400" fill="url(#vg)" pointer-events="none"/>
        <g id="labels"></g>
      </svg>
    </div>
    <div class="panel">
    <div class="ctl">
      <button id="tgl" aria-pressed="true">Switch to day</button>
      <button class="primary" id="b1">Trigger IR 1</button>
      <button class="primary" id="b2">Trigger IR 2</button>
      <button id="drive">Drive a car through</button>
      <button id="demoBtn" type="button" style="display:none">Switch to demo</button>
    </div>
    <div class="bars">
      <div class="bar"><small>IR 1 timer</small><div class="track"><div class="fill" id="f1"></div></div></div>
      <div class="bar"><small>IR 2 timer</small><div class="track"><div class="fill" id="f2"></div></div></div>
    </div>
    <div class="status" id="st" aria-live="polite"></div>
      <div class="rot">Tip: rotate your phone to landscape for a bigger view.</div>
    </div>
  </div>
</section>

<section aria-labelledby="how">
  <h2 id="how">How it behaves</h2>
  <div class="three">
    <div class="box"><h3>Day</h3><p>The light sensor says it is bright, so every lamp is off and running timers are cleared.</p></div>
    <div class="box"><h3>Night, idle</h3><p>Every lamp stays on at 50% brightness using PWM.</p></div>
    <div class="box"><h3>Night, triggered</h3><p>Each lamp has its own IR sensor and its own 5 second timer. While it runs, that lamp is at 100% and the other stays dim. A new detection restarts the timer.</p></div>
  </div>
</section>

<section aria-labelledby="hw">
  <h2 id="hw">Wiring</h2>
  <div class="scroll"><table>
    <tr><th>Part</th><th>NodeMCU pin</th><th>Notes</th></tr>
    <tr><td>IR sensor 1 (entry)</td><td>D1</td><td>Output goes LOW when it sees an object</td></tr>
    <tr><td>IR sensor 2 (exit)</td><td>D2</td><td>Same as sensor 1</td></tr>
    <tr><td>LED 1</td><td>D5</td><td>Pin HIGH = on (use a resistor)</td></tr>
    <tr><td>LED 2</td><td>D6</td><td>Pin HIGH = on (use a resistor)</td></tr>
    <tr><td>LED 3</td><td>D7</td><td>Pin HIGH = on (use a resistor)</td></tr>
    <tr><td>LDR module</td><td>A0</td><td>Night when the reading is above 600</td></tr>
  </table></div>
</section>

<section aria-labelledby="code">
  <h2 id="code">The sketch</h2>
  <p>Each IR sensor has its own timer based on <code>millis()</code>, so the loop never blocks. Any active timer turns all three LEDs on.</p>
<pre><code>const unsigned long ALL_ON_TIME = 5000;

void loop() {
  unsigned long now = millis();
  int ldr = analogRead(LDR_PIN);
  bool isNight = DARK_IS_LOW ? (ldr &lt; DARK_THRESHOLD)
                             : (ldr &gt; DARK_THRESHOLD);

  if (!isNight) {
    ir1Active = false; ir2Active = false;
    allOff();                              // day
  } else {
    if (digitalRead(IR1_PIN) == IR_DETECTED) { ir1Active = true; ir1Until = now + ALL_ON_TIME; }
    if (digitalRead(IR2_PIN) == IR_DETECTED) { ir2Active = true; ir2Until = now + ALL_ON_TIME; }
    if (ir1Active &amp;&amp; (long)(now - ir1Until) &gt;= 0) ir1Active = false;
    if (ir2Active &amp;&amp; (long)(now - ir2Until) &gt;= 0) ir2Active = false;

    if (ir1Active || ir2Active) threeLedsOn();
    else                        oneLedOn();   // only LED 3
  }
  delay(50);
}</code></pre>
</section>

<footer>Batch No. 1 · Automatic Street Light Control Using LDR and Arduino · ESP8266 NodeMCU · LDR · 2 IR sensors · 3 LEDs</footer>
</div>

<script>
(function(){
  var HOLD=5000,night=true,t=[0,0,0],driving=false,NS='http://www.w3.org/2000/svg';
  var PS=[.3,.62];
  var $=function(i){return document.getElementById(i)};
  var scene=$('scene'),L=[];
  function add(par,html){par.insertAdjacentHTML('beforeend',html)}
  var sd=11;function rnd(){sd=(sd*9301+49297)%233280;return sd/233280}
  function city(id,wid,minW,maxW,minH,maxH,p){
    var b='',w='';
    for(var x=-10;x<810;){
      var bw=minW+rnd()*(maxW-minW),bh=minH+rnd()*(maxH-minH),y=190-bh;
      b+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'"/>';
      if(rnd()<.2)b+='<rect x="'+(x+bw/2-1).toFixed(1)+'" y="'+(y-12).toFixed(1)+'" width="2" height="12"/>';
      for(var wx=x+4;wx<x+bw-6;wx+=8)for(var wy=y+6;wy<184;wy+=10)if(rnd()<p)w+='<rect x="'+wx.toFixed(1)+'" y="'+wy.toFixed(1)+'" width="3" height="4" fill="'+(rnd()<.8?'#d9b25f':'#8fb4dc')+'"/>';
      x+=bw+rnd()*3;
    }
    add($(id),b);add($(wid),w);
  }
  city('skyA','winA',22,48,30,95,.07);
  city('skyB','winB',34,74,18,52,.08);
  // college building windows (blue glass by day, some lit at night)
  (function(){
    var W=[],i,j;
    for(j=0;j<2;j++)for(i=0;i<5;i++){W.push([120+14*i,152+18*j,8,11]);W.push([280+14*i,152+18*j,8,11])}
    for(j=0;j<3;j++){W.push([86,140+18*j,6,9]);W.push([98,140+18*j,6,9]);W.push([355,140+18*j,6,9]);W.push([367,140+18*j,6,9])}
    W.push([213,84,8,14]);W.push([239,84,8,14]);
    var d='',n='';
    W.forEach(function(w){var r='<rect x="'+w[0]+'" y="'+w[1]+'" width="'+w[2]+'" height="'+w[3]+'" rx="1"';d+=r+'/>';if(rnd()<.72)n+=r+'/>'});
    add($('cWd'),d);add($('cWn'),n);
  })();
  var tg='';
  [.2,.31,.48,.71].forEach(function(s){tg+='<g transform="translate('+(400+336*s)+' '+(190+210*s)+') scale('+s+')"><rect x="-5" y="-95" width="10" height="95" fill="#3d342f"/><g fill="#3f5b4c"><circle cy="-125" r="46"/><circle cx="-32" cy="-104" r="34"/><circle cx="30" cy="-108" r="36"/><circle cy="-158" r="32"/></g><circle cx="-14" cy="-134" r="22" fill="#52715c" opacity=".6"/></g>'});
  add($('trees'),tg);
  var sl='';
  for(var q=6;q>1.1;q-=.4){var a=1/q,yy=190+210*a;sl+='<path d="M'+(400-400*a)+' '+yy+'H'+(400-272*a)+'M'+(400+272*a)+' '+yy+'H'+(400+400*a)+'" stroke="#7b8294" stroke-width="'+Math.max(.5,1.2*a)+'"/>';}
  add($('slabs'),sl);
  // lane dashes in perspective
  var d='';
  for(var z=6;z>1.2;z-=.55){var a=1/z,b=1/(z-.25),w0=5*a,w1=5*b,y0=190+210*a,y1=190+210*b;
    d+='<polygon points="'+(400-w0)+','+y0+' '+(400+w0)+','+y0+' '+(400+w1)+','+y1+' '+(400-w1)+','+y1+'"/>';}
  add($('dash'),d);
  // stars
  var st='',r=7;
  for(var i=0;i<45;i++){r=(r*9301+49297)%233280;var x=r/233280*800;r=(r*9301+49297)%233280;var y=r/233280*130;st+='<circle cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" r="'+(i%5?.8:1.4)+'"/>';}
  add($('stars'),st);
  // poles: far to near
  var LX=[];
  function pole(s,n){
    var ctl=n>=0,x=400-320*s,y=190+210*s,tr='translate('+x+' '+y+') scale('+s+')',
        op=Math.min(1,.45+s*1.2).toFixed(2),id=ctl?'lt'+n:'lx'+LX.length;
    add($('bodies'),'<g'+(ctl?' id="pb'+n+'"':'')+' opacity="'+op+'" transform="'+tr+'"><path d="M-4 0L-120 7L-120 1L4-3Z" fill="#000" opacity=".28"/><ellipse cy="2" rx="14" ry="4" fill="#000" opacity=".25"/><path d="M-6 0H6L3-250H-3Z" fill="url(#pg)"/><rect x="-9" y="-14" width="18" height="14" rx="2" fill="#4a5273"/><path d="M0-250C0-272 24-274 58-262" stroke="#566087" stroke-width="6" fill="none"/><ellipse cx="64" cy="-258" rx="26" ry="7" fill="#7f89ab"/><ellipse cx="64" cy="-253" rx="19" ry="3.5" fill="#cfd6ee"/>'+(ctl&&n<2?'<rect id="s'+(n+1)+'" class="sn" x="5" y="-120" width="16" height="30" rx="3"/>':'')+'</g>');
    add($('lights'),'<g class="lt" id="'+id+'" transform="'+tr+'"><circle cx="64" cy="-253" r="'+(130+120*(1-s)).toFixed(0)+'" fill="url(#gl)"/><polygon points="50,-251 78,-251 190,6 -50,6" fill="url(#cone)" filter="url(#bl)"/><ellipse cx="70" cy="4" rx="160" ry="24" fill="url(#pool)"/><ellipse cx="70" cy="75" rx="12" ry="85" fill="url(#gl)" opacity=".6"/><ellipse cx="64" cy="-253" rx="21" ry="6" fill="#fff8d6" filter="url(#bl)"/></g>');
    if(ctl){if(n<2)add($('labels'),'<text class="lbl" x="'+x+'" y="'+(y+18)+'">IR '+(n+1)+'</text>');L.push($(id))}
    else LX.push($(id));
  }
  PS.forEach(function(s,n){pole(s,n)});
  function trig(n){
    if(!night)return;
    t[n]=Date.now()+HOLD;
    var e=$('s'+(n+1));e.classList.add('hit');setTimeout(function(){e.classList.remove('hit')},300);
  }
  [0,1].forEach(function(n){$('b'+(n+1)).onclick=function(){if(demoView)walk(n?.5:MS0);else trig(n)}});
  // ---- walking man (demo mode): perspective scale, depth ordering vs poles, IR fired as he passes ----
  add($('bodies'),'<g id="man" style="display:none"><ellipse id="mSh" cx="-16" cy="2" rx="38" ry="7" fill="#000" opacity=".4"/>'+
    '<g id="mlL"><rect x="-18" y="-90" width="15" height="84" rx="6" fill="#2c3354"/><rect x="-21" y="-11" width="20" height="11" rx="5" fill="#14172b"/></g>'+
    '<g id="mlR"><rect x="3" y="-90" width="15" height="84" rx="6" fill="#2c3354"/><rect x="1" y="-11" width="20" height="11" rx="5" fill="#14172b"/></g>'+
    '<g id="mBody"><g id="maL"><rect x="-34" y="-140" width="12" height="52" rx="6" fill="#c9672a"/><circle cx="-28" cy="-85" r="6" fill="#d9a577"/></g>'+
    '<g id="maR"><rect x="22" y="-140" width="12" height="52" rx="6" fill="#c9672a"/><circle cx="28" cy="-85" r="6" fill="#d9a577"/></g>'+
    '<rect x="-23" y="-146" width="46" height="62" rx="15" fill="#e0742e"/><rect x="-21" y="-92" width="42" height="7" fill="#1c1f33"/>'+
    '<rect x="-5" y="-156" width="10" height="12" fill="#c98f62"/><circle cy="-168" r="13" fill="#d9a577"/>'+
    '<path d="M-13-169C-13-186 13-186 13-169C7-176-7-176-13-169Z" fill="#1c1410"/></g></g>');
  var demoView=true,man=$('man'),mlL=$('mlL'),mlR=$('mlR'),maL=$('maL'),maR=$('maR'),mBody=$('mBody'),mZone=-1;
  var MX=352,MS0=.16,MZ1=.8,MV=.0007,M={walking:false,wait:0,t0:0,z0:1/MS0,s:MS0,fired:[true,true]};
  function manZone(s){
    var z=s<PS[0]?0:s<PS[1]?1:2;if(z===mZone)return;mZone=z;
    var p=$('bodies');
    if(z===0)p.insertBefore(man,$('pb0'));else if(z===1)p.insertBefore(man,$('pb1'));else p.appendChild(man);
  }
  function walk(s0){
    man.style.display='';M.walking=true;M.wait=0;M.t0=performance.now();M.z0=1/s0;
    M.fired=[s0>=PS[0],s0>=PS[1]];
  }
  function manFrame(now){
    if(demoView&&M.walking){
      var s=M.s,ph=0;
      if(M.walking){
        var z=M.z0-MV*(now-M.t0);
        if(z<=MZ1){M.walking=false;man.style.display='none';M.fired=[true,true];requestAnimationFrame(manFrame);return}
        else{s=1/z;ph=(now-M.t0)*.0072}
      }
      M.s=s;
      if(M.walking)[0,1].forEach(function(k){if(!M.fired[k]&&s>=PS[k]){M.fired[k]=true;trig(k)}});
      var sw=Math.sin(ph),bob=M.walking?-Math.abs(Math.cos(ph))*4:0,lift=Math.max(0,sw)*11,lift2=Math.max(0,-sw)*11;
      manZone(s);
      man.setAttribute('transform','translate('+(400-MX*s)+' '+(190+210*s)+') scale('+s+')');
      man.setAttribute('opacity',Math.min(1,.5+s*1.6).toFixed(2));
      mlL.setAttribute('transform','translate(0 '+(-lift)+') rotate('+(sw*7)+' -10 -90)');
      mlR.setAttribute('transform','translate(0 '+(-lift2)+') rotate('+(sw*7)+' 10 -90)');
      maL.setAttribute('transform','translate(0 '+(sw*7)+')');
      maR.setAttribute('transform','translate(0 '+(-sw*7)+')');
      mBody.setAttribute('transform','translate(0 '+bob+')');
    }
    requestAnimationFrame(manFrame);
  }
  requestAnimationFrame(manFrame);
  $('tgl').onclick=function(){
    night=!night;t=[0,0,0];scene.classList.toggle('night',night);
    this.textContent=night?'Switch to day':'Switch to night';this.setAttribute('aria-pressed',night);
  };
  var D=5000,z0=8,z1=.85,carB=$('car'),carL=$('carL');
  $('drive').onclick=function(){
    if(driving||!night)return;driving=true;
    carB.style.display='';carL.style.display='';
    PS.slice(0,2).forEach(function(s,n){setTimeout(function(){trig(n)},D*(z0-1/s)/(z0-z1))});
    var t0=performance.now();
    (function f(now){
      var u=Math.min(1,(now-t0)/D),s=1/(z0+(z1-z0)*u),tr='translate('+(400+136*s)+' '+(190+210*s)+') scale('+s+')';
      carB.setAttribute('transform',tr);carL.setAttribute('transform',tr);
      if(u<1)requestAnimationFrame(f);
      else{carB.style.display='none';carL.style.display='none';driving=false}
    })(t0);
  };
  function tick(){
    var now=Date.now(),a0=night&&now<t[0],a1=night&&now<t[1],all=a0||a1;
    LX.forEach(function(e){e.style.setProperty('--b',0)});
    L[0].style.setProperty('--b',!night?0:a0?1:.5);
    L[1].style.setProperty('--b',!night?0:a1?1:.5);
    $('f1').style.width=(a0?(t[0]-now)/HOLD*100:0)+'%';
    $('f2').style.width=(a1?(t[1]-now)/HOLD*100:0)+'%';
    $('st').innerHTML=!night?'<b>Day:</b> all lamps off.':all?'<b>Night:</b> '+(a0&&a1?'IR 1 and IR 2 fired, both lamps at 100%.':a0?'IR 1 fired, lamp 1 at 100%, lamp 2 at 50%.':'IR 2 fired, lamp 2 at 100%, lamp 1 at 50%.'):'<b>Night, idle:</b> both lamps at 50%.';
  }
  // ---- full screen (works in portrait and landscape, with a fallback for iPhone) ----
  var sim=$('sim'),svg=$('svg'),fsb=$('fs'),wl=null;
  function isFs(){return sim.classList.contains('fs')}
  function nativeEl(){return document.fullscreenElement||document.webkitFullscreenElement}
  function fit(){
    var r=scene.getBoundingClientRect();
    var wide=isFs()&&r.height>0&&r.width/r.height>=1.35;
    svg.setAttribute('preserveAspectRatio',wide?'xMidYMid slice':'xMidYMid meet');
  }
  function lockScreen(){
    try{if(navigator.wakeLock)navigator.wakeLock.request('screen').then(function(l){wl=l;l.addEventListener('release',function(){wl=null})}).catch(function(){})}catch(e){}
  }
  function unlockScreen(){try{if(wl)wl.release()}catch(e){}wl=null}
  function enterFs(){
    sim.classList.add('fs');document.documentElement.classList.add('fs-lock');
    fsb.textContent='Exit full screen';fsb.setAttribute('aria-label','Exit full screen');
    var f=sim.requestFullscreen||sim.webkitRequestFullscreen;
    if(f){try{var p=f.call(sim);if(p&&p.catch)p.catch(function(){})}catch(e){}}
    lockScreen();fit();
  }
  function leaveFs(){
    sim.classList.remove('fs');document.documentElement.classList.remove('fs-lock');
    fsb.textContent='Full screen';fsb.setAttribute('aria-label','Full screen');
    if(nativeEl()){var x=document.exitFullscreen||document.webkitExitFullscreen;try{var p=x.call(document);if(p&&p.catch)p.catch(function(){})}catch(e){}}
    unlockScreen();fit();
  }
  fsb.onclick=function(){isFs()?leaveFs():enterFs()};
  function onFsChange(){if(isFs()&&!nativeEl())leaveFs();else fit()}
  document.addEventListener('fullscreenchange',onFsChange);
  document.addEventListener('webkitfullscreenchange',onFsChange);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isFs())leaveFs()});
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&isFs()&&!wl)lockScreen()});
  window.addEventListener('resize',fit);
  window.addEventListener('orientationchange',function(){setTimeout(fit,200)});
  if(window.ResizeObserver)new ResizeObserver(fit).observe(scene);
  fit();
  // ---- live device sync ----
  var last=[0,0];
  function setNight(v){
    if(night===v)return;night=v;t=[0,0,0];scene.classList.toggle('night',v);
    var b=$('tgl');b.textContent=v?'Switch to day':'Switch to night';b.setAttribute('aria-pressed',v);
  }
  var best={seen:0,night:null,ir1At:0,ir2At:0},forceDemo=false,isOnline=false;
  function refreshUI(){
    var live=isOnline&&!forceDemo,p=$('pill'),db=$('demoBtn');
    p.textContent=live?'Live from device':'Demo mode';p.className=live?'pill on':'pill';
    $('tgl').disabled=live&&best.night!==null;
    db.style.display=isOnline?'':'none';db.textContent=forceDemo?'Back to live':'Switch to demo';
    db.setAttribute('aria-pressed',forceDemo);
    demoView=!live;
    if(live){M.walking=false;man.style.display='none';mZone=-1}
  }
  function demo(){isOnline=false;forceDemo=false;refreshUI()}
  $('demoBtn').onclick=function(){forceDemo=!forceDemo;t=[0,0,0];refreshUI();if(!forceDemo)poll()};
  function apply(d){
    // keep the newest information seen so far, so a stale answer can never go backwards
    if(d.seen>=best.seen){best.seen=d.seen;if(d.night!==null)best.night=d.night}
    best.ir1At=Math.max(best.ir1At,d.ir1At);best.ir2At=Math.max(best.ir2At,d.ir2At);
    var online=best.seen>0&&d.now-best.seen<100000;
    if(!online){demo();return}
    isOnline=true;refreshUI();
    if(forceDemo){[1,2].forEach(function(k,i){last[i]=Math.max(last[i],best['ir'+k+'At'])});return}
    if(best.night!==null)setNight(best.night);
    [1,2].forEach(function(k,i){
      var at=best['ir'+k+'At'];
      if(at>last[i]){
        last[i]=at;
        var rem=HOLD-(d.now-at);
        if(rem>0&&night){
          t[i]=Date.now()+rem;
          var e=$('s'+k);e.classList.add('hit');setTimeout(function(){e.classList.remove('hit')},300);
        }
      }
    });
  }
  function poll(){
    if(document.hidden)return;
    fetch('api/state',{cache:'no-store'}).then(function(r){return r.ok?r.json():Promise.reject()}).then(apply).catch(demo);
  }
  setInterval(poll,1000);poll();
  refreshUI();
  setInterval(tick,50);tick();
})();
</script>
</body>
</html>
`;