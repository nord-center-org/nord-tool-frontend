/**
 * Cômodos e apartamentos a partir das paredes reais da 1ª fiada (o mesmo caminho do protótipo do Juan: o pavimento
 * isolado, montado pelas paredes do projeto, antes de virar 3D). A 1ª fiada não tem janela (o peitoril continua a parede),
 * então todo vão nela é porta: vão entre trechos da mesma parede, ou ponta de parede de frente para outra parede.
 * Fechando os vãos, cada região livre é um cômodo; os cômodos ligados por porta, sem passar pelo hall, são um apartamento.
 * Tudo em metros, y para cima, sem DOM (testável em node).
 */
import {
  area, limites, ortogonalizar, simplificar, type AberturaPlanta, type Apartamento, type ComodoPlanta, type Lado, type ParedeReal, type Ponto, type Torre,
} from "./escadinha.ts";
import { apartamentosPadrao, atribuirLados, cortar, definirLados } from "./escadinhaApto.ts";
import { tracarBorda } from "./escadinhaPlanta.ts";

export type { TipoComodo } from "./escadinha.ts";
type Comodo = ComodoPlanta;
type Abertura = AberturaPlanta;

export interface LeituraComodos {
  comodos: ComodoPlanta[];
  aberturas: AberturaPlanta[];
  apartamentos: Apartamento[];
}

const PX = 0.05;
const VAO_MIN = 0.55;
const VAO_MAX = 1.1;
const horizontal = (p: ParedeReal) => Math.abs(p.a[1] - p.b[1]) < 0.02;

/** Vãos entre trechos alinhados da mesma parede (mesma linha e espessura) e de ponta de parede até a parede da frente. */
export function aberturasDasParedes(paredes: ParedeReal[]): Abertura[] {
  const saida: Abertura[] = [];
  const linhas = new Map<string, { ini: number; fim: number; fixo: number; h: boolean }[]>();
  for (const p of paredes) {
    const h = horizontal(p);
    const fixo = h ? p.a[1] : p.a[0];
    const [ini, fim] = h ? [Math.min(p.a[0], p.b[0]), Math.max(p.a[0], p.b[0])] : [Math.min(p.a[1], p.b[1]), Math.max(p.a[1], p.b[1])];
    const k = `${h ? "h" : "v"}|${Math.round(fixo * 50)}`;
    const l = linhas.get(k) ?? [];
    l.push({ ini, fim, fixo, h });
    linhas.set(k, l);
  }
  /** Outra parede ocupa o meio do vão? (então não é porta, é encontro de paredes desenhado em pedaços) */
  const ocupado = (c: Ponto) => paredes.some(p => {
    const l = limites([p.a, p.b]);
    const e = p.esp / 2 + 0.02;
    return c[0] >= l.minX - e && c[0] <= l.maxX + e && c[1] >= l.minY - e && c[1] <= l.maxY + e;
  });
  for (const trechos of linhas.values()) {
    trechos.sort((x, y) => x.ini - y.ini);
    let fim = trechos[0].fim;
    for (const t of trechos.slice(1)) {
      const vao = t.ini - fim;
      if (vao >= VAO_MIN && vao <= VAO_MAX) {
        const a: Ponto = t.h ? [fim, t.fixo] : [t.fixo, fim];
        const b: Ponto = t.h ? [t.ini, t.fixo] : [t.fixo, t.ini];
        if (!ocupado([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) saida.push({ a, b, largura: vao });
      }
      fim = Math.max(fim, t.fim);
    }
  }
  // Ponta livre de parede olhando para uma parede perpendicular a até 1,2 m: porta encostada no canto.
  const pontas: { p: Ponto; dir: Ponto; esp: number }[] = [];
  for (const p of paredes) {
    const h = horizontal(p);
    const [lo, hi] = h ? (p.a[0] < p.b[0] ? [p.a, p.b] : [p.b, p.a]) : (p.a[1] < p.b[1] ? [p.a, p.b] : [p.b, p.a]);
    pontas.push({ p: lo, dir: h ? [-1, 0] : [0, -1], esp: p.esp }, { p: hi, dir: h ? [1, 0] : [0, 1], esp: p.esp });
  }
  const tocaOutra = (q: Ponto, propria: ParedeReal | null) => paredes.some(p => p !== propria && distSeg(q, p) < p.esp / 2 + 0.08);
  for (const { p, dir } of pontas) {
    const dona = paredes.find(w => (w.a === p || w.b === p)) ?? null;
    if (tocaOutra(p, dona)) continue;
    let melhor: { d: number } | null = null;
    for (const w of paredes) {
      if (w === dona || horizontal(w) === (dir[1] === 0)) continue; // só perpendiculares
      const face = horizontal(w) ? w.a[1] : w.a[0];
      const ao = dir[0] !== 0 ? p[0] : p[1];
      const d = (face - ao) * (dir[0] + dir[1]) - w.esp / 2;
      if (d < VAO_MIN || d > 1.05) continue;
      const l = limites([w.a, w.b]);
      const cruza = dir[0] !== 0 ? p[1] >= l.minY - 0.02 && p[1] <= l.maxY + 0.02 : p[0] >= l.minX - 0.02 && p[0] <= l.maxX + 0.02;
      if (cruza && (!melhor || d < melhor.d)) melhor = { d };
    }
    if (melhor) {
      const b: Ponto = [p[0] + dir[0] * melhor.d, p[1] + dir[1] * melhor.d];
      if (!saida.some(o => Math.hypot((o.a[0] + o.b[0]) / 2 - (p[0] + b[0]) / 2, (o.a[1] + o.b[1]) / 2 - (p[1] + b[1]) / 2) < 0.3)) saida.push({ a: p, b, largura: melhor.d });
    }
  }
  return saida;
}

function distSeg([x, y]: Ponto, s: { a: Ponto; b: Ponto }): number {
  const [x1, y1] = s.a, [x2, y2] = s.b;
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const t = l2 ? Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2)) : 0;
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
}

/** Grade de paredes (1) com os vãos fechados e o contorno da torre como limite. */
function rasterizar(paredes: ParedeReal[], aberturas: Abertura[], contorno: Ponto[]) {
  const lim = limites(contorno);
  const x0 = lim.minX - 0.5, y0 = lim.minY - 0.5;
  const w = Math.ceil((lim.largura + 1) / PX), h = Math.ceil((lim.profundidade + 1) / PX);
  const m = new Uint8Array(w * h);
  const caixa = (ax: number, ay: number, bx: number, by: number) => {
    for (let py = Math.max(0, Math.floor((ay - y0) / PX)); py <= Math.min(h - 1, Math.floor((by - y0) / PX)); py++) {
      for (let px = Math.max(0, Math.floor((ax - x0) / PX)); px <= Math.min(w - 1, Math.floor((bx - x0) / PX)); px++) m[py * w + px] = 1;
    }
  };
  const tracar = (a: Ponto, b: Ponto, esp: number) => {
    const e = Math.max(esp / 2, PX * 0.8);
    caixa(Math.min(a[0], b[0]) - e, Math.min(a[1], b[1]) - e, Math.max(a[0], b[0]) + e, Math.max(a[1], b[1]) + e);
  };
  for (const p of paredes) tracar(p.a, p.b, p.esp);
  for (const o of aberturas) tracar(o.a, o.b, 0.1);
  // contorno: segmentos finos (ortogonais) na borda
  contorno.forEach((a, i) => {
    const b = contorno[(i + 1) % contorno.length];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (PX / 2));
    for (let k = 0; k <= n; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / n, y = a[1] + ((b[1] - a[1]) * k) / n;
      caixa(x - PX, y - PX, x + PX, y + PX);
    }
  });
  return { m, w, h, x0, y0 };
}

/** Rótulos das regiões livres (4-vizinhança); 0 = parede, -1 = fora da torre. */
function rotular(m: Uint8Array, w: number, h: number): { rotulo: Int32Array; tamanhos: number[] } {
  const rotulo = new Int32Array(w * h);
  const pilha: number[] = [];
  const encher = (inicio: number, valor: number) => {
    let n = 0;
    rotulo[inicio] = valor;
    pilha.push(inicio);
    while (pilha.length) {
      const i = pilha.pop()!;
      n++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= w * h || m[j] || rotulo[j]) continue;
        rotulo[j] = valor;
        pilha.push(j);
      }
    }
    return n;
  };
  for (let x = 0; x < w; x++) for (const i of [x, (h - 1) * w + x]) if (!m[i] && !rotulo[i]) encher(i, -1);
  for (let y = 0; y < h; y++) for (const i of [y * w, y * w + w - 1]) if (!m[i] && !rotulo[i]) encher(i, -1);
  const tamanhos: number[] = [0];
  for (let i = 0; i < w * h; i++) if (!m[i] && !rotulo[i]) tamanhos.push(encher(i, tamanhos.length));
  return { rotulo, tamanhos };
}

/**
 * Lê cômodos, portas e apartamentos do pavimento tipo. O hall é o cômodo com mais portas (dá acesso a todos);
 * cada grupo de cômodos ligado por porta, sem passar pelo hall, com área de apartamento, vira um apartamento.
 */
export function lerComodos(todas: ParedeReal[], contorno: Ponto[]): LeituraComodos {
  const vazio = { comodos: [], aberturas: [], apartamentos: [] };
  // Pedaço curto solto (símbolo, bloco de detalhe) não é parede: atrapalharia os vãos e partiria o corredor.
  const paredes = todas.filter(p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) >= 0.5
    || todas.some(q => q !== p && distSeg(p.a, q) < q.esp / 2 + 0.06 || q !== p && distSeg(p.b, q) < q.esp / 2 + 0.06));
  if (paredes.length < 8 || contorno.length < 3) return vazio;
  const aberturas = aberturasDasParedes(paredes);
  const { m, w, h, x0, y0 } = rasterizar(paredes, aberturas, contorno);
  const { rotulo, tamanhos } = rotular(m, w, h);
  const AREA_PX = PX * PX;
  const min = 0.6 / AREA_PX;

  const comodos: Comodo[] = [];
  const idDoRotulo = new Map<number, string>();
  for (let r = 1; r < tamanhos.length; r++) {
    if (tamanhos[r] < min) continue;
    const mascara = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (rotulo[i] === r) mascara[i] = 1;
    const borda = tracarBorda(mascara, w, h);
    if (borda.length < 4) continue;
    let poly = ortogonalizar(simplificar(borda, 1.2));
    if (poly.length < 3 || Math.abs(area(poly)) < 1) poly = simplificar(borda, 1.2);
    const id = `c${comodos.length + 1}`;
    idDoRotulo.set(r, id);
    const rd = (v: number) => Math.round(v * 100) / 100;
    comodos.push({
      id,
      contorno: poly.map(([x, y]) => [rd(x * PX + x0), rd(y * PX + y0)] as Ponto),
      area: Math.round(tamanhos[r] * AREA_PX * 100) / 100,
      tipo: "outro",
    });
  }
  const noPonto = ([x, y]: Ponto) => {
    const px = Math.floor((x - x0) / PX), py = Math.floor((y - y0) / PX);
    if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
    return idDoRotulo.get(rotulo[py * w + px]);
  };

  // Portas ligando cômodos: amostra dos dois lados do vão.
  const vizinhos = new Map<string, Set<string>>(comodos.map(c => [c.id, new Set<string>()]));
  for (const o of aberturas) {
    const cx = (o.a[0] + o.b[0]) / 2, cy = (o.a[1] + o.b[1]) / 2;
    const h0 = Math.abs(o.a[1] - o.b[1]) < 0.02;
    const lados = [0.2, 0.35, 0.5].map(d => (h0 ? [[cx, cy + d], [cx, cy - d]] : [[cx + d, cy], [cx - d, cy]]) as [Ponto, Ponto]);
    for (const [p, q] of lados) {
      const a = noPonto(p), b = noPonto(q);
      if (a && b && a !== b) {
        o.entre = [a, b];
        vizinhos.get(a)!.add(b);
        vizinhos.get(b)!.add(a);
        break;
      }
    }
  }

  // Hall: o cômodo com mais portas (com pelo menos 3); cômodos grandes ligados a ele com muitas portas também (corredor em L).
  const grau = (id: string) => vizinhos.get(id)?.size ?? 0;
  const ordem = [...comodos].sort((a, b) => grau(b.id) - grau(a.id) || b.area - a.area);
  const halls = new Set<string>();
  if (ordem[0] && grau(ordem[0].id) >= 3) halls.add(ordem[0].id);
  // Só trechos compridos (corredor partido por um vão): a sala do apartamento também tem muitas portas, mas não é comprida.
  const comprido = (c: Comodo) => { const l = limites(c.contorno); return Math.max(l.largura, l.profundidade) / Math.max(0.1, Math.min(l.largura, l.profundidade)) >= 3.5; };
  for (const c of ordem.slice(1)) if (grau(c.id) >= 3 && comprido(c) && [...vizinhos.get(c.id)!].some(v => halls.has(v))) halls.add(c.id);

  // Grupos sem passar pelo hall.
  const grupo = new Map<string, number>();
  const grupos: string[][] = [];
  for (const c of comodos) {
    if (halls.has(c.id) || grupo.has(c.id)) continue;
    const g: string[] = [];
    const fila = [c.id];
    grupo.set(c.id, grupos.length);
    while (fila.length) {
      const atual = fila.pop()!;
      g.push(atual);
      for (const v of vizinhos.get(atual) ?? []) if (!halls.has(v) && !grupo.has(v)) { grupo.set(v, grupos.length); fila.push(v); }
    }
    grupos.push(g);
  }
  const porId = new Map(comodos.map(c => [c.id, c]));
  const areaGrupo = (g: string[]) => g.reduce((s, id) => s + (porId.get(id)?.area ?? 0), 0);
  const ligadoAoHall = (g: string[]) => g.some(id => [...vizinhos.get(id)!].some(v => halls.has(v)));

  // Cômodo solto (porta que a 1ª fiada não mostra: drywall, vão largo) entra no apartamento vizinho com quem divide mais parede fina.
  const fronteira = vizinhancaPorParede(rotulo, w, h, idDoRotulo);
  const ehApto = (g: string[]) => areaGrupo(g) >= 22 && ligadoAoHall(g);
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    if (!g.length || ehApto(g) || areaGrupo(g) >= 22) continue;
    let melhor = -1, melhorLen = 0;
    for (const id of g) for (const [outro, len] of fronteira.get(id) ?? []) {
      const og = grupo.get(outro);
      if (og === undefined || og === gi || !ehApto(grupos[og])) continue;
      if (len > melhorLen) { melhorLen = len; melhor = og; }
    }
    if (melhor >= 0 && areaGrupo(g) < 15) {
      for (const id of g) grupo.set(id, melhor);
      grupos[melhor].push(...g);
      grupos[gi] = [];
    }
  }

  // Dois apartamentos grudados (uma porta a mais entre eles): grupo com o dobro da área típica e duas entradas pelo hall
  // é partido na porta interna cuja retirada deixa duas partes com entrada e tamanho de apartamento.
  const areas = grupos.filter(g => g.length && ehApto(g)).map(areaGrupo).sort((a, b) => a - b);
  const tipica = areas[Math.floor(areas.length / 2)] ?? 0;
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    if (!g.length || !tipica || areaGrupo(g) < tipica * 1.6) continue;
    const dentroG = new Set(g);
    const partir = (sem: [string, string]) => {
      const visto = new Set<string>([g[0]]);
      const fila = [g[0]];
      while (fila.length) {
        const a = fila.pop()!;
        for (const v of vizinhos.get(a) ?? []) {
          if (!dentroG.has(v) || visto.has(v) || (a === sem[0] && v === sem[1]) || (a === sem[1] && v === sem[0])) continue;
          visto.add(v);
          fila.push(v);
        }
      }
      return [[...visto], g.filter(id => !visto.has(id))];
    };
    for (const a of g) {
      const corte = [...vizinhos.get(a)!].filter(b => dentroG.has(b) && a < b).map(b => partir([a, b])).find(([p, q]) => q.length && ehApto(p) && ehApto(q));
      if (corte) {
        grupos[gi] = corte[0];
        grupos.push(corte[1]);
        corte[1].forEach(id => grupo.set(id, grupos.length - 1));
        break;
      }
    }
  }

  // Ainda grudados num cômodo só (a parede entre eles não fecha na 1ª fiada): parte entre as portas de entrada.
  const entradasDe = (g: string[]) => {
    const lista: Ponto[] = [];
    for (const o of aberturas) {
      if (!o.entre || !o.entre.some(id => halls.has(id)) || !o.entre.some(id => g.includes(id))) continue;
      const c: Ponto = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
      if (!lista.some(p => Math.hypot(p[0] - c[0], p[1] - c[1]) < 0.6)) lista.push(c);
    }
    return lista;
  };
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    if (!g.length || !tipica || areaGrupo(g) < tipica * 1.6) continue;
    const ent = entradasDe(g);
    if (ent.length !== 2) continue;
    const emX = Math.abs(ent[0][0] - ent[1][0]) >= Math.abs(ent[0][1] - ent[1][1]);
    const corte = emX ? (ent[0][0] + ent[1][0]) / 2 : (ent[0][1] + ent[1][1]) / 2;
    const a: Ponto = emX ? [corte, -1e4] : [-1e4, corte], b: Ponto = emX ? [corte, 1e4] : [1e4, corte];
    const novo: string[] = [];
    for (const id of [...g]) {
      const c = porId.get(id)!;
      const l = limites(c.contorno);
      if ((emX ? l.minX : l.minY) >= corte) { novo.push(id); continue; }
      if ((emX ? l.maxX : l.maxY) <= corte) continue;
      const [esq, dir] = [cortar(c.contorno, a, b, true), cortar(c.contorno, a, b, false)];
      const parte = (p: Ponto[]) => (emX ? limites(p).minX >= corte - 0.01 : limites(p).minY >= corte - 0.01);
      const [fica, vai] = parte(esq) ? [dir, esq] : [esq, dir];
      const total = c.area;
      c.contorno = fica;
      c.area = Math.round(total * (Math.abs(area(fica)) / (Math.abs(area(fica)) + Math.abs(area(vai)))) * 100) / 100;
      const nc: Comodo = { id: `c${comodos.length + 1}`, contorno: vai, area: Math.round((total - c.area) * 100) / 100, tipo: "outro" };
      comodos.push(nc);
      porId.set(nc.id, nc);
      vizinhos.set(nc.id, new Set());
      novo.push(nc.id);
    }
    const resto = g.filter(id => !novo.includes(id));
    if (novo.length && resto.length) {
      grupos[gi] = resto;
      grupos.push(novo);
      for (const o of aberturas) {
        // a entrada do lado novo passa a ligar o cômodo novo
        if (!o.entre || !o.entre.some(id => halls.has(id))) continue;
        const cx = emX ? (o.a[0] + o.b[0]) / 2 : (o.a[1] + o.b[1]) / 2;
        const i = o.entre.findIndex(id => resto.includes(id));
        if (i < 0 || cx <= corte) continue;
        const destino = novo.find(id => porId.get(id)!.area > 5) ?? novo[0];
        const hall = o.entre[1 - i];
        o.entre[i] = destino;
        vizinhos.get(destino)!.add(hall);
        vizinhos.get(hall)?.add(destino);
      }
    }
  }

  const apartamentos: Apartamento[] = [];
  const lista = grupos.filter(g => g.length && ehApto(g) && areaGrupo(g) <= 160);
  // Ordem de leitura: de cima para baixo, da esquerda para a direita.
  const centro = (g: string[]) => {
    const pts = g.flatMap(id => porId.get(id)!.contorno);
    const l = limites(pts);
    return [(l.minX + l.maxX) / 2, (l.minY + l.maxY) / 2] as Ponto;
  };
  lista.sort((a, b) => { const [ax, ay] = centro(a), [bx, by] = centro(b); return Math.abs(ay - by) > 3 ? by - ay : ax - bx; });
  lista.forEach((g, i) => {
    const id = `ap-${i + 1}`;
    const partes = g.map(c => porId.get(c)!).sort((a, b) => b.area - a.area);
    for (const c of partes) { c.apto = id; c.tipo = c.area < 5 ? "molhado" : "apartamento"; }
    apartamentos.push({ id, nome: `Apto ${String(i + 1).padStart(2, "0")}`, contorno: unirContornos(partes.map(p => p.contorno)), lado: "A" as Lado });
  });
  for (const c of comodos) {
    if (halls.has(c.id)) c.tipo = "hall";
    else if (!c.apto) c.tipo = c.area < 2 ? "shaft" : c.area < 22 && grau(c.id) <= 1 ? "escada" : "outro";
  }
  for (const o of aberturas) if (o.entre && o.entre.some(id => halls.has(id)) && o.entre.some(id => porId.get(id)?.apto)) o.entrada = true;
  return { comodos, aberturas, apartamentos };
}

/** Quanto (m) cada par de cômodos divide de parede fina (até ~20 cm entre eles). */
function vizinhancaPorParede(rotulo: Int32Array, w: number, h: number, ids: Map<number, string>): Map<string, Map<string, number>> {
  const saida = new Map<string, Map<string, number>>();
  const passo = Math.round(0.2 / PX);
  const somar = (a: string, b: string) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      const m = saida.get(x) ?? new Map<string, number>();
      m.set(y, (m.get(y) ?? 0) + PX);
      saida.set(x, m);
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rotulo[y * w + x];
      if (r <= 0) continue;
      const a = ids.get(r);
      if (!a) continue;
      if (x + passo < w && rotulo[y * w + x + 1] === 0) {
        for (let k = 2; k <= passo; k++) { const o = rotulo[y * w + x + k]; if (o === 0) continue; const b = o > 0 ? ids.get(o) : undefined; if (b && b !== a) somar(a, b); break; }
      }
      if (y + passo < h && rotulo[(y + 1) * w + x] === 0) {
        for (let k = 2; k <= passo; k++) { const o = rotulo[(y + k) * w + x]; if (o === 0) continue; const b = o > 0 ? ids.get(o) : undefined; if (b && b !== a) somar(a, b); break; }
      }
    }
  }
  return saida;
}

/** Contorno de um apartamento a partir dos cômodos (união pela grade, engrossando as paredes internas). */
export function unirContornos(contornos: Ponto[][]): Ponto[] {
  const pts = contornos.flat();
  const l = limites(pts);
  const P = 0.05, M = 0.4;
  const w = Math.ceil((l.largura + 2 * M) / P), h = Math.ceil((l.profundidade + 2 * M) / P);
  const m = new Uint8Array(w * h);
  for (const c of contornos) {
    const lc = limites(c);
    for (let py = Math.floor((lc.minY - l.minY + M) / P); py <= Math.ceil((lc.maxY - l.minY + M) / P); py++) {
      for (let px = Math.floor((lc.minX - l.minX + M) / P); px <= Math.ceil((lc.maxX - l.minX + M) / P); px++) {
        const x = px * P + l.minX - M + P / 2, y = py * P + l.minY - M + P / 2;
        if (px >= 0 && py >= 0 && px < w && py < h && dentroComFolga([x, y], c, 0.12)) m[py * w + px] = 1;
      }
    }
  }
  const borda = tracarBorda(m, w, h);
  let poly = ortogonalizar(simplificar(borda, 1.5));
  if (poly.length < 3) poly = borda;
  const rd = (v: number) => Math.round(v * 100) / 100;
  return poly.map(([x, y]) => [rd(x * P + l.minX - M), rd(y * P + l.minY - M)] as Ponto);
}

function dentroComFolga(p: Ponto, poly: Ponto[], folga: number): boolean {
  if (dentroPoly(p, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (distSeg(p, { a: poly[i], b: poly[(i + 1) % poly.length] }) <= folga) return true;
  return false;
}

function dentroPoly([x, y]: Ponto, pts: Ponto[]): boolean {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/**
 * Torre importada antes dos cômodos: lê cômodos e portas das paredes e, se os apartamentos ainda são a malha de exemplo,
 * troca pelos apartamentos reais. Apartamentos desenhados ou renomeados à mão ficam como estão.
 */
export function completarComodos(torre: Torre): Torre {
  if (!torre.paredes?.length || torre.comodos) return torre;
  const lidos = lerComodos(torre.paredes, torre.contorno);
  if (!lidos.comodos.length) return torre;
  const chave = (aps: Apartamento[]) => JSON.stringify(aps.map(a => [a.nome, a.contorno]));
  const exemplo = !torre.apartamentos?.length || chave(torre.apartamentos) === chave(apartamentosPadrao(torre.contorno));
  const lados = torre.lados ?? definirLados(torre.contorno, null);
  const apartamentos = exemplo && lidos.apartamentos.length >= 2 ? atribuirLados(lidos.apartamentos, lados) : torre.apartamentos;
  return { ...torre, comodos: lidos.comodos, aberturas: lidos.aberturas, apartamentos };
}
