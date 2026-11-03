/**
 * A peça de cada elemento da escadinha, montada com o que o projeto diz da planta: paredes da 1ª fiada (com as
 * janelas recortadas e as vergas das portas), cômodos pelo uso (banheiro, cozinha, dormitório, sala, hall, escada,
 * shaft, elevador), portas, janelas, portas-sacada e sacadas. Só números (caixas, cilindros e placas no sistema da planta:
 * x e y em metros, z a altura a partir do piso); o desenho em three.js fica no componente. Sem React aqui.
 */
import { dentro, limites, type AberturaPlanta, type ComodoPlanta, type ParedeReal, type Ponto, type SacadaPlanta, type VaoFachada } from "./escadinha.ts";
import { centroide } from "./escadinhaApto.ts";
import type { Elemento } from "./escadinhaElementos.ts";

/**
 * Caixa: centro (x, y) na planta, base em z; w ao longo do ângulo `ang`, d na perpendicular, h para cima.
 * `cor` especial: "bloco" (textura de bloco), "vidro", "madeira", "ceramica".
 */
export interface Caixa { k: "caixa"; x: number; y: number; z: number; w: number; h: number; d: number; ang: number; cor: string }
export interface Cilindro { k: "cilindro"; x: number; y: number; z: number; r: number; h: number; cor: string }
export interface Placa { k: "placa"; poly: Ponto[]; z: number; esp: number; cor: string }
export type Peca = Caixa | Cilindro | Placa;

export interface PlantaPecas {
  comodos: ComodoPlanta[];
  aberturas: AberturaPlanta[];
  paredes: ParedeReal[];
  vaos: VaoFachada[];
  sacadas: SacadaPlanta[];
  /** Contorno da torre (fachada, para-raio). */
  contorno: Ponto[];
  /** Pé-direito livre (m): do piso até a laje de cima. */
  altura: number;
  /** Só o que cai aqui (um lado da torre, um apartamento); sem filtro, tudo. */
  filtro?: (p: Ponto) => boolean;
}

export type Pecas = Partial<Record<Elemento, Peca[]>>;

const ESP_PAREDE = 0.14;
const TOPO_PORTA = 2.16;
const TOPO_VAO = 2.36;

const meio = (a: Ponto, b: Ponto): Ponto => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const comp = (a: Ponto, b: Ponto) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ang = (a: Ponto, b: Ponto) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Caixa ao longo de um segmento (a → b), deslocada `desloc` m para a esquerda do segmento. */
function caixaNoSegmento(a: Ponto, b: Ponto, z: number, h: number, d: number, cor: string, desloc = 0): Caixa {
  const l = comp(a, b), t = ang(a, b);
  const [cx, cy] = meio(a, b);
  return { k: "caixa", x: r3(cx - Math.sin(t) * desloc), y: r3(cy + Math.cos(t) * desloc), z: r3(z), w: r3(l), h: r3(h), d: r3(d), ang: t, cor };
}
function caixaEm(p: Ponto, z: number, w: number, h: number, d: number, t: number, cor: string): Caixa {
  return { k: "caixa", x: r3(p[0]), y: r3(p[1]), z: r3(z), w, h, d, ang: t, cor };
}
const cilindro = (p: Ponto, z: number, r: number, h: number, cor: string): Cilindro => ({ k: "cilindro", x: r3(p[0]), y: r3(p[1]), z: r3(z), r, h: r3(h), cor });
const placa = (poly: Ponto[], z: number, esp: number, cor: string): Placa => ({ k: "placa", poly, z, esp, cor });

/** Um ponto que cai dentro do polígono (o centroide de um L pode cair fora). */
export function pontoDentro(poly: Ponto[]): Ponto {
  const c = centroide(poly);
  if (dentro(c, poly)) return c;
  const l = limites(poly);
  let melhor: Ponto = c, folga = -1;
  for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
    const p: Ponto = [l.minX + (l.largura * i) / 10, l.minY + (l.profundidade * j) / 10];
    if (!dentro(p, poly)) continue;
    const f = Math.min(...poly.map((v, k) => distSeg(p, v, poly[(k + 1) % poly.length])));
    if (f > folga) { folga = f; melhor = p; }
  }
  return melhor;
}

function distSeg(p: Ponto, a: Ponto, b: Ponto): number {
  const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1])));
}

/** Normal do segmento que aponta para dentro do polígono. */
function paraDentro(a: Ponto, b: Ponto, poly: Ponto[]): Ponto {
  const t = ang(a, b);
  const n: Ponto = [-Math.sin(t), Math.cos(t)];
  const m = meio(a, b);
  return dentro([m[0] + n[0] * 0.15, m[1] + n[1] * 0.15], poly) ? n : [-n[0], -n[1]];
}

/** Arestas do cômodo, da maior para a menor. */
function arestasDe(poly: Ponto[]) {
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] })).filter(e => comp(e.a, e.b) > 0.3).sort((x, y) => comp(y.a, y.b) - comp(x.a, x.b));
}

/** Tubo em L (vai em x, depois em y) como caixas finas. */
function tubo(de: Ponto, para: Ponto, z: number, bitola: number, cor: string): Caixa[] {
  const quina: Ponto = [para[0], de[1]];
  return [[de, quina], [quina, para]].filter(([a, b]) => comp(a, b) > 0.05).map(([a, b]) => caixaNoSegmento(a, b, z, bitola, bitola, cor));
}

/** Recorta [0, L] tirando os intervalos dados. */
function recortar(L: number, tirar: [number, number][]): [number, number][] {
  const lista = tirar.map(([a, b]) => [Math.max(0, a), Math.min(L, b)] as [number, number]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const saida: [number, number][] = [];
  let ini = 0;
  for (const [a, b] of lista) {
    if (a > ini) saida.push([ini, a]);
    ini = Math.max(ini, b);
  }
  if (ini < L) saida.push([ini, L]);
  return saida.filter(([a, b]) => b - a > 0.02);
}

/** Parede subindo inteira, com as janelas recortadas (fica o peitoril embaixo e a verga em cima). */
function paredeComVaos(p: ParedeReal, vaos: VaoFachada[], H: number, cor: string): Caixa[] {
  const L = comp(p.a, p.b);
  if (L < 0.02) return [];
  const t = ang(p.a, p.b);
  const ux = Math.cos(t), uy = Math.sin(t);
  const recortes: { ini: number; fim: number; v: VaoFachada }[] = [];
  for (const v of vaos) {
    if (v.tipo !== "janela") continue;
    const tv = ang(v.a, v.b);
    if (Math.abs(Math.sin(tv - t)) > 0.05) continue;
    const m = meio(v.a, v.b);
    // distância do eixo da parede à linha do vão (na face externa)
    const dLinha = Math.abs((m[0] - p.a[0]) * -uy + (m[1] - p.a[1]) * ux);
    if (dLinha > p.esp / 2 + 0.1) continue;
    const s0 = (v.a[0] - p.a[0]) * ux + (v.a[1] - p.a[1]) * uy, s1 = (v.b[0] - p.a[0]) * ux + (v.b[1] - p.a[1]) * uy;
    const ini = Math.min(s0, s1), fim = Math.max(s0, s1);
    if (fim <= 0.01 || ini >= L - 0.01) continue;
    recortes.push({ ini, fim, v });
  }
  const em = (s: number): Ponto => [p.a[0] + ux * s, p.a[1] + uy * s];
  const saida: Caixa[] = recortar(L, recortes.map(r => [r.ini, r.fim])).map(([a, b]) => caixaNoSegmento(em(a), em(b), 0, H, p.esp, cor));
  for (const r of recortes) {
    const a = em(Math.max(0, r.ini)), b = em(Math.min(L, r.fim));
    if (r.v.peitoril > 0.02) saida.push(caixaNoSegmento(a, b, 0, r.v.peitoril, p.esp, cor));
    const topo = r.v.peitoril + r.v.altura;
    if (topo < H - 0.02) saida.push(caixaNoSegmento(a, b, topo, H - topo, p.esp, cor));
  }
  return saida;
}

/** Vão de fachada deslocado para o eixo da parede (o vão é lido na face externa). */
function noEixo(v: { a: Ponto; b: Ponto }, contorno: Ponto[], desloc = ESP_PAREDE / 2): { a: Ponto; b: Ponto; n: Ponto } {
  const n = paraDentro(v.a, v.b, contorno);
  return { a: [v.a[0] + n[0] * desloc, v.a[1] + n[1] * desloc], b: [v.b[0] + n[0] * desloc, v.b[1] + n[1] * desloc], n };
}

/** Moldura de 3 lados (batente, guarnição) num vão: dois montantes e a travessa. */
function moldura(a: Ponto, b: Ponto, z: number, altura: number, largura: number, d: number, cor: string, desloc = 0): Caixa[] {
  const t = ang(a, b), L = comp(a, b);
  const ux = Math.cos(t), uy = Math.sin(t);
  const nx = -uy * desloc, ny = ux * desloc;
  const pa: Ponto = [a[0] + ux * largura / 2 + nx, a[1] + uy * largura / 2 + ny];
  const pb: Ponto = [b[0] - ux * largura / 2 + nx, b[1] - uy * largura / 2 + ny];
  const m: Ponto = [(a[0] + b[0]) / 2 + nx, (a[1] + b[1]) / 2 + ny];
  return [
    caixaEm(pa, z, largura, altura, d, t, cor),
    caixaEm(pb, z, largura, altura, d, t, cor),
    caixaEm(m, z + altura, L + largura, largura, d, t, cor),
  ];
}

/** Pontos numa grade dentro do polígono (luminárias). */
function grade(poly: Ponto[], passo: number): Ponto[] {
  const l = limites(poly);
  const pts: Ponto[] = [];
  for (let x = l.minX + passo / 2; x < l.maxX; x += passo) for (let y = l.minY + passo / 2; y < l.maxY; y += passo) if (dentro([x, y], poly)) pts.push([x, y]);
  if (!pts.length) pts.push(pontoDentro(poly));
  return pts;
}

/**
 * Todas as peças da planta, por elemento. A mesma planta serve para todos os pavimentos tipo: o componente guarda o
 * resultado e só troca o que aparece conforme a escadinha.
 */
export function pecasDaPlanta(e: PlantaPecas): Pecas {
  const H = Math.max(1.5, e.altura);
  const ok = e.filtro ?? (() => true);
  const pecas: Pecas = {};
  const add = (el: Elemento, ...lista: Peca[]) => { (pecas[el] ??= []).push(...lista); };

  const comodos = e.comodos.filter(c => ok(pontoDentro(c.contorno)));
  const porId = new Map(e.comodos.map(c => [c.id, c]));
  const de = (...usos: string[]) => comodos.filter(c => c.uso && usos.includes(c.uso));
  // Cozinha de cada apartamento: a cozinha / área de serviço lida; sem ela, a cozinha americana fica na sala.
  const cozinhas = (() => {
    const lista = de("cozinha");
    const comCozinha = new Set(lista.map(c => c.apto));
    for (const s of de("sala")) if (s.apto && !comCozinha.has(s.apto)) { lista.push(s); comCozinha.add(s.apto); }
    return lista;
  })();
  const molhados = [...de("banheiro"), ...cozinhas];
  const aberturas = e.aberturas.filter(o => ok(meio(o.a, o.b)));
  const vaos = e.vaos.filter(v => ok(meio(v.a, v.b)));
  const sacadas = e.sacadas.filter(s => ok(centroide(s.contorno)));
  const paredes = e.paredes.filter(p => ok(meio(p.a, p.b)));
  const shafts = de("shaft");
  const halls = de("hall");
  const ladoDoShaft = (o: AberturaPlanta) => {
    const outro = (o.entre ?? []).map(id => porId.get(id)).find(c => c?.uso !== "shaft");
    return outro?.apto ? "apto" : "hall";
  };
  const fechamentos = aberturas.filter(o => o.tipo === "shaft");
  // Shaft fechado de bloco na 1ª fiada: o fechamento em drywall fica na face maior que dá para um cômodo.
  for (const s of shafts) {
    if (fechamentos.some(o => o.entre?.includes(s.id))) continue;
    for (const ar of arestasDe(s.contorno)) {
      const dir = paraDentro(ar.a, ar.b, s.contorno);
      const m = meio(ar.a, ar.b);
      const fora = e.comodos.find(c => c.uso !== "shaft" && dentro([m[0] - dir[0] * 0.35, m[1] - dir[1] * 0.35], c.contorno));
      if (!fora) continue;
      const d = ESP_PAREDE + 0.06;
      fechamentos.push({ a: [ar.a[0] - dir[0] * d, ar.a[1] - dir[1] * d], b: [ar.b[0] - dir[0] * d, ar.b[1] - dir[1] * d], largura: comp(ar.a, ar.b), tipo: "shaft", entre: [s.id, fora.id] });
      break;
    }
  }
  const portas = aberturas.filter(o => o.entre && o.tipo && o.tipo !== "shaft" && o.tipo !== "elevador");

  // ---- ciclo 1: alvenaria, muretas, PCF, gradil, elétrica embutida, laje, para-raio
  for (const p of paredes) add(p.elevador ? "muretas" : "alvenaria", ...paredeComVaos(p, vaos, H, "bloco"));
  for (const o of portas) {
    const topo = o.altura ?? TOPO_PORTA;
    if (topo < H - 0.05) add("alvenaria", caixaNoSegmento(o.a, o.b, topo, H - topo, ESP_PAREDE, "bloco"));
  }
  for (const v of vaos.filter(x => x.tipo === "porta_sacada")) {
    const { a, b } = noEixo(v, e.contorno);
    const topo = v.peitoril + v.altura;
    if (topo < H - 0.05) add("alvenaria", caixaNoSegmento(a, b, topo, H - topo, ESP_PAREDE, "bloco"));
  }
  for (const o of aberturas.filter(x => x.tipo === "elevador")) {
    if (TOPO_VAO < H - 0.05) add("muretas", caixaNoSegmento(o.a, o.b, TOPO_VAO, H - TOPO_VAO, ESP_PAREDE, "bloco"));
  }
  for (const o of fechamentos) if (ladoDoShaft(o) === "hall") add("muretas", caixaNoSegmento(o.a, o.b, 0, 0.6, 0.09, "bloco"));
  for (const o of portas.filter(x => x.tipo === "pcf")) add("pcf", ...moldura(o.a, o.b, 0, (o.altura ?? TOPO_PORTA), 0.06, 0.16, "#7f1d1d"));
  for (const s of sacadas) {
    for (const [a, b] of s.bordas) {
      add("gradil", caixaNoSegmento(a, b, 1.05, 0.05, 0.05, "#334155"), caixaNoSegmento(a, b, 0.08, 0.03, 0.03, "#334155"));
      const n = Math.max(1, Math.floor(comp(a, b) / 0.12));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        add("gradil", caixaEm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 0.08, 0.018, 0.98, 0.018, ang(a, b), "#334155"));
      }
    }
  }

  // Pontos elétricos de cada cômodo: interruptor ao lado da porta e tomadas no meio das paredes maiores.
  const pontosEletricos: { p: Ponto; z: number; t: number }[] = [];
  const internos = de("sala", "dormitorio", "banheiro", "cozinha");
  for (const c of internos) {
    const n = c.uso === "sala" ? 3 : c.uso === "banheiro" ? 1 : 2;
    for (const ar of arestasDe(c.contorno).slice(0, n)) {
      const dir = paraDentro(ar.a, ar.b, c.contorno);
      const m = meio(ar.a, ar.b);
      pontosEletricos.push({ p: [m[0] + dir[0] * 0.04, m[1] + dir[1] * 0.04], z: c.uso === "banheiro" || c.uso === "cozinha" ? 1.1 : 0.3, t: ang(ar.a, ar.b) });
    }
    for (const o of portas.filter(x => x.entre?.includes(c.id))) {
      const t = ang(o.a, o.b);
      const dir = paraDentro(o.a, o.b, c.contorno);
      pontosEletricos.push({ p: [o.b[0] + Math.cos(t) * 0.2 + dir[0] * 0.04, o.b[1] + Math.sin(t) * 0.2 + dir[1] * 0.04], z: 1.1, t });
    }
  }
  for (const q of pontosEletricos) {
    add("caixinhas", caixaEm(q.p, q.z, 0.1, 0.1, 0.06, q.t, "#f97316"));
    add("tomadas", caixaEm(q.p, q.z + 0.015, 0.07, 0.07, 0.07, q.t, "#475569"));
    add("espelhos", caixaEm(q.p, q.z - 0.005, 0.12, 0.12, 0.08, q.t, "#f8fafc"));
  }

  // Quadro e caixa de sistemas ao lado da porta de entrada, do lado de dentro.
  const entradas = portas.filter(o => o.tipo === "entrada");
  const quadros: Ponto[] = [];
  for (const o of entradas) {
    const sala = (o.entre ?? []).map(id => porId.get(id)).find(c => c?.apto);
    if (!sala) continue;
    const t = ang(o.a, o.b);
    const dir = paraDentro(o.a, o.b, sala.contorno);
    const ux = Math.cos(t), uy = Math.sin(t);
    const q: Ponto = [o.b[0] + ux * 0.45 + dir[0] * 0.12, o.b[1] + uy * 0.45 + dir[1] * 0.12];
    const s: Ponto = [o.a[0] - ux * 0.4 + dir[0] * 0.1, o.a[1] - uy * 0.4 + dir[1] * 0.1];
    quadros.push(q);
    add("quadro", caixaEm(q, 1.4, 0.36, 0.48, 0.1, t, "#9ca3af"));
    add("disjuntores", caixaEm([q[0] + dir[0] * 0.03, q[1] + dir[1] * 0.03], 1.48, 0.28, 0.32, 0.08, t, "#1f2937"));
    add("caixas_sistemas", caixaEm(s, 0.35, 0.3, 0.3, 0.1, t, "#f1f5f9"));
    // Cavaletes no hall, um de cada lado da porta.
    const hall = (o.entre ?? []).map(id => porId.get(id)).find(c => c?.uso === "hall");
    if (hall) {
      const fora = paraDentro(o.a, o.b, hall.contorno);
      add("cavalete_agua", caixaEm([o.a[0] - ux * 0.45 + fora[0] * 0.14, o.a[1] - uy * 0.45 + fora[1] * 0.14], 0.9, 0.5, 0.6, 0.16, t, "#2563eb"));
      add("cavalete_gas", caixaEm([o.b[0] + ux * 0.45 + fora[0] * 0.14, o.b[1] + uy * 0.45 + fora[1] * 0.14], 0.9, 0.4, 0.5, 0.16, t, "#eab308"));
    }
    // Água e gás chegam pelo teto até os cômodos molhados.
    const apto = sala.apto;
    for (const m of molhados.filter(c => c.apto === apto)) {
      const alvo = pontoDentro(m.contorno);
      add("dist_agua", ...tubo(meio(o.a, o.b), alvo, H - 0.14, 0.04, "#3b82f6"), ...tubo(meio(o.a, o.b), [alvo[0] + 0.08, alvo[1] + 0.08], H - 0.2, 0.04, "#ef4444"));
      if (m.uso !== "banheiro") add("dist_gas", ...tubo(meio(o.a, o.b), alvo, H - 0.26, 0.035, "#eab308"));
    }
    // Enfiação de sistemas: do quadro até o meio de cada cômodo, rente ao teto.
    for (const c of internos.filter(x => x.apto === apto)) add("enfiacao_sistemas", ...tubo(q, pontoDentro(c.contorno), H - 0.04, 0.025, "#0ea5e9"));
  }

  // Para-raio: descidas nas quinas da fachada.
  for (const v of e.contorno.filter(ok)) add("para_raio", caixaEm(v, -0.25, 0.03, H + 0.25, 0.03, 0, "#b45309"));

  // ---- ciclo 3: hall, shafts, prumadas, esquadrias
  for (const h of [...halls, ...de("escada")]) for (const p of grade(h.contorno, 3)) add("iluminacao_hall", cilindro(p, H - 0.06, 0.13, 0.05, "#fde68a"));
  for (const o of fechamentos.filter(x => ladoDoShaft(x) === "hall")) add("arremate_shaft", ...moldura(o.a, o.b, 0.6, H - 0.65, 0.04, 0.12, "#e2e8f0"));
  for (const s of shafts) for (const ar of arestasDe(s.contorno)) {
    const dir = paraDentro(ar.a, ar.b, s.contorno);
    add("pintura_shaft", caixaNoSegmento(ar.a, ar.b, 0, H, 0.01, "#bfdbfe", (dir[0] * -Math.sin(ang(ar.a, ar.b)) + dir[1] * Math.cos(ang(ar.a, ar.b))) * 0.01));
  }
  // Prumadas: os shafts do hall levam água, gás e incêndio; os de dentro do apartamento, esgoto e pluvial.
  const shaftsHall = shafts.filter(s => fechamentos.some(o => o.entre?.includes(s.id) && ladoDoShaft(o) === "hall") || !fechamentos.some(o => o.entre?.includes(s.id)));
  const shaftsApto = shafts.filter(s => !shaftsHall.includes(s));
  const prumadas = (lista: ComodoPlanta[], tipos: [Elemento, string][]) => {
    for (const s of lista) {
      const l = limites(s.contorno);
      const longoX = l.largura >= l.profundidade;
      tipos.forEach(([el, cor], i) => {
        const t = (i + 1) / (tipos.length + 1);
        const p: Ponto = longoX ? [l.minX + l.largura * t, (l.minY + l.maxY) / 2] : [(l.minX + l.maxX) / 2, l.minY + l.profundidade * t];
        add(el, cilindro(p, -0.25, el === "prumada_incendio" ? 0.055 : 0.045, H + 0.25, cor));
      });
    }
  };
  prumadas(shaftsHall, [["prumada_agua", "#22c55e"], ["prumada_gas", "#eab308"], ["prumada_incendio", "#dc2626"], ...(shaftsApto.length ? [] : [["prumada_esgoto", "#92400e"], ["prumada_pluvial", "#64748b"]] as [Elemento, string][])]);
  prumadas(shaftsApto, [["prumada_esgoto", "#92400e"], ["prumada_pluvial", "#64748b"]]);
  const busway = shaftsHall[0];
  if (busway) { const p = pontoDentro(busway.contorno); add("busway", caixaEm([p[0] + 0.12, p[1]], -0.25, 0.12, H + 0.25, 0.08, 0, "#b45309")); }

  for (const v of vaos) {
    const { a, b, n } = noEixo(v, e.contorno);
    const t = ang(a, b), w = comp(a, b);
    const m = meio(a, b);
    if (v.tipo === "janela") {
      add("peitoril", caixaEm([m[0] - n[0] * 0.03, m[1] - n[1] * 0.03], v.peitoril - 0.03, w + 0.06, 0.03, ESP_PAREDE + 0.06, t, "#9ca3af"));
      add("caixilhos", caixaEm(m, v.peitoril, w - 0.06, v.altura - 0.04, 0.02, t, "vidro"), ...moldura(a, b, v.peitoril, v.altura - 0.04, 0.04, 0.06, "#e5e7eb"));
      add("guarnicao_janela", ...moldura(a, b, v.peitoril - 0.04, v.altura + 0.02, 0.06, 0.015, "#fafaf9", (ESP_PAREDE / 2 + 0.01) * (n[0] * -Math.sin(t) + n[1] * Math.cos(t))));
      add("cantoneira", caixaEm(a, v.peitoril, 0.025, v.altura, ESP_PAREDE + 0.02, t, "#cbd5e1"), caixaEm(b, v.peitoril, 0.025, v.altura, ESP_PAREDE + 0.02, t, "#cbd5e1"));
    } else {
      add("portas_sacada", caixaEm(m, 0.02, w - 0.06, v.altura - 0.04, 0.03, t, "vidro"), ...moldura(a, b, 0, v.altura - 0.04, 0.05, 0.08, "#e5e7eb"));
      add("soleira_sacada", caixaEm(m, -0.01, w + 0.04, 0.03, ESP_PAREDE + 0.04, t, "#9ca3af"));
      add("imper_soleira", caixaEm([m[0] - n[0] * 0.1, m[1] - n[1] * 0.1], -0.02, w + 0.3, 0.012, ESP_PAREDE + 0.3, t, "#2563eb"));
    }
  }
  for (const s of sacadas) {
    add("imper_sacada", placa(s.contorno, -0.03, 0.01, "#2563eb"));
    add("contrapiso_sacada", placa(s.contorno, -0.02, 0.03, "#a8a29e"));
    add("ceramica", placa(s.contorno, 0.01, 0.015, "ceramica"));
    const [a0, b0] = [s.contorno[0], s.contorno[1]];
    add("massa_sacada", caixaNoSegmento(a0, b0, 0, H + 0.2, 0.025, "#d6d3d1", -0.015));
  }
  for (const c of de("escada")) {
    add("regularizacao_escada", placa(c.contorno, 0, 0.02, "#9ca3af"));
    // Lance de degraus na metade comprida da escada, subindo até o pavimento de cima.
    const l = limites(c.contorno);
    const longoX = l.largura >= l.profundidade;
    const n = 16;
    const passo = (longoX ? l.largura : l.profundidade) * 0.7 / n;
    for (let i = 0; i < n; i++) {
      const p: Ponto = longoX ? [l.minX + l.largura * 0.15 + passo * (i + 0.5), l.minY + l.profundidade * 0.25] : [l.minX + l.largura * 0.25, l.minY + l.profundidade * 0.15 + passo * (i + 0.5)];
      add("regularizacao_escada", caixaEm(p, 0, passo, ((i + 1) * H) / n, (longoX ? l.profundidade : l.largura) * 0.45, longoX ? 0 : Math.PI / 2, "#a8a29e"));
    }
    for (const ar of arestasDe(c.contorno).slice(0, 2)) {
      const dir = paraDentro(ar.a, ar.b, c.contorno);
      add("corrimao", caixaNoSegmento([ar.a[0] + dir[0] * 0.06, ar.a[1] + dir[1] * 0.06], [ar.b[0] + dir[0] * 0.06, ar.b[1] + dir[1] * 0.06], 0.9, 0.05, 0.05, "#475569"));
    }
  }
  // Hidrante: no hall, perto da escada.
  const escada = de("escada")[0];
  if (halls[0]) {
    const alvo = escada ? pontoDentro(escada.contorno) : pontoDentro(halls[0].contorno);
    const ar = arestasDe(halls[0].contorno).map(x => ({ x, d: distSeg(alvo, x.a, x.b) })).sort((p, q) => p.d - q.d)[0]?.x;
    if (ar) {
      const dir = paraDentro(ar.a, ar.b, halls[0].contorno);
      const m = meio(ar.a, ar.b);
      add("hidrante", caixaEm([m[0] + dir[0] * 0.12, m[1] + dir[1] * 0.12], 0.5, 0.75, 0.9, 0.2, ang(ar.a, ar.b), "#dc2626"));
    }
  }

  // ---- ciclo 4: distribuições, soleiras
  const shaftMaisPerto = (p: Ponto) => [...shaftsApto, ...shaftsHall].map(s => ({ s, d: comp(p, pontoDentro(s.contorno)) })).sort((a, b) => a.d - b.d)[0]?.s;
  for (const m of molhados) {
    const c = pontoDentro(m.contorno);
    const s = shaftMaisPerto(c);
    if (s && comp(c, pontoDentro(s.contorno)) < 9) {
      add("dist_esgoto", ...tubo(c, pontoDentro(s.contorno), 0.01, 0.1, "#a16207"));
      if (m.uso === "banheiro") add("dist_ventilacao", ...tubo(c, pontoDentro(s.contorno), H - 0.32, 0.075, "#9ca3af"));
    }
  }
  for (const o of portas.filter(x => x.tipo === "entrada" || x.tipo === "banheiro" || x.tipo === "dormitorio" || x.tipo === "interna")) {
    add("soleiras", caixaNoSegmento(o.a, o.b, -0.005, 0.02, 0.16, "#9ca3af"));
  }

  // ---- ciclo 5: drywall dos shafts, kit de hidráulica
  for (const o of fechamentos) {
    const hall = ladoDoShaft(o) === "hall";
    const z0 = hall ? 0.6 : 0;
    const L = comp(o.a, o.b), t = ang(o.a, o.b);
    const n = Math.max(1, Math.round(L / 0.4));
    for (let i = 0; i <= n; i++) add("drywall_estrutura", caixaEm([o.a[0] + (o.b[0] - o.a[0]) * i / n, o.a[1] + (o.b[1] - o.a[1]) * i / n], z0, 0.05, H - z0, 0.07, t, "#94a3b8"));
    add("drywall_estrutura", caixaNoSegmento(o.a, o.b, z0, 0.03, 0.07, "#94a3b8"), caixaNoSegmento(o.a, o.b, H - 0.03, 0.03, 0.07, "#94a3b8"));
    add(hall ? "drywall_hall" : "drywall_apto", caixaNoSegmento(o.a, o.b, z0, H - z0, 0.1, "#f1f5f9"));
    add("massa_podre", caixaNoSegmento(o.a, o.b, H - 0.12, 0.12, 0.12, "#9ca3af"));
  }
  for (const m of molhados) {
    const ar = arestasDe(m.contorno)[0];
    if (!ar) continue;
    const dir = paraDentro(ar.a, ar.b, m.contorno);
    const p = meio(ar.a, ar.b);
    const t = ang(ar.a, ar.b);
    const ux = Math.cos(t) * 0.08, uy = Math.sin(t) * 0.08;
    add("kit_hidraulica", cilindro([p[0] + dir[0] * 0.05 - ux, p[1] + dir[1] * 0.05 - uy], 0, 0.016, 1.15, "#3b82f6"), cilindro([p[0] + dir[0] * 0.05 + ux, p[1] + dir[1] * 0.05 + uy], 0, 0.016, 1.15, "#ef4444"));
  }

  // ---- ciclo 6: impermeabilização, ventokit
  for (const m of de("banheiro", "cozinha")) add("imper_interna", placa(m.contorno, 0.005, 0.01, "#2563eb"));
  for (const b of de("banheiro")) {
    const c = pontoDentro(b.contorno);
    const fachada = e.contorno.map((v, i) => ({ a: v, b: e.contorno[(i + 1) % e.contorno.length] }))
      .map(x => ({ x, d: distSeg(c, x.a, x.b) })).sort((p, q) => p.d - q.d)[0];
    if (fachada && fachada.d < 8) {
      const t = Math.max(0, Math.min(1, ((c[0] - fachada.x.a[0]) * (fachada.x.b[0] - fachada.x.a[0]) + (c[1] - fachada.x.a[1]) * (fachada.x.b[1] - fachada.x.a[1])) / comp(fachada.x.a, fachada.x.b) ** 2));
      const alvo: Ponto = [fachada.x.a[0] + (fachada.x.b[0] - fachada.x.a[0]) * t, fachada.x.a[1] + (fachada.x.b[1] - fachada.x.a[1]) * t];
      add("ventokit", ...tubo(c, alvo, H - 0.42, 0.1, "#d1d5db"));
    }
    add("ventokit_acabamento", caixaEm(c, H - 0.33, 0.18, 0.02, 0.18, 0, "#f8fafc"));
  }

  // ---- ciclos 7 a 11: acabamentos
  for (const m of de("banheiro", "cozinha")) add("ceramica", placa(m.contorno, 0.01, 0.015, "ceramica"));
  for (const b of de("banheiro")) for (const ar of arestasDe(b.contorno)) {
    const dir = paraDentro(ar.a, ar.b, b.contorno);
    const t = ang(ar.a, ar.b);
    add("ceramica", caixaNoSegmento(ar.a, ar.b, 0, Math.min(H - 0.35, 2.2), 0.012, "ceramica", (dir[0] * -Math.sin(t) + dir[1] * Math.cos(t)) * 0.012));
  }
  for (const h of halls) add("ceramica", placa(h.contorno, 0.01, 0.015, "#cbd5e1"));
  for (const c of [...de("banheiro", "cozinha"), ...halls]) add("forro", placa(c.contorno, H - (c.uso === "hall" ? 0.35 : 0.28), 0.02, "#ffffff"));
  for (const c of de("sala", "dormitorio")) add("textura_teto", placa(c.contorno, H - 0.025, 0.02, "#fafaf9"));
  for (const c of de("sala", "dormitorio")) add("piso_laminado", placa(c.contorno, 0.005, 0.015, "madeira"));

  for (const b of de("banheiro")) {
    const [ar] = arestasDe(b.contorno);
    if (!ar) continue;
    const dir = paraDentro(ar.a, ar.b, b.contorno);
    const t = ang(ar.a, ar.b);
    const ux = Math.cos(t), uy = Math.sin(t);
    const m = meio(ar.a, ar.b);
    const vaso: Ponto = [m[0] - ux * 0.45 + dir[0] * 0.33, m[1] - uy * 0.45 + dir[1] * 0.33];
    const pia: Ponto = [m[0] + ux * 0.45 + dir[0] * 0.25, m[1] + uy * 0.45 + dir[1] * 0.25];
    add("loucas", caixaEm(vaso, 0, 0.38, 0.4, 0.6, t, "#ffffff"), caixaEm(pia, 0.78, 0.55, 0.12, 0.42, t, "#f8fafc"));
    add("metais", cilindro([pia[0] + dir[0] * -0.12, pia[1] + dir[1] * -0.12], 0.9, 0.02, 0.22, "#cbd5e1"));
    add("valvula_sifao", cilindro(pia, 0.45, 0.03, 0.33, "#e5e7eb"));
  }
  for (const c of cozinhas) {
    // bancada na parede molhada: a mais perto do banheiro do apartamento (na cozinha lida, a maior)
    const banho = de("banheiro").find(b => b.apto === c.apto);
    const lista = arestasDe(c.contorno);
    const [ar] = c.uso === "sala" && banho ? [...lista].sort((x, y) => distSeg(pontoDentro(banho.contorno), x.a, x.b) - distSeg(pontoDentro(banho.contorno), y.a, y.b)) : lista;
    if (!ar) continue;
    const dir = paraDentro(ar.a, ar.b, c.contorno);
    const t = ang(ar.a, ar.b);
    const m = meio(ar.a, ar.b);
    const bancada: Ponto = [m[0] + dir[0] * 0.3, m[1] + dir[1] * 0.3];
    const L = Math.min(1.6, comp(ar.a, ar.b) - 0.2);
    add("loucas", caixaEm(bancada, 0.85, L, 0.04, 0.6, t, "#57534e"), caixaEm(bancada, 0.72, 0.5, 0.14, 0.4, t, "#e5e7eb"));
    add("metais", cilindro([bancada[0] - dir[0] * 0.22, bancada[1] - dir[1] * 0.22], 0.89, 0.02, 0.26, "#cbd5e1"));
    add("valvula_sifao", cilindro(bancada, 0.45, 0.03, 0.3, "#e5e7eb"));
    const ux = Math.cos(t), uy = Math.sin(t);
    add("registro_gas", caixaEm([m[0] + ux * (L / 2 + 0.1) + dir[0] * 0.05, m[1] + uy * (L / 2 + 0.1) + dir[1] * 0.05], 0.55, 0.08, 0.08, 0.08, t, "#eab308"));
  }
  for (const o of portas.filter(x => x.tipo !== "pcf")) {
    const altura = Math.min(o.altura ?? 2.1, 2.1);
    const m = meio(o.a, o.b);
    add("portas_madeira", caixaEm(m, 0.01, Math.max(0.5, o.largura - 0.08), altura - 0.03, 0.035, ang(o.a, o.b), o.tipo === "entrada" ? "#78350f" : "madeira"));
    add("guarnicoes_porta", ...moldura(o.a, o.b, 0, altura, 0.05, ESP_PAREDE + 0.03, "#f5f5f4"));
  }

  // ---- conforme tipologia: fachada, elevador, hall
  const fachada = e.contorno.map((a, i) => ({ a, b: e.contorno[(i + 1) % e.contorno.length] })).filter(x => ok(meio(x.a, x.b)) && comp(x.a, x.b) > 0.05);
  for (const f of fachada) {
    const dir = paraDentro(f.a, f.b, e.contorno);
    const t = ang(f.a, f.b);
    const fora = -(dir[0] * -Math.sin(t) + dir[1] * Math.cos(t));
    add("fachada_selador", caixaNoSegmento(f.a, f.b, -0.25, H + 0.25, 0.02, "#e5e7eb", fora * 0.012));
    add("fachada_textura", caixaNoSegmento(f.a, f.b, -0.25, H + 0.25, 0.02, "#e7dcc8", fora * 0.03));
  }
  for (const el of de("elevador")) {
    for (const ar of arestasDe(el.contorno)) {
      const dir = paraDentro(ar.a, ar.b, el.contorno);
      const t = ang(ar.a, ar.b);
      add("regularizacao_elevador", caixaNoSegmento(ar.a, ar.b, 0, H, 0.012, "#cbd5e1", (dir[0] * -Math.sin(t) + dir[1] * Math.cos(t)) * 0.012));
    }
    const c = pontoDentro(el.contorno);
    const l = limites(el.contorno);
    add("elevadores", caixaEm(c, 0.02, Math.min(1.6, l.largura - 0.4), 2.3, Math.min(1.5, l.profundidade - 0.4), 0, "#94a3b8"));
  }
  for (const o of aberturas.filter(x => x.tipo === "elevador")) add("hall_arremates", ...moldura(o.a, o.b, 0, 2.2, 0.08, ESP_PAREDE + 0.04, "#64748b"));
  for (const h of halls) for (const ar of arestasDe(h.contorno)) {
    const dir = paraDentro(ar.a, ar.b, h.contorno);
    const t = ang(ar.a, ar.b);
    add("hall_arremates", caixaNoSegmento(ar.a, ar.b, 0.01, 0.07, 0.015, "#475569", (dir[0] * -Math.sin(t) + dir[1] * Math.cos(t)) * 0.01));
    const n = Math.floor(comp(ar.a, ar.b) / 4);
    for (let i = 1; i <= n; i++) {
      const s = i / (n + 1);
      add("arandelas", caixaEm([ar.a[0] + (ar.b[0] - ar.a[0]) * s + dir[0] * 0.06, ar.a[1] + (ar.b[1] - ar.a[1]) * s + dir[1] * 0.06], 2.0, 0.16, 0.2, 0.08, t, "#fbbf24"));
    }
  }
  // Escoramento: escoras sob a laje no meio dos cômodos.
  for (const c of comodos.filter(x => x.area >= 4 && x.uso !== "shaft" && x.uso !== "elevador")) {
    for (const p of grade(c.contorno, 1.6).slice(0, 6)) add("escoramento", cilindro(p, 0, 0.035, H, "#f59e0b"));
  }
  return pecas;
}

/** Onde pôr os ícones de cada apartamento (no chão da sala) e do hall. */
export function lugaresDosIcones(e: Pick<PlantaPecas, "comodos" | "filtro">): { aptos: Ponto[]; hall: Ponto[] } {
  const ok = e.filtro ?? (() => true);
  const aptos = new Map<string, ComodoPlanta>();
  for (const c of e.comodos) {
    if (!c.apto || !ok(pontoDentro(c.contorno))) continue;
    const atual = aptos.get(c.apto);
    if (!atual || (c.uso === "sala" && (atual.uso !== "sala" || c.area > atual.area)) || (atual.uso !== "sala" && c.area > atual.area)) aptos.set(c.apto, c);
  }
  const hall = e.comodos.filter(c => (c.uso === "hall" || c.uso === "escada") && ok(pontoDentro(c.contorno))).map(c => pontoDentro(c.contorno));
  return { aptos: [...aptos.values()].map(c => pontoDentro(c.contorno)), hall };
}
