// Sonidos del teléfono generados con Web Audio: tonos de tecla, timbre de espera, clic y fin de llamada.
let ctx = null;

// En iPhone, el interruptor de silencio apaga el audio web. El modo "playback" lo evita para los tonos del
// teclado y el timbre; durante la llamada se vuelve a "auto" para que el micrófono funcione como siempre.
export function setAudioMode(mode) {
  try { if (navigator.audioSession) navigator.audioSession.type = mode; } catch { /* no disponible */ }
}

// Respaldo para iOS sin audioSession: un audio silencioso en bucle mantiene la salida activa aun en silencio.
let keepAlive = null;
export function unlockAudio() {
  getCtx();
  if (navigator.audioSession || keepAlive) return;
  try {
    const rate = 8000, n = rate / 2, buf = new Uint8Array(44 + n);
    const dv = new DataView(buf.buffer);
    const w = (o, t) => [...t].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
    w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true); buf.fill(128, 44);
    keepAlive = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
    keepAlive.loop = true;
    keepAlive.setAttribute("playsinline", "");
    keepAlive.play().catch(() => { keepAlive = null; });
  } catch { /* sin respaldo */ }
}

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freqs, opts = {}) {
  const c = getCtx();
  if (c.state !== "running") {
    // Contexto dormido (pasa en iOS al volver a la app): se despierta y se toca en cuanto esté listo.
    const pending = { oscs: [], gain: null };
    c.resume().then(() => Object.assign(pending, playTone(c, freqs, opts))).catch(() => {});
    return pending;
  }
  return playTone(c, freqs, opts);
}

function playTone(c, freqs, { start = 0, dur = 0.12, vol = 0.08, dest } = {}) {
  const t0 = c.currentTime + start;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.setValueAtTime(vol, t0 + dur - 0.015);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  g.connect(dest || c.destination);
  const oscs = freqs.map((f) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return o;
  });
  return { oscs, gain: g };
}

const ROW = { 1: 697, 2: 697, 3: 697, 4: 770, 5: 770, 6: 770, 7: 852, 8: 852, 9: 852, "*": 941, 0: 941, "#": 941 };
const COL = { 1: 1209, 4: 1209, 7: 1209, "*": 1209, 2: 1336, 5: 1336, 8: 1336, 0: 1336, 3: 1477, 6: 1477, 9: 1477, "#": 1477 };

export function playDtmf(key) {
  if (ROW[key] == null) return;
  tone([ROW[key], COL[key]], { dur: 0.13, vol: 0.07 });
}

// Timbre de espera: 440 + 480 Hz, 2 s sonando y 4 s en silencio, filtrado como línea telefónica.
export function startRingback() {
  const c = getCtx();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  const master = c.createGain();
  master.gain.value = 1;
  filter.connect(master);
  master.connect(c.destination);
  let stopped = false;
  let live = [];
  const ring = () => {
    if (stopped) return;
    live.push(tone([440, 480], { dur: 2, vol: 0.09, dest: filter }));
  };
  ring();
  const id = setInterval(ring, 6000);
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(id);
    const t = c.currentTime;
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0, t + 0.04);
    setTimeout(() => {
      live.forEach(({ oscs }) => oscs.forEach((o) => { try { o.stop(); } catch { /* ya detenido */ } }));
      master.disconnect();
    }, 80);
  };
}

export function playPickup() {
  tone([180], { dur: 0.03, vol: 0.05 });
}

export function playEndBeep() {
  tone([480], { dur: 0.16, vol: 0.06 });
  tone([480], { start: 0.26, dur: 0.16, vol: 0.06 });
  tone([480], { start: 0.52, dur: 0.16, vol: 0.06 });
}
