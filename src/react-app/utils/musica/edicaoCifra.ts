/**
 * Repertório v13 — mexer nos acordes direto na cifra (texto do Cifra Club): cada linha de letra tem a sua linha de
 * acordes em cima (que pode não existir ainda); linhas só de acordes (intro, solos) também valem. Pôr, tirar e mover
 * um acorde mexem só na linha de acordes, sem tocar na letra; a coluna do acorde é a sílaba onde ele cai.
 * Puro, testável em node.
 */
import { acordesDaLinha, transporAcordes, type AcordeNaLinha } from "./cifra.ts";

const RE_TAB = /^\s*[EADGBe]\s*[|:].*-{2,}|^\s*[|]?-{3,}.*\|/;

export interface LinhaEditavel {
  /** Linha da letra no texto (null numa linha só de acordes). */
  letra: number | null;
  /** Linha de acordes no texto (null se o verso ainda não tem acordes). */
  acordes: number | null;
  texto: string;
  itens: AcordeNaLinha[];
}

const ehEspecial = (l: string) => !l.trim() || /^\s*tom\s*:/i.test(l) || /^\s*\[[^\]]+\]/.test(l) || RE_TAB.test(l) || (/capo/i.test(l) && l.length < 60);

/** As linhas onde dá para mexer nos acordes, na ordem do texto. */
export function linhasEditaveis(texto: string): LinhaEditavel[] {
  const ls = texto.replace(/\r\n?/g, "\n").split("\n");
  const r: LinhaEditavel[] = [];
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i].replace(/\s+$/, "");
    if (ehEspecial(l)) continue;
    const ac = acordesDaLinha(l);
    if (ac) {
      const prox = ls[i + 1]?.replace(/\s+$/, "") ?? "";
      if (prox && !ehEspecial(prox) && !acordesDaLinha(prox)) {
        r.push({ letra: i + 1, acordes: i, texto: prox, itens: ac });
        i++;
      } else {
        r.push({ letra: null, acordes: i, texto: "", itens: ac });
      }
      continue;
    }
    r.push({ letra: i, acordes: null, texto: l, itens: [] });
  }
  return r;
}

/** Linha de acordes com cada um na sua coluna (empurrando quem encostaria). */
const escreverLinha = (itens: AcordeNaLinha[]) => {
  const ordenados = transporAcordes([...itens].sort((a, b) => a.col - b.col), 0);
  let s = "";
  for (const a of ordenados) s = s.padEnd(a.col, " ") + a.nome;
  return s;
};

/** Troca os acordes da linha `indice` (das editáveis) e devolve o texto novo. */
export function trocarAcordesDaLinha(texto: string, indice: number, itens: AcordeNaLinha[]): string {
  const ls = texto.replace(/\r\n?/g, "\n").split("\n");
  const alvo = linhasEditaveis(texto)[indice];
  if (!alvo) return texto;
  if (alvo.acordes !== null) {
    // verso que fica sem acorde perde a linha de acordes; linha só de acordes vazia some
    if (!itens.length) ls.splice(alvo.acordes, 1);
    else ls[alvo.acordes] = escreverLinha(itens);
  } else if (itens.length && alvo.letra !== null) {
    ls.splice(alvo.letra, 0, escreverLinha(itens));
  }
  return ls.join("\n");
}

/** Põe o acorde na coluna (troca o que começava ali). */
export function porAcorde(texto: string, indice: number, col: number, nome: string): string {
  const alvo = linhasEditaveis(texto)[indice];
  if (!alvo) return texto;
  return trocarAcordesDaLinha(texto, indice, [...alvo.itens.filter(a => a.col !== col), { col: Math.max(0, col), nome }]);
}

/** Tira o acorde que começa na coluna. */
export function tirarAcorde(texto: string, indice: number, col: number): string {
  const alvo = linhasEditaveis(texto)[indice];
  if (!alvo) return texto;
  return trocarAcordesDaLinha(texto, indice, alvo.itens.filter(a => a.col !== col));
}

/**
 * Move um acorde para outra coluna (e outra linha, se for o caso). Tirar uma linha só de acordes que ficou vazia muda
 * a contagem; por isso a linha de destino é procurada de novo depois de tirar.
 */
export function moverAcorde(texto: string, de: { linha: number; col: number }, para: { linha: number; col: number }): string {
  const linhas = linhasEditaveis(texto);
  const origem = linhas[de.linha];
  const item = origem?.itens.find(a => a.col === de.col);
  if (!item || !linhas[para.linha]) return texto;
  if (de.linha === para.linha) {
    return trocarAcordesDaLinha(texto, de.linha, [...origem.itens.filter(a => a !== item && a.col !== para.col), { col: Math.max(0, para.col), nome: item.nome }]);
  }
  // marca o destino pela linha da letra (ou dos acordes) no texto, que não muda de lugar relativo ao tirar a origem
  const destino = linhas[para.linha];
  const semOrigem = trocarAcordesDaLinha(texto, de.linha, origem.itens.filter(a => a !== item));
  const removeuLinha = origem.acordes !== null && origem.itens.length === 1;
  const ajuste = (n: number | null) => (n === null ? null : removeuLinha && origem.acordes! < n ? n - 1 : n);
  const ref = { letra: ajuste(destino.letra), acordes: ajuste(destino.acordes) };
  const novoIndice = linhasEditaveis(semOrigem).findIndex(l => (ref.letra !== null ? l.letra === ref.letra : l.acordes === ref.acordes));
  if (novoIndice < 0) return texto;
  return porAcorde(semOrigem, novoIndice, para.col, item.nome);
}
