import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Music, Trash2, Upload } from "lucide-react";

import {
  AJUSTES_PADRAO, excluirMusica, lerArquivo, listarMusicas, salvarArquivo, salvarMusica, tituloDoArquivo, type Musica,
} from "@/react-app/utils/musica/repertorioDb";
import { nomeDoTom } from "@/react-app/utils/musica/teoria";

const PlayerRepertorio = lazy(() => import("@/react-app/components/repertorio/PlayerRepertorio"));

const LIMITE_MB = 60;
const relogio = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/**
 * Repertório: as músicas que a pessoa enviou, guardadas no próprio aparelho. Ao abrir uma, o player reconhece o
 * tom, o BPM, os acordes e o baixo, e mostra a cifra rolando com o instrumento ao lado.
 */
export default function RepertorioPage() {
  const [musicas, setMusicas] = useState<Musica[] | null>(null);
  const [aberta, setAberta] = useState<{ musica: Musica; arquivo: Blob } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try { setMusicas(await listarMusicas()); } catch (e) { setErro(e instanceof Error ? e.message : "Não deu para ler o repertório."); setMusicas([]); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const enviar = async (f: File) => {
    setErro(null);
    if (!f.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|webm)$/i.test(f.name)) { setErro("Envie um arquivo de áudio (MP3, WAV, M4A, OGG, FLAC)."); return; }
    if (f.size > LIMITE_MB * 1024 * 1024) { setErro(`O arquivo passa de ${LIMITE_MB} MB.`); return; }
    setEnviando(true);
    try {
      const { titulo, artista } = tituloDoArquivo(f.name);
      const agora = new Date().toISOString();
      const m: Musica = {
        id: novoId(), titulo, artista, criadaEm: agora, atualizadaEm: agora, nomeArquivo: f.name, tamanho: f.size, duracao: 0,
        analise: null, cifra: "", tempos: null, ajustes: { ...AJUSTES_PADRAO },
      };
      await salvarArquivo(m.id, f);
      await salvarMusica(m);
      setAberta({ musica: m, arquivo: f });
      void carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para guardar a música no aparelho.");
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (m: Musica) => {
    setErro(null);
    const arquivo = await lerArquivo(m.id).catch(() => undefined);
    if (!arquivo) { setErro("O áudio dessa música não está mais neste aparelho. Exclua e envie de novo."); return; }
    setAberta({ musica: m, arquivo });
  };

  const salvar = useCallback(async (m: Musica) => { await salvarMusica(m).catch(() => undefined); }, []);

  if (aberta) {
    return (
      <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o player…</p>}>
        <PlayerRepertorio key={aberta.musica.id} musica={aberta.musica} arquivo={aberta.arquivo} onSalvar={salvar}
          onVoltar={() => { setAberta(null); void carregar(); }} />
      </Suspense>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-2 text-xl font-bold text-slate-800"><Music className="h-5 w-5 text-orange-500" />Repertório</h1>
      </div>
      <input ref={entrada} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.opus" className="hidden" aria-label="Música para enviar"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={enviando}
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void enviar(f); }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center hover:bg-slate-50 disabled:opacity-60">
        {enviando ? <Loader2 className="h-9 w-9 animate-spin text-slate-400" /> : <Upload className="h-9 w-9 text-slate-400" />}
        <span className="text-base font-bold text-slate-700">Enviar uma música</span>
        <span className="max-w-md text-xs text-slate-500">MP3, WAV, M4A, OGG ou FLAC, até {LIMITE_MB} MB. Reconheço o tom, o BPM, os acordes e o baixo; dá para mudar o tom e o andamento, separar as faixas e tocar junto com a cifra. Fica guardada só neste aparelho.</span>
      </button>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <h2 className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">Músicas neste aparelho</h2>
      {musicas === null ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : musicas.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Nenhuma música ainda. Envie a primeira acima.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Músicas">
          {musicas.map(m => (
            <li key={m.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 hover:border-blue-300">
              <button type="button" onClick={() => void abrir(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ${m.titulo}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-red-500 text-sm font-bold text-white">
                  {m.analise ? nomeDoTom(m.analise.tom).cifra : <Music className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{m.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[m.artista, m.duracao ? relogio(m.duracao) : null, m.analise ? `${Math.round(m.analise.bpm)} BPM` : "ainda não analisada", m.cifra.trim() ? "com cifra" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${m.titulo}`}
                onClick={async () => { if (window.confirm(`Excluir "${m.titulo}" deste aparelho?`)) { await excluirMusica(m.id).catch(() => undefined); void carregar(); } }}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
