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

const saved = load("secreto", {});
const state = {
  screen: "setup", // setup | phone | call
  tab: "key", // rec | con | key
  valor: saved.valor || null,
  palo: saved.palo || null,
  palabra: saved.palabra || "",
  number: "",
  recents: load("recientes", []),
};

const secreto = () => {
  const palabra = state.palabra.trim();
  if (palabra) return { tipo: "palabra", secreto: palabra };
  if (state.valor && state.palo) return { tipo: "carta", secreto: nombreCarta(state.valor, state.palo) };
  return null;
};
const persistSecreto = () => save("secreto", { valor: state.valor, palo: state.palo, palabra: state.palabra });

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
    <button class="search" id="search" aria-label="Buscar">${ICON.search(28)}</button>`;

  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.tab = b.dataset.tab; renderPhone(); }));

  // Control oculto: mantener presionada la lupa vuelve a la selección.
  const search = app.querySelector("#search");
  let hold = null;
  const clearHold = () => { clearTimeout(hold); hold = null; };
  search.addEventListener("pointerdown", () => { clearHold(); hold = setTimeout(() => go("setup"), 800); });
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
        onDisconnect: () => { if (current.phase === "live") endCall(); },
        onError: () => { if (current.phase === "live") endCall(); },
      });
      current.conv = conv;
      if (current.ended) conv.endSession().catch(() => {});
      else if (current.muted) conv.setMicMuted?.(true);
    } catch (err) {
      console.warn("sin conexión", err?.message || err); // sigue timbrando hasta el límite
    }
  }, delay));
  current.timers.push(setTimeout(() => { if (current.phase === "ringing") endCall(); }, RING_TIMEOUT_MS));
}

function endCall() {
  const c = call;
  if (!c || c.ended) return;
  c.ended = true;
  c.timers.forEach(clearTimeout);
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
        call.conv?.setMicMuted?.(on);
      }
    }),
  );
  app.querySelector("#hang").addEventListener("click", endCall);
  paintCall();
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
  if (screen === "setup") renderSetup();
  else if (screen === "phone") renderPhone();
  else renderCall();
}

document.addEventListener("contextmenu", (e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); });
document.addEventListener("gesturestart", (e) => e.preventDefault());

go("setup");
