import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AlertTriangle, Cloud, CloudOff, Loader2, Music, Piano, Trash2, Upload } from "lucide-react";

import { AJUSTES_PADRAO, salvarArquivo, salvarMusica, tituloDoArquivo, type Musica } from "@/react-app/utils/musica/repertorioDb";
import {
  abrirMusica, enviarMusica, excluirMusica, guardarNaConta, sincronizarMusicas, subirPendentes, usoDaConta, type SituacaoConta,
} from "@/react-app/components/repertorio/sincronizacao";
import { MAX_AUDIO_CONTA, textoDoUso } from "@/react-app/utils/musica/repertorioConta";
import { tomExibido } from "@/react-app/utils/musica/notacao";
import { useNotacao } from "@/react-app/components/repertorio/useNotacao";
import { textoAutoria, type Autoria } from "@/react-app/utils/musica/repertorioConta";
import { repertorioService } from "@/react-app/services/RepertorioService";

const PlayerRepertorio = lazy(() => import("@/react-app/components/repertorio/PlayerRepertorio"));
const EstudioRepertorio = lazy(() => import("@/react-app/components/repertorio/EstudioRepertorio"));
const PainelInstrumentoOnline = lazy(() => import("@/react-app/components/repertorio/PainelInstrumentoOnline"));
const CifrasRecebidas = lazy(() => import("@/react-app/components/repertorio/CifrasRecebidas"));
const DrumcamRepertorio = lazy(() => import("@/react-app/components/drumcam/DrumcamRepertorio"));

const LIMITE_MB = 60;
const relogio = (s: number) => { const t = Math.max(0, Math.floor(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const novoId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Barrinhas de equalizador, só enfeite do cabeçalho (paradas quando a pessoa prefere menos movimento). */
function Equalizador() {
  return (
    <span aria-hidden className="ml-1 hidden h-5 items-end gap-[3px] sm:flex">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className="nt-eq w-[3px] rounded-full bg-gradient-to-t from-orange-500 to-pink-400" style={{ animationDelay: `${i * 0.13}s` }} />
      ))}
    </span>
  );
}

/**
 * Estúdio (antigo Repertório): as músicas que a pessoa enviou, guardadas no próprio aparelho. Ao abrir uma, o player reconhece o
 * tom, o BPM, os acordes e o baixo, e mostra a cifra rolando com o instrumento ao lado.
 */
export default function RepertorioPage() {
  const notacao = useNotacao();
  const [musicas, setMusicas] = useState<Musica[] | null>(null);
  const [aberta, setAberta] = useState<{ musica: Musica; arquivo: Blob } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // v7: onde cada música está (conta ou só aqui), se há conexão com a conta e o espaço usado nela
  const [situacao, setSituacao] = useState<Map<string, SituacaoConta>>(() => new Map());
  const [semConta, setSemConta] = useState(false);
  const [uso, setUso] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  // v16: a aba é aberta a todos; cada música mostra quem criou, e só quem criou exclui
  const [autoria, setAutoria] = useState<Map<string, Autoria>>(() => new Map());
  const mudarSituacao = useCallback((id: string, s: SituacaoConta) => setSituacao(m => new Map(m).set(id, s)), []);
  const atualizarUso = useCallback(() => { void usoDaConta().then(u => setUso(textoDoUso(u.bytesUsados, u.bytesCota))).catch(() => setUso(null)); }, []);
  const entrada = useRef<HTMLInputElement>(null);
  // v6: sub-abas "Músicas" e "Criar" (na URL, para o link das novidades abrir direto) e o instrumento online
  const [busca, setBusca] = useSearchParams();
  // Drumcam v2: sub-aba "Drumcam" (celular-câmera da bateria, no Wi-Fi e pela internet).
  // Drumcam v4: a tela toda virou "Estúdio" e a sub-aba das câmeras é "Gravação" (?aba=gravacao); os links antigos
  // ?aba=estudio (v3) e ?aba=drumcam (v2) continuam abrindo.
  const pedida = ["gravacao", "estudio"].includes(busca.get("aba") ?? "") ? "drumcam" : busca.get("aba");
  const aba = pedida === "criar" || pedida === "recebidas" || pedida === "drumcam" ? pedida : "musicas";
  const mudarAba = (a: "musicas" | "criar" | "recebidas" | "drumcam") => setBusca(b => { const n = new URLSearchParams(b); if (a !== "musicas") n.set("aba", a === "drumcam" ? "gravacao" : a); else n.delete("aba"); return n; }, { replace: true });
  // v12: cifras que compartilharam comigo (o número das novas aparece na aba)
  const [naoLidas, setNaoLidas] = useState(0);
  useEffect(() => { repertorioService.cifrasRecebidas().then(l => setNaoLidas(l.filter(c => !c.dhLeitura).length)).catch(() => undefined); }, []);
  const [instrumentoOnline, setInstrumentoOnline] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await sincronizarMusicas();
      setMusicas(r.musicas);
      setSituacao(r.situacao);
      setAutoria(r.autoria);
      setSemConta(r.semConta);
      if (!r.semConta) {
        atualizarUso();
        if (r.pendentes.length) void subirPendentes(r.pendentes, mudarSituacao).then(atualizarUso);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler o repertório."); setMusicas([]);
    }
  }, [atualizarUso, mudarSituacao]);
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
      const salva = await salvarMusica(m);
      setAberta({ musica: salva, arquivo: f });
      // vai para a conta em segundo plano (o áudio só se couber)
      if (!semConta) {
        mudarSituacao(m.id, f.size > MAX_AUDIO_CONTA ? "so-aparelho" : "enviando");
        void enviarMusica(salva, true).then(s => { mudarSituacao(m.id, s); atualizarUso(); }).catch(() => mudarSituacao(m.id, "falhou"));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para guardar a música no aparelho.");
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (m: Musica) => {
    setErro(null);
    setAbrindo(m.id);
    try { setAberta(await abrirMusica(m, semConta)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não deu para abrir a música."); }
    finally { setAbrindo(null); }
  };

  // cada mudança: no aparelho na hora e na conta logo depois
  const salvar = useCallback(async (m: Musica) => {
    const salva = await salvarMusica(m).catch(() => null);
    if (salva) guardarNaConta(salva);
  }, []);

  // v12: põe a cifra recebida numa música minha e abre o player
  const usarCifraRecebida = async (m: Musica, cifra: string) => {
    const salva = await salvarMusica({ ...m, cifra, tempos: null, ajustes: { ...m.ajustes, semitonsCifra: 0 } });
    guardarNaConta(salva);
    mudarAba("musicas");
    await abrir(salva);
  };

  if (aberta) {
    return (
      <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o player…</p>}>
        <PlayerRepertorio key={aberta.musica.id} musica={aberta.musica} arquivo={aberta.arquivo} onSalvar={salvar} autoria={textoAutoria(autoria.get(aberta.musica.id))}
          onVoltar={() => { setAberta(null); void carregar(); }} />
      </Suspense>
    );
  }

  return (
    <div className={`mx-auto ${aba === "drumcam" ? "max-w-[1700px]" : aba === "criar" ? "max-w-6xl" : "max-w-4xl"}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-600 text-white shadow-lg shadow-pink-900/40"><Music className="h-5 w-5" /></span>
          <span>
            <span className="block text-xl font-black tracking-tight text-white">Estúdio</span>
            <span className="block text-[11px] font-medium text-[#9d93a8]">Músicas, cifras, criação e gravação</span>
          </span>
          <Equalizador />
        </h1>
        <button type="button" onClick={() => setInstrumentoOnline(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/25"><Piano className="h-4 w-4" />Instrumento online</button>
      </div>
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur" role="tablist" aria-label="Estúdio">
        {([["musicas", "Músicas"], ["criar", "Criar"], ["recebidas", "Recebidas"], ["drumcam", "Gravação"]] as const).map(([a, r]) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => mudarAba(a)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${aba === a ? "bg-gradient-to-r from-orange-500 to-pink-600 text-white shadow" : "text-[#b9aec6] hover:bg-white/[0.06] hover:text-white"}`}>
            {r}{a === "recebidas" && naoLidas > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white" aria-label={`${naoLidas} novas`}>{naoLidas}</span>}
          </button>
        ))}
      </div>
      {instrumentoOnline && <Suspense fallback={null}><PainelInstrumentoOnline onFechar={() => setInstrumentoOnline(false)} /></Suspense>}
      {aba === "drumcam" ? (
        <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</p>}>
          <div data-tema-fixo><DrumcamRepertorio /></div>
        </Suspense>
      ) : aba === "recebidas" ? (
        <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo…</p>}>
          <CifrasRecebidas musicas={musicas} onNaoLidas={setNaoLidas} onUsar={usarCifraRecebida} />
        </Suspense>
      ) : aba === "criar" ? (
        <Suspense fallback={<p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Abrindo o estúdio…</p>}>
          <EstudioRepertorio onMandado={(m, arquivo) => { mudarAba("musicas"); setAberta({ musica: m, arquivo }); }} />
        </Suspense>
      ) : (<>
      <input ref={entrada} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.opus" className="hidden" aria-label="Música para enviar"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void enviar(f); }} />
      <button type="button" onClick={() => entrada.current?.click()} disabled={enviando}
        onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void enviar(f); }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center hover:bg-slate-50 disabled:opacity-60">
        {enviando ? <Loader2 className="h-9 w-9 animate-spin text-slate-400" /> : <Upload className="h-9 w-9 text-slate-400" />}
        <span className="text-base font-bold text-slate-700">Enviar uma música</span>
        <span className="max-w-md text-xs text-slate-500">MP3, WAV, M4A, OGG ou FLAC, até {LIMITE_MB} MB. Reconheço o tom, o BPM, os acordes e o baixo; dá para mudar o tom e o andamento, separar as faixas e tocar junto com a cifra. Fica no NordTool (até 15 MB por música), abre em qualquer aparelho e todos podem tocar e editar; só quem enviou exclui.</span>
      </button>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {semConta && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Sem conexão com a conta agora: mostrando só as músicas deste aparelho.</p>}
      <h2 className="mb-2 mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Músicas de todos
        {uso && <span className="font-normal normal-case tracking-normal text-slate-400">· seu espaço: {uso}</span>}
      </h2>
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
                  {abrindo === m.id ? <Loader2 className="h-5 w-5 animate-spin" /> : m.analise ? tomExibido(m.analise.tom, notacao).cifra : <Music className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{m.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[m.artista, m.duracao ? relogio(m.duracao) : null, m.analise ? `${Math.round(m.analise.bpm)} BPM` : "ainda não analisada", m.cifra.trim() ? "com cifra" : null].filter(Boolean).join(" · ")}
                  </span>
                  {autoria.get(m.id) && <span className="block truncate text-[11px] text-slate-400">{textoAutoria(autoria.get(m.id))}</span>}
                </span>
              </button>
              <SeloConta situacao={situacao.get(m.id)} />
              {autoria.get(m.id)?.minha !== false && (
                <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${m.titulo}`}
                  onClick={async () => { if (window.confirm(`Excluir "${m.titulo}"? Ela sai do Estúdio de todos.`)) { await excluirMusica(m.id); void carregar(); } }}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      </>)}
    </div>
  );
}

/** Onde a música está guardada. */
function SeloConta({ situacao }: { situacao: SituacaoConta | undefined }) {
  if (!situacao) return null;
  if (situacao === "na-conta") return <span title="No NordTool: abre em qualquer aparelho, para todos" className="p-1 text-emerald-600"><Cloud className="h-4 w-4" aria-label="Na conta" /></span>;
  if (situacao === "enviando") return <span title="Enviando para a sua conta" className="p-1 text-blue-500"><Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando para a conta" /></span>;
  if (situacao === "so-aparelho") return <span title="Só neste aparelho: o áudio passa de 15 MB" className="p-1 text-amber-600"><CloudOff className="h-4 w-4" aria-label="Só neste aparelho" /></span>;
  return <span title="Não deu para enviar para a conta; tento de novo na próxima vez" className="p-1 text-red-500"><AlertTriangle className="h-4 w-4" aria-label="Falhou ao enviar" /></span>;
}
