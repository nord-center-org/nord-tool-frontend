/** Regras puras da aba Convidados (sem dependências, testáveis em node). */

export const ROTULO_STATUS_CONVIDADO = {
  NAO_CONVIDADO: "Não convidado",
  CONVIDADO: "Convidado",
  CONFIRMADO: "Confirmado",
  NAO_IRA: "Não irá",
} as const;

export type ChaveStatusConvidado = keyof typeof ROTULO_STATUS_CONVIDADO;

export const SEM_GRUPO = "Sem grupo";
export const SEM_MESA = "Sem mesa";

export interface ConvidadoBasico {
  nmGrupo: string | null;
  nmMesa: string | null;
  nmStatus: string;
  nrAcompanhantes: number;
}

/** Cada convidado é uma pessoa: os acompanhantes são cadastrados como convidados (ligados a outro), então o número de acompanhantes sem cadastro não entra nos indicadores. */
const PESSOAS_POR_CONVIDADO = 1;
const rotuloOu = (valor: string | null, padrao: string) => (valor && valor.trim() ? valor.trim() : padrao);

export interface ResumoGrupo {
  grupo: string;
  qtConvidados: number;
  qtConfirmados: number;
  qtPessoas: number;
}

export interface ResumoMesa {
  mesa: string;
  qtPessoas: number;
}

export interface TotaisConvidados {
  qtConvidados: number;
  qtConfirmados: number;
  /** Pessoas cadastradas, qualquer status (acompanhantes são convidados ligados). */
  qtPessoas: number;
  /** Pessoas confirmadas. */
  qtPessoasConfirmadas: number;
}

export function totaisConvidados(itens: ConvidadoBasico[]): TotaisConvidados {
  let qtConfirmados = 0, qtPessoas = 0, qtPessoasConfirmadas = 0;
  for (const c of itens) {
    qtPessoas += PESSOAS_POR_CONVIDADO;
    if (c.nmStatus === "CONFIRMADO") {
      qtConfirmados += 1;
      qtPessoasConfirmadas += PESSOAS_POR_CONVIDADO;
    }
  }
  return { qtConvidados: itens.length, qtConfirmados, qtPessoas, qtPessoasConfirmadas };
}

const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

/** Um item por grupo (ordem alfabética; "Sem grupo" por último). */
export function resumoPorGrupo(itens: ConvidadoBasico[]): ResumoGrupo[] {
  const mapa = new Map<string, ResumoGrupo>();
  for (const c of itens) {
    const grupo = rotuloOu(c.nmGrupo, SEM_GRUPO);
    const atual = mapa.get(grupo) ?? { grupo, qtConvidados: 0, qtConfirmados: 0, qtPessoas: 0 };
    atual.qtConvidados += 1;
    atual.qtPessoas += PESSOAS_POR_CONVIDADO;
    if (c.nmStatus === "CONFIRMADO") atual.qtConfirmados += 1;
    mapa.set(grupo, atual);
  }
  return [...mapa.values()].sort((a, b) =>
    a.grupo === SEM_GRUPO ? 1 : b.grupo === SEM_GRUPO ? -1 : comparar(a.grupo, b.grupo));
}

/** Pessoas por mesa (convidados + acompanhantes); "Sem mesa" por último. */
export function resumoPorMesa(itens: ConvidadoBasico[]): ResumoMesa[] {
  const mapa = new Map<string, number>();
  for (const c of itens) {
    const mesa = rotuloOu(c.nmMesa, SEM_MESA);
    mapa.set(mesa, (mapa.get(mesa) ?? 0) + PESSOAS_POR_CONVIDADO);
  }
  return [...mapa.entries()]
    .map(([mesa, qtPessoas]) => ({ mesa, qtPessoas }))
    .sort((a, b) => (a.mesa === SEM_MESA ? 1 : b.mesa === SEM_MESA ? -1 : comparar(a.mesa, b.mesa)));
}

/** Link do WhatsApp (wa.me) a partir de um telefone brasileiro; null se não houver dígitos suficientes. */
export function linkWhatsapp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const completo = digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
  return `https://wa.me/${completo}`;
}

export const COLUNAS_PLANILHA = ["Nome", "Grupo", "Telefone", "Relação", "Status", "Acompanhantes", "Mesa"] as const;

export interface ConvidadoExportavel extends ConvidadoBasico {
  nmConvidado: string;
  nrTelefone: string | null;
  nmRelacao: string | null;
}

/** Linhas no mesmo layout que o importador do backend reconhece (cabeçalho = COLUNAS_PLANILHA). */
export function linhasPlanilha(itens: ConvidadoExportavel[]): Record<(typeof COLUNAS_PLANILHA)[number], string | number>[] {
  return itens.map(c => ({
    Nome: c.nmConvidado,
    Grupo: c.nmGrupo ?? "",
    Telefone: c.nrTelefone ?? "",
    "Relação": c.nmRelacao ?? "",
    Status: ROTULO_STATUS_CONVIDADO[c.nmStatus as ChaveStatusConvidado] ?? c.nmStatus,
    Acompanhantes: c.nrAcompanhantes || 0,
    Mesa: c.nmMesa ?? "",
  }));
}

// ---------- família: convidados ligados em cascata ----------

export interface ConvidadoLigavel {
  idConvidado: number;
  idConvidadoPrincipal: number | null;
}

export interface LinhaFamilia<T> {
  item: T;
  /** 0 = principal (ou sem o principal na lista); 1 = ligado a um principal; 2 = ligado a um ligado… */
  nivel: number;
  /** Tem principal, mas ele não está na lista (filtrado): a linha aparece solta, com o aviso de quem ela acompanha. */
  principalForaDaLista: boolean;
}

/**
 * Põe cada convidado logo abaixo de quem ele acompanha (em cascata), mantendo a ordem recebida entre irmãos.
 * Quem acompanha alguém que não está na lista (filtro) aparece como principal, marcado com `principalForaDaLista`.
 */
export function organizarEmFamilias<T extends ConvidadoLigavel>(itens: T[]): LinhaFamilia<T>[] {
  const ids = new Set(itens.map(i => i.idConvidado));
  const filhos = new Map<number, T[]>();
  const raizes: T[] = [];
  for (const i of itens) {
    const p = i.idConvidadoPrincipal;
    if (p !== null && p !== i.idConvidado && ids.has(p)) filhos.set(p, [...(filhos.get(p) ?? []), i]);
    else raizes.push(i);
  }
  const saida: LinhaFamilia<T>[] = [];
  const vistos = new Set<number>();
  const visitar = (i: T, nivel: number) => {
    if (vistos.has(i.idConvidado)) return;
    vistos.add(i.idConvidado);
    saida.push({ item: i, nivel, principalForaDaLista: nivel === 0 && i.idConvidadoPrincipal !== null && !ids.has(i.idConvidadoPrincipal) });
    for (const f of filhos.get(i.idConvidado) ?? []) visitar(f, nivel + 1);
  };
  for (const r of raizes) visitar(r, 0);
  // Defesa: um círculo (que o backend recusa) não faz ninguém sumir da tela.
  for (const i of itens) visitar(i, 0);
  return saida;
}

/** Todos os que estão ligados, direta ou indiretamente, a `id` (não podem virar o principal dele: faria um círculo). */
export function descendentes(itens: ConvidadoLigavel[], id: number): Set<number> {
  const achados = new Set<number>();
  let novos = [id];
  while (novos.length > 0) {
    const proximos: number[] = [];
    for (const i of itens) {
      if (i.idConvidadoPrincipal !== null && novos.includes(i.idConvidadoPrincipal) && !achados.has(i.idConvidado) && i.idConvidado !== id) {
        achados.add(i.idConvidado);
        proximos.push(i.idConvidado);
      }
    }
    novos = proximos;
  }
  return achados;
}

// ---------- cortejo nupcial ----------

export const PAPEIS_CORTEJO_PADRAO = ["Padrinho", "Madrinha", "Daminha", "Pajem", "Dama de honra"] as const;

/** Sugestões do campo: os papéis padrão e os que já foram usados (sem repetir, ignorando caixa e acento). */
export function papeisDoCortejo(itens: { nmCortejo: string | null }[]): string[] {
  const chave = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const vistos = new Map<string, string>();
  for (const p of PAPEIS_CORTEJO_PADRAO) vistos.set(chave(p), p);
  for (const i of itens) {
    const t = i.nmCortejo?.trim();
    if (t && !vistos.has(chave(t))) vistos.set(chave(t), t);
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

/** Quantos convidados fazem parte do cortejo. */
export function qtNoCortejo(itens: { nmCortejo: string | null }[]): number {
  return itens.filter(i => (i.nmCortejo ?? "").trim() !== "").length;
}

// ---------- busca ----------

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export interface ConvidadoPesquisavel {
  nmConvidado: string;
  nmGrupo: string | null;
  nrTelefone: string | null;
  nmRelacao: string | null;
  nmMesa: string | null;
  nmCortejo: string | null;
  nmConvidadoPrincipal: string | null;
}

/**
 * Busca por texto, sem diferenciar maiúsculas nem acentos: todas as palavras digitadas precisam aparecer
 * no nome, grupo, telefone (com ou sem formatação), relação, mesa, cortejo ou no nome de quem ele acompanha.
 */
export function filtrarPorBusca<T extends ConvidadoPesquisavel>(itens: T[], termo: string): T[] {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return itens;
  return itens.filter(c => {
    const telefone = c.nrTelefone ?? "";
    const texto = semAcento([c.nmConvidado, c.nmGrupo, telefone, telefone.replace(/\D/g, ""), c.nmRelacao, c.nmMesa, c.nmCortejo, c.nmConvidadoPrincipal]
      .filter(Boolean).join(" "));
    return palavras.every(p => texto.includes(p));
  });
}

/** Para cada linha principal (nível 0) da cascata: quantos ligados vêm logo abaixo dela. */
export function contarLigadosAbaixo<T>(linhas: { item: T; nivel: number }[]): Map<T, number> {
  const contagem = new Map<T, number>();
  let raiz: T | null = null;
  for (const l of linhas) {
    if (l.nivel === 0) {
      raiz = l.item;
      contagem.set(raiz, 0);
    } else if (raiz !== null) {
      contagem.set(raiz, (contagem.get(raiz) ?? 0) + 1);
    }
  }
  return contagem;
}

// ---------- ações em massa ----------

/**
 * Convidados que podem ser o principal de todos os selecionados: não pode ser um dos selecionados
 * nem alguém ligado a eles (ligar um selecionado a um descendente dele fecharia um círculo).
 */
export function opcoesPrincipalEmMassa<T extends ConvidadoLigavel>(todos: T[], idsSelecionados: number[]): T[] {
  const proibidos = new Set<number>(idsSelecionados);
  for (const id of idsSelecionados) for (const d of descendentes(todos, id)) proibidos.add(d);
  return todos.filter(c => !proibidos.has(c.idConvidado));
}
