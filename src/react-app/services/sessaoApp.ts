import { authService } from "./AuthService";
import { API_BASE } from "../config/api";
import { apiAbsoluta, pedirSessaoAoApp, ponteAndroid } from "../utils/appAndroid";
import { nomeDoAparelho } from "../utils/notificacoes";
import { gravarSessao, lerSessao, sessaoValida, type Sessao } from "../utils/sessao";

function armazenamento(): Storage | undefined {
  try {
    return sessionStorage;
  } catch {
    return undefined;
  }
}

/** Sessão nova pelo token do aparelho (só no app Android v2+); null fora do app ou se o aparelho foi desconectado. */
export async function sessaoDoApp(): Promise<Sessao | null> {
  const nova = await pedirSessaoAoApp();
  return sessaoValida(nova as Sessao | null, Date.now()) ? (nova as Sessao) : null;
}

/** Depois de entrar com a senha no app: registra o aparelho, para a sessão não cair mais. */
export function registrarNoApp(): void {
  const ponte = ponteAndroid();
  if (!ponte) return;
  authService.registrarAparelho(nomeDoAparelho(navigator.userAgent, navigator.maxTouchPoints))
    .then(r => ponte.registrar(r.txToken, apiAbsoluta(API_BASE, window.location.href)))
    .catch(() => { /* sem o aparelho a sessão só volta a cair como no navegador */ });
}

/** Antes de mostrar a tela: no app, sem sessão nesta aba (o Android fechou o app), entra pelo aparelho. */
export async function prepararSessaoDoApp(): Promise<void> {
  if (!ponteAndroid() || sessaoValida(lerSessao(armazenamento()), Date.now())) return;
  const nova = await sessaoDoApp().catch(() => null);
  if (nova) gravarSessao(armazenamento(), nova);
}
