/**
 * Repertório v8: ferramentas para tocar melhor no instrumento online e no estúdio — timbres (variações de cada
 * instrumento), escalas destacadas, acorde com uma tecla, transpor, sustentar, força e o braço (cordas e casas) para
 * baixo e violão. Só o modelo, puro e testável em node; o som fica em `components/repertorio/sintetizador.ts`.
 */
import type { Timbre } from "./estudio.ts";

// ---------------------------------------------------------------- timbres (variações)

export const VARIANTES: Record<Timbre, Array<{ id: string; nome: string }>> = {
  baixo: [
    { id: "dedo", nome: "Dedo" }, { id: "palheta", nome: "Palheta" }, { id: "slap", nome: "Slap" },
    { id: "fretless", nome: "Fretless" }, { id: "synth", nome: "Sintetizado" },
  ],
  teclado: [{ id: "eletrico", nome: "Piano elétrico" }, { id: "piano", nome: "Piano" }, { id: "orgao", nome: "Órgão" }],
  violao: [{ id: "aco", nome: "Violão de aço" }, { id: "nylon", nome: "Violão de nylon" }, { id: "guitarra", nome: "Guitarra limpa" }, { id: "distorcida", nome: "Guitarra distorcida" }],
  lead: [{ id: "serra", nome: "Lead" }, { id: "quadrada", nome: "Quadrada" }, { id: "pad", nome: "Pad" }, { id: "sino", nome: "Sino" }],
  bateria: [{ id: "acustica", nome: "Acústica" }, { id: "eletronica", nome: "Eletrônica" }],
};

/** A variação pedida, se existir para o timbre; senão a primeira (a padrão). */
export function variante(t: Timbre, v: string | null | undefined): string {
  const lista = VARIANTES[t] ?? [];
  return lista.some(x => x.id === v) ? (v as string) : lista[0]?.id ?? "";
}

// ---------------------------------------------------------------- escalas

export const ESCALAS: Array<{ id: string; nome: string; intervalos: number[] }> = [
  { id: "maior", nome: "Maior", intervalos: [0, 2, 4, 5, 7, 9, 11] },
  { id: "menor", nome: "Menor", intervalos: [0, 2, 3, 5, 7, 8, 10] },
  { id: "penta-maior", nome: "Pentatônica maior", intervalos: [0, 2, 4, 7, 9] },
  { id: "penta-menor", nome: "Pentatônica menor", intervalos: [0, 3, 5, 7, 10] },
  { id: "blues", nome: "Blues", intervalos: [0, 3, 5, 6, 7, 10] },
];

/** Classes de nota (0–11) da escala na tônica dada. */
export function notasDaEscala(tonica: number, escala: string): Set<number> {
  const e = ESCALAS.find(x => x.id === escala) ?? ESCALAS[0];
  return new Set(e.intervalos.map(i => (((tonica + i) % 12) + 12) % 12));
}

/** A nota está na escala? (`null` = sem escala escolhida: todas estão.) */
export const naEscala = (midi: number, escala: Set<number> | null) => !escala || escala.has(((midi % 12) + 12) % 12);

// ---------------------------------------------------------------- acorde com uma tecla

export const ACORDES_UMA_TECLA: Array<{ id: string; nome: string; intervalos: number[] }> = [
  { id: "maior", nome: "Maior", intervalos: [0, 4, 7] },
  { id: "menor", nome: "Menor", intervalos: [0, 3, 7] },
  { id: "7", nome: "Com sétima (7)", intervalos: [0, 4, 7, 10] },
  { id: "m7", nome: "Menor com sétima (m7)", intervalos: [0, 3, 7, 10] },
  { id: "5", nome: "Quinta (power chord)", intervalos: [0, 7, 12] },
];

/**
 * As notas que uma tecla toca: só ela, ou o acorde montado sobre ela. Com `escala`, o acorde segue a escala (no
 * campo harmônico: em Dó maior, a tecla Ré dá Ré menor), se o tipo for "escala".
 */
export function notasDaTecla(midi: number, acorde: string | null, escala: Set<number> | null = null): number[] {
  if (!acorde) return [midi];
  if (acorde === "escala" && escala) {
    // terça e quinta da própria escala (a 3ª e a 5ª notas a partir da tecla)
    const acima = (de: number, passos: number) => {
      let m = de, n = 0;
      while (n < passos && m < de + 24) { m++; if (escala.has(((m % 12) + 12) % 12)) n++; }
      return m;
    };
    return escala.has(((midi % 12) + 12) % 12) ? [midi, acima(midi, 2), acima(midi, 4)] : [midi];
  }
  const a = ACORDES_UMA_TECLA.find(x => x.id === acorde);
  return a ? a.intervalos.map(i => midi + i) : [midi];
}

// ---------------------------------------------------------------- braço (cordas e casas)

/** Cordas soltas (MIDI, da mais grave para a mais aguda) do braço na tela. */
export const CORDAS_DO_BRACO: Partial<Record<Timbre, { nome: string; cordas: number[] }>> = {
  baixo: { nome: "Baixo de 5 cordas", cordas: [23, 28, 33, 38, 43] },
  violao: { nome: "Violão", cordas: [40, 45, 50, 55, 59, 64] },
};

export const temBraco = (t: Timbre) => !!CORDAS_DO_BRACO[t];

/** Altura da nota na corda e casa dadas, com a transposição (capotraste/afinação). */
export const notaNoBraco = (cordas: number[], corda: number, casa: number, transpor = 0) => cordas[corda] + casa + transpor;

// ---------------------------------------------------------------- preferências do instrumento

export interface FerramentasTocar {
  sustentar: boolean;
  /** Semitons (−12 a +12) somados a tudo que se toca. */
  transpor: number;
  /** Tônica (0–11) e escala destacadas; null = sem escala. */
  escala: { tonica: number; id: string } | null;
  /** Acorde com uma tecla (id de ACORDES_UMA_TECLA ou "escala"); null = nota sozinha. */
  acorde: string | null;
  /** Força das notas (0,2–1). */
  forca: number;
  /** Teclas de piano ou o braço (baixo e violão). */
  layout: "teclas" | "braco";
  /** Quantas oitavas de teclas (1 a 3). */
  oitavas: number;
  /** Timbre escolhido por instrumento. */
  variantes: Partial<Record<Timbre, string>>;
}

export const FERRAMENTAS_PADRAO: FerramentasTocar = { sustentar: false, transpor: 0, escala: null, acorde: null, forca: 0.85, layout: "teclas", oitavas: 2, variantes: {} };

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Onde as ferramentas ficam guardadas no aparelho (o instrumento online e o sintetizador do player usam). */
export const CHAVE_FERRAMENTAS = "@NordTool:repertorio-ferramentas";

export function lerFerramentasDe(storage: Pick<Storage, "getItem"> | undefined): FerramentasTocar {
  try { return lerFerramentas(JSON.parse(storage?.getItem(CHAVE_FERRAMENTAS) ?? "null")); } catch { return lerFerramentas(null); }
}

export function gravarFerramentas(storage: Pick<Storage, "setItem"> | undefined, f: FerramentasTocar) {
  try { storage?.setItem(CHAVE_FERRAMENTAS, JSON.stringify(f)); } catch { /* sem espaço ou bloqueado */ }
}

/** Lê as preferências guardadas, descartando o que estiver fora do formato. */
export function lerFerramentas(bruto: unknown): FerramentasTocar {
  if (!bruto || typeof bruto !== "object") return { ...FERRAMENTAS_PADRAO };
  const o = bruto as Record<string, unknown>;
  const num = (v: unknown, p: number) => (typeof v === "number" && Number.isFinite(v) ? v : p);
  const esc = o.escala && typeof o.escala === "object" ? (o.escala as Record<string, unknown>) : null;
  const variantes: Partial<Record<Timbre, string>> = {};
  if (o.variantes && typeof o.variantes === "object") {
    for (const [t, v] of Object.entries(o.variantes as Record<string, unknown>)) {
      if (t in VARIANTES && typeof v === "string" && VARIANTES[t as Timbre].some(x => x.id === v)) variantes[t as Timbre] = v;
    }
  }
  return {
    sustentar: o.sustentar === true,
    transpor: Math.round(limitar(num(o.transpor, 0), -12, 12)),
    escala: esc && typeof esc.id === "string" && ESCALAS.some(e => e.id === esc.id) ? { tonica: Math.round(limitar(num(esc.tonica, 0), 0, 11)), id: esc.id } : null,
    acorde: typeof o.acorde === "string" && (o.acorde === "escala" || ACORDES_UMA_TECLA.some(a => a.id === o.acorde)) ? o.acorde : null,
    forca: limitar(num(o.forca, FERRAMENTAS_PADRAO.forca), 0.2, 1),
    layout: o.layout === "braco" ? "braco" : "teclas",
    oitavas: Math.round(limitar(num(o.oitavas, 2), 1, 3)),
    variantes,
  };
}
