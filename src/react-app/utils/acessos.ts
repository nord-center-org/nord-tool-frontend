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
