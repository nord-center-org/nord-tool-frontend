/**
 * Mover linhas e colunas da planilha (como no Google Sheets: Alt+Shift+setas). O editor não tem isso pronto: aqui
 * ficam as contas puras — o bloco que gira e as referências das fórmulas que acompanham. Testável em node.
 */

export type Eixo = "linha" | "coluna";
export type Direcao = "antes" | "depois";

/** Faixa selecionada [inicio, fim] (inclusive) que vai trocar de lugar com a vizinha. */
export interface Movimento { eixo: Eixo; inicio: number; fim: number; direcao: Direcao }

/** Bloco afetado (a seleção mais a vizinha) e a nova posição da seleção; null se já está na borda. */
export function blocoDoMovimento(m: Movimento, total: number): { de: number; ate: number; novoInicio: number; novoFim: number } | null {
  if (m.direcao === "antes") {
    if (m.inicio <= 0) return null;
    return { de: m.inicio - 1, ate: m.fim, novoInicio: m.inicio - 1, novoFim: m.fim - 1 };
  }
  if (m.fim >= total - 1) return null;
  return { de: m.inicio, ate: m.fim + 1, novoInicio: m.inicio + 1, novoFim: m.fim + 1 };
}

/** Novo índice de cada linha/coluna depois do movimento (as fora do bloco não mudam). */
export function mapaDoMovimento(m: Movimento): (i: number) => number {
  return i => {
    if (m.direcao === "antes") {
      if (i === m.inicio - 1) return m.fim; // a vizinha de cima/esquerda vai para o fim do bloco
      if (i >= m.inicio && i <= m.fim) return i - 1;
      return i;
    }
    if (i === m.fim + 1) return m.inicio; // a vizinha de baixo/direita vai para o começo do bloco
    if (i >= m.inicio && i <= m.fim) return i + 1;
    return i;
  };
}

/** Gira o bloco (matriz de linhas) conforme o movimento: as células saem da posição velha e vão para a nova. */
export function girarBloco<T>(bloco: T[][], m: Movimento, de: number): T[][] {
  const mapa = mapaDoMovimento(m);
  if (m.eixo === "linha") {
    const novo: T[][] = new Array(bloco.length);
    bloco.forEach((linha, k) => { novo[mapa(de + k) - de] = linha; });
    return novo;
  }
  return bloco.map(linha => {
    const nova: T[] = new Array(linha.length);
    linha.forEach((cel, k) => { nova[mapa(de + k) - de] = cel; });
    return nova;
  });
}

// ---------------------------------------------------------------- referências nas fórmulas

const colunaParaNumero = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const numeroParaColuna = (n: number) => { let s = ""; n += 1; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };

/**
 * Ajusta as referências de uma fórmula (A1, $B$2, A1:C3) ao movimento, para continuarem apontando para as mesmas
 * células. Texto entre aspas e referências de outras páginas (Plan2!A1) ficam como estão.
 */
export function ajustarFormula(formula: string, m: Movimento): string {
  const mapa = mapaDoMovimento(m);
  const partes = formula.split(/("(?:[^"]|"")*")/); // não mexe dentro de texto
  const ref = (c1: string, c2: string, c: number, l: number) => `${c1}${numeroParaColuna(c)}${c2}${l + 1}`;
  return partes.map((p, i) => (i % 2 === 1 ? p : p
    // intervalos (A1:C3): o conjunto de linhas/colunas coberto, depois do movimento (vai do menor ao maior)
    .replace(/(!)?(\$?)([A-Z]{1,3})(\$?)(\d+):(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Z0-9(_])/g, (todo, outra, a1, ac, a2, al, b1, bc, b2, bl, pos, str) => {
      if (outra) return todo;
      const antes = str[pos - 1];
      if (antes && /[A-Za-z0-9_.]/.test(antes)) return todo;
      let c0 = colunaParaNumero(ac), c9 = colunaParaNumero(bc), l0 = Number(al) - 1, l9 = Number(bl) - 1;
      const novos = (x: number, y: number) => { const v: number[] = []; for (let k = Math.min(x, y); k <= Math.max(x, y); k++) v.push(mapa(k)); return [Math.min(...v), Math.max(...v)]; };
      if (m.eixo === "coluna") [c0, c9] = novos(c0, c9); else [l0, l9] = novos(l0, l9);
      // marca o intervalo pronto (\u0000) para a troca das referências soltas não mexer de novo
      return `\u0000${ref(a1, a2, c0, l0)}:${ref(b1, b2, c9, l9)}\u0000`;
    })
    .split("\u0000").map((q, k) => (k % 2 === 1 ? q : q.replace(/(!)?(\$?)([A-Z]{1,3})(\$?)(\d+)(?![A-Z0-9(_])/g, (todo, outra, c1, col, c2, lin, pos, str) => {
    if (outra) return todo; // referência de outra página
    // não é referência se vier colado a letra/número/ponto (nome de função, número decimal)
    const antes = str[pos - 1];
    if (antes && /[A-Za-z0-9_.]/.test(antes)) return todo;
    let c = colunaParaNumero(col), l = Number(lin) - 1;
    if (m.eixo === "coluna") c = mapa(c); else l = mapa(l);
    return ref(c1, c2, c, l);
  }))).join(""))).join("");
}
