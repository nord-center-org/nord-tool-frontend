/**
 * Multiplayer dos Games: a tela grande hospeda o jogo e os celulares viram controles. Aqui ficam as partes puras:
 * código da sala, endereços, o formato das entradas e o "trinco" que não deixa um toque rápido se perder.
 */

export type Direcao = "cima" | "baixo" | "esquerda" | "direita";
const DIRECOES: Direcao[] = ["cima", "baixo", "esquerda", "direita"];

/** Letras e números sem os ambíguos (sem O/0 e I/1), como o servidor gera. */
export const ALFABETO_SALA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_JOGADORES_SALA = 8;

/** O que a pessoa digitou → código da sala (maiúsculas, só letras e números do alfabeto, até 4). */
export function normalizarCodigo(texto: string): string {
  return Array.from(texto.toUpperCase()).filter(c => ALFABETO_SALA.includes(c)).join("").slice(0, 4);
}

/** Endereço do WebSocket a partir da base da API (absoluta ou relativa à página). */
export function urlDoSocket(apiBase: string, origemDaPagina: string, bilhete: string): string {
  const base = /^https?:\/\//.test(apiBase) ? apiBase : `${origemDaPagina}${apiBase.startsWith("/") ? "" : "/"}${apiBase}`;
  return `${base.replace(/^http/, "ws").replace(/\/+$/, "")}/games/ws?bilhete=${encodeURIComponent(bilhete)}`;
}

/** Link que o QR Code abre no celular. */
export const linkDoControle = (origem: string, codigo: string) => `${origem}/gestao/games/controle?sala=${codigo}`;

/** Entrada que o celular manda (só quando muda). */
export interface EntradaControle { x: Direcao | null; a: boolean; b: boolean; p: boolean }
export const CONTROLE_SOLTO: EntradaControle = { x: null, a: false, b: false, p: false };

export const mesmaEntrada = (u: EntradaControle, v: EntradaControle) => u.x === v.x && u.a === v.a && u.b === v.b && u.p === v.p;

/** Lê com cuidado o que veio da rede (pode vir qualquer coisa). */
export function lerEntrada(d: unknown): EntradaControle {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
  return {
    x: DIRECOES.includes(o.x as Direcao) ? (o.x as Direcao) : null,
    a: o.a === true, b: o.b === true, p: o.p === true,
  };
}

/**
 * Entradas dos celulares, por vaga da sala. Um botão que foi apertado e solto entre dois passos do jogo ainda conta
 * uma vez no passo seguinte (o "trinco"), do mesmo jeito do teclado e do controle na tela.
 */
export class EntradasRemotas {
  private atual = new Map<number, EntradaControle>();
  private apertados = new Map<number, Set<"a" | "b" | "p">>();

  receber(vaga: number, d: unknown) {
    const nova = lerEntrada(d);
    const antes = this.atual.get(vaga) ?? CONTROLE_SOLTO;
    const trinco = this.apertados.get(vaga) ?? new Set<"a" | "b" | "p">();
    (["a", "b", "p"] as const).forEach(k => { if (nova[k] && !antes[k]) trinco.add(k); });
    this.apertados.set(vaga, trinco);
    this.atual.set(vaga, nova);
  }

  /** O estado da vaga neste passo; limpa o trinco. */
  ler(vaga: number): EntradaControle {
    const e = this.atual.get(vaga) ?? CONTROLE_SOLTO;
    const t = this.apertados.get(vaga);
    const lida = { x: e.x, a: e.a || !!t?.has("a"), b: e.b || !!t?.has("b"), p: e.p || !!t?.has("p") };
    t?.clear();
    return lida;
  }

  /** Quem caiu solta tudo (não fica andando sozinho). */
  soltar(vaga: number) {
    this.atual.delete(vaga);
    this.apertados.delete(vaga);
  }
}

/** Um jogador na lista da sala (como o servidor manda). */
export interface JogadorSala { vaga: number; idUsuario: number; nome: string; avatar: string | null; conectado: boolean }

/** O que a tela grande manda para os celulares (campo "d" das mensagens "host"). */
export type AvisoDaTela =
  | { k: "lugar"; indice: number; cor: string; jogo: string }
  | { k: "fase"; fase: "lobby" | "contagem" | "jogando" | "fimRodada" | "fimPartida" }
  | { k: "vibrar"; ms: number; texto?: string }
  | { k: "fim"; jogo: string; modo: string; pontos: number; venceu: boolean; colocacao: number; jogadores: number; bots: number; dificuldade: string | null; duracao: number };

export function lerAviso(d: unknown): AvisoDaTela | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min);
  switch (o.k) {
    case "lugar": return { k: "lugar", indice: num(o.indice, 0, 7), cor: /^#[0-9a-f]{6}$/i.test(String(o.cor)) ? String(o.cor) : "#64748b", jogo: String(o.jogo ?? "").slice(0, 40) };
    case "fase": return ["lobby", "contagem", "jogando", "fimRodada", "fimPartida"].includes(o.fase as string) ? { k: "fase", fase: o.fase as "lobby" } : null;
    case "vibrar": return { k: "vibrar", ms: num(o.ms, 0, 1000), texto: typeof o.texto === "string" ? o.texto.slice(0, 80) : undefined };
    case "fim": return {
      k: "fim", jogo: String(o.jogo ?? "").slice(0, 40), modo: String(o.modo ?? "").slice(0, 40), pontos: num(o.pontos, 0, 10_000_000),
      venceu: o.venceu === true, colocacao: num(o.colocacao, 1, 8), jogadores: num(o.jogadores, 1, 8), bots: num(o.bots, 0, 7),
      dificuldade: ["facil", "medio", "dificil"].includes(o.dificuldade as string) ? (o.dificuldade as string) : null, duracao: num(o.duracao, 0, 86_400),
    };
    default: return null;
  }
}

/** Espera entre as tentativas de reconectar: 1 s, 2 s, 4 s… até 10 s. */
export const esperaDaTentativa = (n: number) => Math.min(10_000, 1000 * 2 ** Math.max(0, n));
