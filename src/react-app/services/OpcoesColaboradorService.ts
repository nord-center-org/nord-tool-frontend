export interface Empresa { id: number; nmEmpresa: string; }
export interface Cargo { id: number; nmCargo: string; }
export interface Permissao { id: number; nmPermissao: string; }

interface ApiResponseBody<T> {
  body?: T;
  txMensagem?: string;
}

type OpcaoColaborador = Empresa | Cargo | Permissao;

const API_BASE = (
  import.meta.env.DEV
    ? '/api/v1/nord-tool'
    : (import.meta.env.VITE_API_URL as string | undefined) || ''
).replace(/\/+$/, '').replace(/\/api$/, '');

const processarResposta = async <T>(res: Response, descricao: string): Promise<T> => {
  const texto = await res.text();
  let json: ApiResponseBody<unknown> | unknown = null;

  if (texto.trim()) {
    try {
      json = JSON.parse(texto) as ApiResponseBody<unknown>;
    } catch {
      throw new Error(`Resposta inválida ao processar ${descricao}`);
    }
  }

  if (!res.ok) {
    const resposta = json && typeof json === 'object' ? json as ApiResponseBody<unknown> : null;
    const mensagem = resposta?.txMensagem || `Falha ao processar ${descricao}`;
    const causa = typeof resposta?.body === 'string' ? `: ${resposta.body}` : '';
    throw new Error(`${mensagem} (HTTP ${res.status})${causa}`);
  }

  const conteudo = json && typeof json === 'object' && 'body' in json
    ? (json as ApiResponseBody<unknown>).body
    : json;
  return conteudo as T;
};

const listarOpcoes = async <T extends OpcaoColaborador>(endpoint: string, descricao: string): Promise<T[]> => {
  if (!API_BASE) {
    throw new Error('VITE_API_URL não configurada para a API de Controle de Chaves');
  }
  const res = await fetch(`${API_BASE}${endpoint}`);
  const conteudo = await processarResposta<unknown>(res, `carregar ${descricao}`);
  return Array.isArray(conteudo) ? conteudo as T[] : [];
};

const criarOpcao = async <T extends OpcaoColaborador>(endpoint: string, payload: Record<string, unknown>, descricao: string): Promise<T> => {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return processarResposta<T>(res, `criar ${descricao}`);
};

const alterarOpcao = async <T extends OpcaoColaborador>(endpoint: string, id: number, payload: Record<string, unknown>, descricao: string): Promise<T> => {
  const res = await fetch(`${API_BASE}${endpoint}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return processarResposta<T>(res, `alterar ${descricao}`);
};

const excluirOpcao = async (endpoint: string, id: number, descricao: string): Promise<void> => {
  const res = await fetch(`${API_BASE}${endpoint}/${id}`, { method: 'DELETE' });
  await processarResposta<void>(res, `excluir ${descricao}`);
};

export const OpcoesColaboradorService = {
  listarEmpresas: () => listarOpcoes<Empresa>('/api/empresas', 'empresas'),
  listarCargos: () => listarOpcoes<Cargo>('/api/cargos', 'cargos'),
  listarPermissoes: () => listarOpcoes<Permissao>('/api/permissoes', 'permissões'),

  criarEmpresa: (nmEmpresa: string) => criarOpcao<Empresa>('/api/empresas', { nmEmpresa }, 'empresa'),
  alterarEmpresa: (id: number, nmEmpresa: string) => alterarOpcao<Empresa>('/api/empresas', id, { nmEmpresa }, 'empresa'),
  excluirEmpresa: (id: number) => excluirOpcao('/api/empresas', id, 'empresa'),

  criarCargo: (nmCargo: string) => criarOpcao<Cargo>('/api/cargos', { nmCargo }, 'cargo'),
  alterarCargo: (id: number, nmCargo: string) => alterarOpcao<Cargo>('/api/cargos', id, { nmCargo }, 'cargo'),
  excluirCargo: (id: number) => excluirOpcao('/api/cargos', id, 'cargo'),

  criarPermissao: (nmPermissao: string) => criarOpcao<Permissao>('/api/permissoes', { nmPermissao }, 'permissão'),
  alterarPermissao: (id: number, nmPermissao: string) => alterarOpcao<Permissao>('/api/permissoes', id, { nmPermissao }, 'permissão'),
  excluirPermissao: (id: number) => excluirOpcao('/api/permissoes', id, 'permissão'),
};
