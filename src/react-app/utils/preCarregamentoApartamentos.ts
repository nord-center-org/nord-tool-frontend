/** Pré-carregamento da aba Apartamentos: filtros e ordenação iniciais (regras puras, sem React). */
import { VALOR_VAZIO } from "./filtroColuna.ts";

export type ColunaPreCarregamento = "apartamento" | "status" | "data" | "horario" | "observacao" | "termo" | "fotos";
export type DirecaoPreCarregamento = "asc" | "desc";

export const COLUNAS_PRE_CARREGAMENTO: { coluna: ColunaPreCarregamento; rotulo: string }[] = [
  { coluna: "apartamento", rotulo: "Apartamento" },
  { coluna: "status", rotulo: "Status" },
  { coluna: "data", rotulo: "Data" },
  { coluna: "horario", rotulo: "Horário" },
  { coluna: "observacao", rotulo: "Observação" },
  { coluna: "termo", rotulo: "Termo" },
  { coluna: "fotos", rotulo: "Fotos" },
];

export interface PreCarregamento {
  filtros: Partial<Record<ColunaPreCarregamento, string[]>>;
  ordenacao: { coluna: ColunaPreCarregamento; direcao: DirecaoPreCarregamento } | null;
}

/** Atalhos de data resolvidos na hora de abrir a tela (a preferência não envelhece). */
export const TOKEN_HOJE = "@hoje";
export const TOKEN_AMANHA = "@amanha";

export const CHAVE_PRE_CARREGAMENTO = "@NordTool:apartamentos_preload";
const CHAVE_STATUS_LEGADA = "@NordTool:filter_db_status";
export const PADRAO_LEGADO: PreCarregamento = { filtros: { status: ["Agendado", "Pendente"] }, ordenacao: null };

const COLUNAS_VALIDAS = COLUNAS_PRE_CARREGAMENTO.map(c => c.coluna);

interface ArmazenamentoLeitura {
  getItem(chave: string): string | null;
}

function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && v.trim() !== "").map(v => v.trim()) : [];
}

/**
 * Lê a preferência salva. Sem a chave nova, migra o "status padrão" antigo (ou o padrão original
 * Agendado/Pendente). Qualquer conteúdo inválido vira o padrão, nunca um erro.
 */
export function lerPreCarregamento(armazenamento: ArmazenamentoLeitura): PreCarregamento {
  try {
    const bruto = armazenamento.getItem(CHAVE_PRE_CARREGAMENTO);
    if (bruto) {
      const dados = JSON.parse(bruto) as Partial<PreCarregamento> | null;
      const filtros: PreCarregamento["filtros"] = {};
      for (const coluna of COLUNAS_VALIDAS) {
        const valores = listaDeTextos(dados?.filtros?.[coluna]);
        if (valores.length > 0) filtros[coluna] = valores;
      }
      const o = dados?.ordenacao;
      const ordenacao = o && COLUNAS_VALIDAS.includes(o.coluna) && (o.direcao === "asc" || o.direcao === "desc")
        ? { coluna: o.coluna, direcao: o.direcao }
        : null;
      return { filtros, ordenacao };
    }
    const legado = armazenamento.getItem(CHAVE_STATUS_LEGADA);
    if (legado !== null) {
      const status = listaDeTextos(JSON.parse(legado));
      return { filtros: status.length > 0 ? { status } : {}, ordenacao: null };
    }
  } catch {
    // cai no padrão
  }
  return { filtros: { ...PADRAO_LEGADO.filtros }, ordenacao: null };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
export const formatarDataBr = (d: Date) => `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Como cada coluna compara o valor salvo com o valor da tabela. */
const MODO: Record<ColunaPreCarregamento, "contem" | "exato"> = {
  apartamento: "contem",
  status: "contem", // "Aprovado" também pega "Aprovado DAT", como sempre foi
  observacao: "contem",
  data: "exato",
  horario: "exato",
  termo: "exato",
  fotos: "exato",
};

const minusculo = (t: string) => t.toLocaleLowerCase("pt-BR");

/**
 * Converte a preferência nos filtros que realmente existem nos dados carregados.
 * - "@hoje"/"@amanha" viram a data de hoje/amanhã (dd/MM/yyyy);
 * - cada valor salvo é casado com os valores existentes na coluna (contém ou exato, sem diferenciar caixa);
 * - coluna sem nenhum valor correspondente fica SEM filtro (evita abrir a tela vazia).
 */
export function resolverPreCarregamento(
  pre: PreCarregamento,
  valoresPorColuna: Record<ColunaPreCarregamento, string[]>,
  hoje: Date = new Date(),
): Partial<Record<ColunaPreCarregamento, string[]>> {
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  const resultado: Partial<Record<ColunaPreCarregamento, string[]>> = {};
  for (const coluna of COLUNAS_VALIDAS) {
    const salvos = pre.filtros[coluna];
    if (!salvos || salvos.length === 0) continue;
    const alvos = salvos.map(v => (v === TOKEN_HOJE ? formatarDataBr(hoje) : v === TOKEN_AMANHA ? formatarDataBr(amanha) : v));
    const existentes = valoresPorColuna[coluna] ?? [];
    const casados = existentes.filter(valor => alvos.some(alvo => {
      if (alvo === VALOR_VAZIO || valor === VALOR_VAZIO) return alvo === valor;
      return MODO[coluna] === "contem" ? minusculo(valor).includes(minusculo(alvo)) : minusculo(valor) === minusculo(alvo);
    }));
    if (casados.length > 0) resultado[coluna] = casados;
  }
  return resultado;
}

/** Alterna um valor em uma lista (usado pelos checkboxes e pelas fichas da tela de configurações). */
export function alternarValor(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor];
}

/** Monta o objeto salvo, descartando colunas vazias. */
export function montarPreCarregamento(
  filtros: Partial<Record<ColunaPreCarregamento, string[]>>,
  ordenacao: PreCarregamento["ordenacao"],
): PreCarregamento {
  const limpos: PreCarregamento["filtros"] = {};
  for (const coluna of COLUNAS_VALIDAS) {
    const valores = listaDeTextos(filtros[coluna]);
    if (valores.length > 0) limpos[coluna] = [...new Set(valores)];
  }
  return { filtros: limpos, ordenacao };
}
