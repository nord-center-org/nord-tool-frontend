export interface Ferramenta {
  id?: number;
  nmFerramenta: string;
  nmCategoria?: string;
  cdPatrimonio?: string;
  flAtivo?: boolean;
}

interface ApiResponse<T> { body?: T; txMensagem?: string; error?: string }

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const API_URL = `${API_BASE}/api/ferramentas`;

const requisitar = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  let json: ApiResponse<T> | T | null = null;
  if (text.trim()) {
    try { json = JSON.parse(text) as ApiResponse<T> | T; }
    catch { throw new Error(`Resposta inválida do servidor (HTTP ${response.status})`); }
  }
  if (!response.ok) {
    const envelope = json && typeof json === 'object' ? json as ApiResponse<T> : null;
    const detalhe = envelope?.txMensagem || envelope?.error || response.statusText;
    throw new Error(`Falha na API de Ferramentas (HTTP ${response.status})${detalhe ? `: ${detalhe}` : ''}`);
  }
  if (json && typeof json === 'object' && 'body' in json) return (json as ApiResponse<T>).body as T;
  return json as T;
};

export const FerramentaService = {
  listar() {
    return requisitar<Ferramenta[]>(API_URL);
  },
  criar(ferramenta: Ferramenta) {
    return requisitar<Ferramenta>(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ferramenta),
    });
  },
  alterar(id: number, ferramenta: Ferramenta) {
    return requisitar<Ferramenta>(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ferramenta),
    });
  },
  excluir(id: number) {
    return requisitar<void>(`${API_URL}/${id}`, { method: 'DELETE' });
  },
};
