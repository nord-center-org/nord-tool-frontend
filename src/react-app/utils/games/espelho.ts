/**
 * Espelho: a tela (quem hospeda) roda o jogo e manda "quadros" para cada celular, que desenha o mesmo jogo com o
 * próprio motor. Aqui ficam as partes puras: transformar o estado em JSON (com Map, Set e sem funções) e os formatos
 * das mensagens.
 */

/** Estado → valor que cabe em JSON: Map/Set viram marcados, funções e undefined somem, números não finitos viram null. */
export function serializar(v: unknown, profundidade = 0): unknown {
  if (profundidade > 40) return null;
  if (v === null || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "function" || typeof v === "undefined" || typeof v === "symbol" || typeof v === "bigint") return undefined;
  if (Array.isArray(v)) return v.map(x => { const s = serializar(x, profundidade + 1); return s === undefined ? null : s; });
  if (v instanceof Map) return { __m: Array.from(v.entries()).map(([k, x]) => [serializar(k, profundidade + 1), serializar(x, profundidade + 1)]) };
  if (v instanceof Set) return { __s: Array.from(v.values()).map(x => serializar(x, profundidade + 1)) };
  if (ArrayBuffer.isView(v)) return { __a: Array.from(v as unknown as ArrayLike<number>) };
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const s = serializar(x, profundidade + 1);
      if (s !== undefined) o[k] = s;
    }
    return o;
  }
  return undefined;
}

/** O caminho de volta de {@link serializar}. */
export function desserializar(v: unknown, profundidade = 0): unknown {
  if (profundidade > 40) return null;
  if (Array.isArray(v)) return v.map(x => desserializar(x, profundidade + 1));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.__m)) return new Map((o.__m as unknown[]).filter(Array.isArray).map(p => [desserializar((p as unknown[])[0], profundidade + 1), desserializar((p as unknown[])[1], profundidade + 1)]));
    if (Array.isArray(o.__s)) return new Set((o.__s as unknown[]).map(x => desserializar(x, profundidade + 1)));
    if (Array.isArray(o.__a)) return (o.__a as unknown[]).map(Number);
    const r: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      r[k] = desserializar(x, profundidade + 1);
    }
    return r;
  }
  return v;
}

/** Fases da partida, como a moldura usa. */
export type FaseEspelho = "contagem" | "jogando" | "fimRodada" | "fimPartida";

/** O que acompanha cada quadro: tudo que a moldura do celular precisa para mostrar o placar e as telas de fim. */
export interface MetaEspelho {
  fase: FaseEspelho;
  contagem: number;
  pausado: boolean;
  rodada: number;
  vitorias: number[];
  placar: { tempo: number; alerta?: boolean; jogadores: { vivo: boolean; texto?: string }[] } | null;
  ultimo: { vencedor: number | null; time?: number | null } | null;
}

/** Uma vaga como o celular precisa ver (sem dados de conta: só nome, avatar e se é bot). */
export interface VagaEspelho { nome: string; bot: string | null; avatar: unknown }

/** Início de partida: o que o celular precisa para montar o mesmo motor. */
export interface PartidaEspelho { jogo: string; modo: string; cenario: string; vagas: VagaEspelho[]; eu: number; vitoriasParaVencer: number; numero: number }

/** Um quadro do jogo: número (para descartar quadros velhos fora de ordem), estado, eventos desde o último e meta. */
export interface QuadroEspelho { n: number; s: unknown; ev: unknown[]; m: MetaEspelho }

const FASES: FaseEspelho[] = ["contagem", "jogando", "fimRodada", "fimPartida"];

/** Confere o básico de um quadro recebido (o resto é do motor do jogo). */
export function lerQuadro(d: unknown): QuadroEspelho | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  const m = o.m as Record<string, unknown> | undefined;
  if (typeof o.n !== "number" || !m || !FASES.includes(m.fase as FaseEspelho)) return null;
  const vit = Array.isArray(m.vitorias) ? (m.vitorias as unknown[]).slice(0, 8).map(x => (typeof x === "number" ? Math.max(0, Math.min(99, Math.round(x))) : 0)) : [];
  return {
    n: o.n,
    s: o.s,
    ev: Array.isArray(o.ev) ? (o.ev as unknown[]).slice(0, 500) : [],
    m: {
      fase: m.fase as FaseEspelho,
      contagem: typeof m.contagem === "number" ? m.contagem : 0,
      pausado: m.pausado === true,
      rodada: typeof m.rodada === "number" ? m.rodada : 1,
      vitorias: vit,
      placar: (m.placar && typeof m.placar === "object" ? m.placar : null) as MetaEspelho["placar"],
      ultimo: (m.ultimo && typeof m.ultimo === "object" ? m.ultimo : null) as MetaEspelho["ultimo"],
    },
  };
}

/** Confere o início de partida recebido. */
export function lerPartida(d: unknown): PartidaEspelho | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.jogo !== "string" || !/^[a-z0-9-]{1,40}$/.test(o.jogo) || !Array.isArray(o.vagas)) return null;
  const vagas = (o.vagas as unknown[]).slice(0, 8).map((v, i) => {
    const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { nome: typeof x.nome === "string" ? x.nome.slice(0, 40) : `P${i + 1}`, bot: ["facil", "medio", "dificil"].includes(x.bot as string) ? (x.bot as string) : null, avatar: x.avatar ?? null };
  });
  const eu = typeof o.eu === "number" && o.eu >= 0 && o.eu < vagas.length ? o.eu : -1;
  return {
    jogo: o.jogo, modo: typeof o.modo === "string" ? o.modo.slice(0, 40) : "", cenario: typeof o.cenario === "string" ? o.cenario.slice(0, 40) : "",
    vagas, eu, vitoriasParaVencer: typeof o.vitoriasParaVencer === "number" ? o.vitoriasParaVencer : 1, numero: typeof o.numero === "number" ? o.numero : 1,
  };
}
