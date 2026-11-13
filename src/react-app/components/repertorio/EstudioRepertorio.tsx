import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Circle, Copy, Download, Eraser, Loader2, Music, Play, Plus, Repeat, Send, Square, Timer, Trash2, Undo2, Volume2, VolumeX,
} from "lucide-react";

import InstrumentoOnline from "@/react-app/components/repertorio/InstrumentoOnline";
import { TocadorEstudio, renderizarProjeto } from "@/react-app/components/repertorio/tocadorEstudio";
import {
  LIMITES, PASSOS_POR_TEMPO, PECAS_BATERIA, TEMPOS_POR_COMPASSO, TIMBRES, alternarNota, duplicarCompassos, juntarGravacao, mudarCompassos,
  novaFaixa, novoProjeto, temposDoProjeto, timbre as dadosTimbre, type Faixa, type NotaEstudio, type Projeto, type Timbre,
} from "@/react-app/utils/musica/estudio";
import { corDaNota, ehPreta } from "@/react-app/utils/musica/instrumentos";
import { AJUSTES_PADRAO, excluirProjeto, listarProjetos, salvarArquivo, salvarMusica, salvarProjeto, type Musica } from "@/react-app/utils/musica/repertorioDb";
import { nomeDaNota } from "@/react-app/utils/musica/teoria";

const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const quadrado = "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40";
/** Botão quadrado de liga/desliga (sem misturar fundo branco e azul nas classes). */
const alternador = (ligado: boolean) => `inline-flex h-7 w-7 items-center justify-center rounded-lg border ${ligado ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`;
const DURACOES: Array<[number, string]> = [[0.25, "1/16"], [0.5, "1/8"], [1, "1 tempo"], [2, "2 tempos"], [4, "1 compasso"]];
const CORES_BATERIA: Record<number, string> = { 49: "#eab308", 46: "#84cc16", 42: "#22c55e", 48: "#06b6d4", 43: "#3b82f6", 39: "#a855f7", 38: "#ef4444", 36: "#f97316" };

/**
 * Repertório v6 — "Criar": a pessoa monta uma música faixa por faixa. Cada projeto fica no aparelho, com BPM e
 * compassos; cada faixa tem um instrumento, volume, mudo e solo, e as notas são escritas na grade (piano roll, ou o
 * sequenciador de passos na bateria) ou gravadas tocando o instrumento online com o metrônomo e as outras faixas.
 */
export default function EstudioRepertorio({ onMandado }: { onMandado: (m: Musica, arquivo: Blob) => void }) {
  const [projetos, setProjetos] = useState<Projeto[] | null>(null);
  const [aberto, setAberto] = useState<Projeto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try { setProjetos(await listarProjetos()); } catch (e) { setErro(e instanceof Error ? e.message : "Não deu para ler os projetos."); setProjetos([]); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const criar = async () => {
    const p = novoProjeto(`Música ${((projetos?.length ?? 0) + 1)}`);
    // começa com bateria e baixo, a base mais comum; dá para tirar ou trocar
    p.faixas = [novaFaixa("bateria"), novaFaixa("baixo")];
    await salvarProjeto(p).catch(() => undefined);
    setAberto(p);
  };

  if (aberto) return <EditorProjeto inicial={aberto} onVoltar={() => { setAberto(null); void carregar(); }} onMandado={onMandado} />;

  return (
    <div>
      <button type="button" onClick={() => void criar()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:bg-slate-50">
        <Plus className="h-8 w-8 text-slate-400" />
        <span className="text-base font-bold text-slate-700">Criar uma música</span>
        <span className="max-w-md text-xs text-slate-500">Adicione as faixas uma por uma (bateria, baixo, teclado, violão, sintetizador), escreva as notas na grade ou grave tocando. Fica guardada só neste aparelho.</span>
      </button>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <h2 className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">Minhas criações</h2>
      {projetos === null ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : projetos.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Nenhuma criação ainda.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Criações">
          {projetos.map(p => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 hover:border-violet-300">
              <button type="button" onClick={() => setAberto(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ${p.titulo}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Music className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{p.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">{p.bpm} BPM · {p.compassos} compasso{p.compassos > 1 ? "s" : ""} · {p.faixas.length} faixa{p.faixas.length === 1 ? "" : "s"}</span>
                </span>
              </button>
              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${p.titulo}`}
                onClick={async () => { if (window.confirm(`Excluir "${p.titulo}" deste aparelho?`)) { await excluirProjeto(p.id).catch(() => undefined); void carregar(); } }}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- editor de um projeto

function EditorProjeto({ inicial, onVoltar, onMandado }: { inicial: Projeto; onVoltar: () => void; onMandado: (m: Musica, arquivo: Blob) => void }) {
  const [p, setP] = useState(inicial);
  const [historico, setHistorico] = useState<Projeto[]>([]);
  const [sel, setSel] = useState<string | null>(inicial.faixas[0]?.id ?? null);
  const [tocando, setTocando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [laco, setLaco] = useState(false);
  const [metronomo, setMetronomo] = useState(true);
  const [dur, setDur] = useState(1);
  const [grade, setGrade] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const tocador = useRef<TocadorEstudio | null>(null);
  // o tocador (e o áudio dele) nasce no efeito e fecha na limpeza: no modo estrito o React monta duas vezes
  const [tocadorPronto, setTocadorPronto] = useState<TocadorEstudio | null>(null);
  const projetoAtual = useRef(inicial);
  const gravadas = useRef<NotaEstudio[]>([]);
  const cabeca = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);

  const faixa = p.faixas.find(f => f.id === sel) ?? null;
  const total = temposDoProjeto(p);

  /** Toda mudança passa aqui: guarda o passo para desfazer e o tocador já usa a versão nova. */
  const mudar = useCallback((fn: (x: Projeto) => Projeto, guardar = true) => {
    setP(atual => {
      const novo = fn(atual);
      if (novo === atual) return atual;
      if (guardar) setHistorico(h => [...h.slice(-49), atual]);
      return novo;
    });
  }, []);
  const mudarFaixa = (id: string, m: Partial<Faixa>, guardar = true) => mudar(x => ({ ...x, faixas: x.faixas.map(f => (f.id === id ? { ...f, ...m } : f)) }), guardar);
  const desfazer = () => setHistorico(h => { if (!h.length) return h; setP(h[h.length - 1]); return h.slice(0, -1); });

  projetoAtual.current = p;
  useEffect(() => {
    const t = new TocadorEstudio(projetoAtual.current);
    tocador.current = t;
    setTocadorPronto(t);
    return () => { t.fechar(); tocador.current = null; };
  }, []);
  useEffect(() => { tocador.current?.atualizar(p); }, [p, tocadorPronto]);
  useEffect(() => { if (tocador.current) { tocador.current.laco = laco && !gravando; tocador.current.metronomo = metronomo; } }, [laco, metronomo, gravando, tocadorPronto]);
  // salva sozinho
  useEffect(() => { const t = window.setTimeout(() => void salvarProjeto(p).catch(() => setAviso("Não deu para salvar no aparelho.")), 500); return () => window.clearTimeout(t); }, [p]);

  const terminarGravacao = useCallback(() => {
    if (!gravando && !gravadas.current.length) return;
    const notas = gravadas.current;
    gravadas.current = [];
    setGravando(false);
    if (notas.length && sel) mudar(x => ({ ...x, faixas: x.faixas.map(f => (f.id === sel ? { ...f, notas: juntarGravacao(f.notas, notas, temposDoProjeto(x), grade ? 1 / PASSOS_POR_TEMPO : 0) } : f)) }));
  }, [gravando, sel, grade, mudar]);

  useEffect(() => {
    if (tocadorPronto) tocadorPronto.aoParar = () => { setTocando(false); terminarGravacao(); };
  }, [terminarGravacao, tocadorPronto]);

  const tocarParar = async () => {
    const t = tocador.current;
    if (!t) return;
    if (t.tocando) { t.parar(); setTocando(false); terminarGravacao(); return; }
    await t.tocar(Math.max(0, t.posicao() >= total ? 0 : t.posicao()));
    setTocando(true);
  };
  const gravar = async () => {
    const t = tocador.current;
    if (!t) return;
    if (!faixa) { setAviso("Adicione uma faixa para gravar nela."); return; }
    if (gravando) { t.parar(); setTocando(false); terminarGravacao(); return; }
    gravadas.current = [];
    t.laco = false;
    await t.tocar(0, true);
    setGravando(true); setTocando(true);
    setAviso(`Gravando em "${faixa.nome}": um compasso de contagem e pode tocar.`);
  };
  const aoTocar = (midi: number, vel: number, inicio: number, fim: number) => {
    const t = tocador.current;
    if (!t || !gravando || !t.tocando) return;
    const a = t.tempoNoRelogio(inicio), b = t.tempoNoRelogio(fim);
    if (a < -0.25) return;
    gravadas.current.push({ inicio: Math.max(0, a), dur: Math.max(0.05, b - a), midi, vel });
  };

  // a linha que anda na grade
  useEffect(() => {
    let id = 0;
    const passo = () => {
      id = requestAnimationFrame(passo);
      const t = tocador.current, c = cabeca.current;
      if (!t || !c) return;
      const pos = t.posicao();
      c.style.transform = `translateX(${Math.max(0, pos) * PASSOS_POR_TEMPO * LARG_PASSO}px)`;
      c.style.opacity = pos < 0 ? "0" : "1";
      const r = rolagem.current;
      if (t.tocando && r && pos >= 0) {
        const x = pos * PASSOS_POR_TEMPO * LARG_PASSO + ROTULO;
        if (x > r.scrollLeft + r.clientWidth - 40 || x < r.scrollLeft + ROTULO) r.scrollLeft = x - ROTULO - 20;
      }
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, []);

  const exportar = async (mandar: boolean) => {
    if (!p.faixas.some(f => f.notas.length)) { setAviso("Escreva ou grave alguma nota antes."); return; }
    setOcupado(mandar ? "Mandando para Músicas" : "Gerando o WAV");
    try {
      const wav = await renderizarProjeto(p);
      if (mandar) {
        const agora = new Date().toISOString();
        const m: Musica = {
          id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, titulo: p.titulo, artista: "Criada no NordTool", criadaEm: agora, atualizadaEm: agora,
          nomeArquivo: `${p.titulo}.wav`, tamanho: wav.size, duracao: 0, analise: null, cifra: "", tempos: null, ajustes: { ...AJUSTES_PADRAO },
        };
        await salvarArquivo(m.id, wav);
        await salvarMusica(m);
        tocador.current?.parar();
        onMandado(m, wav);
      } else {
        const url = URL.createObjectURL(wav);
        const a = document.createElement("a");
        a.href = url; a.download = `${p.titulo.replace(/[\\/:*?"<>|]+/g, "-")}.wav`;
        document.body.appendChild(a); a.click(); a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setAviso("WAV baixado.");
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não deu para gerar o áudio.");
    } finally {
      setOcupado(null);
    }
  };

  // atalhos: espaço toca/para, Ctrl+Z desfaz
  const tocarRef = useRef(tocarParar);
  tocarRef.current = tocarParar;
  const desfazerRef = useRef(desfazer);
  desfazerRef.current = desfazer;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === " ") { e.preventDefault(); void tocarRef.current(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); desfazerRef.current(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const adicionar = (t: Timbre) => {
    if (p.faixas.length >= LIMITES.faixasMax) { setAviso(`No máximo ${LIMITES.faixasMax} faixas.`); return; }
    const f = novaFaixa(t, p.faixas);
    mudar(x => ({ ...x, faixas: [...x.faixas, f] }));
    setSel(f.id);
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-2">
      {/* cabeçalho e transporte */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button type="button" className={botao} onClick={() => { tocador.current?.parar(); onVoltar(); }}><ArrowLeft className="h-3.5 w-3.5" />Criações</button>
        <input value={p.titulo} onChange={e => mudar(x => ({ ...x, titulo: e.target.value.slice(0, 80) }), false)} aria-label="Nome da música"
          className="min-w-[10rem] flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none sm:max-w-xs" />
        <button type="button" onClick={() => void tocarParar()} aria-label={tocando ? "Parar" : "Tocar"} title="Tocar / parar (espaço)"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700">{tocando ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <button type="button" onClick={() => void gravar()} aria-pressed={gravando} aria-label={gravando ? "Parar de gravar" : "Gravar"} title="Grava tocando o instrumento na faixa escolhida (com um compasso de contagem)"
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${gravando ? "animate-pulse bg-red-600 text-white" : "border border-red-200 bg-white text-red-600 hover:bg-red-50"}`}>
          <Circle className={`h-3.5 w-3.5 ${gravando ? "fill-white" : "fill-red-600"}`} />{gravando ? "Gravando" : "Gravar"}
        </button>
        <button type="button" onClick={() => setLaco(v => !v)} aria-pressed={laco} title="Repetir a música" aria-label="Repetir a música" className={alternador(laco)}><Repeat className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => setMetronomo(v => !v)} aria-pressed={metronomo} title="Metrônomo" aria-label="Metrônomo" className={alternador(metronomo)}><Timer className="h-3.5 w-3.5" /></button>
        <label className="flex items-center gap-1 text-xs font-bold text-slate-600">BPM
          <input type="number" min={LIMITES.bpmMin} max={LIMITES.bpmMax} value={p.bpm} aria-label="BPM"
            onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) mudar(x => ({ ...x, bpm: Math.min(LIMITES.bpmMax, Math.max(LIMITES.bpmMin, Math.round(v))) }), false); }}
            className="w-14 rounded-lg border border-slate-200 px-1.5 py-1 text-xs" />
        </label>
        <label className="flex items-center gap-1 text-xs font-bold text-slate-600">Compassos
          <input type="number" min={1} max={LIMITES.compassosMax} value={p.compassos} aria-label="Compassos"
            onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 1) mudar(x => mudarCompassos(x, v)); }}
            className="w-12 rounded-lg border border-slate-200 px-1.5 py-1 text-xs" />
        </label>
        <button type="button" className={botao} title="Repete todos os compassos no fim (dobra a música)" onClick={() => mudar(x => duplicarCompassos(x, 0, x.compassos))} disabled={p.compassos * 2 > LIMITES.compassosMax}><Copy className="h-3.5 w-3.5" />Dobrar</button>
        <button type="button" className={quadrado} onClick={desfazer} disabled={!historico.length} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
        <span className="ml-auto flex gap-1.5">
          <button type="button" className={botao} onClick={() => void exportar(false)} disabled={!!ocupado}><Download className="h-3.5 w-3.5" />WAV</button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40" onClick={() => void exportar(true)} disabled={!!ocupado}
            title="Gera o áudio e abre no player do Repertório (cifra, análise, mapa do braço)"><Send className="h-3.5 w-3.5" />Mandar para Músicas</button>
        </span>
      </div>
      {aviso && <p role="status" className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs text-blue-800"><span className="flex-1">{aviso}</span><button type="button" onClick={() => setAviso(null)} className="font-bold">OK</button></p>}

      {/* faixas */}
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
          <b className="mr-auto text-sm text-slate-700">Faixas</b>
          {TIMBRES.map(t => <button key={t.id} type="button" className={botao} onClick={() => adicionar(t.id)}><Plus className="h-3 w-3" />{t.nome}</button>)}
        </div>
        {p.faixas.length === 0 ? <p className="p-2 text-xs text-slate-500">Adicione a primeira faixa acima.</p> : (
          <ul className="flex flex-col gap-1" aria-label="Faixas">
            {p.faixas.map(f => (
              <li key={f.id} className={`flex items-center gap-1.5 rounded-lg border px-1.5 py-1 ${f.id === sel ? "border-violet-400 bg-violet-50" : "border-slate-200"}`}>
                <button type="button" onClick={() => setSel(f.id)} aria-pressed={f.id === sel} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Editar ${f.nome}`}>
                  <span className="w-20 shrink-0 truncate text-xs font-bold text-slate-800 sm:w-28">{f.nome}</span>
                  <MiniFaixa faixa={f} total={total} />
                </button>
                <input type="range" min={0} max={1.5} step={0.05} value={f.volume} onChange={e => mudarFaixa(f.id, { volume: Number(e.target.value) }, false)} aria-label={`Volume de ${f.nome}`} className="w-14 sm:w-20" />
                <button type="button" aria-pressed={f.mudo} aria-label={f.mudo ? `Ligar ${f.nome}` : `Silenciar ${f.nome}`} onClick={() => mudarFaixa(f.id, { mudo: !f.mudo }, false)}
                  className={`rounded p-1 ${f.mudo ? "text-red-500" : "text-slate-500 hover:bg-slate-100"}`}>{f.mudo ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</button>
                <button type="button" aria-pressed={f.solo} onClick={() => mudarFaixa(f.id, { solo: !f.solo }, false)} title={`Ouvir só ${f.nome}`}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.solo ? "bg-amber-400 text-white" : "text-slate-500 hover:bg-slate-100"}`}>S</button>
                <button type="button" aria-label={`Excluir ${f.nome}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() => { if (!f.notas.length || window.confirm(`Excluir a faixa "${f.nome}"?`)) { mudar(x => ({ ...x, faixas: x.faixas.filter(o => o.id !== f.id) })); if (sel === f.id) setSel(null); } }}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* grade da faixa escolhida + instrumento */}
      {faixa && (
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
            <b className="mr-auto text-sm text-slate-700">{faixa.nome} <span className="font-normal text-slate-400">· {dadosTimbre(faixa.timbre).nome}</span></b>
            {faixa.timbre !== "bateria" && (
              <label className="flex items-center gap-1 text-[11px] text-slate-600">Nota nova
                <select value={dur} onChange={e => setDur(Number(e.target.value))} aria-label="Duração da nota nova" className="rounded-lg border border-slate-200 px-1.5 py-1 text-[11px]">
                  {DURACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1 text-[11px] text-slate-600" title="Na gravação, encaixa as notas na grade (semicolcheias)"><input type="checkbox" checked={grade} onChange={e => setGrade(e.target.checked)} />Encaixar na grade</label>
            <button type="button" className={botao} onClick={() => mudarFaixa(faixa.id, { notas: [] })} disabled={!faixa.notas.length}><Eraser className="h-3.5 w-3.5" />Limpar</button>
          </div>
          <div ref={rolagem} className="relative max-h-[42vh] overflow-auto rounded-lg border border-slate-200">
            <Grade faixa={faixa} total={total} cabeca={cabeca}
              onCelula={(midi, inicio) => {
                const d = faixa.timbre === "bateria" ? 1 / PASSOS_POR_TEMPO : dur;
                const notas = alternarNota(faixa.notas, midi, inicio, d, total);
                mudarFaixa(faixa.id, { notas });
                // ouvir a nota que entrou
                if (notas.length > faixa.notas.length) tocador.current?.sint.tocar(faixa.timbre, midi, 0, Math.min(0.5, d * 0.6), 0, 0.85, tocador.current.ganhoDaFaixa(faixa.id));
              }} />
          </div>
          {tocadorPronto && (
            <div className="mt-2">
              <InstrumentoOnline sint={tocadorPronto.sint} timbre={faixa.timbre} destino={tocadorPronto.ganhoDaFaixa(faixa.id)} aoTocar={aoTocar} />
            </div>
          )}
        </div>
      )}

      {ocupado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="status" aria-live="polite">
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 text-center shadow-2xl">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-600" />
            <p className="mt-2 text-sm font-bold text-slate-800">{ocupado}…</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- grade (piano roll / bateria)

const LARG_PASSO = 22, ROTULO = 64;

function linhasDaFaixa(f: Faixa): Array<{ midi: number; rotulo: string; preta: boolean }> {
  if (f.timbre === "bateria") return PECAS_BATERIA.map(p => ({ midi: p.midi, rotulo: p.nome, preta: false }));
  // a extensão do instrumento, aumentada para caber as notas gravadas fora dela
  let [lo, hi] = dadosTimbre(f.timbre).faixa;
  for (const n of f.notas) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  const r: Array<{ midi: number; rotulo: string; preta: boolean }> = [];
  for (let m = hi; m >= lo; m--) r.push({ midi: m, rotulo: `${nomeDaNota(m)}${Math.floor(m / 12) - 1}`, preta: ehPreta(m) });
  return r;
}

function Grade({ faixa, total, cabeca, onCelula }: { faixa: Faixa; total: number; cabeca: React.RefObject<HTMLDivElement | null>; onCelula: (midi: number, inicio: number) => void }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const linhas = useMemo(() => linhasDaFaixa(faixa), [faixa]);
  const altLinha = faixa.timbre === "bateria" ? 28 : 18;
  const passos = total * PASSOS_POR_TEMPO;
  const larg = passos * LARG_PASSO, alt = linhas.length * altLinha;
  const escuro = typeof document !== "undefined" && document.documentElement.classList.contains("nt-escuro");

  useLayoutEffect(() => {
    const c = tela.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(larg * dpr); c.height = Math.round(alt * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = escuro ? "#0f172a" : "#ffffff";
    ctx.fillRect(0, 0, larg, alt);
    linhas.forEach((l, i) => {
      if (l.preta) { ctx.fillStyle = escuro ? "#1e293b" : "#f1f5f9"; ctx.fillRect(0, i * altLinha, larg, altLinha); }
      ctx.fillStyle = escuro ? "#1e293b" : "#e2e8f0"; ctx.fillRect(0, (i + 1) * altLinha - 0.5, larg, 0.5);
    });
    for (let s = 0; s <= passos; s++) {
      const forte = s % (PASSOS_POR_TEMPO * TEMPOS_POR_COMPASSO) === 0, tempo = s % PASSOS_POR_TEMPO === 0;
      ctx.fillStyle = forte ? (escuro ? "#64748b" : "#64748b") : tempo ? (escuro ? "#334155" : "#cbd5e1") : (escuro ? "#1e293b" : "#eef2f7");
      ctx.fillRect(s * LARG_PASSO - (forte ? 1 : 0.5), 0, forte ? 2 : 1, alt);
    }
    // números dos compassos
    ctx.fillStyle = escuro ? "#94a3b8" : "#94a3b8"; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
    for (let b = 0; b < total / TEMPOS_POR_COMPASSO; b++) ctx.fillText(String(b + 1), b * TEMPOS_POR_COMPASSO * PASSOS_POR_TEMPO * LARG_PASSO + 3, 9);
    const linhaDe = new Map(linhas.map((l, i) => [l.midi, i]));
    for (const n of faixa.notas) {
      const i = linhaDe.get(n.midi);
      if (i === undefined) continue;
      const x = n.inicio * PASSOS_POR_TEMPO * LARG_PASSO, w = Math.max(6, n.dur * PASSOS_POR_TEMPO * LARG_PASSO - 2), y = i * altLinha + 2, h = altLinha - 4;
      const cor = faixa.timbre === "bateria" ? CORES_BATERIA[n.midi] ?? "#64748b" : corDaNota(nomeDaNota(n.midi)).fundo;
      ctx.fillStyle = cor; ctx.globalAlpha = 0.5 + n.vel * 0.5;
      ctx.beginPath(); ctx.roundRect(x + 1, y, w, h, 4); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [faixa, linhas, larg, alt, altLinha, passos, total, escuro]);

  // começa mostrando o meio da extensão (melódicos)
  useEffect(() => {
    const r = tela.current?.closest(".overflow-auto") as HTMLElement | null;
    if (r && faixa.timbre !== "bateria") r.scrollTop = Math.max(0, alt / 2 - r.clientHeight / 2);
  }, [faixa.id, faixa.timbre, alt]);

  return (
    <div className="flex w-max" style={{ minWidth: "100%" }}>
      <div className="sticky left-0 z-20 shrink-0 border-r border-slate-200 bg-white" style={{ width: ROTULO }} aria-hidden="true">
        {linhas.map(l => (
          <div key={l.midi} className={`flex items-center truncate px-1.5 text-[10px] font-bold ${l.preta ? "bg-slate-100 text-slate-500" : "text-slate-600"}`} style={{ height: altLinha }}>{l.rotulo}</div>
        ))}
      </div>
      <div className="relative">
        <canvas ref={tela} style={{ width: larg, height: alt }} aria-label={`Grade de notas de ${faixa.nome}`} role="img" className="cursor-pointer"
          onPointerDown={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const passo = Math.floor((e.clientX - r.left) / LARG_PASSO), linha = Math.floor((e.clientY - r.top) / altLinha);
            const l = linhas[linha];
            if (!l || passo < 0 || passo >= passos) return;
            onCelula(l.midi, passo / PASSOS_POR_TEMPO);
          }} />
        <div ref={cabeca} className="pointer-events-none absolute bottom-0 left-0 top-0 w-0.5 bg-red-500" aria-hidden="true" />
      </div>
    </div>
  );
}

/** As notas da faixa em miniatura, na linha da lista. */
function MiniFaixa({ faixa, total }: { faixa: Faixa; total: number }) {
  return (
    <span className="relative block h-5 min-w-0 flex-1 overflow-hidden rounded bg-slate-100">
      {faixa.notas.slice(0, 600).map((n, i) => (
        <span key={i} className="absolute top-1 h-3 rounded-sm" style={{
          left: `${(n.inicio / total) * 100}%`, width: `${Math.max(0.6, (n.dur / total) * 100)}%`,
          background: faixa.timbre === "bateria" ? CORES_BATERIA[n.midi] ?? "#64748b" : corDaNota(nomeDaNota(n.midi)).fundo,
        }} />
      ))}
    </span>
  );
}
