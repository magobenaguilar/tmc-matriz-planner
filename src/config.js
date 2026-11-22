// Agente de voz de ElevenLabs ("el extraño")
export const AGENT_ID = "agent_2801m7yc2c5xe5eshnhvqf20kebw";

// Así contesta el extraño: como si esperara otra llamada. Se elige uno al azar por llamada.
export const SALUDOS = [
  "¿Aló, mamá?",
  "Hola, mamá, dime.",
  "Hola, sí, ya voy saliendo.",
  "¿Aló? Sí, ya casi llego.",
  "Sí, ya estoy abajo, ¿dónde estás?",
  "¿Aló? ¿Ya llegó el pedido?",
  "Hola, sí, en este momento salgo.",
  "¿Aló? Dime, ya voy para allá.",
];

// Segundos de timbre antes de que conteste (mínimo y máximo)
export const RING_MIN_MS = 5000;
export const RING_MAX_MS = 9000;
// Si no conecta en este tiempo, la llamada termina sola
export const RING_TIMEOUT_MS = 25000;

export const VALORES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const PALOS = ["♠", "♥", "♦", "♣"];
const NOMBRE_VALOR = { A: "as", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez", J: "jota", Q: "reina", K: "rey" };
const NOMBRE_PALO = { "♠": "picas", "♥": "corazones", "♦": "diamantes", "♣": "tréboles" };
export const nombreCarta = (valor, palo) => `${NOMBRE_VALOR[valor]} de ${NOMBRE_PALO[palo]}`;
