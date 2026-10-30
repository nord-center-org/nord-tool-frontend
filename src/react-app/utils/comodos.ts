/**
 * Cômodos e apartamentos a partir das paredes reais do pavimento (1ª fiada): fecha os vãos de porta, separa os espaços
 * fechados (cômodos), liga os cômodos pelas portas e tira o hall (o espaço onde mais portas dão). O que sobra ligado
 * entre si são os apartamentos. Tudo em metros, y para cima, como o resto da Escadinha. Puro, para testar.
 */
import { dilatar, tracarBorda } from "./escadinhaPlanta.ts";
import { area, dentro, limites, ortogonalizar, simplificar, type ParedeReal, type Ponto } from "./escadinha.ts";

export interface Comodo {
  id: string;
  contorno: Ponto[];
  /** m² do vão livre. */
  area: number;
  /** Apartamento a que pertence (null = hall, escada, shaft). */
  apto: string | null;
}

export interface AptoDetectado {
  id: string;
  nome: string;
  contorno: Ponto[];
  area: number;
  comodos: string[];
}

export interface ResultadoComodos {
  comodos: Comodo[];
  apartamentos: AptoDetectado[];
  /** Ids dos cômodos que formam o hall/circulação. */
  hall: string[];
}

const PX = 0.05;
/** Maior vão tratado como porta (m). */
const PORTA = 1.15;

interface Fechamento { a: Ponto; b: Ponto }

const horizontal = (p: { a: Ponto; b: Ponto }) => Math.abs(p.a[1] - p.b[1]) < 0.02;

/** O ponto encosta numa parede perpendicular à direção dada (h = a direção do vão é horizontal)? */
function encostaEmPerpendicular(pt: Ponto, h: boolean, paredes: ParedeReal[], ignorar?: ParedeReal): boolean {
  const tol = 0.15;
  return paredes.some(q => {
    if (q === ignorar || horizontal(q) === h) return false;
    const fixo = h ? q.a[0] : q.a[1];
    const [m0, m1] = h ? [Math.min(q.a[1], q.b[1]), Math.max(q.a[1], q.b[1])] : [Math.min(q.a[0], q.b[0]), Math.max(q.a[0], q.b[0])];
    const ao = h ? pt[0] : pt[1], ao2 = h ? pt[1] : pt[0];
    return Math.abs(ao - fixo) <= q.esp / 2 + tol && ao2 >= m0 - tol && ao2 <= m1 + tol;
  });
}

/**
 * Vãos de porta: paredes alinhadas com folga até PORTA e pontas soltas de parede que chegam perto de outra parede.
 * Vão com as duas pontas em paredes atravessadas é a travessia de um corredor (não é porta) e fica aberto.
 */
export function vaosDePorta(todas: ParedeReal[]): Fechamento[] {
  const saida: Fechamento[] = [];
  // Pedacinho solto (bloco isolado no meio do corredor, símbolo) não define porta: curto e sem encostar em nada.
  const encosta = (p: ParedeReal) => todas.some(q => q !== p && [p.a, p.b].some(pt => {
    const [x0, x1] = [Math.min(q.a[0], q.b[0]) - q.esp / 2 - 0.1, Math.max(q.a[0], q.b[0]) + q.esp / 2 + 0.1];
    const [y0, y1] = [Math.min(q.a[1], q.b[1]) - q.esp / 2 - 0.1, Math.max(q.a[1], q.b[1]) + q.esp / 2 + 0.1];
    return pt[0] >= x0 && pt[0] <= x1 && pt[1] >= y0 && pt[1] <= y1;
  }));
  const paredes = todas.filter(p => Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) >= 0.45 || encosta(p));
  // 1) paredes alinhadas (mesma linha) com vão curto entre elas
  const linhas = new Map<string, ParedeReal[]>();
  for (const p of paredes) {
    const h = horizontal(p);
    const chave = `${h ? "h" : "v"}|${Math.round((h ? p.a[1] : p.a[0]) / 0.04)}`;
    const l = linhas.get(chave);
    if (l) l.push(p); else linhas.set(chave, [p]);
  }
  for (const [chave, lista] of linhas) {
    const h = chave[0] === "h";
    const ini = (p: ParedeReal) => Math.min(h ? p.a[0] : p.a[1], h ? p.b[0] : p.b[1]);
    const fim = (p: ParedeReal) => Math.max(h ? p.a[0] : p.a[1], h ? p.b[0] : p.b[1]);
    lista.sort((p, q) => ini(p) - ini(q));
    for (let i = 1; i < lista.length; i++) {
      const g0 = fim(lista[i - 1]), g1 = ini(lista[i]);
      if (g1 - g0 > 0.05 && g1 - g0 <= PORTA) {
        const f = h ? lista[i].a[1] : lista[i].a[0];
        const a: Ponto = h ? [g0, f] : [f, g0], b: Ponto = h ? [g1, f] : [f, g1];
        if (encostaEmPerpendicular(a, h, paredes) && encostaEmPerpendicular(b, h, paredes)) continue; // travessia de corredor
        saida.push({ a, b });
      }
    }
  }
  // 2) ponta solta: prolonga até PORTA na mesma direção e fecha se encontrar outra parede (porta junto a canto)
  for (const p of paredes) {
    const h = horizontal(p);
    for (const [ponta, outra] of [[p.a, p.b], [p.b, p.a]] as [Ponto, Ponto][]) {
      const dir = h ? Math.sign(ponta[0] - outra[0]) : Math.sign(ponta[1] - outra[1]);
      if (!dir) continue;
      if (encostaEmPerpendicular(ponta, h, paredes, p)) continue; // já encosta em outra parede: não é ponta solta
      let melhor = Infinity;
      for (const q of paredes) {
        if (q === p) continue;
        const qh = horizontal(q);
        if (qh === h) continue; // só perpendicular
        const fixo = qh ? q.a[1] : q.a[0];
        const [m0, m1] = qh ? [Math.min(q.a[0], q.b[0]), Math.max(q.a[0], q.b[0])] : [Math.min(q.a[1], q.b[1]), Math.max(q.a[1], q.b[1])];
        const transv = h ? ponta[1] : ponta[0];
        if (transv < m0 - 0.02 || transv > m1 + 0.02) continue;
        const d = ((h ? fixo - ponta[0] : fixo - ponta[1]) * dir) - q.esp / 2;
        if (d > 0.05 && d <= PORTA && d < melhor) melhor = d;
      }
      if (melhor < Infinity) {
        const b: Ponto = h ? [ponta[0] + dir * melhor, ponta[1]] : [ponta[0], ponta[1] + dir * melhor];
        saida.push({ a: ponta, b });
      }
    }
  }
  return saida;
}

/** Acha cômodos e apartamentos do pavimento. */
export function detectarComodos(paredes: ParedeReal[], contorno: Ponto[]): ResultadoComodos {
  const vazio: ResultadoComodos = { comodos: [], apartamentos: [], hall: [] };
  if (paredes.length < 4 || contorno.length < 3) return vazio;
  const lim = limites(contorno);
  const x0 = lim.minX - 0.5, y0 = lim.minY - 0.5;
  const w = Math.ceil((lim.largura + 1) / PX), h = Math.ceil((lim.profundidade + 1) / PX);
  if (w * h > 6_000_000) return vazio;
  const ix = (x: number) => Math.round((x - x0) / PX), iy = (y: number) => Math.round((y - y0) / PX);
  const bloqueio = new Uint8Array(w * h);
  const pintar = (a: Ponto, b: Ponto, esp: number) => {
    const meia = Math.max(esp / 2, PX);
    const ax = Math.min(a[0], b[0]) - (horizontal({ a, b }) ? 0 : meia), bx = Math.max(a[0], b[0]) + (horizontal({ a, b }) ? 0 : meia);
    const ay = Math.min(a[1], b[1]) - (horizontal({ a, b }) ? meia : 0), by = Math.max(a[1], b[1]) + (horizontal({ a, b }) ? meia : 0);
    for (let py = Math.max(0, iy(ay)); py <= Math.min(h - 1, iy(by)); py++) {
      for (let px = Math.max(0, ix(ax)); px <= Math.min(w - 1, ix(bx)); px++) bloqueio[py * w + px] = 1;
    }
  };
  for (const p of paredes) pintar(p.a, p.b, p.esp);
  const vaos = vaosDePorta(paredes);
  for (const v of vaos) pintar(v.a, v.b, 0.1);
  // fachada fechada pelo contorno (sacadas e janelas não vazam para fora)
  const dentroM = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) dentroM[py * w + px] = dentro([x0 + px * PX, y0 + py * PX], contorno) ? 1 : 0;
  // Afina 40 cm junto ao contorno: a faixa fina entre a parede de fachada e o contorno não liga apartamentos por fora.
  {
    const fora = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) fora[i] = dentroM[i] ? 0 : 1;
    const foraGrosso = dilatar(fora, w, h, Math.round(0.4 / PX));
    for (let i = 0; i < w * h; i++) if (foraGrosso[i]) dentroM[i] = 0;
  }

  // componentes do vão livre
  const rotulo = new Int32Array(w * h).fill(-1);
  const tamanhos: number[] = [];
  const pilha: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (rotulo[i] >= 0 || bloqueio[i] || !dentroM[i]) continue;
    const id = tamanhos.length;
    let n = 0;
    rotulo[i] = id;
    pilha.push(i);
    while (pilha.length) {
      const p = pilha.pop()!;
      n++;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || rotulo[q] >= 0 || bloqueio[q] || !dentroM[q]) continue;
        rotulo[q] = id;
        pilha.push(q);
      }
    }
    tamanhos.push(n);
  }
  const areaPx = PX * PX;
  const validos = tamanhos.map(n => n * areaPx >= 0.8);

  // ligações pelas portas
  const ligacoes = new Map<number, Set<number>>();
  const ligar = (a: number, b: number) => {
    if (a === b || a < 0 || b < 0 || !validos[a] || !validos[b]) return;
    (ligacoes.get(a) ?? ligacoes.set(a, new Set()).get(a)!).add(b);
    (ligacoes.get(b) ?? ligacoes.set(b, new Set()).get(b)!).add(a);
  };
  const rotuloEm = (x: number, y: number) => {
    const px = ix(x), py = iy(y);
    return px >= 0 && py >= 0 && px < w && py < h ? rotulo[py * w + px] : -1;
  };
  for (const v of vaos) {
    const mx = (v.a[0] + v.b[0]) / 2, my = (v.a[1] + v.b[1]) / 2;
    const hz = horizontal(v);
    for (const d of [0.2, 0.35, 0.5]) {
      const r1 = hz ? rotuloEm(mx, my + d) : rotuloEm(mx + d, my);
      const r2 = hz ? rotuloEm(mx, my - d) : rotuloEm(mx - d, my);
      if (r1 >= 0 && r2 >= 0) { ligar(r1, r2); break; }
    }
  }

  // hall: o espaço com mais portas, pesando o tamanho (o corredor é comprido e recebe a porta de cada apartamento)
  const ids = tamanhos.map((_, i) => i).filter(i => validos[i]);
  const nota = (i: number) => (ligacoes.get(i)?.size ?? 0) + (tamanhos[i] * areaPx) / 15;
  let hall = -1;
  for (const i of ids) if ((ligacoes.get(i)?.size ?? 0) >= 2 && (hall < 0 || nota(i) > nota(hall))) hall = i;
  // Torre com junta de dilatação tem um corredor de cada lado: todo espaço tão "corredor" quanto o melhor também é hall.
  const halls = new Set<number>(hall >= 0 ? [hall] : []);
  if (hall >= 0) for (const i of ids) if ((ligacoes.get(i)?.size ?? 0) >= 3 && nota(i) >= nota(hall) * 0.5) halls.add(i);
  const grupo = new Map<number, number>();
  let g = 0;
  for (const i of ids) {
    if (halls.has(i) || grupo.has(i)) continue;
    const fila = [i];
    grupo.set(i, g);
    while (fila.length) {
      const a = fila.pop()!;
      for (const b of ligacoes.get(a) ?? []) if (!halls.has(b) && !grupo.has(b)) { grupo.set(b, g); fila.push(b); }
    }
    g++;
  }
  // Cada apartamento tem uma porta para o hall: grupo com várias entradas são apartamentos vizinhos ligados por um vão;
  // reparte os cômodos pela entrada mais próxima (busca em largura a partir de todas as entradas ao mesmo tempo).
  if (hall >= 0) {
    const membros = new Map<number, number[]>();
    for (const [i, gr] of grupo) (membros.get(gr) ?? membros.set(gr, []).get(gr)!).push(i);
    for (const [, lista] of membros) {
      const entradas = lista.filter(i => [...(ligacoes.get(i) ?? [])].some(b => halls.has(b)));
      if (entradas.length < 2) continue;
      const dono = new Map<number, number>();
      const fila: number[] = [];
      entradas.forEach(e => { dono.set(e, g); fila.push(e); g++; });
      while (fila.length) {
        const a = fila.shift()!;
        for (const b of ligacoes.get(a) ?? []) if (!halls.has(b) && grupo.has(b) && !dono.has(b) && lista.includes(b)) { dono.set(b, dono.get(a)!); fila.push(b); }
      }
      for (const [i, novo] of dono) grupo.set(i, novo);
    }
  }
  const areaGrupo = new Map<number, number>();
  for (const [i, gr] of grupo) areaGrupo.set(gr, (areaGrupo.get(gr) ?? 0) + tamanhos[i] * areaPx);
  const ehApto = (gr: number) => (areaGrupo.get(gr) ?? 0) >= 18 && (areaGrupo.get(gr) ?? 0) <= 160;

  const poligono = (sel: (r: number) => boolean, engrossar: number): Ponto[] => {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (rotulo[i] >= 0 && sel(rotulo[i])) m[i] = 1;
    const grosso = engrossar ? dilatar(m, w, h, engrossar) : m;
    for (let i = 0; i < w * h; i++) if (!dentroM[i]) grosso[i] = 0;
    const borda = tracarBorda(grosso, w, h);
    if (borda.length < 4) return [];
    let poly = ortogonalizar(simplificar(borda, 2.5));
    if (poly.length < 4) poly = simplificar(borda, 2.5);
    const r = (v: number) => Math.round(v * 100) / 100;
    const pts = poly.map(([px, py]) => [r(x0 + px * PX), r(y0 + py * PX)] as Ponto);
    return area(pts) < 0 ? pts.reverse() : pts;
  };

  // apartamentos em ordem de leitura (de cima para baixo, da esquerda para a direita)
  const grupos = [...new Set(grupo.values())].filter(ehApto);
  const centros = new Map<number, Ponto>();
  for (const gr of grupos) {
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < w * h; i += 7) if (rotulo[i] >= 0 && grupo.get(rotulo[i]) === gr) { sx += i % w; sy += Math.floor(i / w); n++; }
    centros.set(gr, [x0 + (sx / Math.max(1, n)) * PX, y0 + (sy / Math.max(1, n)) * PX]);
  }
  grupos.sort((a, b) => {
    const ca = centros.get(a)!, cb = centros.get(b)!;
    return Math.abs(ca[1] - cb[1]) > 2 ? cb[1] - ca[1] : ca[0] - cb[0];
  });
  const idApto = new Map<number, string>();
  const apartamentos: AptoDetectado[] = [];
  grupos.forEach((gr, k) => {
    const id = `ap-${k + 1}`;
    idApto.set(gr, id);
    const contornoApto = poligono(r => grupo.get(r) === gr, 3);
    if (contornoApto.length >= 3) {
      apartamentos.push({ id, nome: `Apto ${String(k + 1).padStart(2, "0")}`, contorno: contornoApto, area: Math.round((areaGrupo.get(gr) ?? 0) * 100) / 100, comodos: [] });
    }
  });
  const comodos: Comodo[] = [];
  for (const i of ids) {
    const contornoC = poligono(r => r === i, 2);
    if (contornoC.length < 3) continue;
    const gr = grupo.get(i);
    const apto = gr !== undefined ? idApto.get(gr) ?? null : null;
    const c: Comodo = { id: `c-${i}`, contorno: contornoC, area: Math.round(tamanhos[i] * areaPx * 100) / 100, apto };
    comodos.push(c);
    if (apto) apartamentos.find(a => a.id === apto)?.comodos.push(c.id);
  }
  return { comodos, apartamentos, hall: [...halls].map(i => `c-${i}`) };
}
