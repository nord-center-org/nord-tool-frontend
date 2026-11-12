/**
 * Teoria musical básica para o Repertório: notas, acordes, transposição e tons. Puro, testável em node.
 * As notas usam o padrão de cifra (C, C#, D…); MIDI 60 = C4 (dó central).
 */

export const NOTAS_SUSTENIDO = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTAS_BEMOL = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const NOMES_SOLFEJO = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];

const LETRA_PARA_CLASSE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;
export const midiParaFrequencia = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const frequenciaParaMidi = (f: number) => 69 + 12 * Math.log2(f / 440);

/** Classe da nota (0 = C … 11 = B) a partir do nome ("F#", "Bb", "E"); null se não for nota. */
export function classeDaNota(nome: string): number | null {
  const m = /^([A-Ga-g])([#b]{0,2})$/.exec(nome.trim());
  if (!m) return null;
  let c = LETRA_PARA_CLASSE[m[1].toUpperCase()];
  for (const a of m[2]) c += a === "#" ? 1 : -1;
  return mod12(c);
}

/** Nome da nota sem oitava, como cifra ("C#") ou solfejo ("Dó#"). */
export const nomeDaNota = (midi: number, estilo: "cifra" | "solfejo" = "cifra") => (estilo === "solfejo" ? NOMES_SOLFEJO : NOTAS_SUSTENIDO)[mod12(midi)];

/** Nome da nota com oitava (ex.: 40 → "E2"). */
export const nomeMidi = (m: number, bemol = false) => `${(bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO)[mod12(m)]}${Math.floor(m / 12) - 1}`;

/** Tonalidades em que se escreve com bemol (F, Bb, Eb, Ab, Db, Gb e as menores relativas). */
const TONS_BEMOL_MAIOR = new Set([5, 10, 3, 8, 1, 6]);
export const usaBemol = (tonica: number, menor: boolean) => TONS_BEMOL_MAIOR.has(menor ? mod12(tonica + 3) : mod12(tonica));

// ---------------------------------------------------------------- acordes

export interface Acorde {
  /** Classe da fundamental (0–11). */
  raiz: number;
  /** O que vem depois da fundamental, como escrito ("m7", "7M", "sus4", "" …). */
  sufixo: string;
  /** Baixo invertido (classe), se houver ("C/E" → 4). */
  baixo: number | null;
  /** Intervalos do acorde em semitons a partir da raiz (sempre começa com 0). */
  intervalos: number[];
  menor: boolean;
}

// Sufixo: letras/números/símbolos de cifra; "/4", "/9" etc. fazem parte dele (D7/4, C/9); "/E" é baixo invertido.
const RE_ACORDE = /^([A-G])([#b]?)((?:[^/\s]|\/(?=\d))*)(?:\/([A-G][#b]?))?$/;
/** Peças válidas de um sufixo (o que sobra precisa ser só disso, para não confundir palavra com acorde). */
const RE_SUFIXO = /^(?:min|maj|dim|aug|sus|add|m|M|[0-9]|[#b+°ºø-]|\/|\(|\)|o(?=7))*$/;

/** Lê um acorde de cifra ("Am7", "F#m7(b5)", "C/E", "Bb7M", "G4", "D7/4", "A9"). Null se não parecer acorde. */
export function lerAcorde(texto: string): Acorde | null {
  const m = RE_ACORDE.exec(texto.trim());
  if (!m) return null;
  const raiz = classeDaNota(m[1] + m[2]);
  const sufixo = m[3] ?? "";
  if (raiz === null || !RE_SUFIXO.test(sufixo) || sufixo.length > 12) return null;
  const baixo = m[4] ? classeDaNota(m[4]) : null;
  const s = sufixo.replace(/[()]/g, "");
  const meioDim = /ø|m7b5|m7-5/.test(s);
  const dim = !meioDim && /dim|°|º|^o/.test(s);
  const menor = /^(min|m(?!aj)|-(?!\d))/.test(s);
  const aum = /aug|^\+|#5|\+5|5\+/.test(s);
  const sus2 = /sus2/.test(s);
  const sus4 = !sus2 && (/sus/.test(s) || /(^|[^\d#b+-])4($|[^\d])/.test(s.replace(/add4/, "")));
  const terca = sus2 ? 2 : sus4 ? 5 : menor || dim || meioDim ? 3 : 4;
  const quinta = dim || meioDim || /b5|-5/.test(s) ? 6 : aum ? 8 : 7;
  const iv = new Set<number>([0, terca, quinta]);
  if (s === "5") iv.delete(terca);
  if (/7M|maj7?|M7|7\+|^M$/.test(s)) iv.add(11);
  else if (dim && /7/.test(s)) iv.add(9);
  else if (/7|(^|[^/])(9|11|13)/.test(s.replace(/add\d+/, ""))) iv.add(10);
  if (/(^|[^1b#])6/.test(s)) iv.add(9);
  if (/9|add2/.test(s)) iv.add(/b9/.test(s) ? 1 : /#9/.test(s) ? 3 : 2);
  if (/11|add4/.test(s)) iv.add(/#11/.test(s) ? 6 : 5);
  if (/13/.test(s)) iv.add(/b13/.test(s) ? 8 : 9);
  return { raiz, sufixo, baixo, intervalos: [...iv].sort((a, b) => a - b), menor: menor || dim || meioDim };
}

/** Classes das notas do acorde (com o baixo, se houver). */
export const notasDoAcorde = (a: Acorde) => {
  const s = new Set(a.intervalos.map(i => mod12(a.raiz + i)));
  if (a.baixo !== null) s.add(a.baixo);
  return [...s];
};

/** Escreve o acorde (com sustenido ou bemol). */
export const escreverAcorde = (a: Acorde, bemol = false) => {
  const nomes = bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
  return `${nomes[a.raiz]}${a.sufixo}${a.baixo !== null ? `/${nomes[a.baixo]}` : ""}`;
};

/** Transpõe um acorde escrito ("F#m7/C#", +2 → "G#m7/D#"). Texto que não é acorde volta igual. */
export function transporAcorde(texto: string, semitons: number, bemol?: boolean): string {
  const a = lerAcorde(texto);
  if (!a) return texto;
  const usarBemol = bemol ?? /^[A-G]b/.test(texto.trim());
  return escreverAcorde({ ...a, raiz: mod12(a.raiz + semitons), baixo: a.baixo === null ? null : mod12(a.baixo + semitons) }, usarBemol);
}

// ---------------------------------------------------------------- tons

export interface Tom { tonica: number; menor: boolean }

export const nomeDoTom = (t: Tom) => {
  const bemol = usaBemol(t.tonica, t.menor);
  const cifra = `${(bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO)[t.tonica]}${t.menor ? "m" : ""}`;
  const solfejo = NOMES_SOLFEJO[t.tonica].replace("#", bemol ? "" : "#");
  const nomeBemol = ["Dó", "Ré♭", "Ré", "Mi♭", "Mi", "Fá", "Sol♭", "Sol", "Lá♭", "Lá", "Si♭", "Si"][t.tonica];
  return { cifra, extenso: `${bemol ? nomeBemol : solfejo} ${t.menor ? "menor" : "maior"}` };
};

export const transporTom = (t: Tom, semitons: number): Tom => ({ tonica: mod12(t.tonica + semitons), menor: t.menor });

/** Lê um tom escrito ("Em", "F#", "Bbm"). */
export function lerTom(texto: string): Tom | null {
  const a = lerAcorde(texto.trim());
  if (!a || (a.sufixo && a.sufixo !== "m")) return null;
  return { tonica: a.raiz, menor: a.sufixo === "m" };
}

/** Semitons de diferença de um tom para outro, no caminho mais curto (−5…+6). */
export const distanciaEntreTons = (de: number, para: number) => { const d = mod12(para - de); return d > 6 ? d - 12 : d; };
