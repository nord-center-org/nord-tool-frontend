import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import "@/react-app/tema-escuro.css";
import App from "@/react-app/App.tsx";
import { prepararSessaoDoApp } from "@/react-app/services/sessaoApp";

// No app Android, se o celular fechou o app, a sessão volta pelo aparelho antes da primeira tela (sem passar pelo login).
void prepararSessaoDoApp().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});

// Service worker só para as notificações no celular (sem cache: ver public/sw.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* sem notificações */ }); });
}
