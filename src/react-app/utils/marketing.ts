/**
 * Marketing v1 — regras puras da tela (testáveis em node): rede pelo state da volta do login, partes do envio do
 * vídeo, números curtos, totais do painel e validação do vídeo.
 */

export type Rede = "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
export const REDES: Rede[] = ["YOUTUBE", "INSTAGRAM", "TIKTOK"];

/** Nome, cor e o que cada rede publica. */
export const INFO_REDE: Record<Rede, { nome: string; cor: string; publica: string }> = {
  YOUTUBE: { nome: "YouTube", cor: "#ff0033", publica: "vídeo ou Short (vertical até 3 min)" },
  INSTAGRAM: { nome: "Instagram", cor: "#d62976", publica: "Reel (sempre público)" },
  TIKTOK: { nome: "TikTok", cor: "#111111", publica: "vídeo (privado até a auditoria do app)" },
};

export const MAX_VIDEO = 500 * 1024 * 1024;
export const TIPOS_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

/** O state que o NordTool mandou para a rede é "usuário.REDE.validade.nonce.assinatura": a rede é a 2ª parte. */
export function redeDoEstado(estado: string | null | undefined): Rede | null {
  const parte = (estado ?? "").split(".")[1] ?? "";
  return (REDES as string[]).includes(parte) ? (parte as Rede) : null;
}

/** Faixas [início, fim) de cada parte do envio. */
export function partesDoVideo(tamanho: number, parte: number): [number, number][] {
  if (tamanho <= 0 || parte <= 0) return [];
  const partes: [number, number][] = [];
  for (let i = 0; i < tamanho; i += parte) partes.push([i, Math.min(tamanho, i + parte)]);
  return partes;
}

/** 950 → "950", 12_300 → "12,3 mil", 4_560_000 → "4,6 mi"; nulo → "—". */
export function numeroCurto(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "")).replace(".", ",");
  if (Math.abs(n) >= 1_000_000_000) return `${fmt(n / 1_000_000_000)} bi`;
  if (Math.abs(n) >= 1_000_000) return `${fmt(n / 1_000_000)} mi`;
  if (Math.abs(n) >= 1_000) return `${fmt(n / 1_000)} mil`;
  return String(Math.round(n));
}

/** Soma seguidores e views de todas as contas (ignora o que a rede não informou). */
export function totaisDoPainel(contas: { nrSeguidores: number | null; nrViewsTotais: number | null }[]) {
  return contas.reduce((t, c) => ({
    seguidores: t.seguidores + (c.nrSeguidores ?? 0),
    views: t.views + (c.nrViewsTotais ?? 0),
  }), { seguidores: 0, views: 0 });
}

/** Erro para mostrar, ou nulo se o vídeo pode subir (tipo e tamanho; o Instagram não aceita WebM). */
export function problemaDoVideo(arquivo: { type: string; size: number }, redes: Rede[]): string | null {
  if (!TIPOS_VIDEO.includes(arquivo.type)) return "Escolha um vídeo MP4, MOV ou WebM.";
  if (arquivo.size <= 0) return "O vídeo está vazio.";
  if (arquivo.size > MAX_VIDEO) return "O vídeo pode ter até 500 MB.";
  if (arquivo.type === "video/webm" && redes.includes("INSTAGRAM")) return "O Instagram não aceita WebM: use MP4 ou MOV.";
  return null;
}

export const STATUS_PUBLICACAO: Record<string, { rotulo: string; cor: string }> = {
  ENVIANDO: { rotulo: "Enviando…", cor: "bg-amber-100 text-amber-800" },
  PUBLICADO: { rotulo: "Publicado", cor: "bg-emerald-100 text-emerald-800" },
  PRIVADO: { rotulo: "Publicado (privado)", cor: "bg-sky-100 text-sky-800" },
  ERRO: { rotulo: "Erro", cor: "bg-red-100 text-red-800" },
};
