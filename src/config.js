// Agente de voz de ElevenLabs ("el extraño")
export const AGENT_ID = "agent_2801m7yc2c5xe5eshnhvqf20kebw";

// Así contesta el extraño: como si esperara otra llamada. Se elige uno al azar por llamada.
// Sin preguntas (la voz las sobreactúa), con pocas comas y sin verbos en segunda persona.
// La marca entre corchetes no se pronuncia: le indica al modelo de voz V4 el tono de la frase.
export const SALUDOS = [
  "[casual] Aló, mamá.",
  "[casual] Hola mamá. Ya voy.",
  "[casual] Hola. Ya voy saliendo.",
  "[casual] Aló. Sí, ya casi llego.",
  "[casual] Sí, ya estoy abajo. Aquí espero.",
  "[casual] Aló. Ya voy para allá.",
  "[tired] Hola. En este momento salgo.",
  "[casual] Sí. Ya estoy llegando.",
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
