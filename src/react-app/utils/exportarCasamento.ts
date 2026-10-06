/** Montagem das abas do "Exportar tudo" do Casamento (função pura, testável em node). */
import { ROTULO_STATUS_CONVIDADO, type ChaveStatusConvidado } from "./convidados.ts";

type Linha = Record<string, string | number>;

export interface AbaExportacao {
  nome: string;
  linhas: Linha[];
}

interface DadosCasamento {
  configuracao: { casal: string | null; dataCasamento: string | null };
  fornecedores: {
    nmFornecedor: string; nmCategoria: string; nmStatus: string; vlValor: number;
    txContato: string | null; txObservacao: string | null; qtAnexos: number;
  }[];
  convidados: {
    nmConvidado: string; nmGrupo: string | null; nrTelefone: string | null; nmRelacao: string | null;
    nmStatus: string; nrAcompanhantes: number; nmMesa: string | null;
  }[];
  marcos: { nmTitulo: string; dtPrazo: string | null; inConcluido: boolean; txObservacao: string | null }[];
}

const ROTULO_FORNECEDOR: Record<string, string> = { PESQUISANDO: "Pesquisando", ORCAMENTO: "Orçamento", CONTRATADO: "Contratado" };

export function abasExportacao(dados: DadosCasamento): AbaExportacao[] {
  return [
    {
      nome: "Configuração",
      linhas: [{ Casal: dados.configuracao.casal ?? "", "Data do casamento": dados.configuracao.dataCasamento ?? "" }],
    },
    {
      nome: "Fornecedores",
      linhas: dados.fornecedores.map(f => ({
        Fornecedor: f.nmFornecedor,
        Categoria: f.nmCategoria,
        Status: ROTULO_FORNECEDOR[f.nmStatus] ?? f.nmStatus,
        Valor: f.vlValor,
        Contato: f.txContato ?? "",
        "Observações": f.txObservacao ?? "",
        Anexos: f.qtAnexos,
      })),
    },
    {
      nome: "Convidados",
      linhas: dados.convidados.map(c => ({
        Nome: c.nmConvidado,
        Grupo: c.nmGrupo ?? "",
        Telefone: c.nrTelefone ?? "",
        "Relação": c.nmRelacao ?? "",
        Status: ROTULO_STATUS_CONVIDADO[c.nmStatus as ChaveStatusConvidado] ?? c.nmStatus,
        Acompanhantes: c.nrAcompanhantes,
        Mesa: c.nmMesa ?? "",
      })),
    },
    {
      nome: "Marcos",
      linhas: dados.marcos.map(m => ({
        "Título": m.nmTitulo,
        Prazo: m.dtPrazo ?? "",
        "Concluído": m.inConcluido ? "Sim" : "Não",
        "Observações": m.txObservacao ?? "",
      })),
    },
  ];
}
