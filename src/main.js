import "./style.css";
import { Conversation } from "@elevenlabs/client";
import { AGENT_ID, SALUDOS, RING_MIN_MS, RING_MAX_MS, RING_TIMEOUT_MS, VALORES, PALOS, nombreCarta } from "./config.js";
import { getCtx, playDtmf, startRingback, playPickup, playEndBeep } from "./audio.js";

const app = document.getElementById("app");
const themeMeta = document.querySelector('meta[name="theme-color"]');

/* ---------- Estado ---------- */
const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

// El secreto nunca se guarda: cada vez que se abre la app empieza en blanco.
try { localStorage.removeItem("secreto"); } catch { /* sin almacenamiento */ }
const state = {
  screen: "setup", // setup | phone | call
  tab: "key", // rec | con | key
  valor: null,
  palo: null,
  palabra: "",
  number: "",
  recents: load("recientes", []),
};

const secreto = () => {
  const palabra = state.palabra.trim();
  if (palabra) return { tipo: "palabra", secreto: palabra };
  if (state.valor && state.palo) return { tipo: "carta", secreto: nombreCarta(state.valor, state.palo) };
  return null;
};
const persistSecreto = () => {};
// Vuelve a la selección con todo en blanco.
function reiniciar() {
  state.valor = null;
  state.palo = null;
  state.palabra = "";
  state.number = "";
  state.tab = "key";
  go("setup");
}

/* ---------- Escala: 1rem = 1 punto del diseño (iPhone 17 Pro, 402 pt de ancho) ---------- */
function fit() {
  const u = Math.min(window.innerWidth / 402, window.innerHeight / 716);
  document.documentElement.style.fontSize = `${Math.max(0.6, u)}px`;
}
window.addEventListener("resize", fit);
fit();

function setChrome() {
  themeMeta.setAttribute("content", "#ffffff");
  document.body.style.backgroundColor = "#ffffff";
}

/* ---------- Micrófono: el permiso se pide en la primera pantalla, nunca al marcar ---------- */
let micGranted = false;
let micPending = null;
function requestMic() {
  if (micGranted) return Promise.resolve();
  if (!micPending) {
    micPending = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Se sueltan las pistas para que no quede el indicador de micrófono encendido en el teclado.
        stream.getTracks().forEach((t) => t.stop());
        micGranted = true;
      })
      .finally(() => { micPending = null; });
  }
  return micPending;
}

/* ---------- Iconos ---------- */
const HANDSET = '<path fill="currentColor" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>';
const svg = (inner, size = 24, extra = "") => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${extra} aria-hidden="true">${inner}</svg>`;
const ICON = {
  handset: (s) => svg(HANDSET, s),
  hangup: (s) => svg(HANDSET, s, 'style="transform:rotate(135deg)"'),
  backspace: (s) => svg('<path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>', s),
  clock: (s) => svg('<circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 6.2V12.4H7.6" fill="none" stroke="var(--cutout)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>', s),
  person: (s) => svg('<circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="9.3" r="3.5" fill="var(--cutout)"/><path d="M5.4 18.6c1.2-2.7 3.7-4.1 6.6-4.1s5.4 1.4 6.6 4.1A9.6 9.6 0 0 1 12 21.2a9.6 9.6 0 0 1-6.6-2.6z" fill="var(--cutout)"/>', s),
  keypad: (s) => svg([4, 12, 20].flatMap((x) => [4, 12, 20].map((y) => `<circle cx="${x}" cy="${y}" r="3" fill="currentColor"/>`)).join(""), s),
  search: (s) => svg('<circle cx="10.5" cy="10.5" r="6.8" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M15.6 15.6L21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>', s),
  speaker: (s) => svg('<path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.3 5.7a9 9 0 0 1 0 12.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', s),
  video: (s) => svg('<rect x="2" y="6" width="14" height="12" rx="3" fill="currentColor"/><path fill="currentColor" d="M17 10.5l4.2-2.6c.35-.2.8.05.8.45v7.3c0 .4-.45.65-.8.45L17 13.5z"/>', s),
  micoff: (s) => svg('<rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 3l16 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>', s),
  addperson: (s) => svg('<circle cx="9.5" cy="8" r="4" fill="currentColor"/><path fill="currentColor" d="M2 20c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6z"/><path d="M19 7v6M16 10h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', s),
  outgoing: (s) => svg(HANDSET + '<path d="M14.5 9.5L20 4M15.5 4H20v4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', s),
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------- Pantalla 1: selección de carta o palabra ---------- */
function renderSetup() {
  setChrome("dark");
  app.className = "screen setup";
  app.innerHTML = `
    <div class="setup-current" id="current"></div>
    <section class="setup-block" id="cardBlock">
      <h2>Carta</h2>
      <div class="values">${VALORES.map((v) => `<button class="chip" data-valor="${v}">${v}</button>`).join("")}</div>
      <div class="suits">${PALOS.map((p) => `<button class="chip suit ${p === "♥" || p === "♦" ? "red" : ""}" data-palo="${p}">${p}</button>`).join("")}</div>
    </section>
    <section class="setup-block" id="wordBlock">
      <h2>Palabra</h2>
      <div class="word-field">
        <input id="word" type="text" inputmode="text" enterkeyhint="go" placeholder="Escribe la palabra…" maxlength="40"
          autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(state.palabra)}" />
        <button class="clear" id="clearWord" aria-label="Borrar">×</button>
      </div>
    </section>
    <button class="next" id="next">Next</button>`;

  app.insertAdjacentHTML("afterbegin", '<button class="gear" id="gear" aria-label="Ajustes">Ajustes</button>');
  app.querySelector("#gear").addEventListener("click", () => go("settings"));
  const input = app.querySelector("#word");
  const sync = () => {
    const s = secreto();
    const usingWord = !!state.palabra.trim();
    app.querySelector("#current").innerHTML = usingWord
      ? esc(state.palabra.trim())
      : state.valor || state.palo
        ? `${state.valor || "–"} <span class="${state.palo === "♥" || state.palo === "♦" ? "red" : ""}">${state.palo || "–"}</span>`
        : "– –";
    app.querySelectorAll("[data-valor]").forEach((b) => b.classList.toggle("on", !usingWord && b.dataset.valor === state.valor));
    app.querySelectorAll("[data-palo]").forEach((b) => b.classList.toggle("on", !usingWord && b.dataset.palo === state.palo));
    app.querySelector("#cardBlock").classList.toggle("dim", usingWord);
    app.querySelector("#wordBlock").classList.toggle("dim", !usingWord && !!(state.valor || state.palo));
    app.querySelector("#clearWord").hidden = !state.palabra;
    app.querySelector("#next").disabled = !s;
    persistSecreto();
  };

  // El primer toque en esta pantalla dispara el permiso del micrófono.
  app.addEventListener("pointerdown", () => { getCtx(); requestMic().catch(() => {}); }, { once: true });

  app.querySelectorAll("[data-valor], [data-palo]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.valor) state.valor = b.dataset.valor;
      if (b.dataset.palo) state.palo = b.dataset.palo;
      state.palabra = "";
      input.value = "";
      input.blur();
      sync();
    }),
  );
  input.addEventListener("input", () => {
    state.palabra = input.value;
    if (state.palabra.trim()) { state.valor = null; state.palo = null; }
    sync();
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); goNext(); } });
  app.querySelector("#clearWord").addEventListener("click", () => { state.palabra = ""; input.value = ""; input.focus(); sync(); });
  app.querySelector("#next").addEventListener("click", goNext);

  async function goNext() {
    if (!secreto()) return;
    getCtx();
    try {
      await requestMic();
    } catch {
      showAlert("Teléfono necesita acceso al micrófono");
      return;
    }
    input.blur();
    state.tab = "key";
    state.number = "";
    go("phone");
  }
  sync();
}

/* ---------- Pantalla 2: teléfono (teclado, llamadas, contactos) ---------- */
const KEYS = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

function renderPhone() {
  const sk = getSkin();
  if (sk && state.tab === "key") return renderSkinPhone(sk);
  setChrome("phone");
  app.className = "screen phone";
  const hora = (ts) => new Date(ts).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
  let body = "";
  if (state.tab === "key") {
    body = `
      <div class="number" id="number"></div>
      <div class="keys">${KEYS.map(([d, l]) => `
        <button class="key ${d === "*" ? "star" : ""} ${d === "0" ? "zero" : ""}" data-key="${d}">
          <span class="digit">${d === "*" ? "∗" : d}</span>${d === "1" ? '<span class="letters">&nbsp;</span>' : l ? `<span class="letters">${l}</span>` : ""}
        </button>`).join("")}
      </div>
      <button class="call" id="call" aria-label="Llamar">${ICON.handset(36)}</button>
      <button class="del" id="del" aria-label="Borrar" hidden>${ICON.backspace(30)}</button>`;
  } else if (state.tab === "rec") {
    body = `
      <div class="list-title">Llamadas</div>
      <div class="list">${state.recents.length
        ? state.recents.map((r) => `<div class="row"><span class="out">${ICON.outgoing(15)}</span><span class="who"><b>${esc(r.number)}</b><small>móvil</small></span><span class="when">${hora(r.ts)}</span></div>`).join("")
        : '<div class="empty">Sin llamadas recientes</div>'}
      </div>`;
  } else {
    body = `<div class="list-title">Contactos</div><div class="list"><div class="empty">Sin contactos</div></div>`;
  }

  const tabs = [["rec", "Llamadas", "clock"], ["con", "Contactos", "person"], ["key", "Teclado", "keypad"]];
  app.innerHTML = `${body}
    <nav class="tabbar">${tabs.map(([id, label, icon]) => `
      <button class="tab ${state.tab === id ? "on" : ""}" data-tab="${id}">
        <span class="tab-icon">${ICON[icon](27)}</span>
        <span class="tab-label">${label}</span>
      </button>`).join("")}
    </nav>
    <button class="search" id="search" aria-label="Buscar">${ICON.search(28)}</button>
    <button class="corner" id="corner" tabindex="-1" aria-hidden="true"></button>`;
  app.querySelector("#corner").addEventListener("click", reiniciar);

  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; renderPhone(); }));

  // Control oculto: mantener presionada la lupa vuelve a la selección.
  const search = app.querySelector("#search");
  let hold = null;
  const clearHold = () => { clearTimeout(hold); hold = null; };
  search.addEventListener("pointerdown", () => { clearHold(); hold = setTimeout(reiniciar, 800); });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => search.addEventListener(ev, clearHold));
  search.addEventListener("contextmenu", (e) => e.preventDefault());

  if (state.tab !== "key") return;

  const numberEl = app.querySelector("#number");
  const del = app.querySelector("#del");
  const paint = () => {
    numberEl.textContent = state.number;
    const len = state.number.length;
    numberEl.style.fontSize = `${len > 20 ? 20 : len > 15 ? 26 : len > 11 ? 31 : 36}rem`;
    del.hidden = !len;
  };
  app.querySelectorAll("[data-key]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state.number.length >= 30) return;
      b.classList.add("down");
      playDtmf(b.dataset.key);
      state.number += b.dataset.key;
      paint();
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => b.classList.remove("down")));
  });
  let delHold = null;
  del.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    state.number = state.number.slice(0, -1);
    paint();
    delHold = setTimeout(() => { state.number = ""; paint(); }, 650);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => del.addEventListener(ev, () => clearTimeout(delHold)));
  app.querySelector("#call").addEventListener("click", startCall);
  paint();
}

/* ---------- Pantalla 3: llamada ---------- */
let call = null;

async function startCall() {
  if (!state.number || call) return;
  getCtx();
  try {
    await requestMic(); // ya concedido en la primera pantalla: aquí no aparece ningún aviso
  } catch {
    showAlert("Teléfono necesita acceso al micrófono");
    return;
  }
  const dato = secreto() || { tipo: "carta", secreto: "siete de corazones" };
  call = { number: state.number, phase: "ringing", secs: 0, muted: false, conv: null, ended: false, timers: [], wake: null, stopRing: null };
  go("call");

  call.stopRing = startRingback();
  navigator.wakeLock?.request("screen").then((w) => { if (call) call.wake = w; else w.release(); }).catch(() => {});

  const current = call;
  const delay = RING_MIN_MS + Math.random() * (RING_MAX_MS - RING_MIN_MS);
  current.timers.push(setTimeout(async () => {
    try {
      const conv = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
        dynamicVariables: {
          tipo: dato.tipo,
          secreto: dato.secreto,
          numero: current.number,
          saludo: SALUDOS[Math.floor(Math.random() * SALUDOS.length)],
        },
        onConnect: () => {
          if (current.ended) return;
          current.stopRing?.();
          current.stopRing = null;
          playPickup();
          current.phase = "live";
          current.tick = setInterval(() => { current.secs += 1; paintCall(); }, 1000);
          paintCall();
        },
        // Mientras el extraño habla, el micrófono se cierra: así no lo cortan su propia voz saliendo por el
        // altavoz ni las voces del público. Se reabre un instante después de que termina.
        onModeChange: ({ mode }) => {
          current.agentSpeaking = mode === "speaking";
          clearTimeout(current.micTimer);
          if (current.agentSpeaking) applyMic(current);
          else current.micTimer = setTimeout(() => applyMic(current), 350);
        },
        onDisconnect: () => { if (current.phase === "live") endCall(); },
        onError: () => { if (current.phase === "live") endCall(); },
      });
      current.conv = conv;
      if (current.ended) conv.endSession().catch(() => {});
      else applyMic(current);
    } catch (err) {
      console.warn("sin conexión", err?.message || err); // sigue timbrando hasta el límite
    }
  }, delay));
  current.timers.push(setTimeout(() => { if (current.phase === "ringing") endCall(); }, RING_TIMEOUT_MS));
}

// El micrófono queda cerrado si el usuario pulsó Silenciar o si el extraño está hablando.
function applyMic(c) {
  try { c.conv?.setMicMuted?.(!!(c.muted || c.agentSpeaking)); } catch { /* sesión cerrada */ }
}

function endCall() {
  const c = call;
  if (!c || c.ended) return;
  c.ended = true;
  c.timers.forEach(clearTimeout);
  clearTimeout(c.micTimer);
  clearInterval(c.tick);
  c.stopRing?.();
  c.conv?.endSession().catch(() => {});
  c.wake?.release().catch(() => {});
  c.phase = "ended";
  paintCall();
  playEndBeep();
  state.recents = [{ number: c.number, ts: Date.now() }, ...state.recents].slice(0, 100);
  save("recientes", state.recents);
  setTimeout(() => {
    call = null;
    state.number = "";
    state.tab = "key";
    go("phone");
  }, 1100);
}

function paintCall() {
  const el = document.getElementById("callStatus");
  if (!el || !call) return;
  const mm = String(Math.floor(call.secs / 60)).padStart(2, "0");
  const ss = String(call.secs % 60).padStart(2, "0");
  el.textContent = call.phase === "ringing" ? "llamando…" : call.phase === "ended" ? "llamada finalizada" : `${mm}:${ss}`;
}

function renderCall() {
  setChrome("dark");
  app.className = "screen call-screen";
  const btn = (id, label, icon, on = false) => `
    <div class="cbtn-wrap"><button class="cbtn ${on ? "on" : ""}" data-c="${id}">${ICON[icon](32)}</button><span>${label}</span></div>`;
  app.innerHTML = `
    <div class="call-head"><div class="call-number">${esc(call.number)}</div><div class="call-status" id="callStatus"></div></div>
    <div class="call-grid">
      ${btn("speaker", "Altavoz", "speaker", true)}
      ${btn("video", "FaceTime", "video")}
      ${btn("mute", "Silenciar", "micoff")}
      ${btn("add", "Añadir", "addperson")}
      <div class="cbtn-wrap"><button class="cbtn hang" id="hang" aria-label="Finalizar">${ICON.hangup(38)}</button><span>Finalizar</span></div>
      ${btn("pad", "Teclado", "keypad")}
    </div>`;
  app.querySelectorAll("[data-c]").forEach((b) =>
    b.addEventListener("click", () => {
      const on = b.classList.toggle("on");
      if (b.dataset.c === "mute" && call) {
        call.muted = on;
        applyMic(call);
      }
    }),
  );
  app.querySelector("#hang").addEventListener("click", endCall);
  paintCall();
}

/* ---------- Ajustes: apariencia tomada de capturas del propio iPhone ---------- */
const getSkin = () => load("skin", null);

function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = URL.createObjectURL(file);
    });
    input.click();
  });
}

function toCanvas(im) {
  const c = document.createElement("canvas");
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  c.getContext("2d").drawImage(im, 0, 0);
  return c;
}

// La captura se ancla abajo y ocupa todo el ancho: así la franja de la barra de estado queda fuera de la vista.
function skinGeo(sk) {
  const scale = window.innerWidth / sk.iw;
  const off = window.innerHeight - sk.ih * scale;
  return { scale, off, S: (p) => ({ x: p.x * scale, y: off + p.y * scale }) };
}

function applyIcon(data) {
  const link = document.querySelector('link[rel="apple-touch-icon"]');
  if (link && data) link.setAttribute("href", data);
}
applyIcon(load("icono", null));

// Guarda la captura calibrada. Devuelve false si no cabe en el almacenamiento.
function guardarSkin(canvas, { k1, kh, call }) {
  const ctx = canvas.getContext("2d");
  // Color de fondo: un punto entre teclas, arriba a la derecha del 1.
  const px = ctx.getImageData(Math.round(k1.x + (kh.x - k1.x) / 4), Math.round(k1.y - (kh.y - k1.y) / 6), 1, 1).data;
  const dark = 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2] < 128;
  let img = canvas.toDataURL("image/png");
  if (img.length > 3000000) img = canvas.toDataURL("image/jpeg", 0.92);
  try {
    localStorage.setItem("skin", JSON.stringify({ iw: canvas.width, ih: canvas.height, img, k1, kh, call, dark, bg: `rgb(${px[0]},${px[1]},${px[2]})` }));
    return true;
  } catch {
    return false;
  }
}

// Analiza la captura en el propio teléfono (sin enviarla a ningún servicio) y ubica el botón verde y las 12 teclas.
function detectarTeclado(canvas) {
  try {
    const W = 402;
    const k = canvas.width / W;
    const H = Math.round(canvas.height / k);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(canvas, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };

    // 1. Botón verde de llamar: la mancha verde más grande de la mitad inferior.
    let n = 0, sx = 0, sy = 0, minX = W, maxX = 0;
    for (let y = Math.round(H * 0.45); y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b] = at(x, y);
        if (g > 120 && g - r > 45 && g - b > 45) { n++; sx += x; sy += y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
      }
    }
    if (n < 1200) return null;
    const call = { x: sx / n, y: sy / n };
    const R = (maxX - minX) / 2;
    if (R < 22 || R > 60) return null;

    // 2. Zona de teclas: encima del botón verde, sin llegar al número marcado.
    const y0 = Math.max(0, Math.round(call.y - 11.4 * R));
    const y1 = Math.round(call.y - 1.35 * R);
    const x0 = Math.max(0, Math.round(call.x - 4.3 * R));
    const x1 = Math.min(W - 1, Math.round(call.x + 4.3 * R));
    const bg = at(Math.round(call.x + 2.6 * R) < W ? Math.round(call.x + 2.6 * R) : W - 2, Math.round(call.y));
    const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
    const bgL = lum(bg);
    const cols = new Array(W).fill(0);
    const rows = new Array(H).fill(0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (Math.abs(lum(at(x, y)) - bgL) > 95) { cols[x]++; rows[y]++; }
      }
    }
    // Agrupa tramos con tinta, uniendo los separados por huecos pequeños.
    const grupos = (arr, from, to, gap, min) => {
      const out = [];
      let ini = -1, fin = -1;
      for (let i = from; i <= to; i++) {
        if (arr[i] >= min) {
          if (ini < 0) ini = i;
          else if (i - fin > gap) { out.push([ini, fin]); ini = i; }
          fin = i;
        }
      }
      if (ini >= 0) out.push([ini, fin]);
      return out.map(([a, b]) => (a + b) / 2);
    };
    const cx = grupos(cols, x0, x1, R * 0.7, 2);
    const cy = grupos(rows, y0, y1, R * 0.7, 2);
    if (cx.length !== 3 || cy.length !== 4) return null;
    const dc = [cx[1] - cx[0], cx[2] - cx[1]];
    const dr = [cy[1] - cy[0], cy[2] - cy[1], cy[3] - cy[2]];
    const parejo = (v) => Math.max(...v) / Math.min(...v) < 1.18;
    if (!parejo(dc) || !parejo(dr)) return null;
    if (Math.abs(cx[1] - call.x) > R * 0.5) return null;
    // El centro de cada tecla se toma de la rejilla uniforme, centrada en el botón verde.
    const col = (cx[2] - cx[0]) / 2;
    const row = (cy[3] - cy[0]) / 3;
    const mid = (cy[0] + cy[3]) / 2;
    return {
      k1: { x: (call.x - col) * k, y: (mid - 1.5 * row) * k },
      kh: { x: (call.x + col) * k, y: (mid + 1.5 * row) * k },
      call: { x: call.x * k, y: call.y * k },
    };
  } catch {
    return null;
  }
}

function renderSettings() {
  setChrome("dark");
  app.className = "screen setup settings";
  const sk = getSkin();
  const ic = load("icono", null);
  app.innerHTML = `
    <div class="st-title">Ajustes</div>
    <section class="setup-block">
      <h2>Pantalla de marcado</h2>
      <p class="st-help">Sube una captura del teclado de la app Teléfono de este iPhone, vacío y sin números marcados. La app la analiza y ubica las teclas sola; si no lo logra, te pide tocar tres puntos.</p>
      <button class="st-btn" id="upPad">${sk ? "Cambiar captura" : "Subir captura del teclado"}</button>
      ${sk ? '<button class="st-btn ghost blue" id="calPad">Ajustar a mano</button><button class="st-btn ghost" id="rmPad">Quitar y usar el diseño incluido</button>' : ""}
    </section>
    <section class="setup-block">
      <h2>Ícono de la app</h2>
      <p class="st-help">Hazlo en Safari, antes de agregar la app a la pantalla de inicio. Sube una captura de tu pantalla de inicio y toca el ícono de Teléfono.</p>
      <button class="st-btn" id="upIcon">${ic ? "Cambiar ícono" : "Subir captura de inicio"}</button>
      ${ic ? `<div class="st-icon-row"><img src="${ic}" alt="" /><button class="st-btn ghost" id="rmIcon">Quitar ícono</button></div>` : ""}
    </section>
    <button class="next" id="back">Volver</button>`;
  app.querySelector("#back").addEventListener("click", () => go("setup"));
  app.querySelector("#upPad").addEventListener("click", async () => {
    const im = await pickImage();
    if (!im) return;
    const canvas = toCanvas(im);
    const auto = detectarTeclado(canvas);
    if (auto && guardarSkin(canvas, auto)) {
      renderSettings();
      showAlert("Teclado detectado y guardado.");
    } else {
      renderCalib(im);
    }
  });
  app.querySelector("#calPad")?.addEventListener("click", () => {
    const im = new Image();
    im.onload = () => renderCalib(im);
    im.src = sk.img;
  });
  app.querySelector("#rmPad")?.addEventListener("click", () => { localStorage.removeItem("skin"); renderSettings(); });
  app.querySelector("#upIcon").addEventListener("click", async () => { const im = await pickImage(); if (im) renderIconPick(im); });
  app.querySelector("#rmIcon")?.addEventListener("click", () => { localStorage.removeItem("icono"); renderSettings(); });
}

function renderCalib(im) {
  const canvas = toCanvas(im);
  const sk = { iw: canvas.width, ih: canvas.height };
  const g = skinGeo(sk);
  const pasos = ["Toca el centro de la tecla 1", "Toca el centro de la tecla #", "Toca el centro del botón verde de llamar"];
  const puntos = [];
  app.className = "screen calib";
  app.innerHTML = `<img class="skin-img" src="${im.src}" style="height:${sk.ih * g.scale}px" alt="" />
    <div class="calib-bar"><b id="paso"></b><span><button id="undo">Deshacer</button><button id="cancel">Cancelar</button></span></div>
    <div id="marks"></div>`;
  const paint = () => {
    app.querySelector("#paso").textContent = `${puntos.length + 1} de 3 · ${pasos[puntos.length]}`;
    app.querySelector("#marks").innerHTML = puntos.map((p) => { const s = g.S(p); return `<i class="mark" style="left:${s.x}px;top:${s.y}px"></i>`; }).join("");
  };
  app.querySelector("#cancel").addEventListener("click", (e) => { e.stopPropagation(); go("settings"); });
  app.querySelector("#undo").addEventListener("click", (e) => { e.stopPropagation(); puntos.pop(); paint(); });
  app.querySelector(".skin-img").addEventListener("pointerdown", (e) => {
    puntos.push({ x: e.clientX / g.scale, y: (e.clientY - g.off) / g.scale });
    if (puntos.length < 3) return paint();
    const [k1, kh, call] = puntos;
    if (kh.x - k1.x < sk.iw * 0.2 || kh.y - k1.y < sk.iw * 0.2) {
      showAlert("Los puntos no cuadran. Toca primero el 1 y después el #.");
      puntos.length = 0;
      return paint();
    }
    if (!guardarSkin(canvas, { k1, kh, call })) {
      showAlert("La captura pesa demasiado para guardarla. Prueba con otra.");
      return go("settings");
    }
    go("settings");
    showAlert("Teclado guardado.");
  });
  paint();
}

function renderSkinPhone(sk) {
  setChrome("phone");
  document.body.style.backgroundColor = sk.bg;
  themeMeta.setAttribute("content", sk.bg);
  app.className = "screen skin";
  app.style.background = sk.bg;
  const g = skinGeo(sk);
  const col = (sk.kh.x - sk.k1.x) / 2;
  const row = (sk.kh.y - sk.k1.y) / 3;
  const r = Math.min(col, row) * 0.41 * g.scale;
  const keys = KEYS.map(([d], i) => ({ d, ...g.S({ x: sk.k1.x + (i % 3) * col, y: sk.k1.y + Math.floor(i / 3) * row }) }));
  const call = g.S(sk.call);
  const del = { x: g.S(sk.kh).x, y: call.y };
  const fg = sk.dark ? "#fff" : "#000";
  app.innerHTML = `<img class="skin-img" src="${sk.img}" style="height:${sk.ih * g.scale}px" alt="" />
    <div class="skin-num" id="number" style="top:${g.S({ x: 0, y: sk.k1.y - row * 1.2 }).y}px;color:${fg}"></div>
    <div class="skin-del" id="del" hidden style="left:${del.x}px;top:${del.y}px;color:${fg}">${ICON.backspace(30)}</div>
    <div class="skin-press" id="press" style="width:${2 * r}px;height:${2 * r}px;background:${sk.dark ? "rgba(255,255,255,.28)" : "rgba(0,0,0,.14)"}"></div>
    <div class="skin-hit" id="hit"></div>`;
  const numberEl = app.querySelector("#number");
  const delEl = app.querySelector("#del");
  const press = app.querySelector("#press");
  const paint = () => {
    numberEl.textContent = state.number;
    const len = state.number.length;
    numberEl.style.fontSize = `${len > 20 ? 20 : len > 15 ? 26 : len > 11 ? 31 : 36}rem`;
    delEl.hidden = !len;
  };
  const near = (p, x, y, d) => Math.hypot(p.x - x, p.y - y) <= d;
  let hold = null;
  const hit = app.querySelector("#hit");
  hit.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    const u = parseFloat(getComputedStyle(document.documentElement).fontSize);
    // Controles ocultos: un toque en la esquina superior derecha, o mantener presionada la inferior derecha,
    // vuelven a la selección con todo en blanco.
    if (x > window.innerWidth - 92 * u && y < 92 * u) return reiniciar();
    if (x > window.innerWidth - 100 * u && y > window.innerHeight - 110 * u) {
      hold = setTimeout(reiniciar, 800);
      return;
    }
    const key = keys.find((k) => near(k, x, y, r * 1.15));
    if (key) {
      if (state.number.length >= 30) return;
      playDtmf(key.d);
      state.number += key.d;
      press.style.left = `${key.x}px`;
      press.style.top = `${key.y}px`;
      press.classList.remove("fade");
      press.classList.add("on");
      return paint();
    }
    if (near(call, x, y, r * 1.15)) return startCall();
    if (state.number && near(del, x, y, r)) {
      state.number = state.number.slice(0, -1);
      paint();
      hold = setTimeout(() => { state.number = ""; paint(); }, 650);
    }
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    hit.addEventListener(ev, () => { clearTimeout(hold); press.classList.add("fade"); press.classList.remove("on"); }),
  );
  paint();
}

function renderIconPick(im) {
  const canvas = toCanvas(im);
  const iw = canvas.width;
  const ih = canvas.height;
  const scale = Math.min(window.innerWidth / iw, (window.innerHeight - 190) / ih);
  let centro = null;
  let frac = 0.158;
  app.className = "screen iconpick";
  app.innerHTML = `<div class="ip-top"><b>Toca el ícono de Teléfono en tu captura</b></div>
    <div class="ip-stage" style="width:${iw * scale}px;height:${ih * scale}px"><img src="${im.src}" alt="" /><i class="ip-box" id="box" hidden></i></div>
    <div class="ip-panel">
      <canvas id="prev" width="180" height="180"></canvas>
      <div class="ip-ctl"><label>Tamaño<input id="size" type="range" min="0.11" max="0.22" step="0.002" value="${frac}" /></label>
      <span><button class="st-btn ghost" id="ipCancel">Cancelar</button><button class="st-btn" id="ipUse" disabled>Usar ícono</button></span></div>
    </div>`;
  const prev = app.querySelector("#prev");
  const box = app.querySelector("#box");
  const draw = () => {
    if (!centro) return;
    const side = iw * frac;
    prev.getContext("2d").clearRect(0, 0, 180, 180);
    prev.getContext("2d").drawImage(canvas, centro.x - side / 2, centro.y - side / 2, side, side, 0, 0, 180, 180);
    box.hidden = false;
    box.style.width = box.style.height = `${side * scale}px`;
    box.style.left = `${centro.x * scale}px`;
    box.style.top = `${centro.y * scale}px`;
    app.querySelector("#ipUse").disabled = false;
  };
  const stage = app.querySelector(".ip-stage");
  stage.addEventListener("pointerdown", (e) => {
    const rect = stage.getBoundingClientRect();
    centro = { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
    draw();
  });
  app.querySelector("#size").addEventListener("input", (e) => { frac = Number(e.target.value); draw(); });
  app.querySelector("#ipCancel").addEventListener("click", () => go("settings"));
  app.querySelector("#ipUse").addEventListener("click", () => {
    const data = prev.toDataURL("image/png");
    save("icono", data);
    applyIcon(data);
    go("settings");
    showAlert("Ícono listo. Ahora, en Safari: Compartir y Agregar a inicio.");
  });
}

/* ---------- Utilidades ---------- */
function showAlert(text) {
  document.querySelector(".alert-layer")?.remove();
  const layer = document.createElement("div");
  layer.className = "alert-layer";
  layer.innerHTML = `<div class="alert"><p>${esc(text)}</p><button>OK</button></div>`;
  layer.querySelector("button").addEventListener("click", () => layer.remove());
  document.body.appendChild(layer);
}

function go(screen) {
  state.screen = screen;
  app.style.background = "";
  if (screen === "settings") return renderSettings();
  if (screen === "setup") renderSetup();
  else if (screen === "phone") renderPhone();
  else renderCall();
}

document.addEventListener("contextmenu", (e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
document.addEventListener("gesturestart", (e) => e.preventDefault());

go("setup");
