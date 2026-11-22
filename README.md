# Teléfono (app del truco "El Extraño")

Web app instalable en iPhone que imita la app Teléfono. Se elige en secreto una carta o una palabra,
se marca cualquier número y contesta "el extraño", un agente de voz de ElevenLabs que revela el secreto.

Se publica sola en GitHub Pages con cada cambio en `main`.

## Uso

```bash
npm install
npm run dev      # desarrollo
npm run build    # genera dist/ (sitio estático, se puede alojar en cualquier hosting)
```

## Dónde ajustar cosas

- `src/config.js`: ID del agente, saludos con los que contesta, duración del timbre.
- `src/main.js`: pantallas (selección, teclado, llamada) y lógica de la llamada.
- `src/style.css`: diseño; las medidas están en puntos del iPhone 17 Pro (1rem = 1 pt).
- `src/audio.js`: tonos de tecla, timbre de espera y fin de llamada.

Control oculto: mantener presionada la lupa del teclado vuelve a la pantalla de selección.
