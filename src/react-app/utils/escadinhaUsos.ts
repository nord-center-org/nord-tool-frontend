/**
 * O que cada cômodo e cada vão é, pelos rótulos que o projeto escreve na 1ª fiada: "71 x 216" ao lado da porta do
 * banheiro, "81 x 216" na do dormitório, "91 x 216" na entrada, "121 x 121" fora da fachada na frente da janela,
 * "141 x 236" na porta-sacada. A porta que liga o hall à escada é a corta-fogo; o cômodo pequeno do miolo com a nota
 * "as alvenarias de fechamento serão executadas após a instalação do equipamento" é o elevador.
 * Tudo em metros, y para cima, sem DOM (testável em node).
 */
import {
  area, dentro, limites, type AberturaPlanta, type ComodoPlanta, type ParedeReal, type Ponto, type RotuloVao, type SacadaPlanta, type TipoAbertura,
  type UsoComodo, type VaoFachada,
} from "./escadinha.ts";

/** Profundidade da sacada (m) e quanto ela passa da porta-sacada de cada lado: medidas da fôrma (rebaixo de -4 cm). */
export const SACADA = { profundidade: 0.8, sobra: 0.5 };
/** Topo dos vãos (m): a janela de 121 com peitoril de 115 termina na mesma altura da porta-sacada de 236. */
const TOPO_VAO = 2.36;

export interface PlantaClassificada {
  comodos: ComodoPlanta[];
  aberturas: AberturaPlanta[];
  paredes: ParedeReal[];
  vaos: VaoFachada[];
  sacadas: SacadaPlanta[];
}

const meio = (a: Ponto, b: Ponto): Ponto => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: Ponto, b: Ponto) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Tipo do rótulo: porta (até 1,25 m de largura e altura de porta), porta-sacada, janela ou visita de shaft. */
export function tipoDoRotulo(r: Pick<RotuloVao, "w" | "h">): "porta" | "porta_sacada" | "janela" | "visita" {
  if (r.w <= 60 && r.h <= 60) return "visita";
  if (r.h >= 200) return r.w > 125 ? "porta_sacada" : "porta";
  return "janela";
}

/** Tipo da porta pela largura do rótulo: 91 entrada, 81 dormitório, 71 banheiro, 1,0 m ou mais corta-fogo. */
function tipoDaPorta(w: number): TipoAbertura {
  if (w >= 100) return "pcf";
  if (w >= 86) return "entrada";
  if (w >= 76) return "dormitorio";
  return "banheiro";
}

/** Contorno no sentido anti-horário (o interior fica à esquerda de cada aresta). */
function antiHorario(c: Ponto[]): Ponto[] {
  return area(c) < 0 ? [...c].reverse() : c;
}

/**
 * Classifica cômodos e vãos. `comodos` e `aberturas` vêm de lerComodos (já com hall, apartamentos e shafts); os rótulos
 * dizem o resto. Sem rótulos, só separa os fechamentos de shaft e marca as paredes do elevador pelo que der.
 */
export function classificarPlanta(
  comodosIn: ComodoPlanta[], aberturasIn: AberturaPlanta[], paredesIn: ParedeReal[], contornoIn: Ponto[], rotulos: RotuloVao[] = [], notasElevador: Ponto[] = [],
): PlantaClassificada {
  const comodos = comodosIn.map(c => ({ ...c }));
  const aberturas = aberturasIn.map(o => ({ ...o, entre: o.entre ? [...o.entre] as [string, string] : undefined }));
  const paredes = paredesIn.map(p => ({ ...p }));
  const contorno = antiHorario(contornoIn);
  const porId = new Map(comodos.map(c => [c.id, c]));
  const noPonto = (p: Ponto) => comodos.find(c => dentro(p, c.contorno));
  const usar = (c: ComodoPlanta | undefined, uso: UsoComodo, forca = false) => { if (c && (forca || !c.uso)) c.uso = uso; };

  // Cômodos de uso comum: hall, shaft e escada já vêm da leitura.
  for (const c of comodos) {
    if (c.tipo === "hall") c.uso = "hall";
    else if (c.tipo === "shaft") c.uso = "shaft";
  }

  // Vão que fecha um shaft não é porta: é o fechamento (drywall ou autoclave).
  for (const o of aberturas) {
    if (o.tipo === "elevador") continue;
    if (o.entre?.some(id => porId.get(id)?.uso === "shaft")) { o.tipo = "shaft"; o.entrada = false; }
  }

  // ---- portas: cada rótulo fica no vão livre mais perto com a largura dele
  const idxLivres = aberturas.map((o, i) => (o.tipo !== "shaft" && o.tipo !== "elevador" ? i : -1)).filter(i => i >= 0);
  const livres = new Set(idxLivres);
  const portas = rotulos.filter(r => tipoDoRotulo(r) === "porta").sort((a, b) => b.w - a.w);
  for (const r of portas) {
    let melhor = -1, nota = Infinity;
    for (const i of idxLivres) {
      if (!livres.has(i)) continue;
      const o = aberturas[i];
      const d = dist(meio(o.a, o.b), r.p);
      const dw = Math.abs(o.largura * 100 - r.w);
      if (d > 1.8 || dw > 25) continue;
      const n = d + dw / 20;
      if (n < nota) { nota = n; melhor = i; }
    }
    if (melhor < 0) continue;
    livres.delete(melhor);
    const o = aberturas[melhor];
    const tipo = tipoDaPorta(r.w);
    o.tipo = tipo === "pcf" && o.entre?.some(id => porId.get(id)?.apto) ? "interna" : tipo;
    o.altura = r.h / 100;
    const lados = (o.entre ?? []).map(id => porId.get(id)).filter((c): c is ComodoPlanta => !!c);
    if (!lados.length) continue;
    const comRotulo = lados.find(c => dentro(r.p, c.contorno));
    const menor = [...lados].sort((a, b) => a.area - b.area)[0];
    if (o.tipo === "banheiro") usar(menor, "banheiro", true);
    else if (o.tipo === "dormitorio") usar(comRotulo && comRotulo.apto ? comRotulo : menor, "dormitorio");
    else if (o.tipo === "entrada") usar(lados.find(c => c.apto), "sala");
    else if (o.tipo === "pcf") usar(lados.find(c => c.uso !== "hall" && !c.apto), "escada", true);
  }
  for (const o of aberturas) {
    if (o.tipo) continue;
    o.tipo = o.entrada ? "entrada" : "interna";
  }

  // ---- janelas e portas-sacada: o rótulo fica fora da fachada, na frente do vão
  const vaos: VaoFachada[] = [];
  const sacadas: SacadaPlanta[] = [];
  const arestas = contorno.map((a, i) => ({ a, b: contorno[(i + 1) % contorno.length] }));
  for (const r of rotulos) {
    const tipo = tipoDoRotulo(r);
    if (tipo !== "janela" && tipo !== "porta_sacada") continue;
    let melhor: { a: Ponto; b: Ponto; t: number; d: number; nota: number } | null = null;
    for (const e of arestas) {
      const emPe = Math.abs(e.a[0] - e.b[0]) < 0.05; // aresta em pé na planta (x fixo)
      const deitada = Math.abs(e.a[1] - e.b[1]) < 0.05;
      if (!emPe && !deitada) continue;
      // Texto deitado costuma ficar ao lado de parede em pé e vice-versa (a porta-sacada nem sempre): o contrário pesa mais.
      const contraria = r.vertical ? !deitada : !emPe;
      const comp = dist(e.a, e.b);
      if (comp < r.w / 100 - 0.05) continue;
      const ux = (e.b[0] - e.a[0]) / comp, uy = (e.b[1] - e.a[1]) / comp;
      const t = (r.p[0] - e.a[0]) * ux + (r.p[1] - e.a[1]) * uy;
      if (t < -0.2 || t > comp + 0.2) continue;
      // fora da torre: à direita da aresta (o contorno é anti-horário)
      const lado = (r.p[0] - e.a[0]) * -uy + (r.p[1] - e.a[1]) * ux;
      const d = -lado;
      if (d < -0.3 || d > 2) continue;
      const nota = Math.abs(d) + (contraria ? 0.8 : 0);
      if (contraria && tipo === "janela" && d > 0.6) continue;
      if (!melhor || nota < melhor.nota) melhor = { a: e.a, b: e.b, t, d, nota };
    }
    if (!melhor) continue;
    const comp = dist(melhor.a, melhor.b);
    const ux = (melhor.b[0] - melhor.a[0]) / comp, uy = (melhor.b[1] - melhor.a[1]) / comp;
    const w = r.w / 100;
    const t = Math.max(w / 2, Math.min(comp - w / 2, melhor.t));
    const a: Ponto = [melhor.a[0] + ux * (t - w / 2), melhor.a[1] + uy * (t - w / 2)];
    const b: Ponto = [melhor.a[0] + ux * (t + w / 2), melhor.a[1] + uy * (t + w / 2)];
    const nx = -uy, ny = ux; // para dentro
    const c = meio(a, b);
    const sala = noPonto([c[0] + nx * 0.5, c[1] + ny * 0.5]);
    const altura = r.h / 100;
    const peitoril = tipo === "porta_sacada" ? 0 : Math.max(0.1, Math.round((TOPO_VAO - altura) * 100) / 100);
    if (vaos.some(v => v.tipo === tipo && dist(meio(v.a, v.b), c) < 0.3)) continue;
    vaos.push({ tipo, a, b, peitoril, altura, comodo: sala?.id });
    if (tipo === "porta_sacada") {
      usar(sala, "sala", true);
      const s = SACADA.sobra, p = SACADA.profundidade;
      const a0: Ponto = [a[0] - ux * s, a[1] - uy * s], b0: Ponto = [b[0] + ux * s, b[1] + uy * s];
      const a1: Ponto = [a0[0] - nx * p, a0[1] - ny * p], b1: Ponto = [b0[0] - nx * p, b0[1] - ny * p];
      sacadas.push({ contorno: [a0, b0, b1, a1], bordas: [[b0, b1], [b1, a1], [a1, a0]], apto: sala?.apto });
    } else if (r.w >= 135) {
      usar(sala, "sala");
    }
  }

  // Vão da 1ª fiada que é a porta-sacada (ou fica dentro dela) não é porta interna.
  const sacadasVao = vaos.filter(v => v.tipo === "porta_sacada");
  for (let i = aberturas.length - 1; i >= 0; i--) {
    const c = meio(aberturas[i].a, aberturas[i].b);
    if (sacadasVao.some(v => dist(meio(v.a, v.b), c) < dist(v.a, v.b) / 2 + 0.3)) aberturas.splice(i, 1);
  }

  // ---- elevador: o poço com a nota "alvenarias de fechamento… após a instalação do equipamento" escrita dentro
  const comuns = comodos.filter(c => !c.apto && c.uso !== "hall" && c.uso !== "shaft");
  for (const n of notasElevador) {
    const c = comuns.find(x => x.area >= 1.5 && x.area <= 16 && dentro(n, x.contorno));
    usar(c, "elevador", true);
  }
  for (const c of comuns) if (!c.uso) c.uso = c.tipo === "escada" ? "escada" : "outro";

  // Frente do poço (os trechos na linha da porta do elevador): a alvenaria de fechamento só sobe depois do equipamento.
  const portasElev = aberturas.filter(o => o.tipo === "elevador");
  for (const p of paredes) {
    const h = Math.abs(p.a[1] - p.b[1]) < 0.02;
    p.elevador = portasElev.some(o => {
      const oh = Math.abs(o.a[1] - o.b[1]) < 0.02;
      if (oh !== h || Math.abs(h ? o.a[1] - p.a[1] : o.a[0] - p.a[0]) > 0.05) return false;
      return [p.a, p.b].some(q => [o.a, o.b].some(r => dist(q, r) < 0.1));
    }) || undefined;
    if (!p.elevador) delete p.elevador;
  }

  // ---- o resto do apartamento: pequeno é cozinha / área de serviço, grande é sala
  for (const c of comodos) {
    if (!c.apto) continue;
    if (!c.uso) c.uso = c.area < 6 ? "cozinha" : "sala";
    c.tipo = c.uso === "banheiro" || c.uso === "cozinha" ? "molhado" : "apartamento";
  }
  for (const c of comodos) if (c.uso === "escada") c.tipo = "escada";
  for (const c of comodos) if (c.uso === "elevador") c.tipo = "outro";

  return { comodos, aberturas, paredes, vaos, sacadas };
}

/** Caixa do conjunto, para testes e enquadramento. */
export function caixaDosVaos(vaos: VaoFachada[]) {
  return limites(vaos.flatMap(v => [v.a, v.b]));
}
