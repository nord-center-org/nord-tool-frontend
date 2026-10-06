import { useState, type FormEvent } from "react";
import { Loader2, Settings2 } from "lucide-react";

import type { CaixinhaLancamento, CaixinhaResponsavel } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { LancamentoForm } from "@/react-app/services/CaixinhaService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import { dataBrParaIso } from "@/react-app/utils/casamento";

interface LancamentoModalProps {
  /** Ausente = novo lançamento. */
  lancamento?: CaixinhaLancamento;
  responsaveis: CaixinhaResponsavel[];
  /** Devolve a mensagem de erro (o modal continua aberto, ex.: conflito 409) ou null se salvou. */
  onSalvar: (form: LancamentoForm) => Promise<string | null>;
  onGerenciarResponsaveis: () => void;
  onFechar: () => void;
}

export default function LancamentoModal({ lancamento, responsaveis, onSalvar, onGerenciarResponsaveis, onFechar }: LancamentoModalProps) {
  // Um UUID por abertura de "Novo": se o envio for repetido (duplo clique, rede), o servidor não duplica.
  const [cdRequisicao] = useState(() => crypto.randomUUID());
  const [data, setData] = useState(dataBrParaIso(lancamento?.dtLancamento) ?? hojeSaoPaulo());
  const [valor, setValor] = useState(lancamento ? String(lancamento.vlValor).replace(".", ",") : "");
  const [idResponsavel, setIdResponsavel] = useState<number | "">(lancamento?.idResponsavel ?? "");
  const [insumo, setInsumo] = useState(lancamento?.txInsumo ?? "");
  const [lancado, setLancado] = useState(lancamento?.inLancado ?? false);
  const [pago, setPago] = useState(lancamento?.inPago ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ativos + o responsável atual do lançamento (mesmo que já esteja inativo).
  const opcoes = responsaveis.filter(r => r.inAtivo || r.idResponsavel === lancamento?.idResponsavel);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const numero = lerValor(valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data.");
    if (numero === null) return setErro("Informe um valor maior que zero.");
    if (idResponsavel === "") return setErro("Escolha o responsável.");
    if (!insumo.trim()) return setErro("Informe o insumo.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({
      cdRequisicao: lancamento ? undefined : cdRequisicao,
      dtLancamento: data,
      idResponsavel,
      txInsumo: insumo.trim(),
      vlValor: numero,
      inLancado: lancado,
      inPago: pago,
      nrVersao: lancamento?.nrVersao,
    });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo={lancamento ? "Editar lançamento" : "Novo lançamento"} onFechar={onFechar}>
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} />
          </Campo>
          <Campo rotulo="Valor (R$)">
            <input autoFocus inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={classeInput} />
          </Campo>
        </div>
        <Campo rotulo="Responsável">
          <div className="flex gap-2">
            <select value={idResponsavel} onChange={e => setIdResponsavel(e.target.value === "" ? "" : Number(e.target.value))} className={classeInput}>
              <option value="">Selecione…</option>
              {opcoes.map(r => <option key={r.idResponsavel} value={r.idResponsavel}>{r.nmResponsavel}{r.inAtivo ? "" : " (inativo)"}</option>)}
            </select>
            <button type="button" onClick={onGerenciarResponsaveis} title="Gerenciar responsáveis" aria-label="Gerenciar responsáveis"
              className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 hover:bg-slate-50"><Settings2 className="h-4 w-4" /></button>
          </div>
        </Campo>
        <Campo rotulo="Insumo / descrição">
          <textarea rows={3} maxLength={500} value={insumo} onChange={e => setInsumo(e.target.value)} className={classeInput} />
        </Campo>
        <div className="flex gap-6 text-sm text-slate-600">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={lancado} onChange={e => setLancado(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Lançado</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Pago</label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
