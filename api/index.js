// api/index.js - the whole website + backend in one file.
// GET  /            -> the street light page
// GET  /api/state   -> latest device state (polled by the page)
// POST /api/event   -> called by the ESP8266 (header X-Device-Token)
//
// Env vars: DEVICE_TOKEN (you choose it) + the Upstash Redis vars Vercel adds
// (UPSTASH_REDIS_REST_URL / _TOKEN, or KV_REST_API_URL / _TOKEN).

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(commands) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Redis env vars are missing');
  const r = await fetch(REDIS_URL + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('Redis error ' + r.status);
  return r.json();
}

async function event(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.DEVICE_TOKEN || req.headers['x-device-token'] !== process.env.DEVICE_TOKEN) {
    return res.status(401).json({ error: 'bad token' });
  }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const now = Date.now();
  const cmds = [['HSET', 'sl:state', 'seen', now]];
  if (b.ir === 1 || b.ir === 2) cmds.push(['HSET', 'sl:state', 'ir' + b.ir + 'At', now]);
  if (typeof b.night === 'boolean') cmds.push(['HSET', 'sl:state', 'night', b.night ? 1 : 0]);
  try {
    await redis(cmds);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function state(req, res) {
  try {
    const out = await redis([['HGETALL', 'sl:state']]);
    const flat = (out[0] && out[0].result) || [];
    const o = {};
    for (let i = 0; i < flat.length; i += 2) o[flat[i]] = Number(flat[i + 1]);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      now: Date.now(),
      seen: o.seen || 0,
      night: o.night === undefined ? null : o.night === 1,
      ir1At: o.ir1At || 0,
      ir2At: o.ir2At || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = async function handler(req, res) {
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
<title>Smart Street Light — ESP8266 + LDR + dual IR</title>
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
body{margin:0;background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,sans-serif;line-height:1.6;font-size:17px}
.wrap{max-width:980px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;line-height:1.1;margin:0}
h1{font-size:clamp(2.4rem,7vw,4.6rem);font-weight:800;letter-spacing:-.03em;max-width:13ch}
h2{font-size:clamp(1.6rem,4vw,2.3rem);font-weight:700;letter-spacing:-.02em;margin-bottom:12px}
h3{font-size:1.15rem;font-weight:700;margin-bottom:6px}
p{margin:0 0 14px;max-width:62ch}
.lede{color:var(--muted);font-size:1.15rem;margin-top:18px}
header{padding:56px 0 28px}section{padding:36px 0}
.sim{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.scene{position:relative;background:#101636}
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
.bars{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;padding:0 16px 16px}
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
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>A street light that wakes up for traffic</h1>
  <p class="lede">An ESP8266 reads a light sensor and three infrared sensors, one at each lamp. By day the lights are off. At night every lamp glows at 50% to save power, and when something passes a lamp's sensor, that lamp goes to full brightness for five seconds.</p>
</header>

<section aria-labelledby="try">
  <h2 id="try">Try it</h2>
  <p>Switch to night, then send a car down the road. It drives toward you, so lamp 1 is the farthest one. When the ESP8266 is online, lamps 1 and 2 follow its IR sensors in real time; lamp 3 stays a demo.</p>
  <div class="sim">
    <div class="scene night" id="scene">
      <div class="pill" id="pill">Demo mode</div>
      <svg id="svg" viewBox="0 0 800 400" role="img" aria-label="A road at night with three street lights receding into the distance">
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
        <circle class="dy" cx="650" cy="62" r="24" fill="#ffd45c"/>
        <g id="skyA" fill="#8fa0bf"></g>
        <rect y="120" width="800" height="70" fill="url(#haze)"/>
        <g id="skyB" fill="#6c7c9c"></g>
        <rect y="160" width="800" height="30" fill="url(#haze)" opacity=".45"/>
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
        <circle class="nt" cx="650" cy="62" r="70" fill="url(#mg)"/>
        <circle class="nt" cx="650" cy="62" r="18" fill="#eef1ff"/>
        <g class="nt" id="winA" fill-opacity=".25"></g>
        <g class="nt" id="winB" fill-opacity=".4"></g>
        <g id="lights"></g>
        <g id="carL" class="nt" style="display:none"><ellipse cx="0" cy="26" rx="190" ry="40" fill="url(#pool)"/><circle cx="-62" cy="-30" r="80" fill="url(#gl)"/><circle cx="62" cy="-30" r="80" fill="url(#gl)"/><ellipse cx="-62" cy="-30" rx="14" ry="7" fill="#fffbe0"/><ellipse cx="62" cy="-30" rx="14" ry="7" fill="#fffbe0"/></g>
        <rect width="800" height="400" fill="url(#vg)" pointer-events="none"/>
        <g id="labels"></g>
      </svg>
    </div>
    <div class="ctl">
      <button id="tgl" aria-pressed="true">Switch to day</button>
      <button class="primary" id="b1">Trigger IR 1</button>
      <button class="primary" id="b2">Trigger IR 2</button>
      <button class="primary" id="b3">Trigger IR 3</button>
      <button id="drive">Drive a car through</button>
    </div>
    <div class="bars">
      <div class="bar"><small>IR 1 timer</small><div class="track"><div class="fill" id="f1"></div></div></div>
      <div class="bar"><small>IR 2 timer</small><div class="track"><div class="fill" id="f2"></div></div></div>
      <div class="bar"><small>IR 3 timer</small><div class="track"><div class="fill" id="f3"></div></div></div>
    </div>
    <div class="status" id="st" aria-live="polite"></div>
  </div>
</section>

<section aria-labelledby="how">
  <h2 id="how">How it behaves</h2>
  <div class="three">
    <div class="box"><h3>Day</h3><p>The light sensor reads below the night threshold, so every lamp is off and running timers are cleared.</p></div>
    <div class="box"><h3>Night, idle</h3><p>Every lamp stays on at 50% brightness using PWM.</p></div>
    <div class="box"><h3>Night, triggered</h3><p>Each lamp has its own IR sensor and its own 5 second timer. While it runs, that lamp is at 100% and the others stay dim. A new detection restarts the timer.</p></div>
  </div>
</section>

<section aria-labelledby="hw">
  <h2 id="hw">Wiring</h2>
  <div class="scroll"><table>
    <tr><th>Part</th><th>NodeMCU pin</th><th>Notes</th></tr>
    <tr><td>IR sensor 1 (lamp 1)</td><td>D1</td><td>Output goes LOW when it sees an object</td></tr>
    <tr><td>IR sensor 2 (lamp 2)</td><td>D2</td><td>Same as sensor 1</td></tr>
    <tr><td>IR sensor 3 (lamp 3)</td><td>D0</td><td>Same as sensor 1. D0 is safe to use at boot.</td></tr>
    <tr><td>LED 1</td><td>D5</td><td>Anode to 3.3V, cathode to pin (PWM)</td></tr>
    <tr><td>LED 2</td><td>D6</td><td>Anode to 3.3V, cathode to pin (PWM)</td></tr>
    <tr><td>LED 3</td><td>D7</td><td>Anode to 3.3V, cathode to pin (PWM)</td></tr>
    <tr><td>LDR module</td><td>A0</td><td>Night when the reading is above 600</td></tr>
  </table></div>
</section>

<section aria-labelledby="code">
  <h2 id="code">The sketch</h2>
  <p>LEDs are active-low, so the helper flips the duty cycle. Timers use <code>millis()</code>, so the loop never blocks.</p>
<pre><code>const int  DIM_PERCENT = 50;
const unsigned long BRIGHT_TIME = 5000;

const int irPin[3]  = {D1, D2, D0};
const int ledPin[3] = {D5, D6, D7};
unsigned long until[3] = {0, 0, 0};
bool bright[3] = {false, false, false};

// active-low: 0% = off, 100% = full brightness
void setLed(int pin, int pct) {
  analogWrite(pin, 1023 - (pct * 1023) / 100);
}

void loop() {
  unsigned long now = millis();
  int ldr = analogRead(LDR_PIN);
  bool isNight = DARK_IS_LOW ? (ldr &lt; DARK_THRESHOLD)
                             : (ldr &gt; DARK_THRESHOLD);

  for (int i = 0; i &lt; 3; i++) {
    if (!isNight) { bright[i] = false; setLed(ledPin[i], 0); continue; }

    if (digitalRead(irPin[i]) == IR_DETECTED) {
      bright[i] = true;
      until[i]  = now + BRIGHT_TIME;
    }
    if (bright[i] &amp;&amp; (long)(now - until[i]) &gt;= 0) bright[i] = false;

    setLed(ledPin[i], bright[i] ? 100 : DIM_PERCENT);
  }
  delay(50);
}</code></pre>
</section>

<footer>ESP8266 NodeMCU · LDR · HW-201 IR sensors · 3 PWM LEDs</footer>
</div>

<script>
(function(){
  var HOLD=5000,night=true,t=[0,0,0],driving=false,NS='http://www.w3.org/2000/svg';
  var PS=[.25,.42,.67];
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
    add($('bodies'),'<g opacity="'+op+'" transform="'+tr+'"><path d="M-4 0L-120 7L-120 1L4-3Z" fill="#000" opacity=".28"/><ellipse cy="2" rx="14" ry="4" fill="#000" opacity=".25"/><path d="M-6 0H6L3-250H-3Z" fill="url(#pg)"/><rect x="-9" y="-14" width="18" height="14" rx="2" fill="#4a5273"/><path d="M0-250C0-272 24-274 58-262" stroke="#566087" stroke-width="6" fill="none"/><ellipse cx="64" cy="-258" rx="26" ry="7" fill="#7f89ab"/><ellipse cx="64" cy="-253" rx="19" ry="3.5" fill="#cfd6ee"/>'+(ctl?'<rect id="s'+(n+1)+'" class="sn" x="5" y="-120" width="16" height="30" rx="3"/>':'')+'</g>');
    add($('lights'),'<g class="lt" id="'+id+'" transform="'+tr+'"><circle cx="64" cy="-253" r="'+(130+120*(1-s)).toFixed(0)+'" fill="url(#gl)"/><polygon points="50,-251 78,-251 190,6 -50,6" fill="url(#cone)" filter="url(#bl)"/><ellipse cx="70" cy="4" rx="160" ry="24" fill="url(#pool)"/><ellipse cx="70" cy="75" rx="12" ry="85" fill="url(#gl)" opacity=".6"/><ellipse cx="64" cy="-253" rx="21" ry="6" fill="#fff8d6" filter="url(#bl)"/></g>');
    if(ctl){add($('labels'),'<text class="lbl" x="'+x+'" y="'+(y+18)+'">IR '+(n+1)+'</text>');L.push($(id))}
    else LX.push($(id));
  }
  PS.forEach(function(s,n){pole(s,n)});
  function trig(n){
    if(!night)return;
    t[n]=Date.now()+HOLD;
    var e=$('s'+(n+1));e.classList.add('hit');setTimeout(function(){e.classList.remove('hit')},300);
  }
  [0,1,2].forEach(function(n){$('b'+(n+1)).onclick=function(){trig(n)}});
  $('tgl').onclick=function(){
    night=!night;t=[0,0,0];scene.classList.toggle('night',night);
    this.textContent=night?'Switch to day':'Switch to night';this.setAttribute('aria-pressed',night);
  };
  var D=5000,z0=8,z1=.85,carB=$('car'),carL=$('carL');
  $('drive').onclick=function(){
    if(driving||!night)return;driving=true;
    carB.style.display='';carL.style.display='';
    PS.forEach(function(s,n){setTimeout(function(){trig(n)},D*(z0-1/s)/(z0-z1))});
    var t0=performance.now();
    (function f(now){
      var u=Math.min(1,(now-t0)/D),s=1/(z0+(z1-z0)*u),tr='translate('+(400+136*s)+' '+(190+210*s)+') scale('+s+')';
      carB.setAttribute('transform',tr);carL.setAttribute('transform',tr);
      if(u<1)requestAnimationFrame(f);
      else{carB.style.display='none';carL.style.display='none';driving=false}
    })(t0);
  };
  function tick(){
    var now=Date.now(),c=0;
    LX.forEach(function(e){e.style.setProperty('--b',night?.5:0)});
    for(var n=0;n<3;n++){
      var a=night&&now<t[n];if(a)c++;
      L[n].style.setProperty('--b',!night?0:a?1:.5);
      $('f'+(n+1)).style.width=(a?(t[n]-now)/HOLD*100:0)+'%';
    }
    $('st').innerHTML=!night?'<b>Day:</b> all lamps off.':c?'<b>Night:</b> '+c+' of 3 lamps at 100%, the rest at 50%.':'<b>Night, idle:</b> all lamps at 50%.';
  }
  // ---- live device sync ----
  var last=[0,0];
  function setNight(v){
    if(night===v)return;night=v;t=[0,0,0];scene.classList.toggle('night',v);
    var b=$('tgl');b.textContent=v?'Switch to day':'Switch to night';b.setAttribute('aria-pressed',v);
  }
  function demo(){var p=$('pill');p.textContent='Demo mode';p.className='pill';$('tgl').disabled=false}
  function apply(d){
    var online=d.now-d.seen<40000;
    if(!online){demo();return}
    var p=$('pill');p.textContent='Live from device';p.className='pill on';
    $('tgl').disabled=d.night!==null;
    if(d.night!==null)setNight(d.night);
    [1,2].forEach(function(k,i){
      var at=d['ir'+k+'At'];
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
  setInterval(poll,700);poll();
  setInterval(tick,50);tick();
})();
</script>
</body>
</html>
`;
