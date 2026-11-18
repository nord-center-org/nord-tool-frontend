/** Endereço do APK do app Android, servido pelo próprio frontend (public/app). */
export const ENDERECO_APK = "/app/nordtool.apk";

/** Marca que o app Android acrescenta ao user agent da WebView. */
export const MARCA_APP_ANDROID = "NordToolAndroid";

/** Mostra o botão de baixar o app, exceto dentro do próprio app e no iPhone/iPad (onde o APK não instala). */
export function mostrarBotaoAppAndroid(agente: string | undefined): boolean {
  const texto = agente ?? "";
  if (texto.includes(MARCA_APP_ANDROID)) return false;
  return !/iPhone|iPad|iPod/i.test(texto);
}
