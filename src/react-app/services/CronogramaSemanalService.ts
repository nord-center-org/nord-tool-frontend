import { apiFetch } from './apiClient';

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

const BASE_PATH = '/cronogramaSemanal';

const doisDigitos = (valor: number) => String(valor).padStart(2, '0');

export const paraDataHoraBackend = (valor?: string | null): string | undefined => {
  if (!valor) return undefined;
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const data = somenteData ? new Date(`${valor}T00:00:00`) : new Date(valor);
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

export const CronogramaSemanalService = {
  listar() {
    return apiFetch<CronogramaSemanalItem[]>(BASE_PATH);
  },
  buscarPorId(id: number) {
    return apiFetch<CronogramaSemanalItem>(`${BASE_PATH}/${id}`);
  },
  criar(item: CronogramaSemanalItem) {
    return apiFetch<CronogramaSemanalItem>(BASE_PATH, {
      method: 'POST',
     
      body: JSON.stringify({
        ...item,
        dtPrazo: paraDataHoraBackend(item.dtPrazo),
        dtFinalizacao: paraDataHoraBackend(item.dtFinalizacao),
        dtAgendamento: paraDataHoraBackend(item.dtAgendamento),
      }),
    });
  },
  alterar(item: CronogramaSemanalItem) {
    return apiFetch<CronogramaSemanalItem>(BASE_PATH, {
      method: 'PUT',
     
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
    return apiFetch<void>(`${BASE_PATH}/${id}`, { method: 'DELETE' });
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
