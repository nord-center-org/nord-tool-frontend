/**
 * Drumcam no NordTool (Repertório → Drumcam): o celular-câmera fica no relé do NordTool e o painel da câmera roda
 * dentro da página. Aqui ficam as regras puras: endereço do WebSocket, ponte do app Android e a tradução entre as
 * mensagens do painel (postMessage) e as do relé.
 */

/** URL do WebSocket do relé, a partir da base da API (absoluta ou relativa à página). */
export function urlDoReleDrumcam(apiBase: string, origemDaPagina: string, bilhete: string): string {
  const base = /^https?:\/\//.test(apiBase) ? apiBase : `${origemDaPagina}${apiBase.startsWith("/") ? "" : "/"}${apiBase}`;
  return `${base.replace(/^http/, "ws").replace(/\/+$/, "")}/drumcam/ws?bilhete=${encodeURIComponent(bilhete)}`;
}

/** Endereço digitado da câmera no Wi-Fi ("192.168.0.10", "http://192.168.0.10:8080/") → URL do painel. */
export function enderecoDaCamera(texto: string, portaPadrao = 8080): string | null {
  const limpo = texto.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(limpo)) return null;
  return `http://${limpo.includes(":") ? limpo : `${limpo}:${portaPadrao}`}/`;
}

export interface PonteDrumcam {
  /** Este celular vira a câmera. */
  drumcamCamera(): void;
  /** Procura a câmera no Wi-Fi e abre o painel completo (com download dos vídeos). */
  drumcamControlar(): void;
  drumcamAtiva(): boolean;
}

/** A ponte do app Android 6.0+ com o Drumcam; fora do app (ou app antigo), null. */
export function ponteDrumcam(janela: unknown = typeof window === "undefined" ? undefined : window): PonteDrumcam | null {
  const p = (janela as { NordAndroid?: Partial<PonteDrumcam> } | undefined)?.NordAndroid;
  return p && typeof p.drumcamCamera === "function" && typeof p.drumcamControlar === "function" && typeof p.drumcamAtiva === "function"
    ? (p as PonteDrumcam) : null;
}

export interface CameraOnline { id: string; nome: string }

/** Pedido do painel (iframe) → mensagem do relé para a câmera escolhida. */
export interface PedidoPainel { tipo: "drumcam-req"; id: number; m: string; c: string; b?: string; tipoCorpo?: string }
export function pedidoDoPainel(d: unknown): PedidoPainel | null {
  const p = d as Partial<PedidoPainel> | null;
  if (!p || p.tipo !== "drumcam-req" || typeof p.id !== "number" || typeof p.m !== "string" || typeof p.c !== "string") return null;
  if (!/^(GET|POST|PUT|DELETE)$/.test(p.m) || p.c.length > 500 || (p.b && p.b.length > 1_300_000)) return null;
  return { tipo: "drumcam-req", id: p.id, m: p.m, c: p.c, b: p.b || "", tipoCorpo: p.tipoCorpo || "" };
}
export const mensagemParaCamera = (camera: string, idRele: number, p: PedidoPainel) =>
  ({ t: "req", camera, id: idRele, m: p.m, c: p.c, b: p.b || "", tipo: p.tipoCorpo || "" });

/** Mensagem que chega do relé: lista de câmeras ou resposta de um pedido. */
export type MsgRele =
  | { t: "cameras"; lista: CameraOnline[] }
  | { t: "resp"; id: number; s: number; tipo?: string; b?: string; erro?: string }
  | { t: "ok" | "outro" };
export function lerMsgRele(texto: string): MsgRele {
  let m: Record<string, unknown>;
  try { m = JSON.parse(texto) as Record<string, unknown>; } catch { return { t: "outro" }; }
  if (!m || typeof m !== "object") return { t: "outro" };
  if (m.t === "cameras" && Array.isArray(m.lista)) {
    return { t: "cameras", lista: m.lista.filter((c): c is CameraOnline => !!c && typeof c.id === "string" && typeof c.nome === "string") };
  }
  if (m.t === "resp" && typeof m.id === "number" && typeof m.s === "number") {
    return { t: "resp", id: m.id, s: m.s, tipo: typeof m.tipo === "string" ? m.tipo : "", b: typeof m.b === "string" ? m.b : "", erro: typeof m.erro === "string" ? m.erro : undefined };
  }
  return { t: m.t === "ok" ? "ok" : "outro" };
}

/** Espera antes de reconectar o relé: 2 s, 4 s, 8 s… até 30 s. */
export const esperaDoRele = (tentativa: number) => Math.min(30_000, 2_000 * 2 ** Math.max(0, tentativa));
