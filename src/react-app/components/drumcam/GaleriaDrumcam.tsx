import { useEffect, useMemo, useState } from "react";
import { Download, Film, Image as ImageIcon, Pencil, Play, Trash2, X } from "lucide-react";
import { duracaoTexto, tamanhoTexto } from "@/react-app/utils/drumcamAoVivo";
import { aoMudarGaleria, galeria, type ItemGaleria } from "./armazenamento";
import { BotaoIcone, Painel } from "./ui";

const ORIGENS: Record<ItemGaleria["origem"], string> = { estudio: "Estúdio", montagem: "Alta qualidade", movimento: "Movimento", foto: "Foto", clipe: "Clipe" };
type Filtro = "todos" | "video" | "foto" | "movimento";

/**
 * Galeria do estúdio e do monitoramento: os vídeos e as fotos ficam neste aparelho e tocam aqui mesmo, sem baixar.
 * Dá para renomear, baixar e apagar.
 */
export default function GaleriaDrumcam({ abrir, aoAbrir }: { abrir?: string | null; aoAbrir?: () => void }) {
  const [itens, setItens] = useState<ItemGaleria[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<ItemGaleria | null>(null);
  const [espaco, setEspaco] = useState<{ usado: number; total: number } | null>(null);

  useEffect(() => {
    const carregar = () => {
      void galeria.listar().then(setItens).catch(() => setItens([]));
      void navigator.storage?.estimate?.().then(e => setEspaco({ usado: e.usage ?? 0, total: e.quota ?? 0 })).catch(() => undefined);
    };
    carregar();
    return aoMudarGaleria(carregar);
  }, []);
  useEffect(() => { if (abrir) { const i = itens.find(x => x.id === abrir); if (i) { setAberto(i); aoAbrir?.(); } } }, [abrir, itens, aoAbrir]);

  const lista = useMemo(() => itens.filter(i => filtro === "todos" || (filtro === "movimento" ? i.origem === "movimento" : i.tipo === filtro)), [itens, filtro]);

  return (
    <Painel titulo="Galeria" acoes={espaco ? <span className="text-[10px] text-slate-500">{tamanhoTexto(espaco.usado)} usados neste aparelho</span> : undefined} corpo="p-2">
      <div className="mb-2 flex flex-wrap gap-1">
        {([["todos", "Tudo"], ["video", "Vídeos"], ["foto", "Fotos"], ["movimento", "Movimento"]] as const).map(([f, r]) => (
          <button key={f} type="button" onClick={() => setFiltro(f)} aria-pressed={filtro === f}
            className={`rounded-md px-2.5 py-1 text-xs font-bold ${filtro === f ? "bg-sky-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{r}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="grid h-40 place-items-center text-center text-sm text-slate-500">Nada por aqui ainda. As gravações do Estúdio, as fotos e os clipes do Monitoramento aparecem aqui.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {lista.map(i => (
            <li key={i.id}>
              <button type="button" onClick={() => setAberto(i)} className="group block w-full overflow-hidden rounded-md bg-black/30 text-left ring-1 ring-white/10 hover:ring-sky-500">
                <span className="relative block aspect-video bg-black">
                  {i.miniatura ? <img src={i.miniatura} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-slate-600">{i.tipo === "foto" ? <ImageIcon className="h-6 w-6" /> : <Film className="h-6 w-6" />}</span>}
                  {i.tipo === "video" && <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100"><Play className="h-8 w-8 fill-white text-white" /></span>}
                  {i.duracao ? <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white">{duracaoTexto(i.duracao)}</span> : null}
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-slate-200">{ORIGENS[i.origem]}</span>
                </span>
                <span className="block truncate px-1.5 py-1 text-[11px] text-slate-300" title={i.nome}>{i.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && <Visualizador item={aberto} fechar={() => setAberto(null)} />}
    </Painel>
  );
}

/** Assistir (ou ver a foto) aqui mesmo, sem baixar. */
function Visualizador({ item, fechar }: { item: ItemGaleria; fechar: () => void }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [nome, setNome] = useState(item.nome);
  const [editando, setEditando] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [fechar]);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-3" role="dialog" aria-modal aria-label={item.nome} onClick={fechar}>
      <div className="w-full max-w-5xl rounded-lg bg-[#181b22] p-2 ring-1 ring-white/10" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-1.5">
          {editando ? (
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus aria-label="Nome" className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1 text-sm text-white"
              onKeyDown={e => { if (e.key === "Enter") { void galeria.renomear(item.id, nome); setEditando(false); } }} />
          ) : <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{nome}</p>}
          <span className="hidden text-[11px] text-slate-400 sm:inline">{tamanhoTexto(item.tamanho)} · {new Date(item.criadoEm).toLocaleString("pt-BR")}</span>
          <BotaoIcone rotulo="Renomear" onClick={() => { if (editando) void galeria.renomear(item.id, nome); setEditando(e => !e); }}><Pencil className="h-4 w-4" /></BotaoIcone>
          <a href={url} download={nome} title="Baixar" aria-label="Baixar" className="inline-flex h-8 items-center gap-1 rounded-md bg-sky-600 px-2 text-xs font-bold text-white hover:bg-sky-500"><Download className="h-4 w-4" />Baixar</a>
          <BotaoIcone rotulo="Apagar" onClick={() => { if (confirm(`Apagar "${nome}" deste aparelho?`)) { void galeria.apagar(item.id); fechar(); } }}><Trash2 className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Fechar" onClick={fechar}><X className="h-4 w-4" /></BotaoIcone>
        </div>
        {item.tipo === "video"
          ? <video src={url} controls autoPlay playsInline className="max-h-[75vh] w-full rounded bg-black" />
          : <img src={url} alt={nome} className="mx-auto max-h-[75vh] rounded" />}
      </div>
    </div>
  );
}
