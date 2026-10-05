import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { termoReprovaService } from "@/react-app/services/TermoReprovaService";
import { prepararFoto, type FotoPreparada } from "@/react-app/utils/imagem";
import { LEGENDA_MAX } from "@/react-app/utils/termoRegras";

interface ConferenciaFotoProps {
  /** Fila de fotos escolhidas; cada uma passa pela conferência e é enviada em seguida. */
  arquivos: File[];
  idTermo: number;
  /** Página aberta: a foto é vinculada a ela. */
  pagina: number;
  onFotoEnviada: () => void;
  onFechar: () => void;
}

type Etapa = "parado" | "preparando" | "enviando" | "erro";

/** Tela de conferência: preview + legenda; reduz a foto e envia (com tentar novamente em caso de falha). */
export default function ConferenciaFoto({ arquivos, idTermo, pagina, onFotoEnviada, onFechar }: ConferenciaFotoProps) {
  const [indice, setIndice] = useState(0);
  const [legenda, setLegenda] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("parado");
  const [erro, setErro] = useState<string | null>(null);
  // Guarda a foto já reduzida para que "Tentar novamente" só refaça o envio.
  const preparada = useRef<FotoPreparada | null>(null);

  const arquivo = arquivos[indice];
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const ocupado = etapa === "preparando" || etapa === "enviando";

  const proxima = () => {
    preparada.current = null;
    setLegenda("");
    setErro(null);
    setEtapa("parado");
    if (indice + 1 < arquivos.length) setIndice(indice + 1);
    else onFechar();
  };

  const enviar = async () => {
    if (ocupado) return;
    setErro(null);
    try {
      if (!preparada.current) {
        setEtapa("preparando");
        preparada.current = await prepararFoto(arquivo);
      }
      setEtapa("enviando");
      await termoReprovaService.adicionarFoto(idTermo, {
        imagem: preparada.current.imagem,
        miniatura: preparada.current.miniatura,
        nome: preparada.current.nome,
        nrPagina: pagina,
        legenda: legenda.trim() || undefined,
      });
      onFotoEnviada();
      proxima();
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível enviar a foto.");
      setEtapa("erro");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Conferir foto">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-slate-800">Foto da página {pagina}</h3>
          {arquivos.length > 1 && <span className="text-xs font-medium text-slate-400">Foto {indice + 1} de {arquivos.length}</span>}
        </div>

        {preview && <img src={preview} alt="Foto selecionada para anexar" className="max-h-72 w-full rounded-xl bg-slate-100 object-contain" />}

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pendência resolvida / legenda</span>
          <textarea
            value={legenda}
            disabled={ocupado}
            rows={2}
            maxLength={LEGENDA_MAX}
            onChange={e => setLegenda(e.target.value)}
            placeholder="Ex.: Ajuste da porta da sala concluído"
            className="mt-1 block w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="mt-1 block text-right text-xs text-slate-400">{legenda.length}/{LEGENDA_MAX}</span>
        </label>

        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={onFechar}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            {arquivos.length > 1 ? "Cancelar restantes" : "Descartar"}
          </button>
          {arquivos.length > 1 && (
            <button type="button" disabled={ocupado} onClick={proxima} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Pular esta
            </button>
          )}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void enviar()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : etapa === "erro" ? <RotateCcw className="h-4 w-4" /> : null}
            {etapa === "preparando" ? "Preparando foto…" : etapa === "enviando" ? "Enviando…" : etapa === "erro" ? "Tentar novamente" : "Salvar foto"}
          </button>
        </div>
      </div>
    </div>
  );
}
