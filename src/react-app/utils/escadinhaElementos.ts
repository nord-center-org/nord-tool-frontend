/**
 * Um elemento do 3D por atividade da escadinha: cada atividade executada acrescenta a sua peça (a alvenaria só a
 * alvenaria, o gradil o gradil da sacada, cada prumada a sua, cada distribuição a sua…). Atividade que não deixa
 * nada construído (testes, conferências, limpezas, proteções) vira um ícone no chão do apartamento.
 * Sem React aqui.
 */
import { atividadesEmOrdem, type Camada, type EstadoCamada, type Grade, type ModeloEscadinha } from "./escadinhaCury.ts";

export type Elemento =
  | "alvenaria" | "muretas" | "pcf" | "gradil" | "caixinhas" | "quadro" | "laje" | "enfiacao_sistemas" | "para_raio"
  | "escoramento" | "desescoramento"
  | "iluminacao_hall" | "arremate_shaft" | "pintura_shaft" | "prumada_esgoto" | "prumada_agua" | "prumada_pluvial" | "prumada_incendio"
  | "prumada_gas" | "disjuntores" | "peitoril" | "imper_soleira" | "soleira_sacada" | "portas_sacada" | "caixilhos" | "regularizacao_escada"
  | "hidrante"
  | "dist_esgoto" | "dist_ventilacao" | "dist_gas" | "dist_agua" | "cavalete_agua" | "cavalete_gas" | "soleiras" | "imper_sacada"
  | "drywall_estrutura" | "kit_hidraulica" | "massa_podre" | "massa_sacada" | "caixas_sistemas" | "drywall_apto" | "drywall_hall"
  | "corrimao" | "imper_interna" | "ventokit" | "contrapiso_sacada"
  | "gesso_liso" | "ceramica" | "protecao_ceramica" | "tomadas" | "forro" | "cantoneira" | "loucas" | "textura_teto"
  | "portas_madeira" | "registro_gas" | "metais" | "valvula_sifao" | "preparacao_pintura"
  | "fachada_selador" | "fachada_textura" | "regularizacao_elevador" | "arandelas" | "elevadores" | "busway" | "pintura" | "espelhos"
  | "guarnicoes_porta" | "ventokit_acabamento" | "piso_laminado" | "guarnicao_janela" | "hall_arremates";

export const ROTULO_ELEMENTO: Record<Elemento, string> = {
  alvenaria: "Alvenaria", muretas: "Muretas e fechamento do elevador", pcf: "Batente da porta corta-fogo", gradil: "Gradil da sacada",
  caixinhas: "Caixinhas elétricas", quadro: "Fundo do quadro", laje: "Laje e enfiação do teto", enfiacao_sistemas: "Enfiação de sistemas",
  para_raio: "Para-raio", escoramento: "Reescoramento", desescoramento: "Retirada do reescoramento", iluminacao_hall: "Iluminação do hall",
  arremate_shaft: "Arremate dos shafts do hall", pintura_shaft: "Pintura do shaft", prumada_esgoto: "Prumada de esgoto",
  prumada_agua: "Prumada de água fria", prumada_pluvial: "Prumada de água pluvial", prumada_incendio: "Prumada de incêndio",
  prumada_gas: "Prumada de gás", disjuntores: "Disjuntores e alimentadores", peitoril: "Peitoril", imper_soleira: "Impermeabilização da soleira",
  soleira_sacada: "Soleira da porta-sacada", portas_sacada: "Portas-sacada", caixilhos: "Caixilhos", regularizacao_escada: "Piso da escadaria",
  hidrante: "Hidrante", dist_esgoto: "Distribuição de esgoto", dist_ventilacao: "Distribuição de ventilação", dist_gas: "Distribuição de gás",
  dist_agua: "Distribuição de água fria e quente", cavalete_agua: "Cavalete de água", cavalete_gas: "Cavalete de gás",
  soleiras: "Soleiras, bit e baguete", imper_sacada: "Impermeabilização da sacada", drywall_estrutura: "Estrutura do drywall",
  kit_hidraulica: "Kit de hidráulica", massa_podre: "Massa podre dos shafts", massa_sacada: "Massa da sacada",
  caixas_sistemas: "Caixas de sistemas", drywall_apto: "Fechamento drywall (apto)", drywall_hall: "Fechamento drywall (hall)",
  corrimao: "Corrimão", imper_interna: "Impermeabilização interna", ventokit: "Tubulação do ventokit", contrapiso_sacada: "Contrapiso da sacada",
  gesso_liso: "Gesso liso", ceramica: "Revestimento cerâmico", protecao_ceramica: "Proteção da cerâmica", tomadas: "Interruptores e tomadas",
  forro: "Forro de gesso", cantoneira: "Cantoneiras", loucas: "Louças e bancadas", textura_teto: "Textura / massa de teto",
  portas_madeira: "Portas de madeira", registro_gas: "Registro de gás", metais: "Metais", valvula_sifao: "Válvula, sifão e flexível",
  preparacao_pintura: "Preparação para pintura", fachada_selador: "Seladora / massa da fachada", fachada_textura: "Textura da fachada",
  regularizacao_elevador: "Poço do elevador", arandelas: "Arandelas", elevadores: "Elevadores", busway: "Busway", pintura: "Pintura",
  espelhos: "Espelhos das tomadas", guarnicoes_porta: "Guarnições das portas", ventokit_acabamento: "Acabamento do ventokit",
  piso_laminado: "Piso laminado", guarnicao_janela: "Guarnição de janela", hall_arremates: "Arremates do hall",
};

const sem = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Atividades sem peça construída: testes, conferências, limpezas, proteções, regulagens… (vão como ícone no chão). */
const SEM_PECA = /pente fino|conferencia|reconferencia|check.?list|teste|limpeza|protecao|regulagem|polimento|lixamento|selo de garantia|repasse|^pu |\bpu (dos|das)\b/;

/** [elemento, regra] na ordem: a primeira que casar vence (as mais específicas antes). */
const REGRAS: [Elemento, RegExp][] = [
  ["fachada_textura", /textura fachada/],
  ["fachada_selador", /seladora.*fachada|massa - fachada/],
  ["massa_sacada", /massa sacada|reboco/],
  ["desescoramento", /retirada do re-?escoramento/],
  ["escoramento", /re-?escoramento|desforma/],
  ["enfiacao_sistemas", /enfiacao especial/],
  ["laje", /^laje|laje tipo/],
  ["muretas", /mureta|fiadas|vao do elevador/],
  ["caixinhas", /caixinhas/],
  ["para_raio", /para\s*-?\s*raio/],
  ["hall_arremates", /^hall|rodape/],
  ["alvenaria", /alvenaria/],
  ["pcf", /pcf|corta fogo/],
  ["gradil", /gradil/],
  ["quadro", /fundo de quadro/],
  ["iluminacao_hall", /iluminacao do hall/],
  ["arremate_shaft", /arremate vedacao/],
  ["pintura_shaft", /pintura do shaft/],
  ["prumada_esgoto", /prumadas? (de )?esgoto/],
  ["prumada_agua", /prumadas? (de )?agua fria/],
  ["prumada_pluvial", /pluvial/],
  ["prumada_incendio", /prumadas? (de )?incendio/],
  ["prumada_gas", /prumadas? (de )?gas/],
  ["disjuntores", /disjuntor/],
  ["peitoril", /peitoril/],
  ["imper_soleira", /impermeabilizacao soleira/],
  ["soleira_sacada", /soleira porta/],
  ["portas_sacada", /portas? sacadas?/],
  ["caixilhos", /caixilho/],
  ["regularizacao_escada", /piso escadaria/],
  ["hidrante", /hidrante/],
  ["dist_esgoto", /distribuicao (de )?esgoto/],
  ["dist_ventilacao", /distribuicao (de )?ventilacao/],
  ["dist_gas", /distribuicao (de )?gas/],
  ["dist_agua", /distribuicao (de )?agua/],
  ["cavalete_agua", /cavalete (de )?agua/],
  ["cavalete_gas", /cavalete (de )?gas/],
  ["soleiras", /soleira, bit|baguete/],
  ["imper_sacada", /impermeabilizacao - sacada|impermeabilizacao da sacada/],
  ["drywall_estrutura", /estrutura drywall|autoclave/],
  ["kit_hidraulica", /kit de hidraulica/],
  ["massa_podre", /massa podre/],
  ["caixas_sistemas", /caixas de sistemas/],
  ["drywall_hall", /fechamento drywall hall/],
  ["drywall_apto", /fechamento drywall/],
  ["corrimao", /corrimao/],
  ["imper_interna", /impermeabilizacao interna/],
  ["ventokit_acabamento", /acabamento ventokit/],
  ["ventokit", /ventokit/],
  ["contrapiso_sacada", /contrapiso/],
  ["gesso_liso", /gesso liso/],
  ["ceramica", /revestimento ceramico|ceramica/],
  ["tomadas", /interruptores e tomadas/],
  ["forro", /forro/],
  ["cantoneira", /cantoneira/],
  ["loucas", /loucas e bancadas/],
  ["textura_teto", /massa de teto|textura \/ massa/],
  ["portas_madeira", /portas? de madeira/],
  ["registro_gas", /registro de gas/],
  ["metais", /^metais|\bmetais\b/],
  ["valvula_sifao", /valvula|sifao/],
  ["preparacao_pintura", /preparacao para pintura/],
  ["regularizacao_elevador", /regularizacao do elevador|pintura do poco/],
  ["arandelas", /arandela/],
  ["elevadores", /elevador/],
  ["busway", /busway|barramento/],
  ["espelhos", /espelhos/],
  ["guarnicoes_porta", /guarnicoes de madeira|guarnicao de porta/],
  ["guarnicao_janela", /guarnicao de janela/],
  ["piso_laminado", /piso laminado/],
  ["pintura", /pintura/],
];

/** Elemento padrão de cada camada (atividade nova que o admin criou com outro nome). */
const DA_CAMADA: Partial<Record<Camada, Elemento>> = {
  alvenaria: "alvenaria", laje: "laje", escoramento: "escoramento", desescoramento: "desescoramento", eletrica: "caixinhas",
  hidraulica: "dist_agua", gas: "dist_gas", incendio: "prumada_incendio", esquadria: "caixilhos", impermeabilizacao: "imper_interna",
  contrapiso: "contrapiso_sacada", drywall: "drywall_apto", gesso: "forro", ceramica: "ceramica", loucas: "loucas", metais: "metais",
  portas: "portas_madeira", pintura: "pintura", fachada: "fachada_textura", elevador: "elevadores", piso: "piso_laminado",
};

/** Elemento que a atividade acrescenta; null = sem peça (vira ícone no chão). */
export function elementoDaAtividade(nome: string, camada?: Camada): Elemento | null {
  const n = sem(nome);
  // A preparação para pintura deixa a parede selada e emassada (tem peça), mesmo falando em lixamento.
  if (/preparacao para pintura/.test(n)) return "preparacao_pintura";
  if (SEM_PECA.test(n)) return null;
  for (const [e, r] of REGRAS) if (r.test(n)) return e;
  return camada ? DA_CAMADA[camada] ?? null : null;
}

/** Símbolo do ícone no chão de uma atividade sem peça. */
export function iconeDaAtividade(nome: string): string {
  const n = sem(nome);
  if (/teste.*eletric/.test(n)) return "⚡";
  if (/teste|estanqueidade/.test(n)) return "💧";
  if (/limpeza/.test(n)) return "🧹";
  if (/protecao/.test(n)) return "🛡";
  if (/regulagem/.test(n)) return "🔧";
  if (/selo|chave/.test(n)) return "🔑";
  if (/polimento|lixamento/.test(n)) return "✨";
  if (/^pu |\bpu\b/.test(n)) return "🧴";
  if (/repasse/.test(n)) return "🖌";
  if (/grout|graute/.test(n)) return "🧱";
  return "✓";
}

/** Chave de estado de um ícone (uma por atividade, para cada uma ter o seu). */
export const chaveIcone = (idAtividade: string) => `icone:${idAtividade}`;

/** O que cada atividade do modelo acrescenta: elemento ou ícone. */
export function mapaDeElementos(modelo: ModeloEscadinha): Map<string, { chave: string; nome: string; icone?: string; noHall: boolean }> {
  const m = new Map<string, { chave: string; nome: string; icone?: string; noHall: boolean }>();
  for (const { atividade } of atividadesEmOrdem(modelo)) {
    const e = elementoDaAtividade(atividade.nome, atividade.camada);
    const noHall = /hall|escada/.test(sem(atividade.nome));
    m.set(atividade.id, e ? { chave: e, nome: atividade.nome, noHall } : { chave: chaveIcone(atividade.id), nome: atividade.nome, icone: iconeDaAtividade(atividade.nome), noHall });
  }
  return m;
}

/** Por pavimento|lado: o estado de cada elemento e de cada ícone (E feito, X em execução; executado ganha). */
export function elementosPorPavimento(modelo: ModeloEscadinha, grade: Grade): Map<string, Map<string, EstadoCamada>> {
  const mapa = mapaDeElementos(modelo);
  const saida = new Map<string, Map<string, EstadoCamada>>();
  for (const [chave, c] of Object.entries(grade)) {
    if (c.s !== "E" && c.s !== "X" && c.s !== "O") continue;
    const [pav, lado, idAtividade] = chave.split("|");
    const e = mapa.get(idAtividade);
    if (!e) continue;
    const k = `${pav}|${lado}`;
    const m = saida.get(k) ?? new Map<string, EstadoCamada>();
    if (c.s === "E" || m.get(e.chave) !== "E") m.set(e.chave, c.s === "E" ? "E" : "X");
    saida.set(k, m);
  }
  return saida;
}

/** Filtro do 3D por elemento: uma atividade, um ciclo ou tudo (null). */
export function elementosDoFiltro(modelo: ModeloEscadinha, filtro: { tipo: "tudo" } | { tipo: "ciclo"; id: string } | { tipo: "atividade"; id: string }): Set<string> | null {
  if (filtro.tipo === "tudo") return null;
  const mapa = mapaDeElementos(modelo);
  const ids = filtro.tipo === "ciclo"
    ? modelo.ciclos.find(c => c.id === filtro.id)?.atividades.map(a => a.id) ?? []
    : [filtro.id];
  return new Set(ids.map(id => mapa.get(id)?.chave).filter((c): c is string => !!c));
}

/** Tudo pronto (apartamento modelo): todos os elementos e ícones do modelo executados, sem o escoramento. */
export function tudoPronto(modelo: ModeloEscadinha): Map<string, EstadoCamada> {
  const m = new Map<string, EstadoCamada>();
  for (const e of mapaDeElementos(modelo).values()) if (e.chave !== "escoramento") m.set(e.chave, "E");
  m.set("desescoramento", "E");
  return m;
}
