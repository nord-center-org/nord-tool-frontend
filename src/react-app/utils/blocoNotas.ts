/**
 * Bloco de notas (Mapeamentos): o desenho de cada página e a geometria das ferramentas (caneta com pressão, marca-texto,
 * borracha de traço e parcial, formas, texto, imagem e laço). Sem React nem DOM aqui (testável em node).
 *
 * Coordenadas em px da página a 96 dpi (A4 em pé = 794 × 1123), independentes do zoom da tela.
 */

export type Fundo = "BRANCO" | "PAUTADO" | "QUADRICULADO" | "PONTILHADO" | "PDF";
export type TipoForma = "linha" | "seta" | "ret" | "elipse";

/** Traço de caneta ou marca-texto. p = [x, y, pressão, x, y, pressão, …] (pressão 0–1). */
export interface Traco { t: "tr"; id: string; c: string; w: number; marca?: boolean; p: number[] }
export interface Forma { t: "fo"; id: string; f: TipoForma; c: string; w: number; x1: number; y1: number; x2: number; y2: number }
export interface Texto { t: "tx"; id: string; x: number; y: number; w: number; s: number; c: string; txt: string }
export interface Imagem { t: "im"; id: string; img: number; x: number; y: number; w: number; h: number }
export type Item = Traco | Forma | Texto | Imagem;

export interface Conteudo { v: 1; itens: Item[] }
export interface Caixa { x: number; y: number; w: number; h: number }
export interface Ponto { x: number; y: number }

export const A4 = { largura: 794, altura: 1123 } as const;
export const CORES = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#ffffff"] as const;
export const CORES_MARCA = ["#facc15", "#4ade80", "#60a5fa", "#f472b6", "#fb923c"] as const;
export const ESPESSURAS = [1.5, 3, 5, 8, 14] as const;
export const ROTULO_FUNDO: Record<Exclude<Fundo, "PDF">, string> = {
  BRANCO: "Em branco", PAUTADO: "Pautado", QUADRICULADO: "Quadriculado", PONTILHADO: "Pontilhado",
};
export const CORES_CAPA = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#334155", "#ca8a04"] as const;
/** Opacidade do marca-texto. */
export const ALFA_MARCA = 0.35;

const COR = /^#[0-9a-fA-F]{6}$/;
const num = (v: unknown, padrao = 0) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const cor = (v: unknown, padrao = "#111827") => (typeof v === "string" && COR.test(v) ? v : padrao);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

let contador = 0;
/** Id curto e único na página (basta não repetir dentro do mesmo desenho). */
export function novoId(): string {
  contador = (contador + 1) % 1_000_000;
  return `${Date.now().toString(36)}${contador.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// ---------------------------------------------------------------- leitura e gravação

/** Lê o JSON salvo, descartando o que não for reconhecido (página antiga ou corrompida nunca quebra o editor). */
export function lerConteudo(bruto: unknown): Conteudo {
  const itens: Item[] = [];
  const lista = bruto && typeof bruto === "object" && Array.isArray((bruto as { itens?: unknown }).itens) ? (bruto as { itens: unknown[] }).itens : [];
  for (const b of lista) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id.slice(0, 40) : novoId();
    if (o.t === "tr" && Array.isArray(o.p) && o.p.length >= 3) {
      const p = o.p.slice(0, o.p.length - (o.p.length % 3)).map(v => num(v));
      itens.push({ t: "tr", id, c: cor(o.c), w: Math.min(60, Math.max(0.5, num(o.w, 3))), ...(o.marca === true ? { marca: true } : {}), p });
    } else if (o.t === "fo" && ["linha", "seta", "ret", "elipse"].includes(o.f as string)) {
      itens.push({ t: "fo", id, f: o.f as TipoForma, c: cor(o.c), w: Math.min(60, Math.max(0.5, num(o.w, 3))), x1: num(o.x1), y1: num(o.y1), x2: num(o.x2), y2: num(o.y2) });
    } else if (o.t === "tx" && typeof o.txt === "string") {
      itens.push({ t: "tx", id, x: num(o.x), y: num(o.y), w: Math.max(40, num(o.w, 300)), s: Math.min(96, Math.max(8, num(o.s, 18))), c: cor(o.c), txt: str(o.txt, 5000) });
    } else if (o.t === "im" && typeof o.img === "number" && o.img > 0) {
      itens.push({ t: "im", id, img: o.img, x: num(o.x), y: num(o.y), w: Math.max(10, num(o.w, 100)), h: Math.max(10, num(o.h, 100)) });
    }
  }
  return { v: 1, itens };
}

/** Arredonda as coordenadas para o JSON ficar pequeno (0,1 px é invisível). */
export function compactar(itens: Item[]): Conteudo {
  return {
    v: 1,
    itens: itens.map(i => {
      if (i.t === "tr") return { ...i, w: r1(i.w), p: i.p.map((v, k) => (k % 3 === 2 ? r2(v) : r1(v))) };
      if (i.t === "fo") return { ...i, w: r1(i.w), x1: r1(i.x1), y1: r1(i.y1), x2: r1(i.x2), y2: r1(i.y2) };
      if (i.t === "tx") return { ...i, x: r1(i.x), y: r1(i.y), w: r1(i.w) };
      return { ...i, x: r1(i.x), y: r1(i.y), w: r1(i.w), h: r1(i.h) };
    }),
  };
}

// ---------------------------------------------------------------- caneta

/** Pressão útil: mouse e dedo mandam 0 ou 0,5 fixos; a caneta (stylus) manda a real. */
export function pressao(pointerType: string, valor: number): number {
  if (pointerType !== "pen") return 0.5;
  return Math.min(1, Math.max(0.05, valor || 0.5));
}

/** Espessura num ponto conforme a pressão: 0,5 (mouse e dedo) dá a espessura escolhida; de 35% a 130% dela. */
export const larguraNaPressao = (w: number, pr: number) => w * Math.min(1.3, 0.35 + 1.3 * Math.min(1, Math.max(0, pr)));

/**
 * Acrescenta um ponto ao traço, pulando os que ficam a menos de `minimo` px do último (a mão treme e o desenho fica
 * pesado à toa) e suavizando de leve com o anterior.
 */
export function acrescentarPonto(p: number[], x: number, y: number, pr: number, minimo = 0.8): number[] {
  const n = p.length;
  if (n >= 3) {
    const dx = x - p[n - 3], dy = y - p[n - 2];
    if (dx * dx + dy * dy < minimo * minimo) return p;
    // Média com o ponto anterior: tira o serrilhado sem atrasar o traço.
    const sx = p[n - 3] * 0.25 + x * 0.75, sy = p[n - 2] * 0.25 + y * 0.75;
    return [...p, sx, sy, pr];
  }
  return [...p, x, y, pr];
}

/** Pontos [x,y,pr] como objetos (ajuda nos cálculos). */
export function pontos(p: number[]): Array<{ x: number; y: number; pr: number }> {
  const r: Array<{ x: number; y: number; pr: number }> = [];
  for (let k = 0; k + 2 < p.length; k += 3) r.push({ x: p[k], y: p[k + 1], pr: p[k + 2] });
  return r;
}

// ---------------------------------------------------------------- geometria

export function distanciaAoSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Caixa que envolve o item (com a espessura do traço). */
export function caixaDoItem(i: Item): Caixa {
  if (i.t === "tr") {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k + 2 < i.p.length; k += 3) {
      x0 = Math.min(x0, i.p[k]); y0 = Math.min(y0, i.p[k + 1]); x1 = Math.max(x1, i.p[k]); y1 = Math.max(y1, i.p[k + 1]);
    }
    const m = i.w / 2;
    return { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };
  }
  if (i.t === "fo") {
    const m = i.w / 2 + (i.f === "seta" ? i.w * 3 : 0);
    return { x: Math.min(i.x1, i.x2) - m, y: Math.min(i.y1, i.y2) - m, w: Math.abs(i.x2 - i.x1) + 2 * m, h: Math.abs(i.y2 - i.y1) + 2 * m };
  }
  if (i.t === "tx") return { x: i.x, y: i.y, w: i.w, h: alturaTexto(i) };
  return { x: i.x, y: i.y, w: i.w, h: i.h };
}

export function uniaoCaixas(caixas: Caixa[]): Caixa | null {
  if (!caixas.length) return null;
  const x0 = Math.min(...caixas.map(c => c.x)), y0 = Math.min(...caixas.map(c => c.y));
  const x1 = Math.max(...caixas.map(c => c.x + c.w)), y1 = Math.max(...caixas.map(c => c.y + c.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const dentroDaCaixa = (x: number, y: number, c: Caixa, folga = 0) =>
  x >= c.x - folga && x <= c.x + c.w + folga && y >= c.y - folga && y <= c.y + c.h + folga;

/** Linhas do texto quebradas na largura da caixa (aproximação de 0,55 da altura da letra por caractere). */
export function linhasDoTexto(i: Pick<Texto, "txt" | "w" | "s">): string[] {
  const porLinha = Math.max(1, Math.floor(i.w / (i.s * 0.55)));
  const saida: string[] = [];
  for (const paragrafo of i.txt.split("\n")) {
    if (!paragrafo) { saida.push(""); continue; }
    let linha = "";
    for (const palavra of paragrafo.split(" ")) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (tentativa.length <= porLinha || !linha) linha = tentativa;
      else { saida.push(linha); linha = palavra; }
    }
    saida.push(linha);
  }
  return saida;
}

export const alturaTexto = (i: Pick<Texto, "txt" | "w" | "s">) => Math.max(1, linhasDoTexto(i).length) * i.s * 1.3;

/** O ponto toca o item? (folga = raio da borracha ou do dedo) */
export function tocaItem(i: Item, x: number, y: number, folga: number): boolean {
  if (i.t === "tr") {
    const raio = folga + i.w / 2;
    if (!dentroDaCaixa(x, y, caixaDoItem(i), folga)) return false;
    if (i.p.length < 6) return Math.hypot(x - i.p[0], y - i.p[1]) <= raio;
    for (let k = 0; k + 5 < i.p.length; k += 3) {
      if (distanciaAoSegmento(x, y, i.p[k], i.p[k + 1], i.p[k + 3], i.p[k + 4]) <= raio) return true;
    }
    return false;
  }
  if (i.t === "fo") {
    const raio = folga + i.w / 2;
    if (i.f === "linha" || i.f === "seta") return distanciaAoSegmento(x, y, i.x1, i.y1, i.x2, i.y2) <= raio;
    const x0 = Math.min(i.x1, i.x2), x1 = Math.max(i.x1, i.x2), y0 = Math.min(i.y1, i.y2), y1 = Math.max(i.y1, i.y2);
    if (i.f === "ret") {
      return distanciaAoSegmento(x, y, x0, y0, x1, y0) <= raio || distanciaAoSegmento(x, y, x1, y0, x1, y1) <= raio
        || distanciaAoSegmento(x, y, x1, y1, x0, y1) <= raio || distanciaAoSegmento(x, y, x0, y1, x0, y0) <= raio;
    }
    // elipse: perto da borda
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2);
    const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return Math.abs(d - 1) * Math.min(rx, ry) <= raio;
  }
  return dentroDaCaixa(x, y, caixaDoItem(i), folga);
}

/** Item mais de cima no ponto (o último desenhado), ou null. */
export function itemNoPonto(itens: Item[], x: number, y: number, folga = 4): Item | null {
  for (let k = itens.length - 1; k >= 0; k--) if (tocaItem(itens[k], x, y, folga)) return itens[k];
  return null;
}

// ---------------------------------------------------------------- borracha

/** Borracha de traço: tira os itens inteiros que a borracha tocou. */
export function apagarItens(itens: Item[], x: number, y: number, raio: number): Item[] {
  const r = itens.filter(i => !tocaItem(i, x, y, raio));
  return r.length === itens.length ? itens : r;
}

/**
 * Borracha parcial: nos traços, tira só os pontos dentro do raio e divide o traço onde ele foi cortado (como apagar a
 * lápis). Formas, textos e imagens tocados saem inteiros.
 */
export function apagarParcial(itens: Item[], x: number, y: number, raio: number): Item[] {
  let mudou = false;
  const saida: Item[] = [];
  for (const i of itens) {
    if (i.t !== "tr") {
      if (tocaItem(i, x, y, raio)) mudou = true;
      else saida.push(i);
      continue;
    }
    if (!tocaItem(i, x, y, raio)) { saida.push(i); continue; }
    mudou = true;
    const limite = raio + i.w / 2;
    // Traço rápido tem pontos longe uns dos outros: preenche o trecho para a borracha cortar no meio dele.
    const denso = adensar(i.p, Math.max(0.5, limite / 2));
    let atual: number[] = [];
    const pedacos: number[][] = [];
    for (let k = 0; k + 2 < denso.length; k += 3) {
      if (Math.hypot(denso[k] - x, denso[k + 1] - y) <= limite) {
        if (atual.length) pedacos.push(atual);
        atual = [];
      } else {
        atual.push(denso[k], denso[k + 1], denso[k + 2]);
      }
    }
    if (atual.length) pedacos.push(atual);
    // Um ponto solto na beira do corte viraria um pingo: só fica se o traço era um ponto só.
    const uteis = i.p.length === 3 ? pedacos : pedacos.filter(p => p.length >= 6);
    uteis.forEach((p, n) => saida.push({ ...i, id: n === 0 ? i.id : novoId(), p }));
  }
  return mudou ? saida : itens;
}

/** Pontos extras ao longo de cada trecho para que nenhum fique maior que `passo` (pressão interpolada). */
export function adensar(p: number[], passo: number): number[] {
  if (p.length < 6) return p;
  const r: number[] = [p[0], p[1], p[2]];
  for (let k = 3; k + 2 < p.length; k += 3) {
    const ax = p[k - 3], ay = p[k - 2], ap = p[k - 1], bx = p[k], by = p[k + 1], bp = p[k + 2];
    const partes = Math.min(500, Math.ceil(Math.hypot(bx - ax, by - ay) / passo));
    for (let n = 1; n < partes; n++) {
      const t = n / partes;
      r.push(ax + (bx - ax) * t, ay + (by - ay) * t, ap + (bp - ap) * t);
    }
    r.push(bx, by, bp);
  }
  return r;
}

// ---------------------------------------------------------------- laço e seleção

/** Ponto dentro do polígono (regra par-ímpar). */
export function dentroDoPoligono(x: number, y: number, poligono: Ponto[]): boolean {
  let dentro = false;
  for (let a = 0, b = poligono.length - 1; a < poligono.length; b = a++) {
    const pa = poligono[a], pb = poligono[b];
    if ((pa.y > y) !== (pb.y > y) && x < ((pb.x - pa.x) * (y - pa.y)) / (pb.y - pa.y) + pa.x) dentro = !dentro;
  }
  return dentro;
}

/** Itens pegos pelo laço: mais da metade dos pontos (ou o centro, para formas, textos e imagens) dentro dele. */
export function itensNoLaco(itens: Item[], laco: Ponto[]): string[] {
  if (laco.length < 3) return [];
  return itens.filter(i => {
    if (i.t === "tr") {
      const ps = pontos(i.p);
      const dentro = ps.filter(p => dentroDoPoligono(p.x, p.y, laco)).length;
      return dentro * 2 > ps.length;
    }
    const c = caixaDoItem(i);
    return dentroDoPoligono(c.x + c.w / 2, c.y + c.h / 2, laco);
  }).map(i => i.id);
}

/** Move os itens escolhidos. */
export function moverItens(itens: Item[], ids: Set<string>, dx: number, dy: number): Item[] {
  return itens.map(i => {
    if (!ids.has(i.id)) return i;
    if (i.t === "tr") return { ...i, p: i.p.map((v, k) => (k % 3 === 0 ? v + dx : k % 3 === 1 ? v + dy : v)) };
    if (i.t === "fo") return { ...i, x1: i.x1 + dx, y1: i.y1 + dy, x2: i.x2 + dx, y2: i.y2 + dy };
    return { ...i, x: i.x + dx, y: i.y + dy };
  });
}

/** Redimensiona os itens escolhidos a partir do canto de cima à esquerda da seleção (fator ≥ 0,05). */
export function escalarItens(itens: Item[], ids: Set<string>, origem: Ponto, fator: number): Item[] {
  const f = Math.max(0.05, fator);
  const ex = (v: number) => origem.x + (v - origem.x) * f, ey = (v: number) => origem.y + (v - origem.y) * f;
  return itens.map(i => {
    if (!ids.has(i.id)) return i;
    if (i.t === "tr") return { ...i, w: Math.max(0.5, i.w * f), p: i.p.map((v, k) => (k % 3 === 0 ? ex(v) : k % 3 === 1 ? ey(v) : v)) };
    if (i.t === "fo") return { ...i, w: Math.max(0.5, i.w * f), x1: ex(i.x1), y1: ey(i.y1), x2: ex(i.x2), y2: ey(i.y2) };
    if (i.t === "tx") return { ...i, x: ex(i.x), y: ey(i.y), w: Math.max(40, i.w * f), s: Math.min(96, Math.max(8, i.s * f)) };
    return { ...i, x: ex(i.x), y: ey(i.y), w: Math.max(10, i.w * f), h: Math.max(10, i.h * f) };
  });
}

/** Troca a cor dos itens escolhidos (imagens ficam como estão). */
export function pintarItens(itens: Item[], ids: Set<string>, c: string): Item[] {
  return itens.map(i => (ids.has(i.id) && i.t !== "im" ? { ...i, c } : i));
}

/** Copia os itens escolhidos com ids novos, um pouco deslocados. */
export function duplicarItens(itens: Item[], ids: Set<string>, deslocamento = 16): { itens: Item[]; novos: string[] } {
  const copias = moverItens(itens.filter(i => ids.has(i.id)), ids, deslocamento, deslocamento).map(i => ({ ...i, id: novoId() }));
  return { itens: [...itens, ...copias], novos: copias.map(i => i.id) };
}

// ---------------------------------------------------------------- formas

/** Forma a partir do arrasto; com `reta`, linha/seta em 45° e retângulo/elipse quadrados (Shift ou toque longo). */
export function formaDoArrasto(f: TipoForma, c: string, w: number, a: Ponto, b: Ponto, reta = false): Forma {
  let x2 = b.x, y2 = b.y;
  if (reta) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (f === "linha" || f === "seta") {
      const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
      const d = Math.hypot(dx, dy);
      x2 = a.x + Math.cos(ang) * d; y2 = a.y + Math.sin(ang) * d;
    } else {
      const lado = Math.max(Math.abs(dx), Math.abs(dy));
      x2 = a.x + Math.sign(dx || 1) * lado; y2 = a.y + Math.sign(dy || 1) * lado;
    }
  }
  return { t: "fo", id: novoId(), f, c, w, x1: a.x, y1: a.y, x2, y2 };
}

/** As duas pontas da cabeça da seta (em torno de (x2, y2)). */
export function pontasDaSeta(f: Pick<Forma, "x1" | "y1" | "x2" | "y2" | "w">): [Ponto, Ponto] {
  const ang = Math.atan2(f.y2 - f.y1, f.x2 - f.x1);
  const tam = Math.max(10, f.w * 4);
  return [
    { x: f.x2 - tam * Math.cos(ang - Math.PI / 7), y: f.y2 - tam * Math.sin(ang - Math.PI / 7) },
    { x: f.x2 - tam * Math.cos(ang + Math.PI / 7), y: f.y2 - tam * Math.sin(ang + Math.PI / 7) },
  ];
}

// ---------------------------------------------------------------- fundo da página

export interface LinhaFundo { x1: number; y1: number; x2: number; y2: number; forte?: boolean }

/** Linhas do papel (pautado: linhas a cada 32 px e margem; quadriculado: grade de 24 px). */
export function linhasDoFundo(fundo: Fundo, largura: number, altura: number): LinhaFundo[] {
  const r: LinhaFundo[] = [];
  if (fundo === "PAUTADO") {
    for (let y = 96; y < altura - 16; y += 32) r.push({ x1: 0, y1: y, x2: largura, y2: y });
    r.push({ x1: 80, y1: 0, x2: 80, y2: altura, forte: true });
  } else if (fundo === "QUADRICULADO") {
    for (let x = 24; x < largura; x += 24) r.push({ x1: x, y1: 0, x2: x, y2: altura });
    for (let y = 24; y < altura; y += 24) r.push({ x1: 0, y1: y, x2: largura, y2: y });
  }
  return r;
}

/** Pontos do papel pontilhado (a cada 24 px). */
export function pontosDoFundo(fundo: Fundo, largura: number, altura: number): Ponto[] {
  if (fundo !== "PONTILHADO") return [];
  const r: Ponto[] = [];
  for (let y = 24; y < altura; y += 24) for (let x = 24; x < largura; x += 24) r.push({ x, y });
  return r;
}

// ---------------------------------------------------------------- histórico

export interface Passo { pagina: number; antes: Item[]; depois: Item[] }

/** Guarda o passo (até 100); fazer algo novo apaga o que dava para refazer. */
export function registrar(desfazer: Passo[], passo: Passo, limite = 100): Passo[] {
  const r = [...desfazer, passo];
  return r.length > limite ? r.slice(r.length - limite) : r;
}

// ---------------------------------------------------------------- tamanhos e nomes

/** Tamanho da página do PDF importado: pontos do PDF (72 dpi) para px da página (96 dpi), no máximo 4000 px. */
export function tamanhoDaPaginaPdf(larguraPt: number, alturaPt: number): { largura: number; altura: number } {
  const f = Math.min(96 / 72, 4000 / Math.max(larguraPt, alturaPt));
  return { largura: Math.max(100, Math.round(larguraPt * f)), altura: Math.max(100, Math.round(alturaPt * f)) };
}

/** Nome do PDF exportado: caderno-obra-norte.pdf */
export function nomeArquivoCaderno(titulo: string): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "caderno";
  return `caderno-${base}.pdf`;
}

/** Título do caderno a partir do PDF importado: "Projeto torre B.pdf" → "Projeto torre B". */
export const tituloDoPdf = (nomeArquivo: string) => (nomeArquivo.replace(/\.pdf$/i, "").trim() || "PDF importado").slice(0, 120);
