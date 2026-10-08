import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import type { FinanceiroAtivo, FinanceiroPessoa } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { OperacaoForm, ProventoForm } from "@/react-app/services/FinanceiroService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import { formatarMoeda } from "@/react-app/utils/casamento";
import { lerCotas, normalizarTicker } from "@/react-app/utils/investimentos";

/** Cada modal devolve a mensagem de erro (o modal continua aberto) ou null se salvou. */
type Salvar<T> = (form: T) => Promise<string | null>;

function Rodape({ salvando, onFechar }: { salvando: boolean; onFechar: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
      <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
      </button>
    </div>
  );
}

export function AtivoModal({ pessoas, idPessoaPadrao, onSalvar, onFechar }: {
  pessoas: FinanceiroPessoa[];
  idPessoaPadrao: number;
  onSalvar: Salvar<{ cdTicker: string; idPessoa: number; nmAtivo: string }>;
  onFechar: () => void;
}) {
  const opcoes = pessoas.filter(p => p.inAtivo && !p.inCompartilhado);
  const [ticker, setTicker] = useState("");
  const [idPessoa, setIdPessoa] = useState<number | "">(idPessoaPadrao || opcoes[0]?.idPessoa || "");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const codigo = normalizarTicker(ticker);
    if (!codigo) return setErro("Informe o código do fundo, como HGLG11.");
    if (idPessoa === "") return setErro("Escolha de quem é o fundo.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({ cdTicker: codigo, idPessoa, nmAtivo: nome.trim() });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo="Novo fundo" onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Código do fundo" dica="Ex.: HGLG11, XPML11, KNRI11">
          <input autoFocus value={ticker} onChange={e => setTicker(e.target.value)} maxLength={12} className={`${classeInput} uppercase`} />
        </Campo>
        <Campo rotulo="De quem é">
          <select value={idPessoa} onChange={e => setIdPessoa(e.target.value === "" ? "" : Number(e.target.value))} className={classeInput}>
            <option value="">Selecione…</option>
            {opcoes.map(p => <option key={p.idPessoa} value={p.idPessoa}>{p.nmPessoa}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Nome (opcional)">
          <input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} className={classeInput} />
        </Campo>
        <Rodape salvando={salvando} onFechar={onFechar} />
      </form>
    </ModalBase>
  );
}

export function OperacaoModal({ ativo, onSalvar, onFechar }: { ativo: FinanceiroAtivo; onSalvar: Salvar<OperacaoForm>; onFechar: () => void }) {
  // Um UUID por abertura: reenviar (duplo clique, rede) não duplica a operação.
  const [cdRequisicao] = useState(() => crypto.randomUUID());
  const [tipo, setTipo] = useState<"COMPRA" | "VENDA">("COMPRA");
  const [data, setData] = useState(hojeSaoPaulo());
  const [cotas, setCotas] = useState("");
  const [preco, setPreco] = useState(ativo.vlCotacao ? String(ativo.vlCotacao).replace(".", ",") : "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const qt = lerCotas(cotas);
  const valor = lerValor(preco);
  const total = qt !== null && valor !== null ? qt * valor : null;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data.");
    if (qt === null) return setErro("A quantidade de cotas deve ser um número inteiro maior que zero.");
    if (tipo === "VENDA" && qt > ativo.qtCotas) return setErro(`Você tem ${ativo.qtCotas} cota(s) de ${ativo.cdTicker}.`);
    if (valor === null) return setErro("Informe o preço por cota.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({ cdRequisicao, dtOperacao: data, cdTipo: tipo, qtCotas: qt, vlPreco: valor });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo={`Compra ou venda · ${ativo.cdTicker}`} onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div role="group" aria-label="Tipo da operação" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["COMPRA", "VENDA"] as const).map(t => (
            <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tipo === t ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}>
              {t === "COMPRA" ? "Compra" : "Venda"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} /></Campo>
          <Campo rotulo="Cotas"><input autoFocus inputMode="numeric" value={cotas} onChange={e => setCotas(e.target.value)} className={classeInput} /></Campo>
        </div>
        <Campo rotulo="Preço por cota (R$)" dica={total !== null ? `Total: ${formatarMoeda(total)}` : undefined}>
          <input inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" className={classeInput} />
        </Campo>
        <Rodape salvando={salvando} onFechar={onFechar} />
      </form>
    </ModalBase>
  );
}

export function ProventoModal({ ativo, onSalvar, onFechar }: { ativo: FinanceiroAtivo; onSalvar: Salvar<ProventoForm>; onFechar: () => void }) {
  const [dtCom, setDtCom] = useState(hojeSaoPaulo());
  const [dtPagamento, setDtPagamento] = useState(hojeSaoPaulo());
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const numero = lerValor(valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dtCom) || !/^\d{4}-\d{2}-\d{2}$/.test(dtPagamento)) return setErro("Informe as duas datas.");
    if (dtPagamento < dtCom) return setErro("O pagamento não pode ser antes da data-com.");
    if (numero === null) return setErro("Informe o valor por cota.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({ dtCom, dtPagamento, vlPorCota: numero });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo={`Provento · ${ativo.cdTicker}`} onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data-com" dica="Quem tem cotas ao fim desse dia recebe">
            <input type="date" value={dtCom} onChange={e => setDtCom(e.target.value)} className={classeInput} />
          </Campo>
          <Campo rotulo="Pagamento"><input type="date" value={dtPagamento} onChange={e => setDtPagamento(e.target.value)} className={classeInput} /></Campo>
        </div>
        <Campo rotulo="Valor por cota (R$)" dica="Se já houver provento nessa data-com, ele é corrigido.">
          <input autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={classeInput} />
        </Campo>
        <Rodape salvando={salvando} onFechar={onFechar} />
      </form>
    </ModalBase>
  );
}
