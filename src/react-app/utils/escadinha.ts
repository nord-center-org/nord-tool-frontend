/**
 * Regras puras da Escadinha 3D: modelo simplificado da torre (croqui), leitura dos pavimentos no texto da prancha,
 * geometria do contorno e os ciclos/atividades de cada pavimento. Sem three.js aqui, para dar para testar.
 */

/** Ponto da planta em metros: x para a direita, y para cima (norte da prancha). */
export type Ponto = [number, number];

export type TipoPavimento = "subsolo" | "terreo" | "mezanino" | "tipo" | "cobertura" | "barrilete";

export interface Pavimento {
  id: string;
  nome: string;
  /** Rótulo curto, mostrado do lado de fora da torre. */
  sigla: string;
  tipo: TipoPavimento;
  /** Altura de piso a piso (m). */
  altura: number;
  /** Contorno próprio (barrilete, por exemplo); sem ele usa o da torre. */
  contorno?: Ponto[];
}

export interface Torre {
  nome: string;
  contorno: Ponto[];
  /** Pavimentos de baixo para cima. */
  pavimentos: Pavimento[];
  origem: "exemplo" | "projeto";
  /** Nome do PDF de onde a torre saiu. */
  arquivo?: string;
  /**
   * Prancha usada: tamanho da análise (px) e o contorno achado nela (px). A imagem (data URL) vai à parte
   * para o servidor e só é carregada quando a planta 2D abre.
   */
  planta?: { imagem?: string; largura: number; altura: number; contornoPx: Ponto[] };
  /** Apartamentos da planta do pavimento tipo (em metros, no mesmo sistema do contorno). */
  apartamentos?: Apartamento[];
  /** Divisão da torre em lado A e lado B. */
  lados?: DivisaoLados;
  /** Início da obra (AAAA-MM-DD): base do plano da escadinha (atrasos e metas). */
  inicioObra?: string | null;
  /** Espessura da laje (m), para o volume de concreto. */
  espessuraLaje?: number;
  /** Paredes reais do pavimento tipo, lidas da 1ª fiada do projeto (m, mesmo sistema do contorno). */
  paredes?: ParedeReal[];
  /** Cômodos do pavimento tipo achados pelas paredes (apto = apartamento a que pertence; null = hall/escada/shaft). */
  comodos?: { id: string; contorno: Ponto[]; area: number; apto: string | null }[];
  /** Resumo do pacote de projetos importado (pranchas, quantitativo de blocos e o que falta). */
  projeto?: ProjetoImportado;
}

/** Parede reta: eixo de a até b e espessura (m). */
export interface ParedeReal { a: Ponto; b: Ponto; esp: number }

export interface ItemBlocos {
  nome: string;
  /** estrutural, sem_funcao, vedacao, corta_fogo, acustico, canaleta, outro */
  categoria: string;
  comp: number;
  esp: number;
  /** Blocos na 1ª fiada de um pavimento. */
  qtd: number;
}

/** Quantitativo de uma prancha de 1ª fiada: vale para os pavimentos das lajes dela. */
export interface QuantitativoFaixa {
  arquivo: string;
  lajes: [number, number] | null;
  /** Ids dos pavimentos cobertos. */
  pavimentos: string[];
  itens: ItemBlocos[];
  /** Metros de parede por espessura (cm → m). */
  metrosPorEspessura: Record<string, number>;
}

export interface ProjetoImportado {
  importadoEm: string;
  torre: number | null;
  escala: number | null;
  /** Prancha usada para a planta (paredes e contorno). */
  base?: string;
  /** Quando a planta não saiu da 1ª fiada do tipo, o porquê e o que pedir. */
  aviso?: string | null;
  pranchas: { arquivo: string; tipo: string; titulo: string | null; revisao: string | null }[];
  quantitativos: QuantitativoFaixa[];
  checklist: { item: string; ok: boolean; detalhe: string }[];
}

export type Lado = "A" | "B";

export interface Apartamento {
  id: string;
  nome: string;
  contorno: Ponto[];
  lado: Lado;
  /** Tipologia (planta do apartamento), por id. */
  idTipologia?: number | null;
  /** Lado escolhido à mão (não muda quando a divisão é refeita). */
  ladoManual?: boolean;
}

/** Linha que separa os lados: o lado A fica à esquerda de a→b quando aEsquerda é true. */
export interface DivisaoLados {
  a: Ponto;
  b: Ponto;
  aEsquerda: boolean;
  /** junta = achou a junta de dilatação na prancha; automatica = pelo formato; manual = desenhada pela pessoa. */
  fonte: "junta" | "automatica" | "manual";
}

export type StatusAtividade = "pendente" | "andamento" | "finalizado";

export interface Atividade {
  id: string;
  nome: string;
  status: StatusAtividade;
}

export interface Ciclo {
  /** Pavimento do ciclo; ciclos avulsos (fundação, cobertura extra…) usam "extra-…". */
  idPavimento: string;
  /** Nome próprio do ciclo (sem ele, usa o nome do pavimento). */
  nome?: string;
  /** Início previsto (AAAA-MM-DD). */
  inicio: string;
  atividades: Atividade[];
}

export interface Escadinha {
  torre: Torre;
  ciclos: Ciclo[];
}

export const ROTULO_STATUS: Record<StatusAtividade, string> = {
  pendente: "Pendente", andamento: "Em andamento", finalizado: "Finalizado",
};

const PROXIMO_STATUS: Record<StatusAtividade, StatusAtividade> = {
  pendente: "andamento", andamento: "finalizado", finalizado: "pendente",
};

export const proximoStatus = (s: StatusAtividade) => PROXIMO_STATUS[s];

/** Atividades de um ciclo de pavimento (estrutura + vedação), na ordem da obra. */
export const ATIVIDADES_CICLO = [
  "Marcação",
  "Forma e armação de pilares",
  "Concretagem de pilares",
  "Forma de vigas e lajes",
  "Armação e instalações embutidas",
  "Concretagem da laje",
  "Desforma",
  "Alvenaria",
];

export const DIAS_POR_CICLO = 7;

/** Modelo de ciclos da obra: atividades de um ciclo novo e quantos dias cada ciclo dura. */
export interface ModeloCiclos {
  atividades: string[];
  diasPorCiclo: number;
}

export const MODELO_PADRAO: ModeloCiclos = { atividades: ATIVIDADES_CICLO, diasPorCiclo: DIAS_POR_CICLO };

/** Lê o modelo vindo do servidor; o que vier faltando ou inválido cai no padrão. */
export function lerModelo(bruto: unknown): ModeloCiclos {
  const m = (bruto ?? {}) as Partial<ModeloCiclos>;
  const atividades = Array.isArray(m.atividades) ? m.atividades.map(a => String(a).trim()).filter(Boolean).slice(0, 40) : [];
  const dias = Number(m.diasPorCiclo);
  return {
    atividades: atividades.length ? atividades : MODELO_PADRAO.atividades,
    diasPorCiclo: Number.isFinite(dias) && dias >= 1 && dias <= 60 ? Math.round(dias) : DIAS_POR_CICLO,
  };
}

// ---------------------------------------------------------------- pavimentos

export interface PavimentosLidos {
  /** Quantidade de pavimentos tipo encontrada (null se a prancha não disser). */
  tipos: number | null;
  subsolos: number;
  terreo: boolean;
  mezanino: boolean;
  cobertura: boolean;
  barrilete: boolean;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const ORD = "\\s*(?:º|°|O|ª)?\\.?\\s*";

/** Lê, no texto da prancha, quantos pavimentos tipo existem e quais pavimentos diferentes aparecem. */
export function lerPavimentosDoTexto(texto: string): PavimentosLidos {
  const t = semAcento(texto).replace(/\s+/g, " ");
  const valido = (n: number) => n >= 1 && n <= 200;
  let tipos: number | null = null;

  const intervalo = [...t.matchAll(new RegExp(`(\\d{1,3})${ORD}(?:AO|A|-)\\s*(\\d{1,3})${ORD}PAV`, "g"))]
    .map(m => Number(m[2]) - Number(m[1]) + 1).filter(valido);
  const vezes = [...t.matchAll(/TIPO[^0-9]{0,20}\(?\s*(\d{1,3})\s*X\b/g), ...t.matchAll(/\b(\d{1,3})\s*X\s*PAV/g)]
    .map(m => Number(m[1])).filter(valido);
  const total = [...t.matchAll(/\b(\d{1,3})\s*PAVIMENTOS?\s*(?:TIPO)?/g)].map(m => Number(m[1])).filter(valido);
  const ordinais = [...t.matchAll(new RegExp(`\\b(\\d{1,3})(?:º|°|ª)\\.?\\s*PAV`, "g"))].map(m => Number(m[1])).filter(valido);

  if (intervalo.length) tipos = Math.max(...intervalo);
  else if (vezes.length) tipos = Math.max(...vezes);
  else if (total.length) tipos = Math.max(...total);
  else if (ordinais.length) tipos = Math.max(...ordinais);

  let subsolos = 0;
  if (/SUBSOLO/.test(t)) {
    const n = [
      ...[...t.matchAll(new RegExp(`(\\d)${ORD}SUBSOLO`, "g"))].map(m => Number(m[1])),
      ...[...t.matchAll(/SUBSOLO\s*(\d)\b/g)].map(m => Number(m[1])),
    ].filter(x => x >= 1 && x <= 6);
    subsolos = n.length ? Math.max(...n) : 1;
  }

  return {
    tipos,
    subsolos,
    terreo: /TERREO/.test(t),
    mezanino: /MEZANINO/.test(t),
    cobertura: /COBERTURA|ATICO/.test(t),
    barrilete: /BARRILETE|CASA DE MAQUINAS|RESERVATORIO/.test(t),
  };
}

export interface OpcoesPavimentos {
  tipos: number;
  subsolos: number;
  terreo: boolean;
  mezanino: boolean;
  cobertura: boolean;
  barrilete: boolean;
  /** Pé-direito do pavimento tipo (m). */
  peDireito?: number;
}

/** Monta a pilha de pavimentos de baixo para cima. */
export function montarPavimentos(o: OpcoesPavimentos, contorno: Ponto[]): Pavimento[] {
  const pd = o.peDireito ?? 2.9;
  const lista: Pavimento[] = [];
  for (let i = o.subsolos; i >= 1; i--) lista.push({ id: `ss${i}`, nome: `Subsolo ${i}`, sigla: `SS${i}`, tipo: "subsolo", altura: 3 });
  if (o.terreo) lista.push({ id: "terreo", nome: "Térreo", sigla: "T", tipo: "terreo", altura: Math.max(pd, 3.6) });
  if (o.mezanino) lista.push({ id: "mezanino", nome: "Mezanino", sigla: "MZ", tipo: "mezanino", altura: pd });
  for (let i = 1; i <= o.tipos; i++) lista.push({ id: `p${i}`, nome: `Pavimento ${i}`, sigla: String(i), tipo: "tipo", altura: pd });
  if (o.cobertura) lista.push({ id: "cobertura", nome: "Cobertura", sigla: "COB", tipo: "cobertura", altura: pd });
  if (o.barrilete) lista.push({ id: "barrilete", nome: "Barrilete", sigla: "BAR", tipo: "barrilete", altura: 3.2, contorno: nucleo(contorno) });
  return lista;
}

/** Opções que geraram a pilha (para editar uma torre já montada). */
export function opcoesDaTorre(torre: Torre): OpcoesPavimentos {
  const p = torre.pavimentos;
  return {
    tipos: p.filter(x => x.tipo === "tipo").length,
    subsolos: p.filter(x => x.tipo === "subsolo").length,
    terreo: p.some(x => x.tipo === "terreo"),
    mezanino: p.some(x => x.tipo === "mezanino"),
    cobertura: p.some(x => x.tipo === "cobertura"),
    barrilete: p.some(x => x.tipo === "barrilete"),
    peDireito: p.find(x => x.tipo === "tipo")?.altura,
  };
}

/** Cota de piso (m) de cada pavimento, com o térreo (ou o primeiro acima dos subsolos) no zero. */
export function cotas(pavimentos: Pavimento[]): number[] {
  const subsolo = pavimentos.filter(p => p.tipo === "subsolo").reduce((s, p) => s + p.altura, 0);
  let y = -subsolo;
  return pavimentos.map(p => { const c = y; y += p.altura; return c; });
}

// ---------------------------------------------------------------- geometria

export interface Limites { minX: number; minY: number; maxX: number; maxY: number; largura: number; profundidade: number }

export function limites(pontos: Ponto[]): Limites {
  const xs = pontos.map(p => p[0]);
  const ys = pontos.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, largura: maxX - minX, profundidade: maxY - minY };
}

export function area(pontos: Ponto[]): number {
  let s = 0;
  for (let i = 0; i < pontos.length; i++) {
    const [x1, y1] = pontos[i];
    const [x2, y2] = pontos[(i + 1) % pontos.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Ponto dentro do polígono (raio horizontal). */
export function dentro([x, y]: Ponto, pontos: Ponto[]): boolean {
  let d = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const [xi, yi] = pontos[i];
    const [xj, yj] = pontos[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distanciaAoSegmento([px, py]: Ponto, [ax, ay]: Ponto, [bx, by]: Ponto): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function douglasPeucker(pontos: Ponto[], tolerancia: number): Ponto[] {
  if (pontos.length < 3) return pontos;
  let maior = 0, indice = 0;
  for (let i = 1; i < pontos.length - 1; i++) {
    const d = distanciaAoSegmento(pontos[i], pontos[0], pontos[pontos.length - 1]);
    if (d > maior) { maior = d; indice = i; }
  }
  if (maior <= tolerancia) return [pontos[0], pontos[pontos.length - 1]];
  const a = douglasPeucker(pontos.slice(0, indice + 1), tolerancia);
  return [...a.slice(0, -1), ...douglasPeucker(pontos.slice(indice), tolerancia)];
}

/** Simplifica um polígono fechado: parte do ponto mais distante do primeiro para não perder cantos. */
export function simplificar(pontos: Ponto[], tolerancia: number): Ponto[] {
  if (pontos.length < 4) return pontos;
  let longe = 0, dist = -1;
  pontos.forEach((p, i) => { const d = Math.hypot(p[0] - pontos[0][0], p[1] - pontos[0][1]); if (d > dist) { dist = d; longe = i; } });
  const ida = douglasPeucker(pontos.slice(0, longe + 1), tolerancia);
  const volta = douglasPeucker([...pontos.slice(longe), pontos[0]], tolerancia);
  return [...ida.slice(0, -1), ...volta.slice(0, -1)];
}

/**
 * Deixa o contorno só com lados horizontais e verticais (o croqui da torre): cada lado vira H ou V pela direção dominante,
 * lados seguidos na mesma direção se juntam e os cantos saem do cruzamento dos lados vizinhos.
 */
export function ortogonalizar(pontos: Ponto[]): Ponto[] {
  if (pontos.length < 4) return pontos;
  type Lado = { h: boolean; valor: number; peso: number };
  const lados: Lado[] = pontos.map((a, i) => {
    const b = pontos[(i + 1) % pontos.length];
    const h = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    return { h, valor: h ? (a[1] + b[1]) / 2 : (a[0] + b[0]) / 2, peso: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9 };
  });
  const juntos: Lado[] = [];
  for (const l of lados) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && ultimo.h === l.h) {
      ultimo.valor = (ultimo.valor * ultimo.peso + l.valor * l.peso) / (ultimo.peso + l.peso);
      ultimo.peso += l.peso;
    } else juntos.push({ ...l });
  }
  if (juntos.length > 1 && juntos[0].h === juntos[juntos.length - 1].h) {
    const u = juntos.pop()!;
    juntos[0].valor = (juntos[0].valor * juntos[0].peso + u.valor * u.peso) / (juntos[0].peso + u.peso);
    juntos[0].peso += u.peso;
  }
  if (juntos.length < 4 || juntos.length % 2) return pontos;
  return juntos.map((l, i) => {
    const prox = juntos[(i + 1) % juntos.length];
    return l.h ? [prox.valor, l.valor] as Ponto : [l.valor, prox.valor] as Ponto;
  });
}

/**
 * Converte o contorno achado na imagem (pixels, y para baixo) em metros, centrado na origem,
 * com a largura real informada.
 */
export function contornoEmMetros(contornoPx: Ponto[], larguraM: number): Ponto[] {
  const paraMetros = transformadorMetros(contornoPx, larguraM);
  const pts = contornoPx.map(paraMetros);
  return area(pts) < 0 ? pts.reverse() : pts;
}

/** Converte qualquer ponto da prancha (px) para o sistema da torre (m), com a mesma escala e centro do contorno. */
export function transformadorMetros(contornoPx: Ponto[], larguraM: number): (p: Ponto) => Ponto {
  const l = limites(contornoPx);
  const escala = l.largura ? larguraM / l.largura : 1;
  const cx = (l.minX + l.maxX) / 2, cy = (l.minY + l.maxY) / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return ([x, y]) => [r((x - cx) * escala), r(-(y - cy) * escala)];
}

/** Núcleo (caixa de escada/elevadores) para o barrilete: retângulo de ~30% no centro do contorno. */
export function nucleo(contorno: Ponto[]): Ponto[] {
  const l = limites(contorno);
  let cx = (l.minX + l.maxX) / 2, cy = (l.minY + l.maxY) / 2;
  if (!dentro([cx, cy], contorno)) {
    // Torre em L: o centro cai fora; usa o vértice interno do L mais próximo do centro, puxado para dentro.
    const dentroPts = contorno.map(p => [p[0] + Math.sign(cx - p[0]) * 2, p[1] + Math.sign(cy - p[1]) * 2] as Ponto).filter(p => dentro(p, contorno));
    const perto = dentroPts.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
    if (perto) [cx, cy] = perto;
  }
  const w = Math.max(4, l.largura * 0.28) / 2, d = Math.max(4, l.profundidade * 0.28) / 2;
  return [[cx - w, cy - d], [cx + w, cy - d], [cx + w, cy + d], [cx - w, cy + d]];
}

/** Pilares do croqui: nos cantos do contorno e numa malha interna de ~`passo` metros. */
export function pilares(contorno: Ponto[], passo = 6): Ponto[] {
  const l = limites(contorno);
  const recuo = 0.4;
  const lista: Ponto[] = contorno.map(([x, y]) => {
    const p: Ponto = [x + (x < (l.minX + l.maxX) / 2 ? recuo : -recuo), y + (y < (l.minY + l.maxY) / 2 ? recuo : -recuo)];
    return dentro(p, contorno) ? p : [x, y];
  });
  const nx = Math.max(1, Math.round(l.largura / passo)), ny = Math.max(1, Math.round(l.profundidade / passo));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const p: Ponto = [l.minX + recuo + ((l.largura - 2 * recuo) * i) / nx, l.minY + recuo + ((l.profundidade - 2 * recuo) * j) / ny];
      if (dentro(p, contorno) && !lista.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < passo * 0.45)) lista.push(p);
    }
  }
  return lista;
}

// ---------------------------------------------------------------- escadinha

export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/**
 * Escadinha inicial: um ciclo por pavimento, começando em `inicio`, um a cada `modelo.diasPorCiclo` dias, com as atividades do modelo.
 * Quando `hoje` é informado, marca o que já passou como finalizado e o ciclo atual como em andamento (para o exemplo ter cara de obra).
 */
export function gerarEscadinha(pavimentos: Pavimento[], inicio: string, hoje?: string, modelo: ModeloCiclos = MODELO_PADRAO): Ciclo[] {
  const dias = modelo.diasPorCiclo;
  const lista = modelo.atividades;
  return pavimentos.map((p, i) => {
    const comeco = somarDias(inicio, i * dias);
    const passados = hoje ? Math.floor((Date.parse(hoje) - Date.parse(comeco)) / 86400000) : -1;
    const feitas = passados < 0 ? 0 : Math.min(lista.length, Math.floor((passados / dias) * lista.length * 0.5));
    return {
      idPavimento: p.id,
      inicio: comeco,
      atividades: lista.map((nome, k) => ({
        id: `${p.id}-${k}`,
        nome,
        status: k < feitas ? "finalizado" : k === feitas && passados >= 0 ? "andamento" : "pendente",
      })),
    };
  });
}

/**
 * Refaz a escadinha quando a pilha de pavimentos muda: mantém os ciclos e atividades já editados
 * dos pavimentos que continuam, cria os novos pelo modelo e preserva os ciclos avulsos.
 */
export function reaproveitarCiclos(novos: Ciclo[], antigos: Ciclo[]): Ciclo[] {
  const porPavimento = novos.map(c => antigos.find(a => a.idPavimento === c.idPavimento) ?? c);
  const avulsos = antigos.filter(a => a.idPavimento.startsWith("extra-"));
  return [...porPavimento, ...avulsos];
}

/** Aplica o modelo a todos os ciclos: lista de atividades do modelo, mantendo o status das que têm o mesmo nome. */
export function aplicarModelo(ciclos: Ciclo[], modelo: ModeloCiclos): Ciclo[] {
  return ciclos.map(c => ({
    ...c,
    atividades: modelo.atividades.map((nome, k) => {
      const igual = c.atividades.find(a => a.nome.trim().toLowerCase() === nome.trim().toLowerCase());
      return igual ? { ...igual, nome } : { id: `${c.idPavimento}-${Date.now().toString(36)}-${k}`, nome, status: "pendente" as const };
    }),
  }));
}

let sequencia = 0;
/** Id novo para atividade ou ciclo criado na tela. */
export const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${(sequencia++).toString(36)}`;

/** Andamento do ciclo de 0 a 1 (em andamento conta meia). */
export function progresso(ciclo: Ciclo): number {
  if (!ciclo.atividades.length) return 0;
  const pontos = ciclo.atividades.reduce((s, a) => s + (a.status === "finalizado" ? 1 : a.status === "andamento" ? 0.5 : 0), 0);
  return pontos / ciclo.atividades.length;
}

export function statusCiclo(ciclo: Ciclo): StatusAtividade {
  if (ciclo.atividades.length && ciclo.atividades.every(a => a.status === "finalizado")) return "finalizado";
  if (ciclo.atividades.some(a => a.status !== "pendente")) return "andamento";
  return "pendente";
}

export function alternarStatus(ciclos: Ciclo[], idAtividade: string): Ciclo[] {
  return ciclos.map(c => ({
    ...c,
    atividades: c.atividades.map(a => (a.id === idAtividade ? { ...a, status: proximoStatus(a.status) } : a)),
  }));
}

/** Data curta "27/10" a partir de AAAA-MM-DD. */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ---------------------------------------------------------------- exemplo

/** Torre em L de exemplo (lembra a planta chave de uma torre de 18 finais), para a tela nunca abrir vazia. */
export const CONTORNO_EXEMPLO: Ponto[] = [[-16, -11], [16, -11], [16, 11], [4, 11], [4, 1], [-16, 1]];

export function escadinhaExemplo(hoje: string): Escadinha {
  const pavimentos = montarPavimentos({ tipos: 14, subsolos: 1, terreo: true, mezanino: false, cobertura: true, barrilete: true }, CONTORNO_EXEMPLO);
  const inicio = somarDias(hoje, -8 * DIAS_POR_CICLO);
  return {
    torre: { nome: "Torre exemplo", contorno: CONTORNO_EXEMPLO, pavimentos, origem: "exemplo" },
    ciclos: gerarEscadinha(pavimentos, inicio, hoje),
  };
}
