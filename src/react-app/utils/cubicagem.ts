/**
 * Cubicagem (Mapeamentos): volume de concreto das peças de um projeto estrutural em PDF. Regras puras, testáveis em
 * node: leitura das peças salvas, volume de cada peça, totais por tipo, perda, busca da peça no texto do PDF
 * (código e seção, ex.: "V12 (14x50)", "P5 20/60", "L3 h=12") e medida no desenho pela escala.
 */

export type TipoPeca = "VIGA" | "PILAR" | "LAJE" | "FUNDACAO" | "OUTRO";
/** RET: b × h × comprimento; CIRC: diâmetro × comprimento; AREA: área × espessura; VOLUME: m³ informado. */
export type FormaPeca = "RET" | "CIRC" | "AREA" | "VOLUME";

export const ROTULO_TIPO: Record<TipoPeca, string> = {
  VIGA: "Vigas", PILAR: "Pilares", LAJE: "Lajes", FUNDACAO: "Fundações", OUTRO: "Outras peças",
};
export const ROTULO_TIPO_UM: Record<TipoPeca, string> = {
  VIGA: "Viga", PILAR: "Pilar", LAJE: "Laje", FUNDACAO: "Fundação", OUTRO: "Outra",
};
export const ROTULO_FORMA: Record<FormaPeca, string> = {
  RET: "Retangular (b × h × comprimento)", CIRC: "Circular (Ø × comprimento)", AREA: "Área × espessura", VOLUME: "Volume direto",
};
export const ORDEM_TIPOS: TipoPeca[] = ["FUNDACAO", "PILAR", "VIGA", "LAJE", "OUTRO"];

export interface Desconto {
  id: string;
  /** Ex.: "Trecho dentro do P5". */
  desc: string;
  /** m³ a abater (já para todas as unidades da linha). */
  m3: number | null;
}

export interface Peca {
  id: string;
  codigo: string;
  tipo: TipoPeca;
  forma: FormaPeca;
  /** cm */
  b: number | null;
  /** cm */
  h: number | null;
  /** cm (circular) */
  d: number | null;
  /** m */
  comp: number | null;
  /** m² */
  area: number | null;
  /** cm */
  esp: number | null;
  /** m³ (forma VOLUME) */
  vol: number | null;
  qtd: number;
  descontos: Desconto[];
  /** Onde foi achada no PDF. */
  origem?: { arquivo: string; pagina: number } | null;
  obs?: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const TIPOS = new Set<TipoPeca>(["VIGA", "PILAR", "LAJE", "FUNDACAO", "OUTRO"]);
const FORMAS = new Set<FormaPeca>(["RET", "CIRC", "AREA", "VOLUME"]);
let seq = 0;
export const novoId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Lê as peças salvas de forma tolerante (o que não for reconhecido vira vazio, nada quebra a tela). */
export function lerPecas(json: unknown): Peca[] {
  if (!Array.isArray(json)) return [];
  return json.filter(p => p && typeof p === "object").slice(0, 2000).map(o => {
    const p = o as Record<string, unknown>;
    const tipo = TIPOS.has(p.tipo as TipoPeca) ? (p.tipo as TipoPeca) : "OUTRO";
    const forma = FORMAS.has(p.forma as FormaPeca) ? (p.forma as FormaPeca) : formaPadrao(tipo);
    const origem = p.origem && typeof p.origem === "object" ? p.origem as Record<string, unknown> : null;
    return {
      id: texto(p.id, 40) || novoId(),
      codigo: texto(p.codigo, 40),
      tipo, forma,
      b: num(p.b), h: num(p.h), d: num(p.d), comp: num(p.comp), area: num(p.area), esp: num(p.esp), vol: num(p.vol),
      qtd: Math.max(1, Math.min(9999, Math.round(num(p.qtd) ?? 1))),
      descontos: Array.isArray(p.descontos)
        ? p.descontos.filter(d => d && typeof d === "object").slice(0, 50).map(x => {
          const d = x as Record<string, unknown>;
          return { id: texto(d.id, 40) || novoId(), desc: texto(d.desc, 120), m3: num(d.m3) };
        })
        : [],
      origem: origem && typeof origem.arquivo === "string" && typeof origem.pagina === "number"
        ? { arquivo: origem.arquivo.slice(0, 200), pagina: origem.pagina } : null,
      obs: texto(p.obs, 500) || undefined,
    };
  });
}

export const formaPadrao = (tipo: TipoPeca): FormaPeca => (tipo === "LAJE" ? "AREA" : "RET");

export function pecaNova(codigo = "", tipo: TipoPeca = tipoDoCodigo(codigo)): Peca {
  return {
    id: novoId(), codigo, tipo, forma: formaPadrao(tipo),
    b: null, h: null, d: null, comp: null, area: null, esp: null, vol: null, qtd: 1, descontos: [], origem: null,
  };
}

/** Tipo pelo prefixo do código: V (viga), P (pilar), L (laje), S/B/E/T (sapata, bloco, estaca, tubulão). */
export function tipoDoCodigo(codigo: string): TipoPeca {
  const c = normalizarCodigo(codigo);
  if (/^(VB|VC|VA|V)\d/.test(c)) return "VIGA";
  if (/^(PC|PR|P)\d/.test(c)) return "PILAR";
  if (/^(LT|LN|L)\d/.test(c)) return "LAJE";
  if (/^(SAP|BL|EST|TB|S|B|E|T)\d/.test(c)) return "FUNDACAO";
  return "OUTRO";
}

/** "v 12", "V-12", "v12" → "V12". */
export const normalizarCodigo = (codigo: string) => codigo.toUpperCase().replace(/[\s\-_.]/g, "");

const arred = (n: number, casas = 4) => Math.round(n * 10 ** casas) / 10 ** casas;

export interface VolumePeca {
  /** m³ de uma unidade (null se faltar medida). */
  unitario: number | null;
  /** unitário × quantidade. */
  bruto: number | null;
  descontos: number;
  /** bruto − descontos (nunca negativo). */
  liquido: number | null;
  /** O que falta para calcular. */
  falta: string[];
}

/** Volume em m³: medidas de seção em cm, comprimento em m, área em m², espessura em cm. */
export function volumeDaPeca(p: Peca): VolumePeca {
  const falta: string[] = [];
  const precisa = (v: number | null, nome: string) => { if (v == null || v <= 0) falta.push(nome); return v ?? 0; };
  let unit = 0;
  if (p.forma === "RET") unit = (precisa(p.b, "largura") / 100) * (precisa(p.h, "altura") / 100) * precisa(p.comp, "comprimento");
  else if (p.forma === "CIRC") unit = Math.PI * ((precisa(p.d, "diâmetro") / 100) / 2) ** 2 * precisa(p.comp, "comprimento");
  else if (p.forma === "AREA") unit = precisa(p.area, "área") * (precisa(p.esp, "espessura") / 100);
  else unit = precisa(p.vol, "volume");
  const descontos = arred(p.descontos.reduce((s, d) => s + (d.m3 ?? 0), 0));
  if (falta.length) return { unitario: null, bruto: null, descontos, liquido: null, falta };
  const bruto = arred(unit * p.qtd);
  return { unitario: arred(unit), bruto, descontos, liquido: arred(Math.max(0, bruto - descontos)), falta };
}

export interface TotalTipo { tipo: TipoPeca; pecas: number; incompletas: number; bruto: number; descontos: number; liquido: number }
export interface Totais { porTipo: TotalTipo[]; bruto: number; descontos: number; liquido: number; perda: number; comPerda: number; incompletas: number }

/** Totais por tipo (na ordem da obra: fundação, pilar, viga, laje, outras) e geral, com a perda (%) por cima. */
export function totais(pecas: Peca[], perdaPct: number): Totais {
  const mapa = new Map<TipoPeca, TotalTipo>();
  for (const p of pecas) {
    const t = mapa.get(p.tipo) ?? { tipo: p.tipo, pecas: 0, incompletas: 0, bruto: 0, descontos: 0, liquido: 0 };
    const v = volumeDaPeca(p);
    t.pecas += p.qtd;
    if (v.liquido == null) t.incompletas += 1;
    else {
      t.bruto = arred(t.bruto + (v.bruto ?? 0));
      t.descontos = arred(t.descontos + v.descontos);
      t.liquido = arred(t.liquido + v.liquido);
    }
    mapa.set(p.tipo, t);
  }
  const porTipo = ORDEM_TIPOS.filter(t => mapa.has(t)).map(t => mapa.get(t) as TotalTipo);
  const soma = (k: "bruto" | "descontos" | "liquido") => arred(porTipo.reduce((s, t) => s + t[k], 0));
  const liquido = soma("liquido");
  const pct = Math.max(0, Math.min(50, perdaPct || 0));
  const perda = arred(liquido * pct / 100);
  return {
    porTipo, bruto: soma("bruto"), descontos: soma("descontos"), liquido, perda, comPerda: arred(liquido + perda),
    incompletas: porTipo.reduce((s, t) => s + t.incompletas, 0),
  };
}

// ---------- busca no PDF ----------

/** Pedaço de texto de uma página do PDF, com a posição (pontos do PDF, origem embaixo à esquerda). */
export interface TrechoPdf { str: string; x: number; y: number; w: number; h: number }

/** Linha de texto montada dos pedaços (o CAD costuma quebrar "V12 (14x50)" em vários pedaços). */
export interface LinhaPdf { texto: string; pagina: number; x: number; y: number; w: number; h: number }

/** Junta os pedaços que estão na mesma linha (mesmo y, perto um do outro) em ordem de x. Texto girado fica como veio. */
export function montarLinhas(trechos: TrechoPdf[], pagina: number): LinhaPdf[] {
  const itens = trechos.filter(t => t.str.trim()).slice().sort((a, b) => b.y - a.y);
  // 1) faixas de mesma altura; 2) em cada faixa, ordem de x, quebrando onde há um vão grande.
  const faixas: TrechoPdf[][] = [];
  for (const t of itens) {
    const f = faixas[faixas.length - 1];
    if (f && Math.abs(f[0].y - t.y) <= Math.max(1.5, f[0].h * 0.4)) f.push(t);
    else faixas.push([t]);
  }
  const linhas: { partes: TrechoPdf[] }[] = [];
  for (const f of faixas) {
    f.sort((a, b) => a.x - b.x);
    let atual: TrechoPdf[] = [];
    for (const t of f) {
      const u = atual[atual.length - 1];
      if (u && t.x - (u.x + u.w) > Math.max(6, t.h * 1.5)) { linhas.push({ partes: atual }); atual = []; }
      atual.push(t);
    }
    if (atual.length) linhas.push({ partes: atual });
  }
  return linhas.map(({ partes }) => {
    let s = "";
    partes.forEach((p, i) => {
      if (i > 0) {
        const ant = partes[i - 1];
        if (p.x - (ant.x + ant.w) > p.h * 0.15 && !s.endsWith(" ") && !p.str.startsWith(" ")) s += " ";
      }
      s += p.str;
    });
    const x = Math.min(...partes.map(p => p.x));
    const fim = Math.max(...partes.map(p => p.x + p.w));
    return { texto: s.replace(/\s+/g, " ").trim(), pagina, x, y: Math.min(...partes.map(p => p.y)), w: fim - x, h: Math.max(...partes.map(p => p.h)) };
  });
}

export interface Achado {
  codigo: string;
  tipo: TipoPeca;
  pagina: number;
  /** Texto da linha onde achou. */
  trecho: string;
  /** Seção em cm (b × h), diâmetro em cm ou espessura de laje em cm, se achou. */
  b: number | null;
  h: number | null;
  d: number | null;
  esp: number | null;
  /** Posição da linha, para destacar no desenho. */
  caixa: { x: number; y: number; w: number; h: number };
}

const N = String.raw`(\d+(?:[.,]\d+)?)`;
const lerN = (s: string) => Number(s.replace(",", "."));
/** Medidas menores que 3 vieram em metros (0,14x0,50); o resto, em cm. */
const emCm = (v: number) => (v > 0 && v < 3 ? arred(v * 100, 2) : v);
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Procura a peça nas linhas do PDF: o código (V12, também "V 12" e "V-12", sem pegar V120) e, logo depois, a seção
 * "14x50", "14/50", "(14 x 50)", "Ø30" ou "h=12". Também vale "V12=V13 (14x50)". Os achados com seção vêm primeiro.
 */
export function acharPeca(codigo: string, linhas: LinhaPdf[]): Achado[] {
  const c = normalizarCodigo(codigo);
  const m = /^([A-Z]+)(\d+)([A-Z]?)$/.exec(c);
  if (!m) return [];
  const [, letras, numero, sufixo] = m;
  const cod = String.raw`(?<![A-Z0-9])${escapar(letras)}\s?-?\s?${numero}${sufixo ? escapar(sufixo) : ""}(?![0-9A-Z])`;
  const outros = String.raw`(?:\s*=\s*[A-Z]{1,3}\s?-?\d+[A-Z]?)*`;
  const reCod = new RegExp(cod, "i");
  const reSecao = new RegExp(cod + outros + String.raw`\s*[([]?\s*${N}\s*[xX×/*]\s*${N}`, "i");
  const reDiam = new RegExp(cod + outros + String.raw`\s*[([]?\s*(?:[ØΦøφ⌀]|DIAM\.?|D\s?=)\s*${N}`, "i");
  const reEsp = new RegExp(cod + outros + String.raw`\s*[([]?\s*(?:h|e|esp\.?)\s*=\s*${N}`, "i");
  const tipo = tipoDoCodigo(c);
  const achados: Achado[] = [];
  for (const l of linhas) {
    if (!reCod.test(l.texto)) continue;
    const a: Achado = {
      codigo: c, tipo, pagina: l.pagina, trecho: l.texto.slice(0, 160), b: null, h: null, d: null, esp: null,
      caixa: { x: l.x, y: l.y, w: l.w, h: l.h },
    };
    const s = reSecao.exec(l.texto);
    const di = s ? null : reDiam.exec(l.texto);
    const e = s || di ? null : reEsp.exec(l.texto);
    if (s) { a.b = emCm(lerN(s[1])); a.h = emCm(lerN(s[2])); }
    else if (di) a.d = emCm(lerN(di[1]));
    else if (e) a.esp = emCm(lerN(e[1]));
    else medidaNaLinhaDeBaixo(a, l, linhas);
    achados.push(a);
  }
  const temMedida = (a: Achado) => a.b != null || a.d != null || a.esp != null;
  return achados.sort((x, y) => Number(temMedida(y)) - Number(temMedida(x)) || x.pagina - y.pagina).slice(0, 30);
}

const reSecaoSo = new RegExp(String.raw`^[([]?\s*${N}\s*[xX×/]\s*${N}\s*[)\]]?$`);
const reDiamSo = new RegExp(String.raw`^[([]?\s*(?:[ØΦøφ⌀]|DIAM\.?)\s*${N}\s*[)\]]?$`, "i");
const reEspSo = new RegExp(String.raw`^[([]?\s*(?:h|e|esp\.?)\s*=\s*${N}\s*(?:cm)?\s*[)\]]?$`, "i");

/**
 * No CAD a medida costuma vir na linha de baixo ("L3" e, embaixo, "h=12"). Vale a linha que só tem a medida, logo
 * abaixo (até 3 alturas de letra) e começando perto do código.
 */
function medidaNaLinhaDeBaixo(a: Achado, l: LinhaPdf, linhas: LinhaPdf[]) {
  const perto = linhas
    .filter(o => o !== l && o.pagina === l.pagina && o.y < l.y && l.y - o.y <= l.h * 3 && Math.abs(o.x - l.x) <= Math.max(l.w, l.h * 4))
    .sort((x, y) => (l.y - x.y) - (l.y - y.y));
  for (const o of perto) {
    const t = o.texto.trim();
    const s = reSecaoSo.exec(t);
    const d = s ? null : reDiamSo.exec(t);
    const e = s || d ? null : reEspSo.exec(t);
    if (!s && !d && !e) continue;
    if (s) { a.b = emCm(lerN(s[1])); a.h = emCm(lerN(s[2])); }
    else if (d) a.d = emCm(lerN(d[1]));
    else if (e) a.esp = emCm(lerN(e[1]));
    a.trecho = `${a.trecho} / ${t}`.slice(0, 160);
    return;
  }
}

/** A peça com as medidas achadas no PDF (seção, diâmetro ou espessura). */
export function pecaDoAchado(a: Achado, arquivo: string): Peca {
  const p = pecaNova(a.codigo, a.tipo);
  if (a.d != null) { p.forma = "CIRC"; p.d = a.d; }
  else if (a.esp != null) { p.forma = "AREA"; p.esp = a.esp; }
  else if (a.b != null && a.h != null) {
    p.forma = "RET";
    // Laje com "b x h"? É a seção de uma faixa; fica retangular.
    p.b = a.b; p.h = a.h;
  }
  p.origem = { arquivo: arquivo.slice(0, 200), pagina: a.pagina };
  return p;
}

/** "ESC. 1:50", "ESCALA 1/50", "Esc 1 : 100" → 50, 100. A escala que mais aparece na página. */
export function acharEscala(textos: string[]): number | null {
  const conta = new Map<number, number>();
  for (const t of textos) {
    for (const m of t.matchAll(/ESC(?:ALA)?\.?\s*:?\s*1\s*[:/]\s*(\d{1,4})\b/gi)) {
      const e = Number(m[1]);
      if (e >= 1 && e <= 5000) conta.set(e, (conta.get(e) ?? 0) + 1);
    }
  }
  let melhor: number | null = null;
  let vezes = 0;
  conta.forEach((n, e) => { if (n > vezes) { melhor = e; vezes = n; } });
  return melhor;
}

// ---------- medida no desenho ----------

/** Metros reais por ponto do PDF numa escala 1:N (1 pt = 25,4/72 mm no papel). */
export const metrosPorPonto = (escala: number) => (25.4 / 72 / 1000) * escala;

export interface Ponto { x: number; y: number }

export const distancia = (a: Ponto, b: Ponto) => Math.hypot(b.x - a.x, b.y - a.y);

/** Comprimento de uma linha de vários pontos (soma dos trechos). */
export const comprimentoDaLinha = (pts: Ponto[]) => pts.slice(1).reduce((s, p, i) => s + distancia(pts[i], p), 0);

/** Área do polígono (fórmula do laço), na unidade dos pontos ao quadrado. */
export function areaDoPoligono(pts: Ponto[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; });
  return Math.abs(s) / 2;
}

/** Calibração por uma cota conhecida: metros reais por ponto do PDF. */
export const calibrar = (pontosDaCota: number, metrosReais: number) =>
  (pontosDaCota > 0 && metrosReais > 0 ? metrosReais / pontosDaCota : null);

// ---------- números ----------

/** "6,30", "6.30", "1.250,5" → número; vazio → null; inválido → NaN. */
export function lerNumero(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const limpo = /,\d*$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : NaN;
}

export const formatar = (n: number | null | undefined, casas = 3) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Linhas da planilha (uma por peça, com totais por tipo e geral no fim). */
export function linhasDaPlanilha(pecas: Peca[], perdaPct: number): Record<string, string | number | null>[] {
  const ordenadas = [...pecas].sort((a, b) => ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo)
    || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
  const linhas: Record<string, string | number | null>[] = ordenadas.map(p => {
    const v = volumeDaPeca(p);
    return {
      Tipo: ROTULO_TIPO_UM[p.tipo], Peça: p.codigo, Forma: ROTULO_FORMA[p.forma],
      "b (cm)": p.forma === "RET" ? p.b : null, "h (cm)": p.forma === "RET" ? p.h : null, "Ø (cm)": p.forma === "CIRC" ? p.d : null,
      "Comprimento (m)": p.forma === "RET" || p.forma === "CIRC" ? p.comp : null,
      "Área (m²)": p.forma === "AREA" ? p.area : null, "Espessura (cm)": p.forma === "AREA" ? p.esp : null,
      Quantidade: p.qtd, "Volume unitário (m³)": v.unitario, "Volume (m³)": v.bruto, "Descontos (m³)": v.descontos || null,
      "Volume líquido (m³)": v.liquido, Página: p.origem?.pagina ?? null, Observação: p.obs ?? null,
    };
  });
  const t = totais(pecas, perdaPct);
  linhas.push({});
  for (const x of t.porTipo) linhas.push({ Tipo: `Total ${ROTULO_TIPO[x.tipo].toLowerCase()}`, Quantidade: x.pecas, "Volume (m³)": x.bruto, "Descontos (m³)": x.descontos || null, "Volume líquido (m³)": x.liquido });
  linhas.push({ Tipo: "Total geral", "Volume (m³)": t.bruto, "Descontos (m³)": t.descontos || null, "Volume líquido (m³)": t.liquido });
  linhas.push({ Tipo: `Perda (${formatar(perdaPct, 1)}%)`, "Volume líquido (m³)": t.perda });
  linhas.push({ Tipo: "Total com perda", "Volume líquido (m³)": t.comPerda });
  return linhas;
}

// ---------- ímã: encaixar o toque nos cantos do desenho ----------

/** Matriz [a, b, c, d, e, f] do PDF. */
export type Matriz = [number, number, number, number, number, number];
export const IDENTIDADE: Matriz = [1, 0, 0, 1, 0, 0];

/** m1 × m2 no sentido do PDF (aplica m1 e depois m2). */
export const multiplicar = (m1: Matriz, m2: Matriz): Matriz => [
  m1[0] * m2[0] + m1[1] * m2[2], m1[0] * m2[1] + m1[1] * m2[3],
  m1[2] * m2[0] + m1[3] * m2[2], m1[2] * m2[1] + m1[3] * m2[3],
  m1[4] * m2[0] + m1[5] * m2[2] + m2[4], m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
];
const aplicar = (m: Matriz, x: number, y: number): Ponto => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/**
 * Vértices de um caminho do pdf.js 5 (constructPath): 0 moveTo x y, 1 lineTo x y, 2 curveTo 6 números,
 * 3 quadraticCurveTo 4 números, 4 closePath. Fica a ponta de cada trecho, já com a matriz atual.
 */
export function verticesDoCaminho(dados: ArrayLike<number>, ctm: Matriz): Ponto[] {
  const pts: Ponto[] = [];
  for (let i = 0; i < dados.length;) {
    const op = dados[i];
    const n = op === 0 || op === 1 ? 2 : op === 2 ? 6 : op === 3 ? 4 : 0;
    if (op < 0 || op > 4) break;
    if (n) pts.push(aplicar(ctm, dados[i + n - 1], dados[i + n]));
    i += 1 + n;
  }
  return pts;
}

/** Pontos em baldes de uma grade, para achar o mais perto rápido mesmo com dezenas de milhares de vértices. */
export class GradePontos {
  private baldes = new Map<string, Ponto[]>();
  total = 0;
  private lado: number;
  private maximo: number;
  constructor(lado = 20, maximo = 400_000) { this.lado = lado; this.maximo = maximo; }
  private chave(x: number, y: number) { return `${Math.floor(x / this.lado)},${Math.floor(y / this.lado)}`; }
  adicionar(p: Ponto) {
    if (this.total >= this.maximo || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const k = this.chave(p.x, p.y);
    const b = this.baldes.get(k);
    if (b) { if (b.some(q => Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01)) return; b.push(p); } else this.baldes.set(k, [p]);
    this.total += 1;
  }
  /** O vértice mais perto de p dentro do raio (mesma unidade dos pontos), ou null. */
  maisPerto(p: Ponto, raio: number): Ponto | null {
    let melhor: Ponto | null = null;
    let dist = raio;
    const x0 = Math.floor((p.x - raio) / this.lado), x1 = Math.floor((p.x + raio) / this.lado);
    const y0 = Math.floor((p.y - raio) / this.lado), y1 = Math.floor((p.y + raio) / this.lado);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      for (const q of this.baldes.get(`${gx},${gy}`) ?? []) {
        const d = distancia(p, q);
        if (d <= dist) { dist = d; melhor = q; }
      }
    }
    return melhor;
  }
}
