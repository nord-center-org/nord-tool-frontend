/** Links de integração (Gemini, ChatGPT…): montagem do link público e do texto pronto para o assistente. */

export interface IntegracaoToken {
  idToken: number;
  cdEscopo: string;
  nmRotulo: string;
  txPrefixo: string;
  dhCriacao?: string | null;
  dhUltimoUso?: string | null;
  /** Só vem na criação: depois o servidor guarda apenas o hash. */
  chave?: string | null;
}

/** URL absoluta do relatório. API_BASE pode ser relativo (proxy do Vite em dev): completa com a origem. */
export function linkRelatorio(apiBase: string, chave: string, origem = ""): string {
  const base = /^https?:\/\//i.test(apiBase) ? apiBase : `${origem}${apiBase.startsWith("/") ? "" : "/"}${apiBase}`;
  return `${base.replace(/\/+$/, "")}/publico/cronograma/${encodeURIComponent(chave)}`;
}

/** Texto para colar numa ação programada do Gemini (ou outro assistente). */
export function instrucaoAssistente(link: string, horario = "7h"): string {
  return [
    `Todo dia às ${horario}, abra este link e leia o meu cronograma: ${link}`,
    "Depois me mande um resumo curto em português com:",
    "1) o que tenho para hoje, em ordem de horário;",
    "2) as tarefas atrasadas, destacando as mais antigas;",
    "3) o que vence nos próximos dias, para eu me planejar.",
    "Se o link der erro, me avise.",
  ].join("\n");
}

/** "último uso 28/10 07:47" ou "nunca usado" — lê a data como o servidor manda (sem converter fuso). */
export function quandoUsado(dh: string | null | undefined): string {
  const m = dh?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `último uso ${m[3]}/${m[2]} ${m[4]}:${m[5]}` : "nunca usado";
}
