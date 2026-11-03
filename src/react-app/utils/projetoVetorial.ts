/**
 * Leitura dos projetos em PDF vetorial (como saem do Construcode): escala da prancha, blocos da 1ª fiada pela legenda,
 * paredes reais, contorno da torre, pavimentos do corte esquemático e o carimbo (torre, tipo de prancha, pavimentos).
 * Tudo puro (sem pdf.js nem DOM) para testar; a extração das linhas fica em projetoPdfVetor.ts.
 */
import { dilatar, tracarBorda } from "./escadinhaPlanta.ts";
import { ortogonalizar, simplificar, type Pavimento, type Ponto, type ProjetoImportado, type QuantitativoFaixa, type RotuloVao, type TipoPavimento } from "./escadinha.ts";
import type { PaginaVetorial, PreenchidoPdf, RetanguloPdf, TextoPdf } from "./projetoPdfVetor.ts";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// ---------------------------------------------------------------- escala

/** Escala da prancha ("Escala 1 : 75", "ESC. 1/50"): o denominador mais citado; null se a prancha não disser. */
export function escalaDaPrancha(textos: TextoPdf[]): number | null {
  const contagem = new Map<number, number>();
  textos.forEach((t, i) => {
    const s = semAcento(t.s);
    let m = s.match(/^1\s*[:/]\s*(\d{2,4})$/);
    // "1 : 75" sozinho só vale perto da palavra escala.
    if (m && !textos.some((u, j) => j !== i && /^ESC/.test(semAcento(u.s)) && Math.abs(u.y - t.y) < 14 && Math.abs(u.x - t.x) < 120)) m = null;
    m ??= s.match(/ESC(?:ALA|\.)?\s*:?\s*1\s*[:/]\s*(\d{2,4})\b/);
    if (m) { const n = Number(m[1]); if (n >= 10 && n <= 1000) contagem.set(n, (contagem.get(n) ?? 0) + 1); }
  });
  let melhor: number | null = null;
  for (const [n, c] of contagem) if (melhor === null || c > (contagem.get(melhor) ?? 0)) melhor = n;
  return melhor;
}

/** Centímetros reais por ponto do PDF numa escala 1:n. */
export const cmPorPonto = (escala: number) => (2.54 / 72) * escala;

// ---------------------------------------------------------------- blocos

/**
 * Bloco em planta (cm reais, origem da prancha, y para baixo): centro, largura (x) e altura (y) do retângulo,
 * cor do traço e cor do que está pintado embaixo (null = nada).
 */
export interface Bloco { x: number; y: number; w: number; h: number; cor: string; fundo: string | null }

const ESPESSURAS = [9, 14, 19];

/** Índice espacial simples das áreas pintadas, para achar o que está embaixo de um ponto. */
function indicePreenchidos(preenchidos: PreenchidoPdf[], k: number) {
  const CEL = 100;
  const caixas = preenchidos.map(f => {
    const xs = f.pts.map(p => p[0] * k), ys = f.pts.map(p => p[1] * k);
    return { f, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const grade = new Map<string, number[]>();
  caixas.forEach((c, i) => {
    if ((c.x1 - c.x0) / CEL > 40 || (c.y1 - c.y0) / CEL > 40) return; // molduras e fundos enormes não interessam
    for (let gx = Math.floor(c.x0 / CEL); gx <= Math.floor(c.x1 / CEL); gx++) {
      for (let gy = Math.floor(c.y0 / CEL); gy <= Math.floor(c.y1 / CEL); gy++) {
        const chave = `${gx}|${gy}`;
        const l = grade.get(chave);
        if (l) l.push(i); else grade.set(chave, [i]);
      }
    }
  });
  /** Cor pintada sob o ponto (a última desenhada vence), exigindo área de pelo menos `minLado` cm no menor lado. */
  return (x: number, y: number, minLado: number): string | null => {
    let cor: string | null = null;
    for (const i of grade.get(`${Math.floor(x / CEL)}|${Math.floor(y / CEL)}`) ?? []) {
      const c = caixas[i];
      if (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1 || Math.min(c.x1 - c.x0, c.y1 - c.y0) < minLado) continue;
      if (dentroDe(x / k, y / k, c.f.pts)) cor = c.f.cor;
    }
    return cor;
  };
}

function dentroDe(x: number, y: number, pts: [number, number][]): boolean {
  let d = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/**
 * Blocos da prancha: retângulos traçados com tamanho de bloco (um lado de 9, 14 ou 19 cm e o outro até 60 cm, na escala
 * da prancha). Furos (retângulos dentro de outro) ficam de fora; guarda a cor pintada embaixo (vedação, sem função…).
 */
export function detectarBlocos(retangulos: RetanguloPdf[], preenchidos: PreenchidoPdf[], escala: number): Bloco[] {
  const k = cmPorPonto(escala);
  const sob = indicePreenchidos(preenchidos, k);
  const blocos: Bloco[] = [];
  const vistos = new Set<string>();
  for (const r of retangulos) {
    const w = (r.x1 - r.x0) * k, h = (r.y1 - r.y0) * k;
    const menor = Math.min(w, h), maior = Math.max(w, h);
    if (menor < 2.5 || maior > 60 || menor > 20) continue;
    if (!ESPESSURAS.some(e => Math.abs(w - e) < 0.8 || Math.abs(h - e) < 0.8)) continue;
    const x = ((r.x0 + r.x1) / 2) * k, y = ((r.y0 + r.y1) / 2) * k;
    const id = `${Math.round(x)}|${Math.round(y)}|${Math.round(w)}|${Math.round(h)}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    blocos.push({ x, y, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, cor: r.cor, fundo: sob(x, y, Math.min(w, h) * 0.8) });
  }
  return semFuros(blocos);
}

const caixaDo = (b: Bloco) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2, area: b.w * b.h });

/** Tira os retângulos cujo centro cai dentro de outro maior (furos do bloco, desenhos internos). */
function semFuros(blocos: Bloco[]): Bloco[] {
  const CEL = 60;
  const grade = new Map<string, number[]>();
  blocos.forEach((b, i) => {
    const c = caixaDo(b);
    for (let gx = Math.floor(c.x0 / CEL); gx <= Math.floor(c.x1 / CEL); gx++) {
      for (let gy = Math.floor(c.y0 / CEL); gy <= Math.floor(c.y1 / CEL); gy++) {
        const chave = `${gx}|${gy}`;
        const l = grade.get(chave);
        if (l) l.push(i); else grade.set(chave, [i]);
      }
    }
  });
  return blocos.filter((b, i) => {
    const area = caixaDo(b).area;
    const vizinhos = grade.get(`${Math.floor(b.x / CEL)}|${Math.floor(b.y / CEL)}`) ?? [];
    return !vizinhos.some(j => {
      if (j === i) return false;
      const c = caixaDo(blocos[j]);
      return c.area > area * 1.2 && b.x > c.x0 + 0.2 && b.x < c.x1 - 0.2 && b.y > c.y0 + 0.2 && b.y < c.y1 - 0.2;
    });
  });
}

// ---------------------------------------------------------------- legenda

export type CategoriaBloco = "estrutural" | "sem_funcao" | "vedacao" | "corta_fogo" | "acustico" | "canaleta" | "outro";

export interface TipoBloco {
  nome: string;
  comp: number;
  esp: number;
  categoria: CategoriaBloco;
  cor: string;
  fundo: string | null;
}

export const ROTULO_CATEGORIA: Record<CategoriaBloco, string> = {
  estrutural: "Estrutural", sem_funcao: "Sem função estrutural", vedacao: "Vedação", corta_fogo: "Corta-fogo",
  acustico: "Acústico", canaleta: "Canaleta", outro: "Outros",
};

function categoriaDoTitulo(titulo: string): CategoriaBloco {
  const t = semAcento(titulo);
  if (/SEM FUNCAO/.test(t)) return "sem_funcao";
  if (/VEDACAO/.test(t)) return "vedacao";
  if (/CORTA.?FOGO/.test(t)) return "corta_fogo";
  if (/ACUSTIC/.test(t)) return "acustico";
  return "estrutural";
}

/**
 * Família da cor pintada embaixo do bloco: neutra (nada, branco, cinza), clara (amarelo-claro) ou forte (amarelo).
 * A legenda e a planta nem sempre usam o mesmo tom, mas a família bate.
 */
export function familia(cor: string | null): "neutra" | "clara" | "forte" {
  if (!cor || !/^#[0-9a-f]{6}$/i.test(cor)) return "neutra";
  const n = parseInt(cor.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max ? (max - min) / max : 0;
  return sat < 0.12 ? "neutra" : sat < 0.45 ? "clara" : "forte";
}

/**
 * Tipos de bloco da legenda: cada "BLOCO 39 (39 x 19 x 14)" tem a amostra desenhada logo à esquerda, na mesma linha
 * (em qualquer escala); a cor do traço e o que está pintado nela identificam o tipo na planta, e o título do grupo
 * acima ("BLOCOS DE VEDAÇÃO", "(SEM FUNÇÃO ESTRUTURAL)"…) dá a categoria.
 */
export function lerLegenda(textos: TextoPdf[], retangulos: RetanguloPdf[], preenchidos: PreenchidoPdf[]): TipoBloco[] {
  const tipos: TipoBloco[] = [];
  const titulos = textos.filter(t => /^BLOCOS\b/.test(semAcento(t.s)));
  for (const t of textos) {
    const s = semAcento(t.s);
    const m = s.match(/^((?:BLOCO|CANALETA)\b[^(]*)\((\d{1,2})\s*X\s*\d{1,2}\s*X\s*(\d{1,2})\)/);
    if (!m) continue;
    const comp = Number(m[2]), esp = Number(m[3]);
    const meioY = t.y - t.h * 0.35;
    const amostra = retangulos
      .filter(r => r.x1 <= t.x + 1 && r.x1 > t.x - 45 && r.y0 - 2 < meioY && r.y1 + 2 > meioY && r.x1 - r.x0 < 80)
      .filter(r => { const a = (r.x1 - r.x0) / (r.y1 - r.y0); return Math.abs(a - comp / esp) / (comp / esp) < 0.25; })
      .sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
    if (!amostra) continue;
    const fundos = preenchidos.filter(f => {
      const cx = f.pts.reduce((v, p) => v + p[0], 0) / f.pts.length, cy = f.pts.reduce((v, p) => v + p[1], 0) / f.pts.length;
      return cx > amostra.x0 && cx < amostra.x1 && cy > amostra.y0 && cy < amostra.y1;
    }).map(f => f.cor).filter(c => familia(c) !== "neutra");
    const titulo = titulos
      .filter(u => u.y < t.y && t.y - u.y < 260 && Math.abs(u.x - t.x) < 130)
      .sort((a, b) => b.y - a.y)[0];
    const categoria: CategoriaBloco = /^CANALETA/.test(m[1]) ? "canaleta" : titulo ? categoriaDoTitulo(titulo.s) : "estrutural";
    const nome = m[1].trim().replace(/\s+/g, " ");
    const tipo: TipoBloco = { nome: `${nome[0]}${nome.slice(1).toLowerCase()} (${comp}×19×${esp})`, comp, esp, categoria, cor: amostra.cor, fundo: fundos[0] ?? null };
    if (!tipos.some(x => x.nome === tipo.nome && x.cor === tipo.cor && familia(x.fundo) === familia(tipo.fundo))) tipos.push(tipo);
  }
  return tipos;
}

const mede = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;

/**
 * Tipo de cada bloco pela legenda: tamanho (nos dois sentidos), cor do traço e família do que está pintado embaixo;
 * blocos inteiros vencem canaletas e "graute" no empate. Sem legenda que sirva, agrupa por tamanho.
 */
export function tipoDoBloco(b: Bloco, tipos: TipoBloco[]): TipoBloco & { horizontal: boolean } {
  const fam = familia(b.fundo);
  let melhor: { t: TipoBloco; horizontal: boolean; nota: number } | null = null;
  for (const t of tipos) {
    for (const horizontal of [true, false]) {
      const comp = horizontal ? b.w : b.h, esp = horizontal ? b.h : b.w;
      if (!mede(comp, t.comp) || !mede(esp, t.esp, 0.8)) continue;
      const nota = (t.cor === b.cor ? 4 : 0) + (familia(t.fundo) === fam ? 3 : 0) + (t.categoria === "canaleta" ? -1 : 0) + (/GRAUTE/i.test(t.nome) ? -1 : 0);
      if (nota < 3) continue;
      if (!melhor || nota > melhor.nota) melhor = { t, horizontal, nota };
    }
  }
  if (melhor) return { ...melhor.t, horizontal: melhor.horizontal };
  const horizontal = b.w >= b.h;
  const comp = Math.round(horizontal ? b.w : b.h), esp = ESPESSURAS.find(e => mede(horizontal ? b.h : b.w, e, 0.8)) ?? Math.round(Math.min(b.w, b.h));
  const categoria: CategoriaBloco = fam === "forte" || esp <= 9 ? "vedacao" : fam === "clara" ? "sem_funcao" : "outro";
  return { nome: `Bloco ${comp}×19×${esp}`, comp, esp, categoria, cor: b.cor, fundo: b.fundo, horizontal };
}

export interface ItemQuantitativo { nome: string; categoria: CategoriaBloco; comp: number; esp: number; qtd: number }

/** Quantidade de blocos por tipo (uma fiada). */
export function quantitativo(blocos: Bloco[], tipos: TipoBloco[]): ItemQuantitativo[] {
  const mapa = new Map<string, ItemQuantitativo>();
  for (const b of blocos) {
    const t = tipoDoBloco(b, tipos);
    const chave = `${t.categoria}|${t.nome}`;
    const it = mapa.get(chave);
    if (it) it.qtd++; else mapa.set(chave, { nome: t.nome, categoria: t.categoria, comp: t.comp, esp: t.esp, qtd: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.qtd - a.qtd);
}

// ---------------------------------------------------------------- planta principal

/**
 * Blocos da planta principal: agrupa por vizinhança (até ~2,5 m) e fica com o grupo maior, mais os grupos grandes
 * encostados nele (a mesma planta separada por um vão). Detalhes, legendas e cortes ficam de fora.
 */
export function blocosDaPlanta(blocos: Bloco[]): Bloco[] {
  if (!blocos.length) return [];
  const CEL = 100;
  const cel = (b: Bloco) => `${Math.floor(b.x / CEL)}|${Math.floor(b.y / CEL)}`;
  const ocupadas = new Map<string, number[]>();
  blocos.forEach((b, i) => { const k = cel(b); const l = ocupadas.get(k); if (l) l.push(i); else ocupadas.set(k, [i]); });
  const grupo = new Map<string, number>();
  const tamanhos: number[] = [];
  for (const inicio of ocupadas.keys()) {
    if (grupo.has(inicio)) continue;
    const id = tamanhos.length;
    let n = 0;
    const fila = [inicio];
    grupo.set(inicio, id);
    while (fila.length) {
      const atual = fila.pop()!;
      n += ocupadas.get(atual)!.length;
      const [gx, gy] = atual.split("|").map(Number);
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        const v = `${gx + dx}|${gy + dy}`;
        if (ocupadas.has(v) && !grupo.has(v)) { grupo.set(v, id); fila.push(v); }
      }
    }
    tamanhos.push(n);
  }
  const maior = tamanhos.indexOf(Math.max(...tamanhos));
  return blocos.filter(b => grupo.get(cel(b)) === maior);
}

// ---------------------------------------------------------------- paredes

/** Parede reta (cm da prancha): eixo de a até b, espessura e a categoria dos blocos (a que mais aparece nela). */
export interface ParedeCm { a: [number, number]; b: [number, number]; esp: number; cat?: CategoriaBloco }

/**
 * Junta blocos alinhados (mesma linha e espessura) em paredes; vãos até `vao` cm (juntas) não quebram a parede.
 * A direção e a espessura de cada bloco vêm do tipo (legenda), porque um bloco 9 de parede de 14 é mais curto que largo.
 */
export function paredesDosBlocos(blocos: Bloco[], tipos: TipoBloco[] = [], vao = 3): ParedeCm[] {
  const linhas = new Map<string, { a: number; b: number; cat: CategoriaBloco }[]>();
  for (const bl of blocos) {
    const t = tipoDoBloco(bl, tipos);
    if (Math.abs(bl.w - bl.h) < 1 && bl.w < 12) continue; // pedacinhos quadrados não definem direção
    const fixo = t.horizontal ? bl.y : bl.x;
    const meio = t.horizontal ? bl.x : bl.y;
    const comp = t.horizontal ? bl.w : bl.h;
    const chave = `${t.horizontal ? "h" : "v"}|${Math.round(fixo)}|${t.esp}`;
    const l = linhas.get(chave);
    const trecho = { a: meio - comp / 2, b: meio + comp / 2, cat: t.categoria };
    if (l) l.push(trecho); else linhas.set(chave, [trecho]);
  }
  const paredes: ParedeCm[] = [];
  for (const [chave, trechos] of linhas) {
    const [o, f, e] = chave.split("|");
    const fixo = Number(f), esp = Number(e);
    trechos.sort((p, q) => p.a - q.a);
    let atual = { a: trechos[0].a, b: trechos[0].b };
    // Comprimento de bloco por categoria na parede: a que mais aparece dá a categoria (canaleta não decide).
    let cats = new Map<CategoriaBloco, number>();
    const contar = (t: { a: number; b: number; cat: CategoriaBloco }) => cats.set(t.cat, (cats.get(t.cat) ?? 0) + (t.b - t.a) * (t.cat === "canaleta" ? 0.1 : 1));
    contar(trechos[0]);
    const fechar = () => {
      if (atual.b - atual.a < 10) return;
      const cat = [...cats].sort((x, y) => y[1] - x[1])[0]?.[0];
      paredes.push(o === "h" ? { a: [atual.a, fixo], b: [atual.b, fixo], esp, cat } : { a: [fixo, atual.a], b: [fixo, atual.b], esp, cat });
    };
    for (const t of trechos.slice(1)) {
      if (t.a <= atual.b + vao) atual.b = Math.max(atual.b, t.b);
      else { fechar(); atual = { a: t.a, b: t.b }; cats = new Map(); }
      contar(t);
    }
    fechar();
  }
  return paredes;
}

/**
 * Contorno externo a partir das paredes: desenha as paredes numa grade de 10 cm, fecha vãos de até ~3 m (sacadas,
 * portas de fachada) engrossando e afinando de volta, e usa a mesma detecção de região fechada da prancha rasterizada.
 * Devolve o contorno em cm da prancha.
 */
export function contornoDasParedes(paredes: ParedeCm[], fechar = 150): [number, number][] | null {
  if (!paredes.length) return null;
  const PX = 10, MARGEM = fechar + 100;
  const xs = paredes.flatMap(p => [p.a[0], p.b[0]]), ys = paredes.flatMap(p => [p.a[1], p.b[1]]);
  const x0 = Math.min(...xs) - MARGEM, y0 = Math.min(...ys) - MARGEM;
  const w = Math.ceil((Math.max(...xs) + MARGEM - x0) / PX), h = Math.ceil((Math.max(...ys) + MARGEM - y0) / PX);
  if (w * h > 8_000_000) return null;
  const parede = new Uint8Array(w * h);
  for (const p of paredes) {
    const e = p.esp / 2;
    const horizontal = Math.abs(p.a[1] - p.b[1]) < 1;
    const ax = Math.min(p.a[0], p.b[0]) - (horizontal ? 0 : e), bx = Math.max(p.a[0], p.b[0]) + (horizontal ? 0 : e);
    const ay = Math.min(p.a[1], p.b[1]) - (horizontal ? e : 0), by = Math.max(p.a[1], p.b[1]) + (horizontal ? e : 0);
    for (let py = Math.max(0, Math.floor((ay - y0) / PX)); py <= Math.min(h - 1, Math.floor((by - y0) / PX)); py++) {
      for (let px = Math.max(0, Math.floor((ax - x0) / PX)); px <= Math.min(w - 1, Math.floor((bx - x0) / PX)); px++) parede[py * w + px] = 1;
    }
  }
  const r = Math.round(fechar / PX);
  const grosso = dilatar(parede, w, h, r);
  // Água a partir da borda: o que ela alcança é fora da torre.
  const fora = new Uint8Array(w * h);
  const pilha: number[] = [];
  const molhar = (i: number) => { if (!fora[i] && !grosso[i]) { fora[i] = 1; pilha.push(i); } };
  for (let x = 0; x < w; x++) { molhar(x); molhar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { molhar(y * w); molhar(y * w + w - 1); }
  while (pilha.length) {
    const i = pilha.pop()!;
    const x = i % w;
    if (x > 0) molhar(i - 1);
    if (x < w - 1) molhar(i + 1);
    if (i >= w) molhar(i - w);
    if (i < w * (h - 1)) molhar(i + w);
  }
  // Afina de volta: engrossar o "fora" pelo mesmo raio devolve a fachada para a face das paredes.
  const foraGrosso = dilatar(fora, w, h, r);
  const torre = new Uint8Array(w * h);
  for (let i = 0; i < torre.length; i++) torre[i] = foraGrosso[i] ? 0 : 1;
  const borda = tracarBorda(torre, w, h);
  if (borda.length < 4) return null;
  // tolerância de ~40 cm: tira os dentes da grade sem perder os recuos da fachada
  let contorno = ortogonalizar(simplificar(borda, 4));
  if (contorno.length < 4) contorno = borda;
  return contorno.map(([x, y]) => [x * PX + x0, y * PX + y0] as [number, number]);
}

// ---------------------------------------------------------------- corte esquemático

export interface NivelCorte { nome: string; cota: number; laje?: number }

/**
 * Níveis do corte esquemático: cada nome de pavimento ("12º PAVIMENTO", "TÉRREO", "1º SUBSOLO", "BARRILETE", "COBERTURA")
 * fica logo abaixo da sua cota ("762,65"); "L13" é a laje (o número do L vem da prancha, como "TIPO (L3 A L5)").
 */
export function lerCorte(textos: TextoPdf[]): NivelCorte[] {
  const ancora = textos.find(t => /CORTE\s+ESQUEM/.test(semAcento(t.s)));
  const zona = (t: TextoPdf) => !ancora || (t.x > ancora.x - 120 && t.x < ancora.x + 420 && t.y > ancora.y - 10 && t.y < ancora.y + 1800);
  const cotas = textos.filter(t => zona(t) && /^\d{2,4},\d{2}$/.test(t.s)).map(t => ({ t, v: Number(t.s.replace(",", ".")) }));
  // Nome do nível: junta "12º" + "PAVIMENTO" da mesma linha.
  const linhas = new Map<number, TextoPdf[]>();
  for (const t of textos) {
    if (!zona(t) || t.vertical) continue;
    const k = Math.round(t.y / 3);
    const l = linhas.get(k) ?? linhas.get(k - 1) ?? linhas.get(k + 1);
    if (l) l.push(t); else linhas.set(k, [t]);
  }
  const nomes: { nome: string; x: number; y: number }[] = [];
  for (const l of linhas.values()) {
    l.sort((a, b) => a.x - b.x);
    const s = l.map(t => t.s).join(" ");
    const m = semAcento(s).match(/(\d{1,3}\s*[º°O]?\s*(?:PAVIMENTO|PAV\.?|SUBSOLO)|TERREO|BARRILETE|COBERTURA|ATICO|MEZANINO|CASA DE MAQUINAS)/);
    if (!m) continue;
    const t0 = l.find(t => semAcento(t.s).includes(m[1].split(/\s+/)[0])) ?? l[0];
    nomes.push({ nome: m[1].replace(/\s+/g, " "), x: t0.x, y: t0.y });
  }
  const lajes = textos.filter(t => zona(t) && /^L\d{1,3}$/.test(t.s)).map(t => ({ n: Number(t.s.slice(1)), y: t.y }));
  const niveis: NivelCorte[] = [];
  const usadas = new Set<number>();
  for (const n of nomes) {
    // cota: a mais perto acima do nome (até ~25 pt), a qualquer distância horizontal dentro do corte.
    let melhor = -1, d = Infinity;
    cotas.forEach((c, i) => {
      const dy = n.y - c.t.y;
      if (dy < -4 || dy > 30 || usadas.has(i)) return;
      if (dy < d) { d = dy; melhor = i; }
    });
    if (melhor < 0) continue;
    usadas.add(melhor);
    // laje: o L logo acima do nome (dentro do pavimento).
    const laje = lajes.filter(l => l.y < n.y && n.y - l.y < 40).sort((a, b) => b.y - a.y)[0]?.n;
    niveis.push({ nome: n.nome, cota: cotas[melhor].v, laje });
  }
  return niveis.sort((a, b) => a.cota - b.cota);
}

/** Tipo e id de pavimento a partir do nome do corte (ids iguais aos da montagem manual, para a escadinha casar). */
function classificar(nome: string, tipoIdx: { n: number }): { id: string; nome: string; sigla: string; tipo: TipoPavimento } | null {
  const s = semAcento(nome);
  let m = s.match(/(\d{1,2})\s*[º°O]?\s*SUBSOLO/);
  if (m) return { id: `ss${m[1]}`, nome: `Subsolo ${m[1]}`, sigla: `SS${m[1]}`, tipo: "subsolo" };
  if (/^SUBSOLO/.test(s)) return { id: "ss1", nome: "Subsolo 1", sigla: "SS1", tipo: "subsolo" };
  m = s.match(/(\d{1,3})\s*[º°O]?\s*PAV/);
  if (m) { tipoIdx.n = Number(m[1]); return { id: `p${m[1]}`, nome: `Pavimento ${m[1]}`, sigla: m[1], tipo: "tipo" }; }
  if (/TERREO/.test(s)) return { id: "terreo", nome: "Térreo", sigla: "T", tipo: "terreo" };
  if (/MEZANINO/.test(s)) return { id: "mezanino", nome: "Mezanino", sigla: "MZ", tipo: "mezanino" };
  if (/BARRILETE|CASA DE MAQUINAS/.test(s)) return { id: "barrilete", nome: "Barrilete", sigla: "BAR", tipo: "barrilete" };
  return null;
}

/**
 * Pilha de pavimentos pelo corte: altura de cada um = cota do próximo − cota dele. A cobertura (topo) só fecha a altura
 * do último. Devolve também o mapa laje → pavimento (para as pranchas "TIPO (L3 A L5)").
 */
export function pavimentosDoCorte(niveis: NivelCorte[]): { pavimentos: Pavimento[]; lajes: Record<number, string> } {
  const pavimentos: Pavimento[] = [];
  const lajes: Record<number, string> = {};
  const idx = { n: 0 };
  for (let i = 0; i < niveis.length; i++) {
    const nv = niveis[i];
    const c = classificar(nv.nome, idx);
    if (!c) continue;
    if (pavimentos.some(p => p.id === c.id)) continue;
    const prox = niveis[i + 1];
    const altura = prox ? Math.round((prox.cota - nv.cota) * 100) / 100 : 3;
    pavimentos.push({ ...c, altura: altura > 0.5 && altura < 12 ? altura : 3 });
    if (nv.laje !== undefined) lajes[nv.laje] = c.id;
  }
  return { pavimentos, lajes };
}

// ---------------------------------------------------------------- carimbo

export type TipoPrancha = "forma" | "modulacao" | "graute" | "elevacao" | "armacao" | "arquitetura" | "hidraulica" | "eletrica" | "implantacao" | "outro";

export const ROTULO_PRANCHA: Record<TipoPrancha, string> = {
  forma: "Fôrma", modulacao: "Modulação (1ª fiada)", graute: "Graute", elevacao: "Elevação de paredes", armacao: "Armação",
  arquitetura: "Arquitetura", hidraulica: "Hidráulica", eletrica: "Elétrica", implantacao: "Implantação", outro: "Outra",
};

export interface Carimbo {
  arquivo: string;
  disciplina: string | null;
  tipo: TipoPrancha;
  /** Torres do título ("TORRES 1 E 3" → [1, 3]); vazio = vale para todas. */
  torres: number[];
  titulo: string | null;
  /** Lajes que a prancha cobre ("(L3 A L5)" → 3..5). */
  lajes: [number, number] | null;
  revisao: string | null;
}

const CODIGOS: Record<string, TipoPrancha> = {
  FOR: "forma", MOD: "modulacao", GRT: "graute", ELV: "elevacao", ARM: "armacao", ARQ: "arquitetura",
  HID: "hidraulica", ELE: "eletrica", IMP: "implantacao",
};

/**
 * Torres pelo código do nome do arquivo, quando o título não diz (arquitetura com texto em curvas): TIA/TOA = torre A (1),
 * TIB/TOB = B (2), TIC/TOC = C (3), TAC = torres A e C (1 e 3).
 */
export function torresDoCodigo(partes: string[]): number[] {
  const n = (l: string) => l.charCodeAt(0) - 64;
  for (const p of partes) {
    const m = p.match(/^T[IO]([A-H])$/);
    if (m) return [n(m[1])];
    const d = p.match(/^T([A-H])([A-H])$/);
    if (d && d[1] !== d[2]) return [n(d[1]), n(d[2])];
  }
  return [];
}

/** Nome da prancha sem a revisão ("…-304-MOD-TIA_R04.pdf" → "…-304-MOD-TIA") e a revisão em número (T04 < R04). */
export function revisaoDoArquivo(arquivo: string): { base: string; ordem: number } {
  const nome = arquivo.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").toUpperCase();
  const m = nome.match(/^(.*?)[-_ ]([RT])(\d{2})$/);
  if (!m) return { base: nome, ordem: -1 };
  return { base: m[1], ordem: Number(m[3]) * 2 + (m[2] === "R" ? 1 : 0) };
}

/** Só a revisão mais nova de cada prancha (pacotes do Construcode costumam trazer as antigas junto). */
export function revisoesVigentes<T>(itens: T[], nome: (t: T) => string): { vigentes: T[]; antigas: T[] } {
  const melhor = new Map<string, { item: T; ordem: number }>();
  for (const it of itens) {
    const { base, ordem } = revisaoDoArquivo(nome(it));
    const atual = melhor.get(base);
    if (!atual || ordem > atual.ordem) melhor.set(base, { item: it, ordem });
  }
  const vigentes = new Set([...melhor.values()].map(v => v.item));
  return { vigentes: itens.filter(i => vigentes.has(i)), antigas: itens.filter(i => !vigentes.has(i)) };
}

/** A prancha precisa ser aberta (desenho)? Fôrma, 1ª fiada e graute da estrutura; o resto entra só pelo nome. */
export function precisaDesenho(arquivo: string): boolean {
  const partes = semAcento(arquivo.replace(/\.[^.]+$/, "")).split(/[-_ ]+/);
  const temCodigo = partes.some(p => p in CODIGOS || /^(EST|ARQ|HID|ELE|INC|FUN|PAI)$/.test(p));
  if (!temCodigo) return true; // nome fora do padrão: abre para ler o carimbo
  return partes.includes("EST") && partes.some(p => p === "MOD" || p === "FOR" || p === "GRT");
}

/**
 * Corte consolidado de várias pranchas da torre: para cada cota, o nome mais votado. Nome repetido em cotas diferentes
 * (o "1º PAVIMENTO" que alguma prancha escreve como "TÉRREO") vira o pavimento que falta antes do seguinte.
 */
export function corteConsolidado(listas: NivelCorte[][]): NivelCorte[] {
  const porCota = new Map<string, { cota: number; nomes: Map<string, number>; lajes: Map<number, number> }>();
  for (const lista of listas) {
    for (const n of lista) {
      const k = n.cota.toFixed(2);
      const e = porCota.get(k) ?? { cota: n.cota, nomes: new Map(), lajes: new Map() };
      const nome = semAcento(n.nome).replace(/\s+/g, " ");
      e.nomes.set(nome, (e.nomes.get(nome) ?? 0) + 1);
      if (n.laje !== undefined) e.lajes.set(n.laje, (e.lajes.get(n.laje) ?? 0) + 1);
      porCota.set(k, e);
    }
  }
  const mais = <K,>(m: Map<K, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const niveis = [...porCota.values()].sort((a, b) => a.cota - b.cota).map(e => ({ nome: mais(e.nomes)!, cota: e.cota, laje: mais(e.lajes) }));
  const numero = (s: string) => Number(s.match(/^(\d{1,3})\s*[º°O]?\s*PAV/)?.[1] ?? NaN);
  const vistos = new Set<string>();
  return niveis.map((n, i) => {
    if (!vistos.has(n.nome)) { vistos.add(n.nome); return n; }
    const prox = niveis.slice(i + 1).map(x => numero(x.nome)).find(Number.isFinite);
    const nome = prox && prox > 1 ? `${prox - 1}º PAVIMENTO` : n.nome;
    vistos.add(nome);
    return { ...n, nome };
  }).filter((n, i, l) => l.findIndex(x => x.nome === n.nome) === i);
}

/** Lê o carimbo: tipo pelo código do nome do arquivo (…-EST-LO-304-MOD-TIA_R04), torre e pavimentos pelo título. */
export function lerCarimbo(arquivo: string, textos: TextoPdf[]): Carimbo {
  const nome = semAcento(arquivo.replace(/\.[^.]+$/, ""));
  const partes = nome.split(/[-_ ]+/);
  const codigo = partes.find(p => p in CODIGOS);
  const disciplina = partes.find(p => /^(EST|ARQ|HID|ELE|INC|IMP|PAI|FUN)$/.test(p)) ?? null;
  const revisao = nome.match(/[_-]([RT]\d{2})$/)?.[1] ?? null;
  // Título: "TORRE 1 - ..." mais as linhas logo abaixo (mesmo x e tamanho), como o carimbo quebra o texto.
  // O do carimbo (canto de baixo à direita) é o título oficial da prancha; senão, o maior/mais longo.
  const larg = Math.max(1, ...textos.map(t => t.x)), alt = Math.max(1, ...textos.map(t => t.y));
  const candidatos = textos
    .filter(t => /^TORRES?\s+\d/.test(semAcento(t.s)))
    .map(t => {
      let s = t.s, y = t.y;
      for (;;) {
        const prox = textos.find(u => u !== t && Math.abs(u.x - t.x) < 2 && Math.abs(u.h - t.h) < 0.5 && u.y > y && u.y - y < t.h * 1.8);
        if (!prox) break;
        s = `${s} ${prox.s}`; y = prox.y;
      }
      return { t, s, carimbo: t.x > larg * 0.75 && t.y > alt * 0.75 };
    })
    .filter(x => /PLANTA|IMPLANTA|ELEVA|ACO|ARMA|FORMA|GRAUTE|CHUMBA/.test(semAcento(x.s)))
    .sort((a, b) => Number(b.carimbo) - Number(a.carimbo) || b.t.h - a.t.h || b.s.length - a.s.length);
  const titulo = candidatos[0]?.s ?? null;
  const st = titulo ? semAcento(titulo) : "";
  const doTitulo = (st.match(/^TORRES?\s+([\d\s,E]+?)\s*-/)?.[1] ?? "").match(/\d+/g)?.map(Number) ?? [];
  const torres = doTitulo.length ? doTitulo : torresDoCodigo(partes);
  const faixa = st.match(/\(\s*L\s*(\d{1,3})\s*(?:A|-|AO)\s*L?\s*(\d{1,3})\s*\)/) ?? st.match(/\(\s*L\s*(\d{1,3})\s*L\s*(\d{1,3})\s*\)/);
  const unica = st.match(/\(\s*L\s*(\d{1,3})\s*\)/);
  let tipo: TipoPrancha = codigo ? CODIGOS[codigo] : "outro";
  if (tipo === "outro") {
    if (/FORMA/.test(st)) tipo = "forma"; else if (/FIADA/.test(st)) tipo = "modulacao"; else if (/ELEVA/.test(st)) tipo = "elevacao";
  }
  return {
    arquivo,
    disciplina,
    tipo,
    torres,
    titulo,
    lajes: faixa ? [Number(faixa[1]), Number(faixa[2])] : unica ? [Number(unica[1]), Number(unica[1])] : null,
    revisao,
  };
}

// ---------------------------------------------------------------- o que falta

export interface ItemChecklist { item: string; ok: boolean; detalhe: string }

/**
 * Confere o pacote de projetos de uma torre: o que já dá para usar e o que falta pedir para o modelo ficar completo
 * (e para a medição de empreiteiro sair certa).
 */
export function checklistProjetos(carimbos: Carimbo[], torre: number | null, lajesTipo: number[]): ItemChecklist[] {
  const daTorre = carimbos.filter(c => torre === null || !c.torres.length || c.torres.includes(torre));
  const de = (t: TipoPrancha) => daTorre.filter(c => c.tipo === t);
  const cobertas = new Set<number>();
  for (const c of de("modulacao")) if (c.lajes) for (let l = c.lajes[0]; l <= c.lajes[1]; l++) cobertas.add(l);
  const faltam = lajesTipo.filter(l => !cobertas.has(l));
  const lista: ItemChecklist[] = [
    { item: "Fôrma do pavimento tipo", ok: de("forma").length > 0, detalhe: de("forma").length ? `${de("forma").length} prancha(s): lajes, vigas e níveis.` : "Peça a planta de fôrmas (FOR) para áreas e volume de laje." },
    {
      item: "1ª fiada (modulação) de todos os pavimentos tipo",
      ok: de("modulacao").length > 0 && faltam.length === 0,
      detalhe: !de("modulacao").length ? "Sem a modulação (MOD) não há paredes nem quantitativo de blocos."
        : faltam.length ? `Faltam as lajes ${resumirFaixa(faltam)}.` : `${de("modulacao").length} prancha(s) cobrindo L${Math.min(...cobertas)} a L${Math.max(...cobertas)}.`,
    },
    { item: "Elevações das paredes", ok: de("elevacao").length > 0, detalhe: de("elevacao").length ? `${de("elevacao").length} prancha(s): fiadas, vãos e pontos elétricos.` : "Peça as elevações (ELV) para vãos de portas/janelas e fiadas." },
    { item: "Graute e armação vertical", ok: de("graute").length > 0, detalhe: de("graute").length ? `${de("graute").length} prancha(s).` : "Peça o projeto de graute (GRT)." },
    { item: "Arquitetura (layout dos apartamentos)", ok: de("arquitetura").length > 0, detalhe: de("arquitetura").length ? "Nomes e cômodos dos apartamentos." : "Sem a arquitetura os apartamentos ficam desenhados à mão (peça a planta de layout do tipo, ARQ)." },
    { item: "Térreo, subsolo e cobertura", ok: daTorre.some(c => /TERREO|SUBSOLO|COBERTURA|BARRILETE/.test(semAcento(c.titulo ?? ""))), detalhe: "Plantas dos pavimentos diferentes (hoje o 3D repete o tipo)." },
    { item: "Instalações (hidráulica/elétrica)", ok: de("hidraulica").length + de("eletrica").length > 0, detalhe: de("hidraulica").length + de("eletrica").length ? "Prumadas e shafts." : "Para prumadas e shafts reais no 3D." },
    { item: "Implantação / periferia", ok: de("implantacao").length > 0, detalhe: de("implantacao").length ? "Torres e periferia no terreno." : "Para posicionar as torres e montar a periferia." },
  ];
  return lista;
}

function resumirFaixa(nums: number[]): string {
  const s = [...nums].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    partes.push(i === j ? `L${s[i]}` : `L${s[i]}–L${s[j]}`);
    i = j;
  }
  return partes.join(", ");
}

// ---------------------------------------------------------------- vãos (rótulos da 1ª fiada)

/**
 * Rótulo de vão escrito na 1ª fiada: "81 x 216" (largura × altura, cm) ao lado da porta, "121 x 121" fora da fachada,
 * na frente da janela (texto deitado = janela numa parede em pé da planta e vice-versa). Posição em cm da prancha.
 */
export interface RotuloVaoCm { w: number; h: number; x: number; y: number; vertical: boolean }

/** Rótulos de vão da planta (só os que caem na caixa dela, fora detalhes e legenda). */
export function rotulosDeVaos(textos: TextoPdf[], k: number, dentroDaPlanta: (x: number, y: number) => boolean): RotuloVaoCm[] {
  const saida: RotuloVaoCm[] = [];
  for (const t of textos) {
    const m = t.s.trim().match(/^(\d{2,3})\s*[xX×]\s*(\d{2,3})$/);
    if (!m) continue;
    const w = Number(m[1]), h = Number(m[2]);
    if (w < 20 || w > 400 || h < 20 || h > 300) continue;
    // centro do texto: o ponto do pdf.js é o começo da linha de base
    const largura = t.s.length * t.h * 0.5;
    const x = (t.vertical ? t.x - t.h * 0.35 : t.x + largura / 2) * k;
    const y = (t.vertical ? t.y - largura / 2 : t.y - t.h * 0.35) * k;
    if (!dentroDaPlanta(x, y)) continue;
    saida.push({ w, h, x, y, vertical: t.vertical });
  }
  return saida;
}

/** Notas "AS ALVENARIAS DE FECHAMENTO SERÃO EXECUTADAS APÓS A INSTALAÇÃO DO EQUIPAMENTO" (paredes do elevador), em cm. */
export function notasDoElevador(textos: TextoPdf[], k: number, dentroDaPlanta: (x: number, y: number) => boolean): [number, number][] {
  return textos
    .filter(t => /ALVENARIAS? DE FECHAMENTO/.test(semAcento(t.s)))
    .map(t => [(t.x + t.s.length * t.h * 0.25) * k, t.y * k] as [number, number])
    .filter(([x, y]) => dentroDaPlanta(x, y));
}

// ---------------------------------------------------------------- análise de uma prancha

export interface PranchaLida {
  carimbo: Carimbo;
  escala: number | null;
  niveis: NivelCorte[];
  /** Só nas pranchas de modulação. */
  paredes: ParedeCm[];
  quantitativo: ItemQuantitativo[];
  totalBlocos: number;
  contorno: [number, number][] | null;
  /** Junta de dilatação escrita na planta: reta horizontal (y) ou vertical (x), em cm da prancha. */
  junta: { horizontal: boolean; valor: number } | null;
  /** Rótulos dos vãos (portas, janelas, portas-sacada) e notas das paredes do elevador, em cm da prancha. */
  rotulos?: RotuloVaoCm[];
  notasElevador?: [number, number][];
}

/**
 * Junta de dilatação: a cota "2 (JUNTA DE DILATAÇÃO)" fica escrita ao longo da medida da junta. Texto em pé = a junta
 * é uma reta horizontal (na altura do texto); texto deitado = reta vertical.
 */
export function juntaDaPrancha(textos: TextoPdf[], escala: number, perto?: (x: number, y: number) => boolean): { horizontal: boolean; valor: number } | null {
  const k = cmPorPonto(escala);
  const achados = textos.filter(t => /JUNTA\s+(DE\s+)?DILATA/.test(semAcento(t.s)) && (!perto || perto(t.x * k, t.y * k)));
  if (!achados.length) return null;
  const horizontal = achados.filter(t => t.vertical).length >= achados.length / 2;
  const lista = achados.filter(t => t.vertical === horizontal);
  const valor = (lista.reduce((v, t) => v + (horizontal ? t.y : t.x), 0) / lista.length) * k;
  return { horizontal, valor };
}

/** Analisa uma página já extraída: carimbo, escala, corte e, se for 1ª fiada, blocos, paredes e contorno. */
export function analisarPrancha(arquivo: string, pagina: PaginaVetorial): PranchaLida {
  const carimbo = lerCarimbo(arquivo, pagina.textos);
  const escala = escalaDaPrancha(pagina.textos);
  const niveis = lerCorte(pagina.textos);
  const base: PranchaLida = { carimbo, escala, niveis, paredes: [], quantitativo: [], totalBlocos: 0, contorno: null, junta: null };
  if (!escala || carimbo.tipo !== "modulacao") return base;
  const tipos = lerLegenda(pagina.textos, pagina.retangulos, pagina.preenchidos);
  const planta = blocosDaPlanta(detectarBlocos(pagina.retangulos, pagina.preenchidos, escala));
  const paredes = paredesDosBlocos(planta, tipos);
  const contorno = contornoDasParedes(paredes);
  const xs = planta.map(b => b.x), ys = planta.map(b => b.y);
  const caixa = { x0: Math.min(...xs) - 300, x1: Math.max(...xs) + 300, y0: Math.min(...ys) - 300, y1: Math.max(...ys) + 300 };
  const naPlanta = (x: number, y: number) => x > caixa.x0 && x < caixa.x1 && y > caixa.y0 && y < caixa.y1;
  const junta = juntaDaPrancha(pagina.textos, escala, naPlanta);
  const k = cmPorPonto(escala);
  return {
    ...base, paredes, quantitativo: quantitativo(planta, tipos), totalBlocos: planta.length, contorno, junta,
    rotulos: rotulosDeVaos(pagina.textos, k, naPlanta), notasElevador: notasDoElevador(pagina.textos, k, naPlanta),
  };
}

// ---------------------------------------------------------------- para a torre (metros)

/** Parede no sistema da torre (m, centrado, y para cima). */
export interface ParedeTorre { a: Ponto; b: Ponto; esp: number; cat?: CategoriaBloco }

/** Converte contorno e paredes de cm da prancha para metros centrados (y para cima), como o resto da Escadinha. */
export function paraMetros(contornoCm: [number, number][], paredes: ParedeCm[]): { contorno: Ponto[]; paredes: ParedeTorre[]; m: (p: [number, number]) => Ponto } {
  const xs = contornoCm.map(p => p[0]), ys = contornoCm.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const m = ([x, y]: [number, number]): Ponto => [r((x - cx) / 100), r(-(y - cy) / 100)];
  let contorno = contornoCm.map(m);
  // sentido anti-horário (área positiva), como contornoEmMetros
  let s = 0;
  for (let i = 0; i < contorno.length; i++) { const [x1, y1] = contorno[i], [x2, y2] = contorno[(i + 1) % contorno.length]; s += x1 * y2 - x2 * y1; }
  if (s < 0) contorno = contorno.reverse();
  return { contorno, paredes: paredes.map(p => ({ a: m(p.a), b: m(p.b), esp: Math.round(p.esp) / 100, ...(p.cat ? { cat: p.cat } : {}) })), m };
}

// ---------------------------------------------------------------- pacote → torre

/** Torres que aparecem no pacote (pelas pranchas de 1ª fiada, que são as que montam o modelo). */
export function torresDoPacote(pranchas: PranchaLida[]): number[] {
  const set = new Set<number>();
  for (const p of pranchas) if (p.paredes.length) p.carimbo.torres.forEach(t => set.add(t));
  return [...set].sort((a, b) => a - b);
}

const somaMetros = (paredes: ParedeCm[]) => {
  const m: Record<string, number> = {};
  for (const p of paredes) {
    const l = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) / 100;
    m[String(p.esp)] = Math.round(((m[String(p.esp)] ?? 0) + l) * 100) / 100;
  }
  return m;
};

export interface TorreDoPacote {
  contorno: Ponto[];
  paredes: ParedeTorre[];
  pavimentos: Pavimento[];
  /** Divisão dos lados pela junta (null = deixa a automática). */
  junta: { a: Ponto; b: Ponto } | null;
  projeto: ProjetoImportado;
  /** Rótulos dos vãos e notas do elevador da 1ª fiada base (m, sistema da torre). */
  rotulos: RotuloVao[];
  notasElevador: Ponto[];
}

/**
 * Junta tudo o que veio do pacote para uma torre: paredes e contorno da 1ª fiada das lajes mais baixas, pavimentos
 * do corte esquemático, junta de dilatação, quantitativo por faixa de pavimentos e o que falta pedir.
 */
export function montarTorreDoPacote(pranchas: PranchaLida[], torre: number | null, hoje: string): TorreDoPacote | null {
  const daTorre = pranchas.filter(p => torre === null || !p.carimbo.torres.length || p.carimbo.torres.includes(torre));
  const porLaje = (a: PranchaLida, b: PranchaLida) => (a.carimbo.lajes?.[0] ?? 99) - (b.carimbo.lajes?.[0] ?? 99);
  const mods = daTorre.filter(p => p.paredes.length && p.contorno).sort(porLaje);
  // O modelo é o pavimento tipo: subsolo, térreo/transfer e cobertura têm outra planta e não servem de base.
  let tipos = mods.filter(ehModulacaoTipo);
  // Sem a 1ª fiada do tipo desta torre: usa a da torre gêmea, se o projeto diz que é a mesma ("TORRES 1 E 3").
  let gemea: number | null = null;
  if (!tipos.length && torre !== null) {
    const irmas = new Set(pranchas.filter(p => p.carimbo.torres.length > 1 && p.carimbo.torres.includes(torre)).flatMap(p => p.carimbo.torres));
    irmas.delete(torre);
    for (const g of [...irmas].sort((a, b) => a - b)) {
      const dela = pranchas.filter(p => p.carimbo.torres.length === 1 && p.carimbo.torres[0] === g && p.paredes.length && p.contorno && ehModulacaoTipo(p)).sort(porLaje);
      if (dela.length) { tipos = dela; gemea = g; break; }
    }
  }
  const base = tipos[0] ?? [...mods].sort((a, b) => b.paredes.length - a.paredes.length)[0];
  if (!base?.contorno) return null;
  const corte = corteConsolidado(daTorre.map(p => p.niveis).filter(l => l.length >= 3));
  const { pavimentos, lajes } = pavimentosDoCorte(corte);
  const { contorno, paredes, m: emMetros } = paraMetros(base.contorno, base.paredes);
  // mesma transformação para a junta
  const xs = base.contorno.map(p => p[0]), ys = base.contorno.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  let junta: TorreDoPacote["junta"] = null;
  if (base.junta) {
    const lx = contorno.map(p => p[0]), ly = contorno.map(p => p[1]);
    const v = base.junta.horizontal ? -(base.junta.valor - cy) / 100 : (base.junta.valor - cx) / 100;
    junta = base.junta.horizontal
      ? { a: [Math.min(...lx) - 2, v], b: [Math.max(...lx) + 2, v] }
      : { a: [v, Math.min(...ly) - 2], b: [v, Math.max(...ly) + 2] };
  }
  const tiposDePav = new Set(pavimentos.map(p => p.id));
  const quantitativos: QuantitativoFaixa[] = (tipos.length ? tipos : mods).map(p => {
    const ids: string[] = [];
    if (p.carimbo.lajes) for (let l = p.carimbo.lajes[0]; l <= p.carimbo.lajes[1]; l++) if (lajes[l] && tiposDePav.has(lajes[l]) && /^p\d+$/.test(lajes[l])) ids.push(lajes[l]);
    return { arquivo: p.carimbo.arquivo, lajes: p.carimbo.lajes, pavimentos: ids, itens: p.quantitativo, metrosPorEspessura: somaMetros(p.paredes) };
  });
  const lajesTipo = Object.entries(lajes).filter(([, id]) => /^p\d+$/.test(id) && id !== "p1").map(([l]) => Number(l));
  const checklist = checklistProjetos([...daTorre, ...(gemea !== null ? tipos : [])].map(p => p.carimbo), torre, lajesTipo).map(c => {
    if (!/^1ª fiada/.test(c.item)) return c;
    if (gemea !== null) return { ...c, ok: true, detalhe: `Sem 1ª fiada do tipo própria: usando a da Torre ${gemea} (o projeto trata as duas como a mesma tipologia). Confira e peça a prancha da torre se for diferente.` };
    if (!tipos.length) return { ...c, ok: false, detalhe: `Falta a 1ª fiada do PAVIMENTO TIPO: o modelo saiu da prancha ${base.carimbo.titulo ?? base.carimbo.arquivo}, que é outro pavimento.` };
    return c;
  });
  return {
    contorno,
    paredes,
    pavimentos,
    junta,
    rotulos: (base.rotulos ?? []).map(r => ({ w: r.w, h: r.h, p: emMetros([r.x, r.y]), vertical: r.vertical })),
    notasElevador: (base.notasElevador ?? []).map(emMetros),
    projeto: {
      importadoEm: hoje,
      torre,
      escala: base.escala,
      pranchas: daTorre.map(p => ({ arquivo: p.carimbo.arquivo, tipo: p.carimbo.tipo, titulo: p.carimbo.titulo, revisao: p.carimbo.revisao })),
      quantitativos,
      checklist,
    },
  };
}

/** 1ª fiada do pavimento tipo: título "…PAVIMENTO TIPO…" ou código TIA/TIB/TIC no nome (TEA = térreo, COA = cobertura, PSA = subsolo). */
export function ehModulacaoTipo(p: PranchaLida): boolean {
  if (p.carimbo.tipo !== "modulacao") return false;
  const titulo = semAcento(p.carimbo.titulo ?? "");
  if (titulo) return /PAVIMENTO TIPO|PAV\.? TIPO|\bTIPO\b/.test(titulo) && !/TERREO|SUBSOLO|COBERTURA|BARRILETE/.test(titulo);
  return /(^|[-_ ])TI[A-H]([-_ ]|$)/.test(semAcento(p.carimbo.arquivo.replace(/\.[^.]+$/, "")));
}

// ---------------------------------------------------------------- quantitativo × escadinha (medição)

export interface LinhaResumoBlocos { categoria: CategoriaBloco; rotulo: string; total: number; executado: number }

export interface ResumoBlocos {
  linhas: LinhaResumoBlocos[];
  total: number;
  executado: number;
  /** Pavimentos tipo cobertos pelas pranchas de 1ª fiada. */
  pavimentos: number;
  metros: number;
}

/**
 * Blocos da 1ª fiada da torre inteira (cada prancha vale para os pavimentos das lajes dela) e quanto já foi assentado:
 * `feito(pav)` diz a fração do pavimento com a alvenaria executada (0 a 1), pela escadinha.
 */
export function resumoBlocos(projeto: ProjetoImportado, feito: (idPavimento: string) => number): ResumoBlocos {
  const mapa = new Map<CategoriaBloco, LinhaResumoBlocos>();
  let metros = 0;
  const pavs = new Set<string>();
  for (const f of projeto.quantitativos) {
    const fracao = f.pavimentos.reduce((s, p) => s + Math.max(0, Math.min(1, feito(p))), 0);
    f.pavimentos.forEach(p => pavs.add(p));
    metros += Object.values(f.metrosPorEspessura).reduce((s, v) => s + v, 0) * f.pavimentos.length;
    for (const it of f.itens) {
      const cat = (it.categoria in ROTULO_CATEGORIA ? it.categoria : "outro") as CategoriaBloco;
      const l = mapa.get(cat) ?? { categoria: cat, rotulo: ROTULO_CATEGORIA[cat], total: 0, executado: 0 };
      l.total += it.qtd * f.pavimentos.length;
      l.executado += it.qtd * fracao;
      mapa.set(cat, l);
    }
  }
  const linhas = [...mapa.values()].map(l => ({ ...l, executado: Math.round(l.executado) })).sort((a, b) => b.total - a.total);
  return {
    linhas,
    total: linhas.reduce((s, l) => s + l.total, 0),
    executado: linhas.reduce((s, l) => s + l.executado, 0),
    pavimentos: pavs.size,
    metros: Math.round(metros),
  };
}

/** Peso de cada lado pelo comprimento das paredes reais (para a medição de meio pavimento). */
export function pesoDosLados(paredes: { a: Ponto; b: Ponto }[], lado: (p: Ponto) => "A" | "B"): { A: number; B: number } {
  let a = 0, b = 0;
  for (const p of paredes) {
    const l = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    if (lado([(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2]) === "A") a += l; else b += l;
  }
  const t = a + b;
  return t ? { A: a / t, B: b / t } : { A: 0.5, B: 0.5 };
}
