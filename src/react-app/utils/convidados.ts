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

const pessoas = (c: ConvidadoBasico) => 1 + (c.nrAcompanhantes || 0);
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
  /** Convidados + acompanhantes, qualquer status. */
  qtPessoas: number;
  /** Convidados confirmados + seus acompanhantes. */
  qtPessoasConfirmadas: number;
}

export function totaisConvidados(itens: ConvidadoBasico[]): TotaisConvidados {
  let qtConfirmados = 0, qtPessoas = 0, qtPessoasConfirmadas = 0;
  for (const c of itens) {
    qtPessoas += pessoas(c);
    if (c.nmStatus === "CONFIRMADO") {
      qtConfirmados += 1;
      qtPessoasConfirmadas += pessoas(c);
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
    atual.qtPessoas += pessoas(c);
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
    mapa.set(mesa, (mapa.get(mesa) ?? 0) + pessoas(c));
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
