/**
 * Cifra no formato do Cifra Club (acordes numa linha, letra embaixo, [Seções], tablaturas): leitura, transposição e
 * cifra gerada a partir dos acordes reconhecidos no áudio. Puro, testável em node.
 */
import { lerAcorde, lerTom, mod12, transporAcorde, usaBemol, type Tom } from "./teoria.ts";

export interface AcordeNaLinha { col: number; nome: string }
export type TipoBloco = "secao" | "letra" | "acordes" | "tab" | "info";

export interface BlocoCifra {
  tipo: TipoBloco;
  /** Letra (em "letra"), nome da seção (em "secao") ou o texto da linha (em "tab"/"info"). */
  texto: string;
  /** Acordes com a coluna onde ficam (em "letra" e "acordes"; numa seção com acordes na mesma linha também). */
  acordes: AcordeNaLinha[];
  /** Havia linha em branco antes. */
  espacoAntes: boolean;
}

export interface Cifra { blocos: BlocoCifra[]; tom: Tom | null; capotraste: number | null }

/** Palavras que podem aparecer numa linha de acordes sem fazer dela uma linha de letra. */
const RE_ENFEITE = /^(\||\|\||-+|\(?\d+x\)?|x\d+|\(|\)|\.+|%|:|\/|N\.?C\.?)$/i;
const RE_TAB = /^\s*[EADGBe]\s*[|:].*-{2,}|^\s*[|]?-{3,}.*\|/;

/** Tokens com a coluna em que começam. */
function tokens(linha: string): { col: number; t: string }[] {
  const r: { col: number; t: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha))) r.push({ col: m.index, t: m[0] });
  return r;
}

/** Acordes da linha se ela for só de acordes (com enfeites como "|" e "(2x)"); null se for letra. */
export function acordesDaLinha(linha: string): AcordeNaLinha[] | null {
  const ts = tokens(linha);
  if (!ts.length) return null;
  const acordes: AcordeNaLinha[] = [];
  for (const { col, t } of ts) {
    // "(A)" e "A)" de ponte/repetição
    const limpo = t.replace(/^\(|\)$/g, "");
    if (lerAcorde(limpo)) acordes.push({ col: col + (t.startsWith("(") ? 1 : 0), nome: limpo });
    else if (!RE_ENFEITE.test(t)) return null;
  }
  return acordes.length ? acordes : null;
}

export function lerCifra(texto: string): Cifra {
  const linhas = texto.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const blocos: BlocoCifra[] = [];
  let tom: Tom | null = null, capotraste: number | null = null;
  let espaco = false;
  let pendente: AcordeNaLinha[] | null = null;
  const fecharPendente = () => {
    if (pendente) { blocos.push({ tipo: "acordes", texto: "", acordes: pendente, espacoAntes: espaco }); espaco = false; pendente = null; }
  };
  for (const bruta of linhas) {
    const linha = bruta.replace(/\s+$/, "");
    if (!linha.trim()) { fecharPendente(); if (blocos.length) espaco = true; continue; }
    const mTom = /^\s*tom\s*:\s*([A-G][#b]?m?)\b/i.exec(linha);
    if (mTom) { tom = lerTom(mTom[1]) ?? tom; continue; }
    const mCapo = /capo(?:traste)?[^\d]*(\d+)/i.exec(linha);
    if (mCapo && linha.length < 60) { capotraste = Number(mCapo[1]); fecharPendente(); blocos.push({ tipo: "info", texto: linha.trim(), acordes: [], espacoAntes: espaco }); espaco = false; continue; }
    if (RE_TAB.test(linha)) { fecharPendente(); blocos.push({ tipo: "tab", texto: linha, acordes: [], espacoAntes: espaco }); espaco = false; continue; }
    const mSecao = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(linha);
    if (mSecao) {
      fecharPendente();
      const resto = mSecao[2];
      const deslocamento = linha.length - resto.length;
      const acordes = resto.trim() ? acordesDaLinha(resto)?.map(a => ({ ...a, col: a.col + deslocamento })) ?? [] : [];
      blocos.push({ tipo: "secao", texto: mSecao[1].trim(), acordes, espacoAntes: espaco });
      espaco = false;
      continue;
    }
    const acordes = acordesDaLinha(linha);
    if (acordes) { fecharPendente(); pendente = acordes; continue; }
    // letra (com os acordes da linha de cima, se havia)
    blocos.push({ tipo: "letra", texto: linha, acordes: pendente ?? [], espacoAntes: espaco });
    pendente = null;
    espaco = false;
  }
  fecharPendente();
  return { blocos, tom, capotraste };
}

/** Transpõe os acordes mantendo-os sobre a mesma sílaba (empurra o seguinte se o nome crescer). */
export function transporAcordes(acordes: AcordeNaLinha[], semitons: number, bemol?: boolean): AcordeNaLinha[] {
  let fim = -1;
  return acordes.map(a => {
    const nome = semitons ? transporAcorde(a.nome, semitons, bemol) : a.nome;
    const col = Math.max(a.col, fim + 1);
    fim = col + nome.length;
    return { col, nome };
  });
}

/** Linha de acordes como texto, com cada acorde na coluna dele. */
export function linhaDeAcordes(acordes: AcordeNaLinha[]): string {
  let s = "";
  for (const a of acordes) s = s.padEnd(a.col, " ") + a.nome + " ";
  return s.trimEnd();
}

/** Índices dos blocos que têm tempo na música (letra e linhas só de acordes, e seções com acordes). */
export const blocosComTempo = (c: Cifra) => c.blocos.flatMap((b, i) => (b.tipo === "letra" || b.tipo === "acordes" || (b.tipo === "secao" && b.acordes.length) ? [i] : []));

/** Cifra simples a partir dos acordes reconhecidos: quatro compassos por linha. */
export function cifraDosAcordes(segmentos: { inicio: number; fim: number; acorde: string }[], segundosPorCompasso: number): string {
  if (!segmentos.length) return "";
  const linhas: string[] = ["[Acordes reconhecidos no áudio]"];
  const dur = segmentos[segmentos.length - 1].fim;
  const compassos = Math.max(1, Math.ceil(dur / segundosPorCompasso));
  let linha: string[] = [];
  let anterior: string | null = null;
  for (let c = 0; c < compassos; c++) {
    const ini = c * segundosPorCompasso, fim = ini + segundosPorCompasso;
    // acorde que mais soa no compasso (ignora "N", sem acorde)
    const peso = new Map<string, number>();
    for (const s of segmentos) {
      const sob = Math.min(fim, s.fim) - Math.max(ini, s.inicio);
      if (sob > 0 && s.acorde !== "N") peso.set(s.acorde, (peso.get(s.acorde) ?? 0) + sob);
    }
    // compasso sem acorde repete o anterior (no começo da música, é pulado)
    const melhor: string | null = [...peso.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? anterior;
    if (!melhor) continue;
    anterior = melhor;
    linha.push(melhor.padEnd(6));
    if (linha.length === 4) { linhas.push(`| ${linha.join(" | ")} |`); linha = []; }
  }
  if (linha.length) linhas.push(`| ${linha.join(" | ")} |`);
  return linhas.join("\n");
}

/**
 * v11: sobe ou desce o tom da cifra escrita (o texto): os acordes (também os de seção, como "[Intro] G D") ficam
 * sobre a mesma sílaba e a linha "Tom:" acompanha. A letra, as tablaturas e o resto não mudam. Com o tom
 * conhecido (`tom` ou a linha "Tom:"), escreve com bemol ou sustenido como no tom novo.
 */
export function transporCifra(texto: string, semitons: number, tom?: Tom | null): string {
  if (!semitons) return texto;
  const original = lerCifra(texto).tom ?? tom ?? null;
  const bemol = original ? usaBemol(mod12(original.tonica + semitons), original.menor) : undefined;
  const nl = texto.includes("\r\n") ? "\r\n" : "\n";
  return texto.replace(/\r\n?/g, "\n").split("\n").map(linha => {
    const mTom = /^(\s*tom\s*:\s*)([A-G][#b]?m?)\b(.*)$/i.exec(linha);
    if (mTom) return `${mTom[1]}${transporAcorde(mTom[2], semitons, bemol)}${mTom[3]}`;
    if (RE_TAB.test(linha)) return linha;
    const mSecao = /^(\s*\[[^\]]+\]\s*)(.*)$/.exec(linha);
    if (mSecao) return mSecao[2].trim() && acordesDaLinha(mSecao[2]) ? mSecao[1] + transporLinha(mSecao[2], semitons, bemol) : linha;
    return acordesDaLinha(linha) ? transporLinha(linha, semitons, bemol) : linha;
  }).join(nl);
}

/** Transpõe uma linha só de acordes no lugar: enfeites ("|", "(2x)") ficam, e o que vem depois anda se o nome crescer. */
function transporLinha(linha: string, semitons: number, bemol?: boolean): string {
  let s = "", fim = -1;
  for (const { col, t } of tokens(linha)) {
    const m = /^(\(?)(.*?)(\)?)$/.exec(t)!;
    const novo = lerAcorde(m[2]) ? `${m[1]}${transporAcorde(m[2], semitons, bemol)}${m[3]}` : t;
    const c = Math.max(col, fim + 1);
    s = s.padEnd(c, " ") + novo;
    fim = c + novo.length;
  }
  return s;
}
