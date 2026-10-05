import { useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Trash2 } from "lucide-react";

import type { TermoFotoDto } from "@/shared/types";
import ImagemAutenticada from "@/react-app/components/ImagemAutenticada";
import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { LEGENDA_MAX } from "@/react-app/utils/termoRegras";

interface FotoCardProps {
  foto: TermoFotoDto;
  totalPaginas: number;
  podeSubir: boolean;
  podeDescer: boolean;
  desabilitado: boolean;
  onAmpliar: () => void;
  onSalvarLegenda: (legenda: string) => void;
  onSubstituirImagem: (arquivo: File) => void;
  onMoverPagina: (pagina: number) => void;
  onMover: (direcao: "cima" | "baixo") => void;
  onExcluir: () => void;
}

const botaoIcone =
  "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40";

/** Cartão de uma foto: miniatura, legenda editável e ações (substituir, mover, reordenar, excluir). */
export default function FotoCard({
  foto, totalPaginas, podeSubir, podeDescer, desabilitado,
  onAmpliar, onSalvarLegenda, onSubstituirImagem, onMoverPagina, onMover, onExcluir,
}: FotoCardProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(foto.txLegenda ?? "");

  const iniciarEdicao = () => { setRascunho(foto.txLegenda ?? ""); setEditando(true); };
  const confirmar = () => {
    setEditando(false);
    if ((foto.txLegenda ?? "") !== rascunho.trim()) onSalvarLegenda(rascunho.trim());
  };

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onAmpliar} className="block w-full cursor-zoom-in" aria-label="Ampliar foto">
        <ImagemAutenticada
          chave={`foto:${foto.idTermoFoto}:miniatura:${foto.nrVersao}`}
          carregar={() => termoReprovaService.baixarMiniatura(foto.idTermoFoto, foto.nrVersao)}
          alt={foto.txLegenda || "Foto da correção"}
          className="block h-auto max-h-72 w-full object-contain"
        />
      </button>

      <div className="border-t border-slate-100 px-3 py-2">
        {editando ? (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={rascunho}
              rows={2}
              maxLength={LEGENDA_MAX}
              onChange={e => setRascunho(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") setEditando(false);
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmar();
              }}
              className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Legenda da foto"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(false)} className="rounded-lg px-3 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button type="button" onClick={confirmar} className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={desabilitado}
            onClick={iniciarEdicao}
            title="Editar legenda"
            className="block w-full text-left text-sm text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed"
          >
            {foto.txLegenda || <span className="italic text-slate-400">Sem legenda — clique para adicionar</span>}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 px-2 py-1.5">
        <div className="flex items-center">
          <button type="button" className={botaoIcone} disabled={desabilitado || !podeSubir} onClick={() => onMover("cima")} aria-label="Mover foto para cima" title="Mover para cima"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" className={botaoIcone} disabled={desabilitado || !podeDescer} onClick={() => onMover("baixo")} aria-label="Mover foto para baixo" title="Mover para baixo"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" className={botaoIcone} disabled={desabilitado} onClick={iniciarEdicao} aria-label="Editar legenda" title="Editar legenda"><Pencil className="h-4 w-4" /></button>
          <label className={`${botaoIcone} cursor-pointer ${desabilitado ? "pointer-events-none opacity-40" : ""}`} title="Substituir imagem">
            <ImagePlus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Substituir imagem</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={desabilitado}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onSubstituirImagem(f); }}
            />
          </label>
        </div>

        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-slate-400">
            Página
            <select
              aria-label="Mover foto para a página"
              value={foto.nrPagina}
              disabled={desabilitado}
              onChange={e => onMoverPagina(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 outline-none"
            >
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button type="button" className={`${botaoIcone} hover:text-red-600`} disabled={desabilitado} onClick={onExcluir} aria-label="Excluir foto" title="Excluir foto"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
    </li>
  );
}
