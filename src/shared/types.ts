export interface DashboardStats {
  total: number;
  total_cadastrados: number;
  agendados: number;
  liberados: number;
  aprovados: number;
  reprovados: number;
  pendentes: number;
  nao_liberados: number;
}

export interface Configuracao {
  id: number;
  chave: string;
  valor: string;
  created_at: string;
  updated_at: string;
}

export interface ApartamentoVistoriaDto {
  idApartamentoVistoria: number;
  nmApartamentoVistoria: string;
  idDiaSemana?: number;
  nmDiaSemana?: string;
  
  // Nick, adicionei o dtVistoria aqui, que é o campo real do seu banco!
  dtVistoria?: string; 
  
  dtApartamentoVigente?: string;
  nmHorarioVistoria?: string;
  idStatusVistoria?: number;
  nmStatusVistoria?: string;
  inMarcarRevistoria?: boolean;
  txObservacaoRevistoria?: string;
  dtRevistoriaVigente?: string;

  // Último termo de reprova (agregado pelo backend; ausente em respostas antigas)
  inTermoAnexado?: boolean;
  qtTermos?: number;
  nrUltimoTermo?: number | null;
  /** PENDENTE | EM_ANDAMENTO | CONCLUIDO */
  nmSituacaoTermo?: string | null;
  qtFotosTermo?: number;
  nrPaginasTermo?: number | null;
  nrPaginasComFoto?: number;
}

export interface ApartamentoVistoriaForm {
  idApartamentoVistoria?: number;
  nmApartamentoVistoria: string;
  idDiaSemana: number;
  
  // Incluindo aqui também para o formulário se necessário
  dtVistoria?: string; 
  
  dtApartamentoVigente?: string;
  nmHorarioVistoria?: string;
  idStatusVistoria: number;
  inMarcarRevistoria?: boolean;
  txObservacaoRevistoria?: string;
  dtRevistoriaVigente?: string;
}

export interface DiaSemanaDto {
  idDiaSemana: number;
  nmDiaSemana: string;
}

export interface StatusVistoriaDto {
  idStatusVistoria: number;
  nmStatusVistoria: string;
}

export type SituacaoTermo = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO';

export interface TermoFotoDto {
  idTermoFoto: number;
  idTermoReprova: number;
  nrPagina: number;
  nrOrdem: number;
  txLegenda: string | null;
  /** dd/MM/yyyy HH:mm:ss */
  dhAlteracao: string;
  /** Epoch millis; usar em ?v= para invalidar cache da imagem. */
  nrVersao: number;
}

export interface TermoReprovaResumo {
  idTermoReprova: number;
  nrTermo: number;
  nmArquivo: string;
  nmSituacao: SituacaoTermo;
  nrPaginas: number;
  qtFotos: number;
  dhAlteracao: string;
  nrVersao: number;
}

export interface TermoReprovaDto {
  idTermoReprova: number;
  idApartamentoVistoria: number;
  nrTermo: number;
  nmArquivo: string;
  nrPaginas: number;
  nmSituacao: SituacaoTermo;
  txObservacao: string | null;
  dhCriacao: string;
  dhAlteracao: string;
  nrVersao: number;
  fotos: TermoFotoDto[];
  /** Avisos da operação (ex.: fotos removidas ao trocar o PDF). */
  avisos: string[];
}

export interface OrdemFoto {
  idTermoFoto: number;
  nrOrdem: number;
}

// ---------- Casamento ----------

export type StatusFornecedor = 'PESQUISANDO' | 'ORCAMENTO' | 'CONTRATADO';
export type StatusConvidado = 'NAO_CONVIDADO' | 'CONVIDADO' | 'CONFIRMADO' | 'NAO_IRA';

export interface CasamentoConfig {
  casal: string | null;
  /** yyyy-MM-dd */
  dataCasamento: string | null;
}

export interface CasamentoFornecedor {
  idFornecedor: number;
  nmFornecedor: string;
  nmCategoria: string;
  txContato: string | null;
  nmStatus: StatusFornecedor;
  vlValor: number;
  txObservacao: string | null;
  qtAnexos: number;
}

export interface CasamentoAnexo {
  idAnexo: number;
  idFornecedor: number;
  nmArquivo: string;
  nmContentType: string;
  nrTamanhoBytes: number;
  txDescricao: string | null;
  nrVersao: number;
}

export interface CasamentoConvidado {
  idConvidado: number;
  nmConvidado: string;
  nmGrupo: string | null;
  nrTelefone: string | null;
  nmRelacao: string | null;
  nmStatus: StatusConvidado;
  nrAcompanhantes: number;
  nmMesa: string | null;
}

export interface CasamentoMarco {
  idMarco: number;
  nmTitulo: string;
  /** dd/MM/yyyy */
  dtPrazo: string | null;
  inConcluido: boolean;
  txObservacao: string | null;
}

export interface CasamentoDashboard {
  configuracao: CasamentoConfig;
  qtFornecedores: number;
  qtFornecedoresContratados: number;
  vlContratado: number;
  qtConvidados: number;
  qtConvidadosConfirmados: number;
  qtPessoasConfirmadas: number;
  qtMarcos: number;
  qtMarcosConcluidos: number;
  pcMarcosConcluidos: number;
  proximosMarcos: CasamentoMarco[];
}

export interface ImportacaoConvidados {
  importados: number;
  rejeitados: { linha: number; motivo: string }[];
}
