// Sonidos del teléfono generados con Web Audio: tonos de tecla, timbre de espera, clic y fin de llamada.
let ctx = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freqs, { start = 0, dur = 0.12, vol = 0.08, dest } = {}) {
  const c = getCtx();
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
