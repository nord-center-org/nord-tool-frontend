/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Padrão visual NordTool (ver docs/PADRAO_VISUAL.md).
      keyframes: {
        "nt-aparecer": { from: { opacity: "0" }, to: { opacity: "1" } },
        "nt-entrada": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "nt-surgir": { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "none" } },
        "nt-da-esquerda": { from: { opacity: "0", transform: "translateX(-8px)" }, to: { opacity: "1", transform: "none" } },
        "nt-da-direita": { from: { opacity: "0", transform: "translateX(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        aparecer: "nt-aparecer 200ms ease-out both",
        entrada: "nt-entrada 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        surgir: "nt-surgir 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "da-esquerda": "nt-da-esquerda 220ms ease-out both",
        "da-direita": "nt-da-direita 220ms ease-out both",
      },
    },
  },
  plugins: [],
};
