/**
 * Apartamentos da planta e lados A/B da torre (regras puras, em metros).
 * O lado A é sempre o que tem a junta de dilatação; sem junta na prancha, a divisão sai do formato da torre
 * (corte no canto de dentro do L) e a pessoa pode inverter ou desenhar a divisão à mão.
 */
import { area, dentro, limites, type Apartamento, type DivisaoLados, type Lado, type Ponto, type Torre } from "./escadinha.ts";

/** Cores dos lados na planta (o texto "Lado A"/"Lado B" vai sempre junto). */
export const COR_LADO: Record<Lado, string> = { A: "#3b82f6", B: "#f59e0b" };

export function centroide(poly: Ponto[]): Ponto {
  const a = area(poly);
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/** > 0 se p está à esquerda da reta a→b. */
const lado = ([ax, ay]: Ponto, [bx, by]: Ponto, [px, py]: Ponto) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/** Parte do polígono de um lado da reta a→b (Sutherland–Hodgman). */
export function cortar(poly: Ponto[], a: Ponto, b: Ponto, esquerda: boolean): Ponto[] {
  const fora = (p: Ponto) => (esquerda ? lado(a, b, p) < 0 : lado(a, b, p) > 0);
  const saida: Ponto[] = [];
  for (let i = 0; i < poly.length; i++) {
    const atual = poly[i];
    const prox = poly[(i + 1) % poly.length];
    const fa = fora(atual), fp = fora(prox);
    if (!fa) saida.push(atual);
    if (fa !== fp) {
      const da = lado(a, b, atual), dp = lado(a, b, prox);
      const t = da / (da - dp);
      saida.push([atual[0] + (prox[0] - atual[0]) * t, atual[1] + (prox[1] - atual[1]) * t]);
    }
  }
  return saida;
}

/** Reta (horizontal ou vertical) atravessando a caixa da torre na coordenada dada. */
function reta(contorno: Ponto[], vertical: boolean, valor: number): [Ponto, Ponto] {
  const l = limites(contorno);
  const folga = 2;
  return vertical
    ? [[valor, l.minY - folga], [valor, l.maxY + folga]]
    : [[l.minX - folga, valor], [l.maxX + folga, valor]];
}

/**
 * Divisão automática pelo formato: em torre com canto de dentro (L, T, U) corta no canto que deixa as duas partes
 * mais parecidas; em torre retangular corta no meio, atravessando o lado comprido.
 */
export function divisaoAutomatica(contorno: Ponto[]): { a: Ponto; b: Ponto } {
  const ccw = area(contorno) > 0;
  const candidatos: [Ponto, Ponto][] = [];
  contorno.forEach((v, i) => {
    const ant = contorno[(i - 1 + contorno.length) % contorno.length];
    const prox = contorno[(i + 1) % contorno.length];
    const giro = (v[0] - ant[0]) * (prox[1] - v[1]) - (v[1] - ant[1]) * (prox[0] - v[0]);
    if (ccw ? giro < 0 : giro > 0) candidatos.push(reta(contorno, true, v[0]), reta(contorno, false, v[1]));
  });
  if (!candidatos.length) {
    const l = limites(contorno);
    const vertical = l.largura >= l.profundidade;
    const [a, b] = reta(contorno, vertical, vertical ? (l.minX + l.maxX) / 2 : (l.minY + l.maxY) / 2);
    return { a, b };
  }
  let melhor = candidatos[0];
  let nota = -1;
  for (const [a, b] of candidatos) {
    const e = Math.abs(area(cortar(contorno, a, b, true)));
    const d = Math.abs(area(cortar(contorno, a, b, false)));
    const n = Math.min(e, d) / Math.max(e, d, 1e-9);
    if (n > nota) { nota = n; melhor = [a, b]; }
  }
  return { a: melhor[0], b: melhor[1] };
}

/** Lado A = o que tem a junta; sem junta, a parte da esquerda/de cima fica como A (a pessoa pode inverter). */
export function definirLados(contorno: Ponto[], junta: Ponto | null, manual?: { a: Ponto; b: Ponto }): DivisaoLados {
  const { a, b } = manual ?? divisaoAutomatica(contorno);
  if (junta) return { a, b, aEsquerda: lado(a, b, junta) > 0, fonte: manual ? "manual" : "junta" };
  const ce = centroide(cortar(contorno, a, b, true));
  const cd = centroide(cortar(contorno, a, b, false));
  // "Primeiro" lado na leitura da planta: mais à esquerda; empatando, mais acima.
  const esquerdaPrimeiro = Math.abs(ce[0] - cd[0]) > 0.5 ? ce[0] < cd[0] : ce[1] > cd[1];
  return { a, b, aEsquerda: esquerdaPrimeiro, fonte: manual ? "manual" : "automatica" };
}

export function ladoDoPonto(p: Ponto, d: DivisaoLados): Lado {
  return (lado(d.a, d.b, p) > 0) === d.aEsquerda ? "A" : "B";
}

/** Atualiza o lado de cada apartamento pela divisão (os escolhidos à mão ficam como estão). */
export function atribuirLados(apartamentos: Apartamento[], d: DivisaoLados): Apartamento[] {
  return apartamentos.map(ap => (ap.ladoManual ? ap : { ...ap, lado: ladoDoPonto(centroide(ap.contorno), d) }));
}

export const inverterLados = (d: DivisaoLados): DivisaoLados => ({ ...d, aEsquerda: !d.aEsquerda, fonte: d.fonte === "manual" ? "manual" : d.fonte });

/** Metades da torre já recortadas (para pintar e rotular "Lado A" / "Lado B"). */
export function metades(contorno: Ponto[], d: DivisaoLados): Record<Lado, Ponto[]> {
  const esq = cortar(contorno, d.a, d.b, true);
  const dir = cortar(contorno, d.a, d.b, false);
  return d.aEsquerda ? { A: esq, B: dir } : { A: dir, B: esq };
}

/** "07", "AP 07", "APTO 7", "FINAL 07" viram "Apto 07"; outros textos não são número de apartamento. */
export function nomeDoTexto(texto: string): string | null {
  const m = texto.trim().toUpperCase().match(/^(?:AP(?:TO)?\.?|FINAL|UNID(?:ADE)?\.?)?\s*(\d{1,3})$/);
  return m ? `Apto ${m[1].padStart(2, "0")}` : null;
}

/** A junta de dilatação escrita na prancha ("JUNTA DE DILATAÇÃO", "J.D.", "JD"). */
export function pontoDaJunta(textos: { texto: string; p: Ponto }[]): Ponto | null {
  const achado = textos.find(t => /JUNTA|\bJ\.\s?D\.?|\bJD\b/i.test(t.texto));
  return achado ? achado.p : null;
}

/**
 * Apartamentos a partir das células fechadas achadas dentro da torre: as pequenas demais (shafts, escada) ficam de fora;
 * o nome vem do número escrito dentro da célula ou, sem número, da ordem de leitura (de cima para baixo, da esquerda para a direita).
 */
export function montarApartamentos(contorno: Ponto[], celulas: Ponto[][], textos: { texto: string; p: Ponto }[]): Apartamento[] {
  const total = Math.abs(area(contorno));
  const minimo = total * 0.015;
  const validas = celulas
    .filter(c => c.length >= 3 && Math.abs(area(c)) >= minimo && Math.abs(area(c)) <= total * 0.6)
    .map(c => ({ c, centro: centroide(c) }))
    .sort((x, y) => (Math.abs(x.centro[1] - y.centro[1]) > 2 ? y.centro[1] - x.centro[1] : x.centro[0] - y.centro[0]));
  const usados = new Set<string>();
  return validas.map(({ c }, i) => {
    const texto = textos.map(t => ({ nome: nomeDoTexto(t.texto), p: t.p })).find(t => t.nome && !usados.has(t.nome) && dentro(t.p, c));
    const nome = texto?.nome ?? `Apto ${String(i + 1).padStart(2, "0")}`;
    usados.add(nome);
    return { id: `ap-${i + 1}`, nome, contorno: c, lado: "A" as Lado };
  });
}

/** Apartamentos de exemplo (sem prancha): malha de ~8 m dentro do contorno, em duas fileiras por ala. */
export function apartamentosPadrao(contorno: Ponto[], tamanho = 8): Apartamento[] {
  const l = limites(contorno);
  const nx = Math.max(1, Math.round(l.largura / tamanho));
  const ny = Math.max(1, Math.round(l.profundidade / (tamanho * 1.2)));
  const w = l.largura / nx, h = l.profundidade / ny;
  const lista: Apartamento[] = [];
  for (let j = ny - 1; j >= 0; j--) {
    for (let i = 0; i < nx; i++) {
      const x0 = l.minX + i * w, y0 = l.minY + j * h;
      const caixa: Ponto[] = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
      const partes = caixa.map(p => dentro([p[0] + (p[0] > x0 ? -0.1 : 0.1), p[1] + (p[1] > y0 ? -0.1 : 0.1)], contorno));
      if (partes.every(Boolean)) {
        const n = lista.length + 1;
        const r = (v: number) => Math.round(v * 100) / 100;
        lista.push({ id: `ap-${n}`, nome: `Apto ${String(n).padStart(2, "0")}`, contorno: caixa.map(([x, y]) => [r(x), r(y)] as Ponto), lado: "A" });
      }
    }
  }
  return lista;
}

/** Garante apartamentos e lados numa torre (exemplo ou torre antiga sem essas informações). */
export function prepararTorre(torre: Torre): Torre {
  const lados = torre.lados ?? definirLados(torre.contorno, null);
  const apartamentos = torre.apartamentos ?? apartamentosPadrao(torre.contorno);
  return { ...torre, lados, apartamentos: atribuirLados(apartamentos, lados) };
}

/** Retângulo (desenhado na planta) como apartamento novo. */
export function apartamentoRetangulo(p1: Ponto, p2: Ponto, existentes: Apartamento[], d: DivisaoLados | undefined): Apartamento | null {
  const [x0, x1] = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])];
  const [y0, y1] = [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])];
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const r = (v: number) => Math.round(v * 100) / 100;
  const contorno: Ponto[] = [[r(x0), r(y0)], [r(x1), r(y0)], [r(x1), r(y1)], [r(x0), r(y1)]];
  const numeros = existentes.map(a => Number(a.nome.match(/\d+/)?.[0] ?? 0));
  const n = Math.max(0, ...numeros) + 1;
  const ap: Apartamento = { id: `ap-${Date.now().toString(36)}`, nome: `Apto ${String(n).padStart(2, "0")}`, contorno, lado: "A" };
  return d ? { ...ap, lado: ladoDoPonto(centroide(contorno), d) } : ap;
}

/** Divisão desenhada à mão (dois cliques), endireitada para horizontal/vertical quando quase alinhada. */
export function divisaoManual(contorno: Ponto[], p1: Ponto, p2: Ponto, anterior?: DivisaoLados): DivisaoLados | null {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  if (Math.hypot(dx, dy) < 1) return null;
  let a = p1, b = p2;
  if (Math.abs(dx) > Math.abs(dy) * 4) { const y = (p1[1] + p2[1]) / 2; [a, b] = reta(contorno, false, y); }
  else if (Math.abs(dy) > Math.abs(dx) * 4) { const x = (p1[0] + p2[0]) / 2; [a, b] = reta(contorno, true, x); }
  const nova = definirLados(contorno, null, { a, b });
  // Mantém o lado A onde ele estava (pelo centro da metade A anterior), se houver.
  if (anterior) {
    const centroA = centroide(metades(contorno, anterior).A);
    return { ...nova, aEsquerda: lado(a, b, centroA) > 0 };
  }
  return nova;
}
