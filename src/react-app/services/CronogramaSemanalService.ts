export type Status = 'pendentes' | 'executar' | 'aguardar' | 'acompanhar' | 'finalizada';
export type Categoria = 'Pessoal' | 'Acadêmica' | 'Atlética' | 'Musical' | 'Devocional' | 'Engenharia' | 'Programação';

export interface CronogramaSemanalItem {
  id?: number;
  idDiaSemana?: number | null;
  nmDiaSemana?: string;
  nmCronogramaSemanal: string;
  nmHorario?: string;
  nmCategoria: Categoria;
  nmStatusCronograma: Status;
  txObservacao?: string;
  dtPrazo?: string | null;
  dtFinalizacao?: string | null;
  nmTag?: string;
  dtAgendamento?: string | null;
  flFixo: boolean;
}

interface ApiResponse<T> { body?: T; txMensagem?: string; error?: string }

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const API_URL = `${API_BASE}/api/v1/nord-tool/cronogramaSemanal`;

const doisDigitos = (valor: number) => String(valor).padStart(2, '0');

export const paraDataHoraBackend = (valor?: string | null): string | undefined => {
  if (!valor) return undefined;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return undefined;
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()} ${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`;
};

export const paraDataHoraInput = (valor?: string | null): string => {
  if (!valor) return '';
  const [data, hora] = valor.split(' ');
  if (!data) return '';
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes}-${dia}${hora ? `T${hora.slice(0, 5)}` : ''}`;
};

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
    throw new Error(`Falha na API de Cronograma Semanal (HTTP ${response.status})${detalhe ? `: ${detalhe}` : ''}`);
  }
  if (json && typeof json === 'object' && 'body' in json) return (json as ApiResponse<T>).body as T;
  return json as T;
};

export const CronogramaSemanalService = {
  listar() {
    return requisitar<CronogramaSemanalItem[]>(API_URL);
  },
  buscarPorId(id: number) {
    return requisitar<CronogramaSemanalItem>(`${API_URL}/${id}`);
  },
  criar(item: CronogramaSemanalItem) {
    return requisitar<CronogramaSemanalItem>(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        dtPrazo: paraDataHoraBackend(item.dtPrazo),
        dtFinalizacao: paraDataHoraBackend(item.dtFinalizacao),
        dtAgendamento: paraDataHoraBackend(item.dtAgendamento),
      }),
    });
  },
  alterar(item: CronogramaSemanalItem) {
    return requisitar<CronogramaSemanalItem>(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idCronogramaSemanal: item.id,
        ...item,
        dtPrazo: paraDataHoraBackend(item.dtPrazo),
        dtFinalizacao: paraDataHoraBackend(item.dtFinalizacao),
        dtAgendamento: paraDataHoraBackend(item.dtAgendamento),
      }),
    });
  },
  excluir(id: number) {
    return requisitar<void>(`${API_URL}/${id}`, { method: 'DELETE' });
  },
  moverStatus(ids: number[], status: Status, itens: CronogramaSemanalItem[]) {
    const porId = new Map(itens.map(item => [item.id, item]));
    return Promise.all(ids.map(id => {
      const atual = porId.get(id);
      if (!atual) return Promise.resolve();
      return CronogramaSemanalService.alterar({ ...atual, nmStatusCronograma: status });
    }));
  },
};
