import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ListPlus, Loader2, MessageSquareText, RefreshCcw } from "lucide-react";

interface CapturaFotoProps {
  /** Item que recebe as fotos (muda ao criar um item novo). */
  nomeItem: string;
  arquivoInicial: File;
  /** Envia a foto do item atual; devolve a mensagem de erro ou null. */
  onEnviar: (arquivo: File, legenda: string | null) => Promise<string | null>;
  /** Cria um item novo (que passa a receber as fotos); devolve o nome dele ou null se falhou. */
  onNovoItem: () => Promise<string | null>;
  onFechar: () => void;
}

/**
 * Sequência de fotos pela câmera: depois de cada foto, só ícones — tirar de novo, próxima, legenda,
 * novo item e finalizar. A foto só é enviada ao seguir em frente (próxima, novo item ou finalizar).
 */
export default function CapturaFoto({ nomeItem, arquivoInicial, onEnviar, onNovoItem, onFechar }: CapturaFotoProps) {
  const [atual, setAtual] = useState<File | null>(arquivoInicial);
  const [url, setUrl] = useState<string | null>(null);
  const [legenda, setLegenda] = useState("");
  const [editandoLegenda, setEditandoLegenda] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const [enviadas, setEnviadas] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoItem, setCriandoItem] = useState(false);
  // A prévia nasce e é liberada junto com a foto da tela.
  useEffect(() => {
    if (!atual) { setUrl(null); return; }
    const u = URL.createObjectURL(atual);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [atual]);

  const mostrar = (arquivo: File | undefined) => { if (arquivo) setAtual(arquivo); };

  /** Manda a foto da tela (com a legenda) e libera a tela para a próxima. */
  const confirmar = () => {
    if (!atual) return;
    const arquivo = atual;
    const texto = legenda.trim() || null;
    setAtual(null);
    setLegenda("");
    setEditandoLegenda(false);
    setPendentes(n => n + 1);
    void onEnviar(arquivo, texto).then(falha => {
      if (falha) setErro(falha); else setEnviadas(n => n + 1);
    }).finally(() => setPendentes(n => n - 1));
  };

  const novoItem = async () => {
    confirmar();
    setCriandoItem(true);
    const nome = await onNovoItem();
    setCriandoItem(false);
    if (!nome) setErro("Não foi possível criar o item.");
  };

  const finalizar = () => { confirmar(); onFechar(); };

  const botao = "flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-all hover:bg-white/25 active:scale-90 disabled:opacity-40";
  // Um só campo de câmera, sempre montado: o botão o "clica" no mesmo toque (o navegador exige o gesto).
  const entrada = useRef<HTMLInputElement>(null);
  const abrirCamera = () => entrada.current?.click();
  const camera = (rotulo: string, icone: ReactNode, antes: () => void, classe = botao) => (
    <button type="button" className={classe} aria-label={rotulo} title={rotulo} onClick={() => { antes(); abrirCamera(); }}>
      {icone}
    </button>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Fotos de ${nomeItem}`} className="fixed inset-0 z-[80] flex flex-col bg-slate-950 animate-aparecer">
      <input ref={entrada} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true"
        data-testid="camera-captura" onChange={e => { mostrar(e.target.files?.[0]); e.target.value = ""; }} />
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <p key={nomeItem} className="min-w-0 truncate text-sm font-bold animate-da-esquerda">{nomeItem}</p>
        <p className="flex shrink-0 items-center gap-1.5 text-xs text-white/70" role="status">
          {pendentes > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {enviadas > 0 && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-300">{enviadas}</span>}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {erro && <p role="alert" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white shadow" onClick={() => setErro(null)}>{erro}</p>}
        {atual ? (
          url && <img key={url} src={url} alt="Foto tirada" className="max-h-full max-w-full rounded-xl object-contain shadow-2xl animate-surgir" />
        ) : criandoItem ? (
          <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Criando item" />
        ) : (
          camera("Tirar foto", <Camera className="h-9 w-9" />, () => undefined,
            "flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/80 bg-white/10 text-white transition-transform active:scale-90 animate-surgir")
        )}
        {atual && editandoLegenda && (
          <input autoFocus value={legenda} maxLength={300} onChange={e => setLegenda(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setEditandoLegenda(false); }}
            aria-label="Legenda da foto" placeholder="Legenda"
            className="absolute inset-x-6 bottom-4 rounded-2xl border border-white/20 bg-slate-900/85 px-4 py-3 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur animate-entrada" />
        )}
        {atual && !editandoLegenda && legenda.trim() && (
          <p className="absolute inset-x-6 bottom-4 truncate rounded-2xl bg-slate-900/70 px-4 py-2 text-center text-sm text-white">{legenda}</p>
        )}
      </div>

      <footer className="flex items-center justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4" role="toolbar" aria-label="Ações da foto">
        {atual && camera("Tirar de novo", <RefreshCcw className="h-6 w-6" />, () => undefined)}
        {atual && camera("Próxima foto", <Camera className="h-7 w-7" />, confirmar,
          "flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 transition-all hover:bg-blue-500 active:scale-90")}
        {atual && (
          <button type="button" className={`${botao} ${editandoLegenda || legenda.trim() ? "bg-white text-slate-900 hover:bg-white" : ""}`} onClick={() => setEditandoLegenda(v => !v)}
            aria-label="Legenda" title="Legenda" aria-pressed={editandoLegenda}>
            <MessageSquareText className="h-6 w-6" />
          </button>
        )}
        <button type="button" className={botao} onClick={() => void novoItem()} disabled={criandoItem} aria-label="Novo item" title="Novo item">
          <ListPlus className="h-6 w-6" />
        </button>
        <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 active:scale-90"
          onClick={finalizar} aria-label="Finalizar" title="Finalizar">
          <Check className="h-7 w-7" />
        </button>
      </footer>
    </div>,
    document.body,
  );
}
