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
  /** v3: último dia da demanda pontual que dura vários dias (nulo = um dia só). */
  dtFimAgendamento?: string | null;
  flFixo: boolean;
  /** Cronograma pessoal (vêm do backend). */
  idDono?: number | null;
  nmDono?: string | null;
  /** false = compartilhado comigo por outra pessoa (só leitura). */
  flProprio?: boolean;
  idsCompartilhados?: number[];
}

/** Demanda montada no chat a partir do texto (ainda não salva). Datas como nos campos da tela. */
export interface RascunhoDemanda {
  nmCronogramaSemanal: string;
  txObservacao?: string | null;
  nmCategoria: Categoria;
  nmStatusCronograma: Status;
  nmTag?: string | null;
  /** AAAA-MM-DD */
  dtPrazo?: string | null;
  flFixo: boolean;
  /** Ids de dia_semana (1 = segunda … 5 = sexta, 7 = sábado). */
  diasSemana: number[];
  nmHorario?: string | null;
  /** AAAA-MM-DDTHH:mm */
  dtAgendamento?: string | null;
  /** AAAA-MM-DD: último dia da demanda pontual que dura vários dias. */
  dtFimAgendamento?: string | null;
}

/** Equipe do cronograma numa obra: os membros veem as demandas uns dos outros. */
export interface CronogramaEquipe {
  id: number;
  idObra: number;
  nmObra: string;
  nmEquipe: string;
  idLider?: number | null;
  nmLider?: string | null;
  idsMembros: number[];
}

export interface CronogramaEquipeForm {
  nmEquipe: string;
  idLider: number | null;
  idsMembros: number[];
}

export interface CronogramaSemanalExcecao {
  idCronogramaSemanal: number;
  dtExcecao: string;
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
  /** Pessoas com quem dá para compartilhar (inEquipe = abaixo de mim na hierarquia). */
  async pessoas() {
    return (await apiFetch<import('../utils/compartilhamento').PessoaCompartilhavel[]>(`${BASE_PATH}/pessoas`)) ?? [];
  },
  /** Substitui a lista de quem vê o item (lista vazia = só eu). */
  compartilhar(id: number, idsUsuarios: number[]) {
    return apiFetch<CronogramaSemanalItem>(`${BASE_PATH}/${id}/compartilhamento`, { method: 'PUT', body: JSON.stringify({ idsUsuarios }) });
  },
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
        dtFimAgendamento: item.flFixo ? undefined : paraDataHoraBackend(item.dtFimAgendamento),
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
        dtFimAgendamento: item.flFixo ? undefined : paraDataHoraBackend(item.dtFimAgendamento),
      }),
    });
  },
  listarExcecoes() {
    return apiFetch<CronogramaSemanalExcecao[]>(`${BASE_PATH}/excecoes`);
  },
  incluirExcecao(id: number, data: string) {
    return apiFetch<void>(`${BASE_PATH}/${id}/excecoes/${data}`, { method: 'PUT' });
  },
  removerExcecao(id: number, data: string) {
    return apiFetch<void>(`${BASE_PATH}/${id}/excecoes/${data}`, { method: 'DELETE' });
  },
  excluir(id: number) {
    return apiFetch<void>(`${BASE_PATH}/${id}`, { method: 'DELETE' });
  },
  /** Move na esteira (só o status): vale para quem enxerga o item, não só o dono. */
  mudarStatus(id: number, status: Status) {
    return apiFetch<CronogramaSemanalItem>(`${BASE_PATH}/${id}/status`, { method: 'PUT', body: JSON.stringify({ nmStatusCronograma: status }) });
  },
  /** A Lugia lê o pedido em texto livre e devolve as demandas montadas (não salva). */
  moverStatus(ids: number[], status: Status) {
    return Promise.all(ids.map(id => CronogramaSemanalService.mudarStatus(id, status)));
  },
  // ---------- equipes por obra ----------
  async equipes() {
    return (await apiFetch<CronogramaEquipe[]>(`${BASE_PATH}/equipes`)) ?? [];
  },
  async equipesDaObra() {
    return (await apiFetch<CronogramaEquipe[]>(`${BASE_PATH}/equipes/obra`)) ?? [];
  },
  salvarEquipe(form: CronogramaEquipeForm, id?: number) {
    return apiFetch<CronogramaEquipe>(id ? `${BASE_PATH}/equipes/${id}` : `${BASE_PATH}/equipes`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(form) });
  },
  excluirEquipe(id: number) {
    return apiFetch<void>(`${BASE_PATH}/equipes/${id}`, { method: 'DELETE' });
  },
  async pelaHierarquia(idLider: number) {
    return (await apiFetch<number[]>(`${BASE_PATH}/equipes/hierarquia/${idLider}`)) ?? [];
  },
};
