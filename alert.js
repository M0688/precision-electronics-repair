// Attention alarm for the workshop pages.
// When a phone/desktop alert arrives and a workshop page is open, the page
// flashes red and plays a tone every 30 seconds until you press "Got it".
//
// Browsers only let a page make sound after you've clicked or tapped on it
// at least once since it loaded — so click anywhere on the workshop after
// opening it and the tone will work from then on.

const REPEAT_MS = 30000;
let timer = null;
let titleTimer = null;
let audio = null;
const pending = [];
const baseTitle = document.title;

function ctx() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

// Unlock sound on the first click/tap/keypress.
['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, () => ctx(), { once: true, passive: true }));

function tone() {
  const a = ctx();
  if (!a) return;
  // Three short rising beeps.
  [0, 0.28, 0.56].forEach((at, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'square';
    o.frequency.value = 880 + i * 220;
    g.gain.setValueAtTime(0.0001, a.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + 0.22);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + at);
    o.stop(a.currentTime + at + 0.24);
  });
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}

function css() {
  if (document.getElementById('alarmCss')) return;
  const s = document.createElement('style');
  s.id = 'alarmCss';
  s.textContent = `
    @keyframes alarmFlash { 0%,100% { background: rgba(179,38,30,.92); } 50% { background: rgba(120,10,10,.97); } }
    #alarm { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center;
             padding: 20px; animation: alarmFlash 1s infinite; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
    #alarm .box { background: #fff; border-radius: 14px; max-width: 480px; width: 100%; padding: 26px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,.35); }
    #alarm h2 { margin: 0 0 8px; font-size: 22px; color: #b3261e; }
    #alarm .list { text-align: left; margin: 14px 0 20px; font-size: 15px; color: #1f2733; }
    #alarm .list div { padding: 8px 0; border-bottom: 1px solid #e2e6ec; }
    #alarm .list div:last-child { border-bottom: 0; }
    #alarm .list a { color: #1B2A4A; font-weight: 700; }
    #alarm button { background: #1B2A4A; color: #fff; border: 0; border-radius: 8px; font: inherit; font-weight: 700;
                    font-size: 17px; padding: 13px 30px; cursor: pointer; }
    #alarm .hint { color: #5a6474; font-size: 13px; margin-top: 12px; }`;
  document.head.appendChild(s);
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function draw() {
  css();
  let el = document.getElementById('alarm');
  if (!el) {
    el = document.createElement('div');
    el.id = 'alarm';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="box">
    <h2>${pending.length > 1 ? pending.length + ' new alerts' : 'New alert'}</h2>
    <div class="list">${pending.map(p => `<div><a href="${esc(p.url || 'workshop.html')}">${esc(p.title)}</a><br>${esc(p.body)}</div>`).join('')}</div>
    <button id="alarmOk">Got it</button>
    <div class="hint">This keeps sounding every 30 seconds until you press Got it.</div>
  </div>`;
  document.getElementById('alarmOk').addEventListener('click', stop);
}

function stop() {
  pending.length = 0;
  clearInterval(timer); timer = null;
  clearInterval(titleTimer); titleTimer = null;
  document.title = baseTitle;
  const el = document.getElementById('alarm');
  if (el) el.remove();
}

export function raise(data) {
  pending.push(data);
  draw();
  tone();
  if (!timer) timer = setInterval(tone, REPEAT_MS);
  if (!titleTimer) {
    let on = false;
    titleTimer = setInterval(() => { on = !on; document.title = on ? '🔴 ' + (data.title || 'New alert') : baseTitle; }, 1000);
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === 'workshop-alert') raise(d);
  });
  navigator.serviceWorker.startMessages?.();
}
