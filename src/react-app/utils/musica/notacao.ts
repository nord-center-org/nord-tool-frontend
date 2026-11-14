/**
 * Repertório v15 — como as notas aparecem na tela: com sustenido (padrão: C#, D#, F#…) ou bemol (Db, Eb, Gb…), e
 * com letras (C, D, E) ou com o nome em português (Dó, Ré, Mi). Só muda o que se vê: a cifra guardada fica como foi
 * escrita, e tocar, transpor e sincronizar continuam com as letras. Puro, testável em node.
 */
import { NOTAS_BEMOL, NOTAS_SUSTENIDO, lerAcorde, mod12, type Tom } from "./teoria.ts";

export interface Notacao { acidente: "sustenido" | "bemol"; nomes: "letras" | "solfejo" }
export const NOTACAO_PADRAO: Notacao = { acidente: "sustenido", nomes: "letras" };
export const CHAVE_NOTACAO = "@NordTool:notacao";

const SOLFEJO: Record<string, string> = { C: "Dó", D: "Ré", E: "Mi", F: "Fá", G: "Sol", A: "Lá", B: "Si" };

/** A nota em letra (C#/Db) conforme o acidente escolhido. */
export const letraDaNota = (classeOuMidi: number, n: Notacao = NOTACAO_PADRAO) =>
  (n.acidente === "bemol" ? NOTAS_BEMOL : NOTAS_SUSTENIDO)[mod12(classeOuMidi)];

/** Troca as letras de um nome já escrito (nota ou acorde) pelo nome em português: "C#m7/G#" → "Dó#m7/Sol#". */
export function emSolfejo(nome: string): string {
  return nome.replace(/(^|\/)([A-G])/g, (_, antes: string, letra: string) => antes + SOLFEJO[letra]);
}

/** A nota como aparece na tela. */
export const nomeDaNotaExibida = (classeOuMidi: number, n: Notacao = NOTACAO_PADRAO) => {
  const l = letraDaNota(classeOuMidi, n);
  return n.nomes === "solfejo" ? emSolfejo(l) : l;
};

/** O acorde com o acidente escolhido, ainda em letras (para tocar e transpor): "Db7/Ab" → "C#7/G#". */
export function acordeNaNotacao(nome: string, n: Notacao = NOTACAO_PADRAO): string {
  const a = lerAcorde(nome);
  if (!a) return nome;
  const notas = n.acidente === "bemol" ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
  return `${notas[a.raiz]}${a.sufixo}${a.baixo !== null ? `/${notas[a.baixo]}` : ""}`;
}

/** O acorde como aparece na tela (acidente e letras ou português). Texto que não é acorde volta igual. */
export function acordeExibido(nome: string, n: Notacao = NOTACAO_PADRAO): string {
  if (!lerAcorde(nome)) return nome;
  const l = acordeNaNotacao(nome, n);
  return n.nomes === "solfejo" ? emSolfejo(l) : l;
}

/** O tom como aparece: "C#m" / "Dó#m" e por extenso "Dó# menor". */
export function tomExibido(t: Tom, n: Notacao = NOTACAO_PADRAO): { cifra: string; extenso: string } {
  const l = letraDaNota(t.tonica, n);
  const pt = emSolfejo(l);
  return { cifra: `${n.nomes === "solfejo" ? pt : l}${t.menor ? "m" : ""}`, extenso: `${pt} ${t.menor ? "menor" : "maior"}` };
}

export function lerNotacao(storage: Pick<Storage, "getItem"> | undefined): Notacao {
  try {
    const v: unknown = JSON.parse(storage?.getItem(CHAVE_NOTACAO) ?? "null");
    if (!v || typeof v !== "object") return { ...NOTACAO_PADRAO };
    const o = v as Record<string, unknown>;
    return {
      acidente: o.acidente === "bemol" ? "bemol" : "sustenido",
      nomes: o.nomes === "solfejo" ? "solfejo" : "letras",
    };
  } catch {
    return { ...NOTACAO_PADRAO };
  }
}

export function gravarNotacao(storage: Pick<Storage, "setItem"> | undefined, n: Notacao) {
  try { storage?.setItem(CHAVE_NOTACAO, JSON.stringify(n)); } catch { /* sem espaço ou bloqueado: vale só nesta visita */ }
}
