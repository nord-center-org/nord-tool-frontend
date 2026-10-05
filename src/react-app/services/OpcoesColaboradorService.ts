import { apiFetch } from './apiClient';

export interface Empresa { id: number; nmEmpresa: string; }
export interface Cargo { id: number; nmCargo: string; }
export interface Permissao { id: number; nmPermissao: string; }

type OpcaoColaborador = Empresa | Cargo | Permissao;

const listarOpcoes = async <T extends OpcaoColaborador>(endpoint: string): Promise<T[]> => {
  const conteudo = await apiFetch<unknown>(endpoint);
  return Array.isArray(conteudo) ? conteudo as T[] : [];
};

const criarOpcao = <T extends OpcaoColaborador>(endpoint: string, payload: Record<string, unknown>): Promise<T> =>
  apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(payload) });

const alterarOpcao = <T extends OpcaoColaborador>(endpoint: string, id: number, payload: Record<string, unknown>): Promise<T> =>
  apiFetch<T>(`${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

const excluirOpcao = async (endpoint: string, id: number): Promise<void> => {
  await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
};

export const OpcoesColaboradorService = {
  listarEmpresas: () => listarOpcoes<Empresa>('/empresas'),
  listarCargos: () => listarOpcoes<Cargo>('/cargos'),
  listarPermissoes: () => listarOpcoes<Permissao>('/permissoes'),

  criarEmpresa: (nmEmpresa: string) => criarOpcao<Empresa>('/empresas', { nmEmpresa }),
  alterarEmpresa: (id: number, nmEmpresa: string) => alterarOpcao<Empresa>('/empresas', id, { nmEmpresa }),
  excluirEmpresa: (id: number) => excluirOpcao('/empresas', id),

  criarCargo: (nmCargo: string) => criarOpcao<Cargo>('/cargos', { nmCargo }),
  alterarCargo: (id: number, nmCargo: string) => alterarOpcao<Cargo>('/cargos', id, { nmCargo }),
  excluirCargo: (id: number) => excluirOpcao('/cargos', id),

  criarPermissao: (nmPermissao: string) => criarOpcao<Permissao>('/permissoes', { nmPermissao }),
  alterarPermissao: (id: number, nmPermissao: string) => alterarOpcao<Permissao>('/permissoes', id, { nmPermissao }),
  excluirPermissao: (id: number) => excluirOpcao('/permissoes', id),
};
