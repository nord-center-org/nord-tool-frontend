import { apiFetch } from "./apiClient";
import { chaveParaBytes, lerPreferencias, nomeDoAparelho, type PreferenciasNotificacao } from "../utils/notificacoes";

export interface ConfigNotificacao { habilitado: boolean; chavePublica: string | null }
export interface Aparelho { id: number; nmAparelho: string | null; dhCriacao: string; dhUltimoEnvio: string | null }

const BASE = "/notificacoes";

/** O service worker registrado em main.tsx (null se o navegador não tiver). */
async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

export const notificacaoService = {
  config: async () => (await apiFetch<ConfigNotificacao>(`${BASE}/config`)) ?? { habilitado: false, chavePublica: null },
  aparelhos: async () => (await apiFetch<Aparelho[]>(`${BASE}/aparelhos`)) ?? [],
  preferencias: async () => lerPreferencias(await apiFetch(`${BASE}/preferencias`)),
  salvarPreferencias: async (p: PreferenciasNotificacao) =>
    lerPreferencias(await apiFetch(`${BASE}/preferencias`, { method: "PUT", body: JSON.stringify(p) })),
  testar: async () => (await apiFetch<number>(`${BASE}/teste`, { method: "POST" })) ?? 0,

  /** A inscrição deste aparelho, se as notificações já estiverem ligadas nele. */
  inscricaoAtual: async () => (await (await registro())?.pushManager.getSubscription()) ?? null,

  /** Pede a permissão, inscreve este aparelho e manda a inscrição ao servidor. */
  ativarEsteAparelho: async (chavePublica: string) => {
    const reg = await registro();
    if (!reg) throw new Error("Este navegador não recebe notificações.");
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      throw new Error(permissao === "denied"
        ? "As notificações estão bloqueadas para o NordTool. Libere nas configurações do navegador/celular e tente de novo."
        : "Permissão não concedida.");
    }
    await navigator.serviceWorker.ready;
    const chave = chaveParaBytes(chavePublica);
    let inscricao = await reg.pushManager.getSubscription();
    // Uma inscrição feita com outra chave (servidor trocou as chaves) não recebe mais: refaz.
    const chaveAtual = inscricao?.options.applicationServerKey;
    if (inscricao && chaveAtual && !iguais(new Uint8Array(chaveAtual), chave)) { await inscricao.unsubscribe(); inscricao = null; }
    try {
      inscricao ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
    } catch {
      throw new Error("O navegador não conseguiu ligar as notificações. No Android, use o Chrome; no iPhone, abra o NordTool pela Tela de Início.");
    }
    const json = inscricao.toJSON();
    await apiFetch<void>(`${BASE}/aparelhos`, {
      method: "POST",
      body: JSON.stringify({
        endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth,
        aparelho: nomeDoAparelho(navigator.userAgent, navigator.maxTouchPoints),
      }),
    });
  },

  /** Desliga neste aparelho (no servidor e no navegador). */
  desativarEsteAparelho: async () => {
    const inscricao = await notificacaoService.inscricaoAtual();
    if (!inscricao) return;
    try { await apiFetch<void>(`${BASE}/aparelhos/cancelar`, { method: "POST", body: JSON.stringify({ endpoint: inscricao.endpoint }) }); }
    finally { await inscricao.unsubscribe(); }
  },

  /**
   * Ao sair da conta: cancela a inscrição só no navegador (sem chamar a API, a sessão já acabou). O servidor recebe
   * "inscrição expirada" no próximo envio e apaga o aparelho, então quem entrar depois não recebe os avisos de outro.
   */
  esquecerEsteAparelho: async () => { try { await (await notificacaoService.inscricaoAtual())?.unsubscribe(); } catch { /* sem push */ } },
};

function iguais(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
