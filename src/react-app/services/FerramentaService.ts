import { apiFetch } from './apiClient';

export interface Ferramenta {
  id?: number;
  nmFerramenta: string;
  nmCategoria?: string;
  cdPatrimonio?: string;
  flAtivo?: boolean;
}

const BASE_PATH = '/ferramentas';

export const FerramentaService = {
  listar() {
    return apiFetch<Ferramenta[]>(BASE_PATH);
  },
  criar(ferramenta: Ferramenta) {
    return apiFetch<Ferramenta>(BASE_PATH, {
      method: 'POST',
     
      body: JSON.stringify(ferramenta),
    });
  },
  alterar(id: number, ferramenta: Ferramenta) {
    return apiFetch<Ferramenta>(`${BASE_PATH}/${id}`, {
      method: 'PUT',
     
      body: JSON.stringify(ferramenta),
    });
  },
  excluir(id: number) {
    return apiFetch<void>(`${BASE_PATH}/${id}`, { method: 'DELETE' });
  },
};
