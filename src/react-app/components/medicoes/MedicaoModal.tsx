import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import type { Medicao, MedicaoStatus } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import BotaoCopiar from "@/react-app/components/medicoes/BotaoCopiar";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { MedicaoForm } from "@/react-app/services/MedicaoService";
import { hojeSaoPaulo, lerValor } from "@/react-app/utils/caixinha";
import {
  STATUS_PENDENTE, acharContrato, analisarMemorial, contratosConhecidos, moedaSienge, observacaoSienge, tituloBoletim,
} from "@/react-app/utils/medicoes";

interface MedicaoModalProps {
  /** Ausente = nova medição. */
  medicao?: Medicao;
  /** Medições já cadastradas: alimentam o preenchimento automático por contrato. */
  medicoes: Medicao[];
  status: MedicaoStatus[];
  /** Devolve a mensagem de erro (o modal continua aberto) ou null se salvou. */
  onSalvar: (form: MedicaoForm) => Promise<string | null>;
  onFechar: () => void;
}

export default function MedicaoModal({ medicao, medicoes, status, onSalvar, onFechar }: MedicaoModalProps) {
  const [nrContrato, setNrContrato] = useState(medicao?.nrContrato ?? "");
  const [nrMedicao, setNrMedicao] = useState(medicao ? String(medicao.nrMedicao) : "");
  const [cdContrato, setCdContrato] = useState(medicao?.cdContrato ?? "");
  const [razao, setRazao] = useState(medicao?.nmRazaoSocial ?? "");
  const [data, setData] = useState(medicao?.dtMedicao ?? hojeSaoPaulo());
  const [valor, setValor] = useState(medicao ? String(medicao.vlMedicao).replace(".", ",") : "");
  const [memorial, setMemorial] = useState(medicao?.txMemorial ?? "");
  const [cdStatus, setCdStatus] = useState(medicao?.cdStatus ?? STATUS_PENDENTE);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const contratos = useMemo(() => contratosConhecidos(medicoes), [medicoes]);
  // Ativos + o status atual da medição (mesmo que já esteja inativo).
  const opcoes = status.filter(s => s.inAtivo || s.cdStatus === medicao?.cdStatus);

  /** Ao digitar um contrato já conhecido, completa o que ainda estiver vazio (só em nova medição). */
  const aoMudarContrato = (texto: string) => {
    setNrContrato(texto);
    if (medicao) return;
    const conhecido = acharContrato(contratos, texto);
    if (!conhecido) return;
    if (!cdContrato.trim()) setCdContrato(conhecido.cdContrato);
    if (!razao.trim()) setRazao(conhecido.nmRazaoSocial);
    if (!nrMedicao.trim()) setNrMedicao(String(conhecido.proximaMedicao));
  };

  const numero = /^\d+$/.test(nrMedicao.trim()) ? Number(nrMedicao.trim()) : null;
  const valorLido = lerValor(valor);
  const analise = useMemo(() => analisarMemorial(memorial), [memorial]);
  // O valor que o memorial indica: o informado depois do "=" ou, sem ele, o resultado da conta.
  const valorDoMemorial = analise.informado ?? analise.conta;
  const diferenteDoValor = valorDoMemorial !== null && valorDoMemorial !== valorLido;
  const contaDivergente = analise.conta !== null && analise.informado !== null && Math.abs(analise.conta - analise.informado) > 0.01;
  const previa = {
    nrMedicao: numero ?? 0, cdContrato: cdContrato.trim(), nmRazaoSocial: razao.trim(), nrContrato: nrContrato.trim(),
    vlMedicao: valorLido ?? 0, txMemorial: memorial,
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!nrContrato.trim()) return setErro("Informe o número do contrato.");
    if (numero === null || numero < 1) return setErro("Informe o número da medição (inteiro maior que zero).");
    if (!cdContrato.trim()) return setErro("Informe o código do contrato.");
    if (!razao.trim()) return setErro("Informe a razão social.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data da medição.");
    if (valorLido === null) return setErro("Informe um valor maior que zero.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onSalvar({
      nrMedicao: numero,
      cdContrato: cdContrato.trim(),
      nmRazaoSocial: razao.trim(),
      nrContrato: nrContrato.trim(),
      dtMedicao: data,
      vlMedicao: valorLido,
      txMemorial: memorial.trim(),
      cdStatus,
      nrVersao: medicao?.nrVersao,
    });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo={medicao ? "Editar medição" : "Nova medição"} onFechar={onFechar} largura="max-w-xl">
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Nº do contrato">
            <input autoFocus list="medicao-contratos" value={nrContrato} onChange={e => aoMudarContrato(e.target.value)} placeholder="CT/4916-209" maxLength={40} className={classeInput} />
            <datalist id="medicao-contratos">
              {contratos.map(c => <option key={c.nrContrato} value={c.nrContrato}>{c.nmRazaoSocial}</option>)}
            </datalist>
          </Campo>
          <Campo rotulo="Nº da medição">
            <input inputMode="numeric" value={nrMedicao} onChange={e => setNrMedicao(e.target.value)} placeholder="11" className={classeInput} />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Código do contrato">
            <input value={cdContrato} onChange={e => setCdContrato(e.target.value)} placeholder="34515" maxLength={20} className={classeInput} />
          </Campo>
          <div className="col-span-2">
            <Campo rotulo="Razão social">
              <input value={razao} onChange={e => setRazao(e.target.value)} placeholder="CLEAN XPRESS LTDA" maxLength={150} className={classeInput} />
            </Campo>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} />
          </Campo>
          <Campo rotulo="Valor (R$)">
            <input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" className={classeInput} />
          </Campo>
          <Campo rotulo="Status">
            <select value={cdStatus} onChange={e => setCdStatus(e.target.value)} className={classeInput}>
              {opcoes.map(s => <option key={s.cdStatus} value={s.cdStatus}>{s.nmStatus}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Memorial de cálculo" dica="Continua o texto depois do valor. Ex.: referente a 73 apartamentos recebidos (73*500=36.500)">
          <textarea rows={3} maxLength={1000} value={memorial} onChange={e => setMemorial(e.target.value)} className={classeInput} />
        </Campo>
        {valorDoMemorial !== null && (diferenteDoValor || contaDivergente) && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span>
              {contaDivergente
                ? `A conta do memorial dá ${moedaSienge(analise.conta ?? 0)}, mas o texto diz ${moedaSienge(analise.informado ?? 0)}.`
                : `O memorial indica ${moedaSienge(valorDoMemorial)}.`}
            </span>
            {diferenteDoValor && (
              <button type="button" onClick={() => setValor(String(valorDoMemorial).replace(".", ","))} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-bold hover:bg-amber-100">
                Usar {moedaSienge(valorDoMemorial)} como valor
              </button>
            )}
          </div>
        )}

        <section aria-label="Prévia" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Boletim</p>
            <p className="font-semibold text-slate-700">{tituloBoletim(previa)}</p>
            <div className="mt-1.5"><BotaoCopiar texto={tituloBoletim(previa)} rotulo="Copiar boletim" /></div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Observação (Sienge)</p>
            <p>{observacaoSienge(previa)}</p>
            <div className="mt-1.5"><BotaoCopiar texto={observacaoSienge(previa)} rotulo="Copiar observação" /></div>
          </div>
        </section>

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
