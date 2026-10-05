import { apiFetch } from './apiClient';

export interface Colaborador {
  id?: number;
  nmColaborador: string;
  nrCelular: string;
  idEmpresa: number;
  nmEmpresa?: string;
  idCargo: number;
  nmCargo?: string;
  idPermissao: number;
  nmPermissao?: string;
}

const PATH = '/colaboradores';

export const ColaboradorService = {
  async listar(): Promise<Colaborador[]> {
    const conteudo = await apiFetch<unknown>(PATH);
    return Array.isArray(conteudo) ? conteudo as Colaborador[] : [];
  },

  async salvar(colaborador: Colaborador): Promise<void> {
    const method = colaborador.id ? 'PUT' : 'POST';
    const path = colaborador.id ? `${PATH}/${colaborador.id}` : PATH;
    await apiFetch(path, { method, body: JSON.stringify(colaborador) });
  }
};
