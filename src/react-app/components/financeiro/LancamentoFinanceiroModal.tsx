import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import type { FinanceiroCategoria, FinanceiroLancamento, FinanceiroPessoa } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { LancamentoFinanceiroForm } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import { dataBrParaIso, formatarMoeda } from "@/react-app/utils/casamento";
import {
  MAX_PARCELAS, categoriasParaLancamento, competenciaDaData, resumoParcelamento, rotuloParcela,
} from "@/react-app/utils/financeiro";

interface LancamentoFinanceiroModalProps {
  /** Presente = edição deste lançamento. */
  lancamento?: FinanceiroLancamento;
  /** Presente (sem `lancamento`) = novo lançamento já preenchido a partir de outro (duplicar). */
  modelo?: FinanceiroLancamento;
  pessoas: FinanceiroPessoa[];
  categorias: FinanceiroCategoria[];
  /** Pessoa pré-selecionada num lançamento novo (a do filtro da tela ou a última usada). */
  idPessoaPadrao?: number | null;
  /** Categoria pré-selecionada num lançamento novo. */
  categoriaPadrao?: number | null;
  /** Devolve a mensagem de erro (o modal continua aberto) ou null se salvou. */
  onSalvar: (form: LancamentoFinanceiroForm) => Promise<string | null>;
  onGerenciarCadastros: () => void;
  onFechar: () => void;
}

export default function LancamentoFinanceiroModal({
  lancamento, modelo, pessoas, categorias, idPessoaPadrao, categoriaPadrao, onSalvar, onGerenciarCadastros, onFechar,
}: LancamentoFinanceiroModalProps) {
  const origem = lancamento ?? modelo;
  // Um UUID por abertura: se o envio for repetido (duplo clique, rede), o servidor não duplica.
  const [cdRequisicao] = useState(() => crypto.randomUUID());
  const [data, setData] = useState(lancamento ? dataBrParaIso(lancamento.dtLancamento) ?? hojeSaoPaulo() : hojeSaoPaulo());
  const [competencia, setCompetencia] = useState(lancamento?.competencia ?? "");
  const [valor, setValor] = useState(origem ? String(origem.vlLancamento).replace(".", ",") : "");
  const [idCategoria, setIdCategoria] = useState<number | "">(origem?.idCategoria ?? categoriaPadrao ?? "");
  const [idPessoa, setIdPessoa] = useState<number | "">(origem?.idPessoa ?? idPessoaPadrao ?? "");
  const [descricao, setDescricao] = useState(origem?.dsLancamento ?? "");
  const [realizado, setRealizado] = useState(lancamento?.inRealizado ?? false);
  const [parcelas, setParcelas] = useState("1");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Sem escolha manual, a competência acompanha o mês da data.
  const competenciaEfetiva = competencia || competenciaDaData(data);
  const opcoesCategoria = useMemo(() => categoriasParaLancamento(categorias, lancamento?.idCategoria), [categorias, lancamento]);
  const entradas = opcoesCategoria.filter(c => c.cdTipo === "ENTRADA");
  const saidas = opcoesCategoria.filter(c => c.cdTipo === "SAIDA");
  const opcoesPessoa = pessoas.filter(p => p.inAtivo || p.idPessoa === lancamento?.idPessoa);
  const numeroParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(Number(parcelas)) || 1));
  const numero = lerValor(valor);
  const aviso = numero !== null ? resumoParcelamento(competenciaEfetiva, numeroParcelas, numero, formatarMoeda) : "";

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data.");
    if (numero === null) return setErro("Informe um valor maior que zero.");
    if (idCategoria === "") return setErro("Escolha a categoria.");
    if (idPessoa === "") return setErro("Escolha de quem é o lançamento.");
    if (!lancamento && (Number(parcelas) < 1 || Number(parcelas) > MAX_PARCELAS)) return setErro(`O número de parcelas deve ser de 1 a ${MAX_PARCELAS}.`);
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({
      cdRequisicao: lancamento ? undefined : cdRequisicao,
      dtLancamento: data,
      dtCompetencia: competencia ? `${competencia}-01` : undefined,
      idCategoria,
      idPessoa,
      dsLancamento: descricao.trim() || undefined,
      vlLancamento: numero,
      inRealizado: realizado && (lancamento !== undefined || numeroParcelas === 1),
      qtParcelas: lancamento ? undefined : numeroParcelas,
      nrVersao: lancamento?.nrVersao,
    });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo={lancamento ? "Editar lançamento" : modelo ? "Duplicar lançamento" : "Novo lançamento"} onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {lancamento && rotuloParcela(lancamento) && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Parcela {rotuloParcela(lancamento)}: a edição vale só para este lançamento.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} />
          </Campo>
          <Campo rotulo="Valor (R$)" dica={!lancamento && numeroParcelas > 1 ? "Valor de cada parcela" : undefined}>
            <input autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={classeInput} />
          </Campo>
        </div>
        <Campo rotulo="Categoria">
          <select value={idCategoria} onChange={e => setIdCategoria(e.target.value === "" ? "" : Number(e.target.value))} className={classeInput}>
            <option value="">Selecione…</option>
            {entradas.length > 0 && (
              <optgroup label="Entradas">
                {entradas.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nmCategoria}{c.inAtivo ? "" : " (inativa)"}</option>)}
              </optgroup>
            )}
            {saidas.length > 0 && (
              <optgroup label="Saídas">
                {saidas.map(c => <option key={c.idCategoria} value={c.idCategoria}>{c.nmCategoria}{c.inAtivo ? "" : " (inativa)"}</option>)}
              </optgroup>
            )}
          </select>
        </Campo>
        <Campo rotulo="De quem é">
          <select value={idPessoa} onChange={e => setIdPessoa(e.target.value === "" ? "" : Number(e.target.value))} className={classeInput}>
            <option value="">Selecione…</option>
            {opcoesPessoa.map(p => <option key={p.idPessoa} value={p.idPessoa}>{p.nmPessoa}{p.inAtivo ? "" : " (inativa)"}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Descrição (opcional)">
          <textarea rows={2} maxLength={500} value={descricao} onChange={e => setDescricao(e.target.value)} className={classeInput} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Mês de competência" dica="Muda só se o lançamento pertence a outro mês que não o da data.">
            <input type="month" value={competenciaEfetiva} onChange={e => setCompetencia(e.target.value === competenciaDaData(data) ? "" : e.target.value)} className={classeInput} />
          </Campo>
          {!lancamento && (
            <Campo rotulo="Parcelas" dica={aviso || "1 = lançamento único"}>
              <input type="number" min={1} max={MAX_PARCELAS} inputMode="numeric" value={parcelas} onChange={e => setParcelas(e.target.value)} className={classeInput} />
            </Campo>
          )}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={realizado && (lancamento !== undefined || numeroParcelas === 1)} disabled={!lancamento && numeroParcelas > 1}
            onChange={e => setRealizado(e.target.checked)} className="h-4 w-4 accent-green-600" />
          {!lancamento && numeroParcelas > 1 ? "Parcelas nascem como previstas; marque cada uma ao pagar" : "Já recebido/pago"}
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={onGerenciarCadastros} className="text-xs font-bold text-blue-600 hover:underline">Pessoas e categorias</button>
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </div>
        </div>
      </form>
    </ModalBase>
  );
}
