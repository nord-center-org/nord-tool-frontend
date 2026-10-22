import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import { useObra } from "@/react-app/hooks/useObra";
import type { ModeloRelatorio, RelatorioForm } from "@/react-app/services/RelatorioFotograficoService";
import { hojeSaoPaulo } from "@/react-app/utils/caixinha";
import { LAYOUTS, type FotosPorPagina } from "@/react-app/utils/relatorioFotografico";

interface Props {
  modelos: ModeloRelatorio[];
  onCriar: (form: RelatorioForm, idFase: number | null) => Promise<string | null>;
  onFechar: () => void;
}

/** Cria um relatório: livre ou a partir de um modelo (que já traz os itens e o layout). */
export default function NovoRelatorioModal({ modelos, onCriar, onFechar }: Props) {
  const ativos = modelos.filter(m => m.inAtivo);
  const [titulo, setTitulo] = useState("");
  const [local, setLocal] = useState("");
  const [data, setData] = useState(hojeSaoPaulo());
  const [idModelo, setIdModelo] = useState<number | null>(ativos[0]?.id ?? null);
  const [layout, setLayout] = useState<FotosPorPagina | null>(null);
  const fases = useObra().fases.filter(f => f.id !== null);
  const [idFase, setIdFase] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const modelo = ativos.find(m => m.id === idModelo) ?? null;
  const layoutEfetivo = layout ?? modelo?.nrFotosPagina ?? 2;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!titulo.trim()) return setErro("Informe o título do relatório.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data.");
    if (fases.length > 1 && !idFase) return setErro("Escolha a fase do relatório.");
    setSalvando(true);
    setErro(null);
    const mensagem = await onCriar({
      nmTitulo: titulo.trim(), nmLocal: local.trim() || null, dtRelatorio: data, idModelo, nrFotosPagina: layoutEfetivo,
      itens: modelo ? undefined : [{ nmItem: "Fotos", txOrientacao: null, txResposta: null }],
    }, fases.length > 1 ? idFase : null);
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo="Novo relatório fotográfico" onFechar={onFechar} largura="max-w-lg">
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Título">
          <input autoFocus value={titulo} maxLength={150} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Vistoria da fachada do bloco A" className={classeInput} />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo rotulo="Local">
            <input value={local} maxLength={150} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Bloco A" className={classeInput} />
          </Campo>
          <Campo rotulo="Data">
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={classeInput} />
          </Campo>
        </div>
        {fases.length > 1 && (
          <Campo rotulo="Fase">
            <select value={idFase ?? ""} onChange={e => setIdFase(e.target.value ? Number(e.target.value) : null)} className={classeInput}>
              <option value="">Escolha a fase</option>
              {fases.map(f => <option key={f.id} value={f.id ?? ""}>{f.nome}</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Modelo" dica={modelo ? `${modelo.itens.length} item(ns) já entram no relatório.` : "Sem modelo: o relatório começa com um item \"Fotos\" e você adiciona outros."}>
          <select value={idModelo ?? ""} onChange={e => { setIdModelo(e.target.value ? Number(e.target.value) : null); setLayout(null); }} className={classeInput}>
            <option value="">Sem modelo (livre)</option>
            {ativos.map(m => <option key={m.id} value={m.id}>{m.nmModelo}</option>)}
          </select>
        </Campo>
        {/* Fora do <label> do Campo: um label com botões dentro "clica" no primeiro botão. */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fotos por página no PDF</span>
          <div className="mt-1 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Fotos por página">
            {LAYOUTS.map(n => (
              <button key={n} type="button" role="radio" aria-checked={layoutEfetivo === n} onClick={() => setLayout(n)}
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${layoutEfetivo === n ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button>
          <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Criar relatório
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
