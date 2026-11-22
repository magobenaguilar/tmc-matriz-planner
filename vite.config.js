import { defineConfig } from "vite";
// base relativo: el build funciona en cualquier hosting estático y en subcarpetas
export default defineConfig({ base: "./", build: { target: "es2020" } });
