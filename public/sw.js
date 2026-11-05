/*
 * Service worker do NordTool: só recebe as notificações push (demandas, horários, prazos, SAC) e abre a tela certa
 * ao tocar. Não guarda cache nem intercepta requisições: o app continua sempre buscando a versão publicada.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", evento => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", evento => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch (e) { dados = { body: evento.data ? evento.data.text() : "" }; }
  const titulo = dados.title || "NordTool";
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.body || "",
    icon: "/icones/icone-192.png",
    badge: "/icones/selo-96.png",
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    data: { url: typeof dados.url === "string" && dados.url.startsWith("/") ? dados.url : "/" },
  }));
});

self.addEventListener("notificationclick", evento => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || "/", self.location.origin).href;
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const janela of janelas) {
      if (new URL(janela.url).origin === self.location.origin) {
        await janela.focus();
        if ("navigate" in janela) { try { await janela.navigate(destino); } catch (e) { /* abre pela janela atual */ } }
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
