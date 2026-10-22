import { useState, type FormEvent } from "react";
import { ClipboardList, Loader2, Ruler } from "lucide-react";

import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { useObra } from "@/react-app/hooks/useObra";
import type { MapeamentoForm } from "@/react-app/services/MapeamentoService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import type { TipoMapeamento } from "@/react-app/utils/mapeamentos";

interface Props {
  onCriar: (form: MapeamentoForm, idFase: number | null) => Promise<string | null>;
  onFechar: () => void;
}

const TIPOS: Array<{ tipo: TipoMapeamento; titulo: string; texto: string; icone: typeof Ruler }> = [
  { tipo: "CONTAGEM", titulo: "Contagem em campo", texto: "Efetivo, atividades ou materiais contados na obra.", icone: ClipboardList },
  { tipo: "QUANTITATIVO", titulo: "Quantitativo", texto: "Projeto × medido × solicitado, com alertas.", icone: Ruler },
];

export default function NovoMapeamentoModal({ onCriar, onFechar }: Props) {
  const [tipo, setTipo] = useState<TipoMapeamento>("CONTAGEM");
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState(hojeSaoPaulo());
  const fases = useObra().fases.filter(f => f.id !== null);
  const [idFase, setIdFase] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!titulo.trim()) return setErro("Informe o título.");
    if (fases.length > 1 && !idFase) return setErro("Escolha a fase.");
    setSalvando(true);
    setErro(null);
    const msg = await onCriar({ cdTipo: tipo, nmTitulo: titulo.trim(), nmLocal: local.trim() || null, dtMapeamento: data, linhas: [] }, fases.length > 1 ? idFase : null);
    setSalvando(false);
    if (msg) setErro(msg);
  };

  return (
    <ModalBase titulo="Novo mapeamento" onFechar={onFechar} largura="max-w-lg">
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de mapeamento">
          {TIPOS.map(t => (
            <button key={t.tipo} type="button" role="radio" aria-checked={tipo === t.tipo} onClick={() => setTipo(t.tipo)}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left ${tipo === t.tipo ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <t.icone className={`mt-0.5 h-5 w-5 shrink-0 ${tipo === t.tipo ? "text-blue-600" : "text-slate-400"}`} />
              <span><span className="block text-sm font-bold text-slate-800">{t.titulo}</span><span className="block text-xs text-slate-500">{t.texto}</span></span>
            </button>
          ))}
        </div>
        <Campo rotulo="Título">
          <input autoFocus value={titulo} maxLength={150} onChange={e => setTitulo(e.target.value)}
            placeholder={tipo === "CONTAGEM" ? "Ex.: Efetivo de 21/10" : "Ex.: Alvenaria do bloco A"} className={classeInput} />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Local"><input value={local} maxLength={150} onChange={e => setLocal(e.target.value)} className={classeInput} /></Campo>
          <Campo rotulo="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} /></Campo>
        </div>
        {fases.length > 1 && (
          <Campo rotulo="Fase">
            <select value={idFase ?? ""} onChange={e => setIdFase(e.target.value ? Number(e.target.value) : null)} className={classeInput}>
              <option value="">Escolha a fase</option>
              {fases.map(f => <option key={f.id} value={f.id ?? ""}>{f.nome}</option>)}
            </select>
          </Campo>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
