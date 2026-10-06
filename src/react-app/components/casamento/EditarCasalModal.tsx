import { useState, type FormEvent } from "react";

import type { CasamentoConfig } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";

interface EditarCasalModalProps {
  atual: CasamentoConfig;
  onSalvar: (casal: string, dataCasamento: string) => void;
  onFechar: () => void;
}

/** Edita o nome do casal e a data do casamento (a contagem regressiva muda na hora). */
export default function EditarCasalModal({ atual, onSalvar, onFechar }: EditarCasalModalProps) {
  const [casal, setCasal] = useState(atual.casal ?? "");
  const [data, setData] = useState(atual.dataCasamento ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!casal.trim()) return setErro("Informe o nome do casal.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data do casamento.");
    onSalvar(casal.trim(), data);
    onFechar();
  };

  return (
    <ModalBase titulo="Casal e data do casamento" onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Casal">
          <input autoFocus maxLength={200} value={casal} onChange={e => setCasal(e.target.value)} placeholder="Ex.: Ana & Beto" className={classeInput} />
        </Campo>
        <Campo rotulo="Data do casamento" dica="A contagem regressiva considera meio-dia, horário de Brasília.">
          <input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} />
        </Campo>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar</button>
        </div>
      </form>
    </ModalBase>
  );
}
