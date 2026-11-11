import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { ModeloRelatorio, RelatorioFotografico } from "@/react-app/services/RelatorioFotograficoService";
import { itensQueEntram } from "@/react-app/utils/relatorioFotografico";

export interface TrocaModelo { idModelo: number | null; inAdicionarItens: boolean; inUsarLayout: boolean }

interface Props {
  relatorio: RelatorioFotografico;
  /** Nomes dos itens que estão na tela agora (para mostrar quantos entram). */
  nomesItens: string[];
  modelos: ModeloRelatorio[];
  onTrocar: (troca: TrocaModelo) => Promise<string | null>;
  onFechar: () => void;
}

/**
 * v3: troca o modelo de um relatório já criado. O que foi preenchido (itens, observações e fotos) fica; dá para
 * acrescentar os itens do modelo que ainda não estão no relatório e usar o layout da página do modelo.
 */
export default function TrocarModeloModal({ relatorio, nomesItens, modelos, onTrocar, onFechar }: Props) {
  // Desativado só aparece se já é o do relatório.
  const opcoes = modelos.filter(m => m.inAtivo || m.id === relatorio.idModelo);
  const [idModelo, setIdModelo] = useState<number | null>(relatorio.idModelo ?? opcoes[0]?.id ?? null);
  const [adicionar, setAdicionar] = useState(true);
  const [usarLayout, setUsarLayout] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const modelo = opcoes.find(m => m.id === idModelo) ?? null;
  const entram = modelo ? itensQueEntram(nomesItens, modelo.itens.map(i => i.nmItem)) : [];
  const igual = idModelo === (relatorio.idModelo ?? null) && (!modelo || (entram.length === 0 && modelo.cdLayout === relatorio.cdLayout));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    const mensagem = await onTrocar({ idModelo, inAdicionarItens: !!modelo && adicionar, inUsarLayout: !!modelo && usarLayout });
    setSalvando(false);
    if (mensagem) setErro(mensagem);
  };

  return (
    <ModalBase titulo="Trocar modelo do relatório" onFechar={onFechar} largura="max-w-lg">
      <form onSubmit={e => void enviar(e)} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <p className="text-sm text-slate-600">
          O modelo define a aparência do PDF (fonte, cabeçalho, marca d'água e ícone). Nada do que já foi preenchido é apagado: itens, observações e fotos ficam.
        </p>
        <Campo rotulo="Modelo">
          <select value={idModelo ?? ""} onChange={e => setIdModelo(e.target.value ? Number(e.target.value) : null)} className={classeInput}>
            <option value="">Sem modelo</option>
            {opcoes.map(m => <option key={m.id} value={m.id}>{m.nmModelo}{m.inAtivo ? "" : " (desativado)"}{m.id === relatorio.idModelo ? " · atual" : ""}</option>)}
          </select>
        </Campo>
        {modelo && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={adicionar} onChange={e => setAdicionar(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="font-semibold text-slate-700">Acrescentar os itens do modelo que faltam</span>
                <span className="block text-xs text-slate-500">
                  {entram.length === 0 ? "O relatório já tem todos os itens deste modelo." : `Entram no fim: ${entram.slice(0, 4).join(", ")}${entram.length > 4 ? ` e mais ${entram.length - 4}` : ""}.`}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={usarLayout} onChange={e => setUsarLayout(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <span>
                <span className="font-semibold text-slate-700">Usar o layout da página do modelo</span>
                <span className="block text-xs text-slate-500">Senão, continua o layout escolhido no relatório.</span>
              </span>
            </label>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button>
          <button type="submit" disabled={salvando || igual} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Trocar modelo
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
