import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox, Loader2, Minus, Music, Plus, Trash2 } from "lucide-react";

import { PainelImagemCifra } from "@/react-app/components/repertorio/CompartilharCifra";
import { repertorioService, type CifraRecebida } from "@/react-app/services/RepertorioService";
import { acordesDaLinha, transporCifra } from "@/react-app/utils/musica/cifra";
import type { Musica } from "@/react-app/utils/musica/repertorioDb";
import { lerTom, transporTom } from "@/react-app/utils/musica/teoria";
import { tomExibido } from "@/react-app/utils/musica/notacao";
import { useNotacao } from "./useNotacao";

const botao = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

interface Props {
  musicas: Musica[] | null;
  /** Põe a cifra recebida numa música minha (e abre o player). */
  onUsar: (m: Musica, cifra: string) => Promise<void>;
  onNaoLidas: (n: number) => void;
}

/** Repertório v12 — as cifras que compartilharam comigo: abrir, mudar o tom, imagem, usar numa música minha, excluir. */
export default function CifrasRecebidas({ musicas, onUsar, onNaoLidas }: Props) {
  const [lista, setLista] = useState<CifraRecebida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<CifraRecebida | null>(null);
  const [abrindo, setAbrindo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const l = await repertorioService.cifrasRecebidas();
      setLista(l);
      onNaoLidas(l.filter(c => !c.dhLeitura).length);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ver as cifras recebidas."); setLista([]);
    }
  }, [onNaoLidas]);
  useEffect(() => { void carregar(); }, [carregar]);

  const abrir = async (c: CifraRecebida) => {
    setErro(null);
    setAbrindo(c.id);
    try {
      const completa = await repertorioService.abrirCifra(c.id);
      if (completa) setAberta(completa);
      const n = (lista ?? []).map(x => (x.id === c.id ? { ...x, dhLeitura: x.dhLeitura ?? new Date().toISOString() } : x));
      setLista(n);
      onNaoLidas(n.filter(x => !x.dhLeitura).length);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para abrir a cifra.");
    } finally {
      setAbrindo(null);
    }
  };
  const excluir = async (c: CifraRecebida) => {
    if (!window.confirm(`Excluir a cifra "${c.nmTitulo}" que ${c.nmUsuarioOrigem} mandou?`)) return;
    await repertorioService.excluirCifra(c.id).catch(() => undefined);
    setAberta(null);
    void carregar();
  };

  if (aberta) return <VerCifra cifra={aberta} musicas={musicas} onUsar={onUsar} onVoltar={() => setAberta(null)} onExcluir={() => void excluir(aberta)} />;

  return (
    <div>
      {erro && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {lista === null ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-700">Nenhuma cifra recebida ainda</p>
          <p className="max-w-sm text-xs text-slate-500">Quando alguém do NordTool compartilhar uma cifra com você (no player, em “Compartilhar”), ela aparece aqui.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Cifras recebidas">
          {lista.map(c => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 hover:border-blue-300">
              <button type="button" onClick={() => void abrir(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir a cifra ${c.nmTitulo}`}>
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-white">
                  {abrindo === c.id ? <Loader2 className="h-5 w-5 animate-spin" /> : c.nmTom ?? <Music className="h-5 w-5" />}
                  {!c.dhLeitura && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500" aria-label="Nova" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{c.nmTitulo}</span>
                  <span className="block truncate text-xs text-slate-500">{[c.nmArtista, `de ${c.nmUsuarioOrigem}`, quando(c.dhCriacao)].filter(Boolean).join(" · ")}</span>
                  {c.txMensagem && <span className="block truncate text-xs italic text-slate-500">“{c.txMensagem}”</span>}
                </span>
              </button>
              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir a cifra ${c.nmTitulo}`} onClick={() => void excluir(c)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerCifra({ cifra, musicas, onUsar, onVoltar, onExcluir }: { cifra: CifraRecebida; musicas: Musica[] | null; onUsar: Props["onUsar"]; onVoltar: () => void; onExcluir: () => void }) {
  const notacao = useNotacao();
  const [semitons, setSemitons] = useState(0);
  const [destino, setDestino] = useState("");
  const [usando, setUsando] = useState(false);
  const original = cifra.txCifra ?? "";
  const tomOriginal = cifra.nmTom ? lerTom(cifra.nmTom) : null;
  const texto = useMemo(() => transporCifra(original, semitons, tomOriginal), [original, semitons, tomOriginal]);
  const tom = tomOriginal ? tomExibido(transporTom(tomOriginal, semitons), notacao).cifra : null;
  const info = useMemo(() => ({ titulo: cifra.nmTitulo, artista: cifra.nmArtista, tom, texto }), [cifra.nmTitulo, cifra.nmArtista, tom, texto]);
  const usar = async () => {
    const m = musicas?.find(x => x.id === destino);
    if (!m) return;
    if (m.cifra.trim() && !window.confirm(`"${m.titulo}" já tem cifra. Trocar pela recebida?`)) return;
    setUsando(true);
    try { await onUsar(m, texto); } finally { setUsando(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={onVoltar}><ArrowLeft className="h-4 w-4" />Recebidas</button>
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-base font-bold text-slate-800">{cifra.nmTitulo}</h2>
          <p className="truncate text-xs text-slate-500">{[cifra.nmArtista, `de ${cifra.nmUsuarioOrigem}`, quando(cifra.dhCriacao)].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className={`${botao} text-red-600`} onClick={onExcluir}><Trash2 className="h-4 w-4" />Excluir</button>
      </div>
      {cifra.txMensagem && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">“{cifra.txMensagem}”</p>}
      <div className="grid gap-3 md:grid-cols-[1fr_20rem]">
        <section className="rounded-xl border border-slate-200 bg-white" aria-label="Cifra recebida">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2">
            <b className="mr-auto text-sm text-slate-700">Cifra {tom && <span className="font-normal text-slate-500">· tom {tom}</span>}</b>
            <div className="flex items-center gap-0.5" role="group" aria-label="Tom da cifra">
              <span className="text-[10px] font-bold uppercase text-slate-400">Tom</span>
              <button type="button" aria-label="Descer meio tom da cifra" onClick={() => setSemitons(s => s - 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-8 text-center text-xs font-bold text-slate-600">{semitons > 0 ? `+${semitons}` : semitons}</span>
              <button type="button" aria-label="Subir meio tom da cifra" onClick={() => setSemitons(s => s + 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-snug text-slate-800">
            {texto.split("\n").map((l, i) => <div key={i} className={acordesDaLinha(l.replace(/^\s*\[[^\]]+\]\s*/, "")) ? "font-bold text-orange-600" : /^\s*\[/.test(l) ? "font-bold text-orange-700" : ""}>{l || " "}</div>)}
          </pre>
        </section>
        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Usar numa música minha</h3>
            {musicas?.length ? (<>
              <select value={destino} onChange={e => setDestino(e.target.value)} aria-label="Música para usar a cifra" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm">
                <option value="">Escolha a música…</option>
                {musicas.map(m => <option key={m.id} value={m.id}>{m.titulo}{m.artista ? ` — ${m.artista}` : ""}</option>)}
              </select>
              <button type="button" onClick={() => void usar()} disabled={!destino || usando}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40">
                {usando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}Pôr a cifra e abrir
              </button>
              <p className="mt-1 text-[11px] text-slate-500">A cifra vai no tom escolhido aqui; no player ela rola com a música.</p>
            </>) : <p className="text-xs text-slate-500">Envie o áudio da música em “Músicas” para tocar junto com esta cifra.</p>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Imagem</h3>
            <PainelImagemCifra info={info} />
          </div>
        </aside>
      </div>
    </div>
  );
}
