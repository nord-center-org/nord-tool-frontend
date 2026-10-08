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

// ---------- Caixinha ----------

export type SituacaoCaixinha = 'TODOS' | 'A_PAGAR' | 'PAGO' | 'NAO_LANCADO';

export interface CaixinhaResponsavel {
  idResponsavel: number;
  nmResponsavel: string;
  inAtivo: boolean;
}

export interface CaixinhaLancamento {
  idLancamento: number;
  /** dd/MM/yyyy */
  dtLancamento: string;
  idResponsavel: number;
  nmResponsavel: string;
  txInsumo: string;
  vlValor: number;
  inLancado: boolean;
  inPago: boolean;
  /** Revisão para controle de concorrência. */
  nrVersao: number;
  qtComprovantes: number;
}

export interface CaixinhaLista {
  lancamentos: CaixinhaLancamento[];
  responsaveis: CaixinhaResponsavel[];
}

export interface CaixinhaResumo {
  total: number;
  pago: number;
  aPagar: number;
  qtLancamentos: number;
  qtPagos: number;
  qtPendentes: number;
}

export interface CaixinhaComprovante {
  idComprovante: number;
  idLancamento: number;
  nmArquivo: string;
  nmContentType: string;
  nrTamanhoBytes: number;
  nrVersao: number;
}

// ---------- Financeiro ----------

export type TipoFluxo = 'ENTRADA' | 'SAIDA';
export type TipoProjecao = 'FIXA_MEDIA' | 'SALDO_ANTERIOR' | 'FIXA_VALOR' | 'RITMO_FATURA' | 'VARIAVEL_MEDIA' | 'MANUAL';
export type RegraData = 'DIA_MES' | 'DIA_UTIL';
export type SituacaoFinanceiro = 'TODOS' | 'REALIZADO' | 'PREVISTO';

/** De quem é o lançamento (Nick, Thaina, Casal). Diferente do autor, que é o login. */
export interface FinanceiroPessoa {
  idPessoa: number;
  nmPessoa: string;
  inCompartilhado: boolean;
  idUsuario: number | null;
  nrOrdem: number;
  inAtivo: boolean;
}

export interface FinanceiroCategoria {
  idCategoria: number;
  nmCategoria: string;
  cdTipo: TipoFluxo;
  cdProjecao: TipoProjecao;
  inFixa: boolean;
  cdRegraData: RegraData | null;
  nrDia: number | null;
  nrOrdem: number;
  inAtivo: boolean;
}

export interface FinanceiroLancamento {
  idLancamento: number;
  /** Mês a que pertence, yyyy-MM. */
  competencia: string;
  /** dd/MM/yyyy */
  dtLancamento: string;
  idCategoria: number;
  nmCategoria: string;
  cdTipo: TipoFluxo;
  idPessoa: number;
  nmPessoa: string;
  dsLancamento: string | null;
  /** Sempre positivo: entrada ou saída vem da categoria. */
  vlLancamento: number;
  inRealizado: boolean;
  nrParcela: number | null;
  qtParcela: number | null;
  /** Quem digitou o lançamento (o login). */
  idUsuarioCriacao: number | null;
  nmUsuarioCriacao: string | null;
  /** Revisão para controle de concorrência. */
  nrVersao: number;
}

export interface FinanceiroResumo {
  entradas: number;
  saidas: number;
  saldo: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  qtLancamentos: number;
  qtRealizados: number;
}

export interface FinanceiroLista {
  lancamentos: FinanceiroLancamento[];
  resumo: FinanceiroResumo | null;
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
}

// ---------- Financeiro: a conta do mês ----------

export type OrigemValor = 'REAL' | 'MEDIA' | 'RECORRENCIA' | 'RITMO' | 'SEM_DADOS';
export type SituacaoMes = 'VERDE' | 'VERMELHO';

/** Uma categoria na conta do mês: o que foi lançado e o que entra na conta (real ou estimado). */
export interface FinanceiroProjecaoLinha {
  idCategoria: number;
  nmCategoria: string;
  cdTipo: TipoFluxo;
  cdProjecao: TipoProjecao;
  real: number;
  projetado: number;
  origem: OrigemValor;
  /** Como o valor foi obtido (ex.: "Média dos últimos 3 mês(es) com lançamento"). */
  detalhe: string;
}

/** O "fechamento do mês" da planilha: entradas, saídas, saldo anterior e saldo final. */
export interface FinanceiroProjecaoMes {
  /** yyyy-MM */
  competencia: string;
  fechado: boolean;
  /** Há valores estimados (mês aberto, atual ou futuro). */
  estimado: boolean;
  /** Falso com filtro de pessoa: o saldo anterior e a meta são da conta toda. */
  comSaldoAnterior: boolean;
  saldoAnterior: number | null;
  entradas: FinanceiroProjecaoLinha[];
  saidas: FinanceiroProjecaoLinha[];
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  metaSaldo: number | null;
  /** Saldo final − meta: quanto sobra (ou falta) em relação à meta. */
  folga: number | null;
  situacao: SituacaoMes;
  /** Lançamentos do mês ainda não marcados como recebidos/pagos. */
  qtPrevistos: number;
}

export interface FinanceiroFechamento {
  mes: FinanceiroProjecaoMes;
  recorrenciasGeradas: number;
}

export interface FinanceiroConfiguracao {
  vlMetaSaldo: number;
  nrMesesMedia: number;
  nrDiaConferencia: number;
  nrDiaFechamentoFatura: number;
}

/** Lançamento fixo (apartamento, evolução de obra, investimentos...). */
export interface FinanceiroRecorrencia {
  idRecorrencia: number;
  idCategoria: number;
  nmCategoria: string;
  cdTipo: TipoFluxo;
  idPessoa: number;
  nmPessoa: string;
  dsRecorrencia: string | null;
  vlRecorrencia: number;
  /** Dia do mês do lançamento gerado (vazio = dia 1). */
  nrDia: number | null;
  /** dd/MM/yyyy */
  dtInicio: string;
  /** dd/MM/yyyy; vazio = sem fim */
  dtFim: string | null;
  inAtivo: boolean;
  nrVersao: number;
}

/** Valor parcial da fatura numa data (uma leitura por dia). */
export interface FinanceiroLeitura {
  /** dd/MM/yyyy */
  dtLeitura: string;
  vlLeitura: number;
}
