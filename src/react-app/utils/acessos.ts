/** Regras puras da tela de Acessos (sem React, testáveis em node). */

export type Nivel = "NENHUM" | "LEITURA" | "ESCRITA" | "ADMIN";

export const NIVEIS: Nivel[] = ["NENHUM", "LEITURA", "ESCRITA", "ADMIN"];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  NENHUM: "Sem acesso",
  LEITURA: "Ver",
  ESCRITA: "Editar",
  ADMIN: "Admin",
};

/** Nome amigável e as telas que cada módulo libera. */
export const MODULOS: Record<string, { nome: string; telas: string }> = {
  VISTORIA: { nome: "Entregas", telas: "Agenda, Apartamentos e Dashboard" },
  TERMO_REPROVA: { nome: "Termos de reprova", telas: "Termos e PDFs dos apartamentos" },
  CONTROLE_CHAVES: { nome: "Controle de chaves", telas: "Chaves e ferramentas" },
  CRONOGRAMA: { nome: "Cronograma semanal", telas: "Rotina, Kanban e Lista" },
  MEDICOES: { nome: "Medições", telas: "Boletins de medição" },
  CAIXINHA: { nome: "Caixinha", telas: "Despesas e comprovantes" },
  FINANCEIRO: { nome: "Gestão financeira", telas: "Controle financeiro e investimentos" },
  CASAMENTO: { nome: "Casamento", telas: "Fornecedores, convidados e marcos" },
  CADASTROS: { nome: "Cadastros", telas: "Empresas, cargos e ferramentas" },
  ADMINISTRACAO: { nome: "Administração", telas: "Acessos de usuários (use Admin)" },
};

export function nomeModulo(codigo: string): string {
  return MODULOS[codigo]?.nome ?? codigo;
}

/** Nível de um mapa (módulo ausente = NENHUM). */
export function nivelDe(mapa: Record<string, string> | undefined, modulo: string): Nivel {
  const v = mapa?.[modulo];
  return v && (NIVEIS as string[]).includes(v) ? (v as Nivel) : "NENHUM";
}

/** Mapa completo (todos os módulos) com o nível de cada um. */
export function completar(modulos: string[], mapa: Record<string, string> | undefined): Record<string, Nivel> {
  return Object.fromEntries(modulos.map(m => [m, nivelDe(mapa, m)]));
}

export interface Rascunho {
  cdPerfil: string;
  inAtivo: boolean;
  acessos: Record<string, Nivel>;
}

/** O rascunho difere do que está salvo? */
export function alterado(a: Rascunho, b: Rascunho): boolean {
  if (a.cdPerfil !== b.cdPerfil || a.inAtivo !== b.inAtivo) return true;
  const chaves = new Set([...Object.keys(a.acessos), ...Object.keys(b.acessos)]);
  return [...chaves].some(k => (a.acessos[k] ?? "NENHUM") !== (b.acessos[k] ?? "NENHUM"));
}

/** Módulos em que o usuário foge do padrão do perfil. */
export function personalizados(acessos: Record<string, Nivel>, doPerfil: Record<string, string> | undefined): string[] {
  return Object.keys(acessos).filter(m => acessos[m] !== nivelDe(doPerfil, m));
}

/** Quantos módulos o usuário pode abrir. */
export function qtModulosLiberados(acessos: Record<string, string>): number {
  return Object.values(acessos).filter(v => v && v !== "NENHUM").length;
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function filtrarUsuarios<T extends { nmNome: string; nmEmail: string }>(lista: T[], busca: string): T[] {
  const termo = semAcento(busca.trim());
  if (!termo) return lista;
  return lista.filter(u => semAcento(`${u.nmNome} ${u.nmEmail}`).includes(termo));
}

/** Padrão de um usuário: o cargo prevalece sobre o perfil no mesmo módulo. */
export function padraoDe(doPerfil: Record<string, string> | undefined, doCargo: Record<string, string> | undefined): Record<string, string> {
  return { ...(doPerfil ?? {}), ...Object.fromEntries(Object.entries(doCargo ?? {}).filter(([, v]) => v && v !== "NENHUM")) };
}

export interface LinhaArvore<T> { item: T; nivel: number }

/**
 * Hierarquia em árvore: cada pessoa logo abaixo do seu superior. Quem não tem superior (ou cujo superior não está
 * na lista) fica no topo. Ciclos não travam: cada pessoa aparece uma vez só.
 */
export function arvoreHierarquia<T extends { id: number; nmNome: string; idSuperior?: number | null }>(itens: T[]): LinhaArvore<T>[] {
  const ids = new Set(itens.map(i => i.id));
  const filhos = new Map<number | null, T[]>();
  for (const i of itens) {
    const pai = i.idSuperior != null && ids.has(i.idSuperior) && i.idSuperior !== i.id ? i.idSuperior : null;
    filhos.set(pai, [...(filhos.get(pai) ?? []), i]);
  }
  for (const l of filhos.values()) l.sort((a, b) => a.nmNome.localeCompare(b.nmNome, "pt-BR"));
  const saida: LinhaArvore<T>[] = [];
  const vistos = new Set<number>();
  const visitar = (pai: number | null, nivel: number) => {
    for (const f of filhos.get(pai) ?? []) {
      if (vistos.has(f.id)) continue;
      vistos.add(f.id);
      saida.push({ item: f, nivel });
      visitar(f.id, nivel + 1);
    }
  };
  visitar(null, 0);
  // Sobra de ciclo (A→B→A sem topo): entra no fim, no nível 0.
  for (const i of itens) if (!vistos.has(i.id)) { vistos.add(i.id); saida.push({ item: i, nivel: 0 }); visitar(i.id, 1); }
  return saida;
}

/** Ids abaixo de alguém (para não oferecer como superior quem está abaixo da pessoa). */
export function abaixoDe<T extends { id: number; idSuperior?: number | null }>(itens: T[], id: number): Set<number> {
  const resultado = new Set<number>();
  let fronteira = [id];
  while (fronteira.length) {
    const proximos = itens.filter(i => i.idSuperior != null && fronteira.includes(i.idSuperior) && !resultado.has(i.id) && i.id !== id).map(i => i.id);
    proximos.forEach(x => resultado.add(x));
    fronteira = proximos;
  }
  return resultado;
}
