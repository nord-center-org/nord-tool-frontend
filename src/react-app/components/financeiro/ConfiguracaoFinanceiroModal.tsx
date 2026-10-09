import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import type { FinanceiroCategoria, FinanceiroConfiguracao, FinanceiroPessoa, FinanceiroRecorrencia } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { financeiroService } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import { dataBrParaIso, formatarMoeda } from "@/react-app/utils/casamento";
import { competenciaDaData } from "@/react-app/utils/financeiro";

interface Props {
  configuracao: FinanceiroConfiguracao;
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  onSalvo: (c: FinanceiroConfiguracao) => void;
  /** Mudou algo que afeta a conta do mês (fixos ou parâmetros). */
  onAlterado: () => void;
  onFechar: () => void;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

export default function ConfiguracaoFinanceiroModal({ configuracao, pessoas, categorias, onSalvo, onAlterado, onFechar }: Props) {
  const [aba, setAba] = useState<"parametros" | "fixos">("parametros");
  const [meta, setMeta] = useState(String(configuracao.vlMetaSaldo).replace(".", ","));
  const [meses, setMeses] = useState(String(configuracao.nrMesesMedia));
  const [conferencia, setConferencia] = useState(String(configuracao.nrDiaConferencia));
  const [fechamento, setFechamento] = useState(String(configuracao.nrDiaFechamentoFatura));
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [fixos, setFixos] = useState<FinanceiroRecorrencia[] | null>(null);
  const [nova, setNova] = useState({ idCategoria: "", idPessoa: "", valor: "", dia: "" });

  const carregarFixos = useCallback(async () => {
    try { setFixos(await financeiroService.recorrencias()); } catch (e) { setErro(mensagem(e, "Não foi possível carregar os lançamentos fixos.")); }
  }, []);
  useEffect(() => { void carregarFixos(); }, [carregarFixos]);

  const salvarParametros = async (e: FormEvent) => {
    e.preventDefault();
    const valorMeta = meta.trim() === "" ? 0 : lerValor(meta) ?? (meta.trim() === "0" ? 0 : null);
    if (valorMeta === null) return setErro("Informe a meta em reais.");
    setSalvando(true);
    setErro(null);
    try {
      const salvo = await financeiroService.atualizarConfiguracao({
        vlMetaSaldo: valorMeta,
        nrMesesMedia: Number(meses),
        nrDiaConferencia: Number(conferencia),
        nrDiaFechamentoFatura: Number(fechamento),
      });
      onSalvo(salvo);
      onAlterado();
      onFechar();
    } catch (err) {
      setErro(mensagem(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (r: FinanceiroRecorrencia) => {
    try {
      await financeiroService.atualizarRecorrencia(r.idRecorrencia, {
        idCategoria: r.idCategoria, idPessoa: r.idPessoa, dsRecorrencia: r.dsRecorrencia ?? undefined, vlRecorrencia: r.vlRecorrencia,
        nrDia: r.nrDia, dtInicio: dataBrParaIso(r.dtInicio) ?? r.dtInicio, dtFim: r.dtFim ? dataBrParaIso(r.dtFim) : null,
        inAtivo: !r.inAtivo, nrVersao: r.nrVersao,
      });
      await carregarFixos();
      onAlterado();
    } catch (err) {
      setErro(mensagem(err, "Não foi possível alterar o lançamento fixo."));
      void carregarFixos();
    }
  };

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    const valor = lerValor(nova.valor);
    if (!nova.idCategoria || !nova.idPessoa || valor === null) return setErro("Escolha categoria, pessoa e informe o valor.");
    try {
      await financeiroService.criarRecorrencia({
        idCategoria: Number(nova.idCategoria), idPessoa: Number(nova.idPessoa), vlRecorrencia: valor,
        nrDia: nova.dia ? Number(nova.dia) : null, dtInicio: `${competenciaDaData(hojeSaoPaulo())}-01`,
      });
      setNova({ idCategoria: "", idPessoa: "", valor: "", dia: "" });
      setErro(null);
      await carregarFixos();
      onAlterado();
    } catch (err) {
      setErro(mensagem(err, "Não foi possível criar o lançamento fixo."));
    }
  };

  const gerar = async () => {
    try {
      const r = await financeiroService.gerarRecorrencias(competenciaDaData(hojeSaoPaulo()));
      setAviso(r.criados === 0 ? "Os fixos do mês já estavam lançados." : `${r.criados} lançamento(s) fixo(s) criado(s) no mês.`);
      setErro(null);
      onAlterado();
    } catch (err) {
      setErro(mensagem(err, "Não foi possível gerar os fixos."));
    }
  };

  const botaoAba = (id: "parametros" | "fixos", rotulo: string) => (
    <button type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold ${aba === id ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>{rotulo}</button>
  );

  return (
    <ModalBase titulo="Ajustes do Financeiro" onFechar={onFechar} largura="max-w-xl">
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {botaoAba("parametros", "Parâmetros")}
        {botaoAba("fixos", "Lançamentos fixos")}
      </div>
      {erro && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {aviso && <p role="status" className="mb-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{aviso}</p>}

      {aba === "parametros" ? (
        <form onSubmit={e => void salvarParametros(e)} className="space-y-4">
          <Campo rotulo="Meta de saldo no fim do mês (R$)" dica="O mês fica no verde quando o saldo final chega a esse valor.">
            <input inputMode="decimal" value={meta} onChange={e => setMeta(e.target.value)} className={classeInput} />
          </Campo>
          <div className="grid grid-cols-3 gap-3">
            <Campo rotulo="Meses da média" dica="1 a 12">
              <input type="number" min={1} max={12} value={meses} onChange={e => setMeses(e.target.value)} className={classeInput} />
            </Campo>
            <Campo rotulo="Dia da conferência" dica="Lembrete de fechar o mês">
              <input type="number" min={1} max={28} value={conferencia} onChange={e => setConferencia(e.target.value)} className={classeInput} />
            </Campo>
            <Campo rotulo="Fecha a fatura no dia" dica="A fatura de setembro vai do dia seguinte em setembro até esse dia em outubro">
              <input type="number" min={1} max={28} value={fechamento} onChange={e => setFechamento(e.target.value)} className={classeInput} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Valores que se repetem todo mês (apartamento, obra, investimentos...). Ao fechar um mês, os do próximo são lançados como previstos.</p>
          {fixos === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-label="Carregando" /></div>
          ) : fixos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Nenhum lançamento fixo cadastrado.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {fixos.map(r => (
                <li key={r.idRecorrencia} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className={r.inAtivo ? "" : "text-slate-400 line-through"}>
                    <strong>{r.nmCategoria}</strong> · {r.nmPessoa}{r.nrDia ? ` · dia ${r.nrDia}` : ""}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{formatarMoeda(r.vlRecorrencia)}</span>
                    <button type="button" onClick={() => void alternar(r)} className="text-xs font-bold text-blue-600 hover:underline">{r.inAtivo ? "Desativar" : "Ativar"}</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={e => void adicionar(e)} className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
            <Campo rotulo="Categoria">
              <select value={nova.idCategoria} onChange={e => setNova({ ...nova, idCategoria: e.target.value })} className={classeInput}>
                <option value="">Selecione…</option>
                {categorias.filter(c => c.inAtivo).map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nmCategoria}</option>)}
              </select>
            </Campo>
            <Campo rotulo="De quem é">
              <select value={nova.idPessoa} onChange={e => setNova({ ...nova, idPessoa: e.target.value })} className={classeInput}>
                <option value="">Selecione…</option>
                {pessoas.filter(p => p.inAtivo).map(p => <option key={p.idPessoa} value={p.idPessoa}>{p.nmPessoa}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Valor (R$)"><input inputMode="decimal" value={nova.valor} onChange={e => setNova({ ...nova, valor: e.target.value })} className={classeInput} /></Campo>
            <Campo rotulo="Dia do mês" dica="Vazio = dia 1"><input type="number" min={1} max={28} value={nova.dia} onChange={e => setNova({ ...nova, dia: e.target.value })} className={classeInput} /></Campo>
            <div className="col-span-2 flex justify-between gap-2">
              <button type="button" onClick={() => void gerar()} className="text-xs font-bold text-blue-600 hover:underline">Gerar os fixos deste mês agora</button>
              <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Adicionar fixo</button>
            </div>
          </form>
        </div>
      )}
    </ModalBase>
  );
}
