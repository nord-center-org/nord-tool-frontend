/**
 * Escadinha no padrão Cury: ciclos com atividades em ordem, cada célula pavimento × lado × atividade com um status
 * (executado, em execução, não se aplica, marcados no pavimento) e o resto calculado: dependência da anterior, atraso pelo
 * plano (início da obra + dias e meta de pavimentos de cada ciclo), meta do período e os gargalos.
 * Também diz que "camada" do modelo 3D cada atividade acende (alvenaria, laje, louças…). Sem React aqui.
 */
import type { Lado, Pavimento, Torre } from "./escadinha.ts";

// ---------------------------------------------------------------- modelo

/** O que a atividade acende no modelo 3D. */
export type Camada =
  | "alvenaria" | "laje" | "escoramento" | "desescoramento" | "eletrica" | "hidraulica" | "gas" | "incendio" | "esquadria"
  | "impermeabilizacao" | "contrapiso" | "drywall" | "gesso" | "ceramica" | "loucas" | "metais" | "portas" | "pintura"
  | "fachada" | "elevador" | "piso" | "limpeza" | "inspecao";

export const ROTULO_CAMADA: Record<Camada, string> = {
  alvenaria: "Alvenaria", laje: "Laje", escoramento: "Reescoramento", desescoramento: "Retirada do escoramento", eletrica: "Elétrica",
  hidraulica: "Hidráulica", gas: "Gás", incendio: "Incêndio", esquadria: "Esquadrias", impermeabilizacao: "Impermeabilização",
  contrapiso: "Contrapiso", drywall: "Drywall", gesso: "Gesso / forro", ceramica: "Cerâmica", loucas: "Louças e bancadas", metais: "Metais",
  portas: "Portas", pintura: "Pintura", fachada: "Fachada", elevador: "Elevador", piso: "Piso laminado", limpeza: "Limpeza", inspecao: "Conferências",
};

export interface AtividadeModelo {
  id: string;
  nome: string;
  /** Atividade de instalações (marcada como "Install" na escadinha da Cury). */
  install?: boolean;
  camada: Camada;
}

export interface CicloModelo {
  id: string;
  nome: string;
  cor: string;
  /** Duração de um lote do ciclo (dias). */
  dias: number;
  /** Quantos pavimentos o ciclo avança a cada lote (meta). */
  metaPav: number;
  /** Sem meta (ex.: ciclo conforme tipologia): não calcula atraso. */
  metasAtivas: boolean;
  atividades: AtividadeModelo[];
}

export interface ModeloEscadinha {
  versao: 2;
  /** Tamanho do período de referência (dias), para a meta do período. */
  diasPeriodo: number;
  ciclos: CicloModelo[];
}

/** Camada provável pelo nome da atividade (vale para atividades novas que o admin criar). */
export function camadaDaAtividade(nome: string): Camada {
  const n = nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tem = (r: RegExp) => r.test(n);
  if (tem(/fachada|massa sacada|reboco/)) return "fachada";
  if (tem(/retirada do re-?escoramento/)) return "desescoramento";
  if (tem(/re-?escoramento|desforma/)) return "escoramento";
  if (tem(/^laje|laje tipo/)) return "laje";
  if (tem(/alvenaria|mureta|fiadas/)) return "alvenaria";
  if (tem(/elevador/)) return "elevador";
  if (tem(/incendio|hidrante/)) return "incendio";
  if (tem(/gas/)) return "gas";
  if (tem(/louca|bancada/)) return "loucas";
  if (tem(/metais/)) return "metais";
  if (tem(/impermeabiliza/)) return "impermeabilizacao";
  if (tem(/drywall|autoclave|massa podre/)) return "drywall";
  if (tem(/gesso|forro|massa de teto|textura \/ massa/)) return "gesso";
  if (tem(/ceramic|rejunte|cantoneira/)) return "ceramica";
  if (tem(/piso laminado/)) return "piso";
  if (tem(/contrapiso|regularizacao piso/)) return "contrapiso";
  if (tem(/porta(s)? de madeira|guarnic(ao|oes) de madeira|regulagem de porta/)) return "portas";
  if (tem(/caixilho|portas sacada|peitoril|gradil|batente|soleira|guarnicao de janela|regulagem de janela|corrimao/)) return "esquadria";
  if (tem(/pintura|seladora|massa corrida|textura/)) return "pintura";
  if (tem(/prumada|distribuicao|cavalete|kit de hidraulica|estanqueidade|valvula|sifao|tubulac|ventokit|ventilacao|esgoto|agua/)) return "hidraulica";
  if (tem(/eletric|enfiacao|quadro|caixinha|disjunt|iluminac|interrupt|tomada|espelho|busway|para - raio|para-raio|arandela|sistemas/)) return "eletrica";
  if (tem(/limpeza/)) return "limpeza";
  return "inspecao";
}

/** [nome, install] por ciclo, na ordem da escadinha da Cury. */
const CURY: { nome: string; cor: string; meta: number; metas?: boolean; atividades: [string, boolean?][] }[] = [
  { nome: "Ciclo 1", cor: "#86e08a", meta: 2, atividades: [
    ["ALVENARIA + ALVENARIA FRISADA SHAFT"], ["MURETAS SHAFTS E INCÊNDIO + 3 FIADAS / ALVENARIA VÃO DO ELEVADOR"], ["BATENTE PCF (PORTA CORTA FOGO)"],
    ["GRADIL"], ["CAIXINHAS NA ALVENARIA", true], ["FUNDO DE QUADRO ELÉTRICO", true], ["LAJE TIPO/ENFIAÇÃO (CONSIDERAR TETO)", true],
    ["ENFIAÇÃO ESPECIAL (SISTEMA) CONSIDERAR TETO", true], ["PARA - RAIO (JUNTO A ALVENARIA)", true]] },
  { nome: "Ciclo 2", cor: "#facc15", meta: 1, atividades: [["REESCORAMENTO E DESFORMA (LAJE TETO)"]] },
  { nome: "Ciclo 3", cor: "#5ccff2", meta: 1, atividades: [
    ["POLIMENTO A SECO (AONDE HOUVER NECESSIDADE)"], ["ILUMINAÇÃO DO HALL E ESCADARIA (FIAÇÃO DEFITIVA)", true], ["ARREMATE VEDAÇÃO DO HALL (SHAFTS)"],
    ["PINTURA DO SHAFT (HALL) VERIFICAR CADERNO DE ACABAMENTO"], ["PRUMADAS ESGOTO", true], ["PRUMADAS DE ÁGUA FRIA", true], ["PRUMADAS ÁGUA PLUVIAL", true],
    ["PRUMADAS INCÊNDIO", true], ["PRUMADAS GÁS", true], ["DISJUNTORES E ALIMENTADORES ELETRICA", true], ["PEITORIL"],
    ["REPAROS E IMPERMEABILIZAÇÃO SOLEIRA SACADA"], ["SOLEIRA PORTA (SACADA)"], ["PORTAS SACADAS"], ["CAIXILHOS"], ["RECONFERÊNCIA E ENCHIMENTO GROUTH"],
    ["REGULARIZAÇÃO PISO ESCADARIA"], ["CAIXA E REGISTRO DE HIDRANTE", true]] },
  { nome: "Ciclo 4", cor: "#e89ae0", meta: 1, atividades: [
    ["DISTRIBUIÇÃO ESGOTO", true], ["DISTRIBUIÇÃO VENTILAÇÃO", true], ["DISTRIBUIÇÃO GAS", true], ["DISTRIBUIÇÃO DE ÁGUA FRIA E QUENTE", true],
    ["CAVALETE ÁGUA FRIA E QUENTE HALL", true], ["CAVALETE GÁS HALL", true], ["RETIRADA DO RE-ESCORAMENTO"], ["SOLEIRA, BIT E BAGUETE"],
    ["IMPERMEABILIZAÇÃO - SACADA"], ["PENTE FINO APARTAMENTO E HALL"], ["PENTE FINO ESCADA"],
    ["CONFERÊNCIA DO PRISMA CHEIO E PRISMA OCO, COM NECESSIDADE RETORNO DO CALCULISTA"]] },
  { nome: "Ciclo 5", cor: "#86efac", meta: 1, atividades: [
    ["ESTRUTURA DRYWALL / AUTOCLAVE"], ["KIT DE HIDRÁULICA (APARTAMENTO)", true], ["MASSA PODRE (FECHAMENTO DAS ABERTURAS DO SHAFT PARA GARANTIR A VEDAÇÃO)"],
    ["MASSA SACADA (REBOCO)"], ["TESTE ESTANQUEIDADE (RAMAL ESGOTO)", true], ["TESTE ESTANQUEIDADE (KIT HIDRÁULICA)", true], ["CAIXAS DE SISTEMAS", true],
    ["FECHAMENTO DRYWALL APTO"], ["FECHAMENTO DRYWALL HALL"]] },
  { nome: "Ciclo 6", cor: "#c4b5fd", meta: 1, atividades: [
    ["CORRIMÃO ESCADARIA"], ["IMPERMEABILIZAÇÃO INTERNA"], ["TUBULAÇÕES (PVC E CORRUGADO) VENTOKIT", true], ["CONTRAPISO DA SACADA"],
    ["LIXAMENTO DE PISO DO QUARTO (SE HOUVER NECESSIDADE)"]] },
  { nome: "Ciclo 7", cor: "#fb9a82", meta: 1, atividades: [["GESSO LISO APTO E HALL"], ["LIMPEZA DO GESSO LISO"]] },
  { nome: "Ciclo 8", cor: "#3f8f2a", meta: 1, atividades: [["REVESTIMENTO CERÂMICO"], ["REJUNTE E LIMPEZA"], ["PROTEÇÃO CERÂMICA"]] },
  { nome: "Ciclo 9", cor: "#8a7d45", meta: 1, atividades: [
    ["INTERRUPTORES E TOMADAS", true], ["PROTEÇÃO DOS INTERRUPTORES E TOMADAS DE ELÉTRICA", true], ["FORRO DE GESSO"]] },
  { nome: "Ciclo 10", cor: "#b5aea6", meta: 1, atividades: [
    ["PU DOS SHAFTS"], ["CANTONEIRA"], ["LOUÇAS E BANCADAS", true], ["PROTEÇÃO DAS LOUÇAS E BANCADAS", true], ["TEXTURA / MASSA DE TETO"],
    ["PU DAS LOUÇAS E BANCADAS"], ["TESTE DE ELÉTRICA", true]] },
  { nome: "Ciclo 11", cor: "#f9a8d4", meta: 1, atividades: [
    ["PORTAS DE MADEIRA"], ["REGISTRO DE GÁS", true], ["METAIS", true], ["VÁLVULA, SIFÃO E FLEXÍVEL", true]] },
  { nome: "Ciclo 12", cor: "#fdba74", meta: 1, atividades: [
    ["CHECK-LIST PARA INICIO DE PINTURA"], ["PREPARAÇÃO PARA PINTURA (SELADORA, MASSA CORRIDA E LIXAMENTO)"], ["PROTEÇÃO PARA PINTURA"]] },
  { nome: "Ciclo conforme tipologia da obra", cor: "#a5b4fc", meta: 1, metas: false, atividades: [
    ["SELADORA / MASSA - FACHADA"], ["TEXTURA FACHADA"], ["REGULARIZAÇÃO DO ELEVADOR E PINTURA DO POÇO"], ["PASSAGEM PRUMADA I ARANDELAS E CABO DE ESPERA", true],
    ["ELEVADORES"], ["BUSWAY (BARRAMENTO BLINDADO)", true], ["PINTURA 1° E 2° DEMAOS"], ["ESPELHOS ELÉTRICA", true], ["GUARNIÇÕES DE MADEIRA"],
    ["REGULAGEM DE PORTA"], ["ACABAMENTO VENTOKIT"], ["PISO LAMINADO"], ["LIMPEZA GROSSA"], ["GUARNIÇÃO DE JANELA"], ["CHECK LIST"],
    ["REGULAGEM DE JANELA"], ["LIMPEZA FINA"], ["REPASSE PINTURA"], ["SELO DE GARANTIA E CHAVES"],
    ["HALL - ARREMATE DE CERÂMICA / PINTURA DE PAREDE / ARREMATE DO BATENTE / RODAPÉ / FECHAMENTO BATENTE DOS ELEVADORES"]] },
];

/** Modelo padrão: a escadinha da Cury (13 ciclos, 96 atividades, 15 dias por ciclo). */
export const MODELO_CURY: ModeloEscadinha = (() => {
  let n = 0;
  return {
    versao: 2,
    diasPeriodo: 15,
    ciclos: CURY.map((c, i) => ({
      id: `c${i + 1}`,
      nome: c.nome,
      cor: c.cor,
      dias: 15,
      metaPav: c.meta,
      metasAtivas: c.metas !== false,
      atividades: c.atividades.map(([nome, install]) => ({ id: `a${++n}`, nome, install: !!install, camada: camadaDaAtividade(nome) })),
    })),
  };
})();

const ID = /^[A-Za-z0-9_.-]{1,64}$/;
const COR = /^#[0-9a-fA-F]{6}$/;
const limitar = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};

/** Lê o modelo salvo; formato antigo (lista simples de atividades) ou inválido vira o padrão da Cury. */
export function lerModeloEscadinha(bruto: unknown): ModeloEscadinha {
  const m = bruto as Partial<ModeloEscadinha> | null;
  if (!m || m.versao !== 2 || !Array.isArray(m.ciclos) || !m.ciclos.length) return MODELO_CURY;
  const ids = new Set<string>();
  const unico = (id: unknown, prefixo: string) => {
    let v = typeof id === "string" && ID.test(id) ? id : `${prefixo}${ids.size + 1}`;
    while (ids.has(v)) v = `${v}x`;
    ids.add(v);
    return v;
  };
  const ciclos = m.ciclos.slice(0, 30).map((c, i): CicloModelo => ({
    id: unico(c?.id, "c"),
    nome: String(c?.nome ?? `Ciclo ${i + 1}`).trim().slice(0, 80) || `Ciclo ${i + 1}`,
    cor: typeof c?.cor === "string" && COR.test(c.cor) ? c.cor : "#94a3b8",
    dias: limitar(c?.dias, 1, 120, 15),
    metaPav: limitar(c?.metaPav, 1, 10, 1),
    metasAtivas: c?.metasAtivas !== false,
    atividades: (Array.isArray(c?.atividades) ? c.atividades : []).slice(0, 60)
      .map(a => ({ a, nome: String(a?.nome ?? "").trim().slice(0, 160) }))
      .filter(x => x.nome)
      .map(({ a, nome }) => ({
        id: unico(a?.id, "a"),
        nome,
        install: !!a?.install,
        camada: a?.camada && a.camada in ROTULO_CAMADA ? a.camada : camadaDaAtividade(nome),
      })),
  })).filter(c => c.atividades.length);
  if (!ciclos.length) return MODELO_CURY;
  return { versao: 2, diasPeriodo: limitar(m.diasPeriodo, 1, 60, 15), ciclos };
}

/** Atividades na ordem da escadinha, com o ciclo de cada uma. */
export function atividadesEmOrdem(modelo: ModeloEscadinha): { atividade: AtividadeModelo; ciclo: CicloModelo; indiceCiclo: number }[] {
  return modelo.ciclos.flatMap((ciclo, indiceCiclo) => ciclo.atividades.map(atividade => ({ atividade, ciclo, indiceCiclo })));
}

// ---------------------------------------------------------------- grade

/**
 * Marcação da célula. E/X/N são o dia a dia; A/O/P/D/V forçam um status da legenda à mão (como na planilha da Cury).
 * A = atrasado, O = atrasada em execução, P = atraso com anterior pendente, D = dentro do período, V = vazio.
 */
export type StatusMarcado = "E" | "X" | "N" | "A" | "O" | "P" | "D" | "V";
export const MARCADOS: StatusMarcado[] = ["E", "X", "N", "A", "O", "P", "D", "V"];

export interface Celula {
  /** E = executado, X = em execução, N = não se aplica; A/O/P/D/V = status escolhido à mão. */
  s: StatusMarcado;
  /** Data da execução (AAAA-MM-DD). */
  d?: string;
  /** Quem marcou. */
  u?: number;
  /** Quando marcou. */
  h?: string;
}

export type Grade = Record<string, Celula>;

export const chaveCelula = (idPavimento: string, lado: Lado, idAtividade: string) => `${idPavimento}|${lado}|${idAtividade}`;

/** Lê a grade vinda do servidor, descartando o que não tiver forma de célula. */
export function lerGrade(bruto: unknown): Grade {
  const g: Grade = {};
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return g;
  for (const [k, v] of Object.entries(bruto as Record<string, unknown>)) {
    const c = v as Partial<Celula> | null;
    if (c && MARCADOS.includes(c.s as StatusMarcado)) g[k] = { s: c.s as StatusMarcado, d: typeof c.d === "string" ? c.d : undefined, u: typeof c.u === "number" ? c.u : undefined, h: typeof c.h === "string" ? c.h : undefined };
  }
  return g;
}

export interface LinhaGrade { pavimento: Pavimento; lado: Lado; /** 0 = pavimento mais baixo da escadinha. */ nivel: number }

const TIPOS_NA_GRADE = new Set(["terreo", "mezanino", "tipo", "cobertura"]);

/** Linhas da grade: do pavimento mais alto para o térreo, lado A e lado B de cada um (subsolo e barrilete ficam fora). */
export function linhasDaGrade(torre: Pick<Torre, "pavimentos">): LinhaGrade[] {
  const pavs = torre.pavimentos.filter(p => TIPOS_NA_GRADE.has(p.tipo));
  const linhas: LinhaGrade[] = [];
  pavs.forEach((pavimento, nivel) => (["A", "B"] as Lado[]).forEach(lado => linhas.push({ pavimento, lado, nivel })));
  return linhas.sort((a, b) => b.nivel - a.nivel || (a.lado < b.lado ? -1 : 1));
}

// ---------------------------------------------------------------- status calculado

export type StatusCelula =
  | "executado" | "execucao" | "atrasado" | "atrasadoExec" | "atrasoAnterior" | "periodo" | "na" | "vazio" | "meta";

/**
 * Os 9 status da escadinha, na ordem da legenda da obra. Executado, em execução e não se aplica são marcados no
 * pavimento (aba do modelo 3D); os outros saem sozinhos das datas do plano. A grade é só o reflexo.
 */
export const LEGENDA: { status: StatusCelula; rotulo: string; cor: string; dica: string }[] = [
  { status: "executado", rotulo: "Executado", cor: "#22c55e", dica: "Marcado como executado no pavimento." },
  { status: "execucao", rotulo: "Em execução", cor: "#facc15", dica: "Marcado como em execução, ainda dentro do prazo." },
  { status: "atrasado", rotulo: "Atrasado", cor: "#ef4444", dica: "O prazo do ciclo passou e a atividade não começou." },
  { status: "atrasadoExec", rotulo: "Atividade atrasada em execução", cor: "#f97316", dica: "Em execução, mas o prazo do ciclo já passou." },
  { status: "atrasoAnterior", rotulo: "Atividade em atraso com atividade anterior pendente", cor: "#a855f7", dica: "Atrasada, e a atividade anterior (ciclo anterior ou pavimento de baixo) ainda não terminou." },
  { status: "periodo", rotulo: "Atividade dentro do período do ciclo (15 dias)", cor: "#38bdf8", dica: "O período do ciclo está correndo, mas ainda depende da atividade anterior." },
  { status: "na", rotulo: "Não se aplica nessa obra", cor: "#94a3b8", dica: "Marcado como não se aplica." },
  { status: "vazio", rotulo: "Vazio", cor: "#ffffff", dica: "Ainda não chegou o período desta atividade." },
  { status: "meta", rotulo: "Meta do ciclo (pendente) — automático", cor: "#ec4899", dica: "Liberada e com prazo no período atual: é a meta deste ciclo." },
];
export const COR_STATUS = Object.fromEntries(LEGENDA.map(l => [l.status, l.cor])) as Record<StatusCelula, string>;

export interface Avaliacao {
  status: StatusCelula;
  /** Deveria terminar dentro do período de referência e ainda não terminou. */
  meta: boolean;
  /** Janela planejada [início, fim) em AAAA-MM-DD (sem início da obra, não há plano). */
  janela?: [string, string];
}

const DIA = 86_400_000;
const paraDia = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DIA);
const deDia = (n: number) => new Date(n * DIA).toISOString().slice(0, 10);
const feita = (c?: Celula) => c?.s === "E" || c?.s === "N";

/** Status escolhidos à mão no menu da célula (ganham do cálculo). */
const MANUAL = { A: "atrasado", O: "atrasadoExec", P: "atrasoAnterior", D: "periodo", V: "vazio" } as const;
/** Marcação de cada status da legenda (meta do ciclo é só automática). */
export const MARCACAO_DO_STATUS: Partial<Record<StatusCelula, StatusMarcado>> = {
  executado: "E", execucao: "X", atrasado: "A", atrasadoExec: "O", atrasoAnterior: "P", periodo: "D", na: "N", vazio: "V",
};

/** Período de referência que contém `hoje` (índice 0 = primeiro período desde o início da obra). */
export function periodoDe(inicio: string, hoje: string, diasPeriodo: number): { indice: number; inicio: string; fim: string } {
  const i = Math.max(0, Math.floor((paraDia(hoje) - paraDia(inicio)) / diasPeriodo));
  const ini = paraDia(inicio) + i * diasPeriodo;
  return { indice: i, inicio: deDia(ini), fim: deDia(ini + diasPeriodo) };
}

/**
 * Avalia todas as células. Regras:
 * - dependência: a mesma atividade no pavimento de baixo (mesmo lado) não terminou, ou o ciclo anterior não terminou neste pavimento/lado;
 * - janela correndo = meta do ciclo (liberada) ou dentro do período do ciclo (ainda depende da anterior); antes dela, vazio;
 * - plano: o ciclo c começa no pavimento mais baixo depois de somados os dias dos ciclos anteriores e avança `metaPav`
 *   pavimentos a cada `dias`; passou do fim da janela sem executar = atrasado (roxo se a etapa anterior ainda está pendente).
 */
export function avaliarGrade(modelo: ModeloEscadinha, linhas: LinhaGrade[], grade: Grade, inicio: string | null | undefined, hoje: string): Map<string, Avaliacao> {
  const saida = new Map<string, Avaliacao>();
  const hojeN = paraDia(hoje);
  const periodo = inicio ? periodoDe(inicio, hoje, modelo.diasPeriodo) : null;
  const porNivel = new Map<string, LinhaGrade>();
  for (const l of linhas) porNivel.set(`${l.nivel}|${l.lado}`, l);
  let deslocamento = 0;
  const inicios = modelo.ciclos.map(c => { const d = deslocamento; deslocamento += c.dias; return d; });

  modelo.ciclos.forEach((ciclo, ic) => {
    const anterior = ic > 0 ? modelo.ciclos[ic - 1] : null;
    for (const l of linhas) {
      const anteriorPendente = !!anterior && anterior.atividades.some(a => !feita(grade[chaveCelula(l.pavimento.id, l.lado, a.id)]));
      for (const a of ciclo.atividades) {
        const chave = chaveCelula(l.pavimento.id, l.lado, a.id);
        const c = grade[chave];
        const abaixo = l.nivel > 0 ? porNivel.get(`${l.nivel - 1}|${l.lado}`) : undefined;
        const dependente = anteriorPendente || (!!abaixo && !feita(grade[chaveCelula(abaixo.pavimento.id, l.lado, a.id)]));
        let janela: [string, string] | undefined;
        if (inicio && ciclo.metasAtivas) {
          const ini = paraDia(inicio) + inicios[ic] + Math.floor(l.nivel / ciclo.metaPav) * ciclo.dias;
          janela = [deDia(ini), deDia(ini + ciclo.dias)];
        }
        const vencida = !!janela && hojeN >= paraDia(janela[1]);
        const emCurso = !!janela && hojeN >= paraDia(janela[0]) && !vencida;
        let status: StatusCelula;
        if (c && c.s in MANUAL) status = MANUAL[c.s as keyof typeof MANUAL];
        else if (c?.s === "E") status = "executado";
        else if (c?.s === "N") status = "na";
        else if (c?.s === "X") status = vencida ? "atrasadoExec" : "execucao";
        else if (vencida) status = dependente ? "atrasoAnterior" : "atrasado";
        else if (emCurso) status = dependente ? "periodo" : "meta";
        else status = "vazio";
        const meta = !!periodo && !!janela && !feita(c) && paraDia(janela[1]) > paraDia(periodo.inicio) && paraDia(janela[1]) <= paraDia(periodo.fim);
        saida.set(chave, { status, meta, janela });
      }
    }
  });
  return saida;
}

// ---------------------------------------------------------------- resumo e gargalos

export interface Resumo {
  contagem: Record<StatusCelula, number>;
  /** Por ciclo: pavimentos com o ciclo inteiro feito nos dois lados (do mais baixo para cima, sem buraco). */
  avancoPorCiclo: { ciclo: CicloModelo; pavimentosConcluidos: number; ultimo?: string }[];
  /** Percentual executado (N/A conta como feito). */
  percentual: number;
}

export function resumir(modelo: ModeloEscadinha, linhas: LinhaGrade[], grade: Grade, avaliacao: Map<string, Avaliacao>): Resumo {
  const contagem = Object.fromEntries(LEGENDA.map(l => [l.status, 0])) as Record<StatusCelula, number>;
  for (const a of avaliacao.values()) contagem[a.status]++;
  const total = avaliacao.size || 1;
  const pavs = [...new Map(linhas.map(l => [l.pavimento.id, l])).values()].sort((a, b) => a.nivel - b.nivel);
  const avancoPorCiclo = modelo.ciclos.map(ciclo => {
    let n = 0;
    let ultimo: string | undefined;
    for (const p of pavs) {
      const ok = (["A", "B"] as Lado[]).every(lado => ciclo.atividades.every(a => feita(grade[chaveCelula(p.pavimento.id, lado, a.id)])));
      if (!ok) break;
      n++;
      ultimo = p.pavimento.nome;
    }
    return { ciclo, pavimentosConcluidos: n, ultimo };
  });
  return { contagem, avancoPorCiclo, percentual: (contagem.executado + contagem.na) / total };
}

export interface Gargalo {
  chave: string;
  atividade: AtividadeModelo;
  ciclo: CicloModelo;
  linha: LinhaGrade;
  /** Quantas células atrasadas dependem desta (direta ou indiretamente). */
  travaAtrasadas: number;
  status: StatusCelula;
}

/**
 * Gargalos: células ainda não feitas que seguram células atrasadas (a mesma atividade acima e o ciclo seguinte no mesmo
 * pavimento/lado). Ordena pelo tamanho do estrago, para o engenheiro atacar primeiro o que destrava mais coisa.
 */
export function gargalos(modelo: ModeloEscadinha, linhas: LinhaGrade[], avaliacao: Map<string, Avaliacao>, max = 6): Gargalo[] {
  const ordem = atividadesEmOrdem(modelo);
  const porNivel = new Map<string, LinhaGrade>();
  for (const l of linhas) porNivel.set(`${l.nivel}|${l.lado}`, l);
  const atrasada = (s?: StatusCelula) => s === "atrasado" || s === "atrasoAnterior" || s === "atrasadoExec";
  const resultado: Gargalo[] = [];
  for (const l of linhas) {
    for (const { atividade, ciclo, indiceCiclo } of ordem) {
      const chave = chaveCelula(l.pavimento.id, l.lado, atividade.id);
      const av = avaliacao.get(chave);
      if (!av || av.status === "executado" || av.status === "na" || av.status === "periodo" || av.status === "atrasoAnterior") continue;
      // Só conta como gargalo quem já pode andar (não depende de outra pendente) e trava gente atrasada.
      let trava = 0;
      for (let n = l.nivel + 1; ; n++) {
        const acima = porNivel.get(`${n}|${l.lado}`);
        if (!acima) break;
        if (atrasada(avaliacao.get(chaveCelula(acima.pavimento.id, l.lado, atividade.id))?.status)) trava++;
      }
      const seguinte = modelo.ciclos[indiceCiclo + 1];
      if (seguinte) for (const a of seguinte.atividades) if (atrasada(avaliacao.get(chaveCelula(l.pavimento.id, l.lado, a.id))?.status)) trava++;
      if (atrasada(av.status)) trava++;
      if (trava > 0) resultado.push({ chave, atividade, ciclo, linha: l, travaAtrasadas: trava, status: av.status });
    }
  }
  return resultado.sort((a, b) => b.travaAtrasadas - a.travaAtrasadas || a.linha.nivel - b.linha.nivel).slice(0, max);
}

// ---------------------------------------------------------------- 3D

export type EstadoCamada = "E" | "X";

/** Por pavimento|lado: o que cada camada tem (E = feito, X = em execução). Executado ganha de em execução. */
export function camadasPorPavimento(modelo: ModeloEscadinha, grade: Grade): Map<string, Map<Camada, EstadoCamada>> {
  const camadaDe = new Map(atividadesEmOrdem(modelo).map(x => [x.atividade.id, x.atividade.camada]));
  const saida = new Map<string, Map<Camada, EstadoCamada>>();
  for (const [chave, c] of Object.entries(grade)) {
    if (c.s !== "E" && c.s !== "X" && c.s !== "O") continue;
    const [pav, lado, idAtividade] = chave.split("|");
    const camada = camadaDe.get(idAtividade);
    if (!camada) continue;
    const k = `${pav}|${lado}`;
    const m = saida.get(k) ?? new Map<Camada, EstadoCamada>();
    if (c.s === "E" || m.get(camada) !== "E") m.set(camada, c.s === "E" ? "E" : "X");
    saida.set(k, m);
  }
  return saida;
}

/** Filtro do 3D: uma atividade, um ciclo inteiro ou tudo. Devolve as camadas visíveis (null = todas). */
export function camadasDoFiltro(modelo: ModeloEscadinha, filtro: { tipo: "tudo" } | { tipo: "ciclo"; id: string } | { tipo: "atividade"; id: string }): Set<Camada> | null {
  if (filtro.tipo === "tudo") return null;
  if (filtro.tipo === "ciclo") return new Set(modelo.ciclos.find(c => c.id === filtro.id)?.atividades.map(a => a.camada) ?? []);
  const a = atividadesEmOrdem(modelo).find(x => x.atividade.id === filtro.id);
  return new Set(a ? [a.atividade.camada] : []);
}
