import { useState, type FormEvent } from "react";

import type { CasamentoMarco } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { MarcoForm } from "@/react-app/services/CasamentoService";
import { dataBrParaIso } from "@/react-app/utils/casamento";

interface MarcoModalProps {
  /** Ausente = novo marco. */
  marco?: CasamentoMarco;
  onSalvar: (form: MarcoForm) => void;
  onFechar: () => void;
}

export default function MarcoModal({ marco, onSalvar, onFechar }: MarcoModalProps) {
  const [titulo, setTitulo] = useState(marco?.nmTitulo ?? "");
  const [prazo, setPrazo] = useState(dataBrParaIso(marco?.dtPrazo) ?? "");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return setErro("Informe o título do marco.");
    onSalvar({ nmTitulo: titulo.trim(), dtPrazo: prazo || null, txObservacao: marco?.txObservacao ?? "" });
    onFechar();
  };

  return (
    <ModalBase titulo={marco ? "Editar marco" : "Novo marco"} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Título">
          <input autoFocus maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} className={classeInput} />
        </Campo>
        <Campo rotulo="Prazo" dica="Opcional.">
          <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={classeInput} />
        </Campo>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar</button>
        </div>
      </form>
    </ModalBase>
  );
}
