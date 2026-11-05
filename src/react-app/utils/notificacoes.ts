/**
 * Notificações no celular (Web Push): o que dá para ligar em cada aparelho, o nome do aparelho e as preferências.
 * Sem React aqui (testável em node).
 */

export interface PreferenciasNotificacao {
  inDemandaNova: boolean;
  inDemandaAlterada: boolean;
  inHorario: boolean;
  /** Minutos antes do horário agendado (0 = na hora). */
  nrAntecedenciaMin: number;
  inPrazo: boolean;
  inSac: boolean;
  /** Avisar também do que eu mesmo fiz (útil para conferir em outro aparelho). */
  inMinhasAcoes: boolean;
}

export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = {
  inDemandaNova: true, inDemandaAlterada: true, inHorario: true, nrAntecedenciaMin: 30, inPrazo: true, inSac: true, inMinhasAcoes: true,
};

export const ANTECEDENCIAS = [0, 10, 15, 30, 60, 120] as const;

export const rotuloAntecedencia = (min: number) =>
  min === 0 ? "Na hora" : min < 60 ? `${min} min antes` : min === 60 ? "1 hora antes" : `${min / 60} horas antes`;

/** As opções da tela, na ordem em que aparecem. */
export const OPCOES_NOTIFICACAO: { chave: Exclude<keyof PreferenciasNotificacao, "nrAntecedenciaMin">; titulo: string; texto: string }[] = [
  { chave: "inDemandaNova", titulo: "Demanda nova", texto: "Quando uma demanda do cronograma é cadastrada para você ou compartilhada com você." },
  { chave: "inDemandaAlterada", titulo: "Demanda alterada", texto: "Quando uma demanda sua muda: texto, data, horário ou etapa." },
  { chave: "inHorario", titulo: "Horário chegando", texto: "Antes do horário marcado de uma demanda agendada." },
  { chave: "inPrazo", titulo: "Prazo do dia", texto: "Às 8h, das demandas que vencem hoje e ainda não foram concluídas." },
  { chave: "inSac", titulo: "Resposta no SAC", texto: "Quando um administrador responde ou muda o status do seu chamado." },
  { chave: "inMinhasAcoes", titulo: "O que eu mesmo fiz", texto: "Avisar também das alterações feitas por você (para conferir em outro aparelho)." },
];

/** Lê as preferências vindas do servidor, completando o que faltar. */
export function lerPreferencias(bruto: unknown): PreferenciasNotificacao {
  const b = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  const bool = (k: keyof PreferenciasNotificacao) => (typeof b[k] === "boolean" ? (b[k] as boolean) : (PREFERENCIAS_PADRAO[k] as boolean));
  const n = Number(b.nrAntecedenciaMin);
  return {
    inDemandaNova: bool("inDemandaNova"), inDemandaAlterada: bool("inDemandaAlterada"), inHorario: bool("inHorario"),
    nrAntecedenciaMin: Number.isFinite(n) ? Math.min(120, Math.max(0, Math.round(n))) : PREFERENCIAS_PADRAO.nrAntecedenciaMin,
    inPrazo: bool("inPrazo"), inSac: bool("inSac"), inMinhasAcoes: bool("inMinhasAcoes"),
  };
}

/** Chave pública VAPID (base64url) → bytes para o pushManager.subscribe. */
export function chaveParaBytes(base64url: string): Uint8Array {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(b64);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

export const ehIos = (userAgent: string, maxTouchPoints = 0) =>
  /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);

/** Nome que aparece na lista de aparelhos: "iPhone · Safari", "Android · Chrome", "Windows · Edge"… */
export function nomeDoAparelho(userAgent: string, maxTouchPoints = 0): string {
  const so = ehIos(userAgent, maxTouchPoints) ? (/iPad/.test(userAgent) || /Macintosh/.test(userAgent) ? "iPad" : "iPhone")
    : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS X|Macintosh/.test(userAgent) ? "Mac"
    : /Linux/.test(userAgent) ? "Linux" : "Aparelho";
  const nav = /Edg\//.test(userAgent) ? "Edge" : /SamsungBrowser/.test(userAgent) ? "Samsung Internet" : /OPR\//.test(userAgent) ? "Opera"
    : /Firefox|FxiOS/.test(userAgent) ? "Firefox" : /Chrome|CriOS/.test(userAgent) ? "Chrome" : /Safari/.test(userAgent) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
}

export type Suporte = "ok" | "instalar-ios" | "sem-suporte";

/**
 * Se este aparelho pode receber: no iPhone/iPad o push só existe com o app adicionado à Tela de Início (iOS 16.4+);
 * nos demais, precisa de service worker e PushManager.
 */
export function suporteDoAparelho(a: { userAgent: string; maxTouchPoints?: number; temServiceWorker: boolean; temPush: boolean; instalado: boolean }): Suporte {
  if (ehIos(a.userAgent, a.maxTouchPoints) && !a.instalado) return "instalar-ios";
  return a.temServiceWorker && a.temPush ? "ok" : "sem-suporte";
}
