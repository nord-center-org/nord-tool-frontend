import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BoxSelect, Circle, ClipboardPaste, Copy, CopyPlus, Download, Eraser, Loader2, Music, Pencil, Play, Plus, Repeat, Scissors, Send, Square, Timer, Trash2, Undo2,
  Volume2, VolumeX,
} from "lucide-react";

import InstrumentoOnline from "@/react-app/components/repertorio/InstrumentoOnline";
import { TocadorEstudio, renderizarProjeto } from "@/react-app/components/repertorio/tocadorEstudio";
import {
  LIMITES, PASSOS_POR_TEMPO, PECAS_BATERIA, TEMPOS_POR_COMPASSO, TIMBRES, apagarNotas, chaveNota, colarNotas, copiarNotas, duplicarCompassos, esticarNota,
  juntarGravacao, moverNotas, mudarCompassos, notasNoRetangulo, porNota, type Recorte,
  novaFaixa, novoProjeto, temposDoProjeto, timbre as dadosTimbre, type Faixa, type NotaEstudio, type Projeto, type Timbre,
} from "@/react-app/utils/musica/estudio";
import { corDaNota, ehPreta } from "@/react-app/utils/musica/instrumentos";
import { AJUSTES_PADRAO, salvarArquivo, salvarMusica, type Musica } from "@/react-app/utils/musica/repertorioDb";
import { abrirProjeto, enviarMusica, excluirProjeto, guardarProjeto, sincronizarProjetos } from "@/react-app/components/repertorio/sincronizacao";
import { nomeDaNota } from "@/react-app/utils/musica/teoria";
import { nomeDaNotaExibida, type Notacao } from "@/react-app/utils/musica/notacao";
import { useNotacao } from "./useNotacao";

const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const quadrado = "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40";
/** Botão quadrado de liga/desliga (sem misturar fundo branco e azul nas classes). */
const alternador = (ligado: boolean) => `inline-flex h-7 w-7 items-center justify-center rounded-lg border ${ligado ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`;
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
  const [semConta, setSemConta] = useState(false);

  // v7: as criações da conta (de qualquer aparelho) junto com as deste aparelho
  const carregar = useCallback(async () => {
    try { const r = await sincronizarProjetos(); setProjetos(r.projetos); setSemConta(r.semConta); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não deu para ler os projetos."); setProjetos([]); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const criar = async () => {
    const p = novoProjeto(`Música ${((projetos?.length ?? 0) + 1)}`);
    // começa com bateria e baixo, a base mais comum; dá para tirar ou trocar
    p.faixas = [novaFaixa("bateria"), novaFaixa("baixo")];
    setAberto(await guardarProjeto(p).catch(() => p));
  };

  if (aberto) return <EditorProjeto inicial={aberto} onVoltar={() => { setAberto(null); void carregar(); }} onMandado={onMandado} />;

  return (
    <div>
      <button type="button" onClick={() => void criar()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center hover:bg-slate-50">
        <Plus className="h-8 w-8 text-slate-400" />
        <span className="text-base font-bold text-slate-700">Criar uma música</span>
        <span className="max-w-md text-xs text-slate-500">Adicione as faixas uma por uma (bateria, baixo, teclado, violão, sintetizador), escreva as notas na grade ou grave tocando. Fica guardada na sua conta: abre em qualquer aparelho.</span>
      </button>
      {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {semConta && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Sem conexão com a conta agora: mostrando só as criações deste aparelho.</p>}
      <h2 className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">Minhas criações</h2>
      {projetos === null ? (
        <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : projetos.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Nenhuma criação ainda.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Criações">
          {projetos.map(p => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 hover:border-violet-300">
              <button type="button" onClick={async () => setAberto((await abrirProjeto(p.id, semConta).catch(() => null)) ?? p)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Abrir ${p.titulo}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Music className="h-5 w-5" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{p.titulo}</span>
                  <span className="block truncate text-xs text-slate-500">{p.bpm} BPM · {p.compassos} compasso{p.compassos > 1 ? "s" : ""} · {p.faixas.length} faixa{p.faixas.length === 1 ? "" : "s"}</span>
                </span>
              </button>
              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Excluir ${p.titulo}`}
                onClick={async () => { if (window.confirm(`Excluir "${p.titulo}"? Ela sai deste aparelho e da sua conta.`)) { await excluirProjeto(p.id); void carregar(); } }}>
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
  // v9: pôr notas ou selecionar (copiar, colar, mover); a seleção é da faixa aberta e o recorte serve a qualquer faixa
  const [modo, setModo] = useState<"por" | "selecionar">("por");
  const [selNotas, setSelNotas] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState(0);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
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
  const atualP = useRef(p);
  atualP.current = p;
  const guardarPasso = () => setHistorico(h => [...h.slice(-49), atualP.current]);

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
  // salva sozinho: no aparelho e, logo depois, na conta
  useEffect(() => { const t = window.setTimeout(() => void guardarProjeto(p).catch(() => setAviso("Não deu para salvar no aparelho.")), 500); return () => window.clearTimeout(t); }, [p]);

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
          // v7: na conta vai só a referência à criação; o áudio é refeito dela em outro aparelho
          projeto: p.id,
        };
        await guardarProjeto(p);
        await salvarArquivo(m.id, wav);
        void enviarMusica(await salvarMusica(m), false).catch(() => undefined);
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
      else if (acoesRef.current(e)) e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // ---------- v9: seleção, copiar, colar, mover ----------
  useEffect(() => { setSelNotas(new Set()); }, [faixa?.id]);
  const copiar = (recortar = false) => {
    if (!faixa) return;
    const r = copiarNotas(faixa.notas, selNotas);
    if (!r) { setAviso("Selecione as notas primeiro (modo Selecionar)."); return; }
    setRecorte(r);
    if (recortar) { mudarFaixa(faixa.id, { notas: apagarNotas(faixa.notas, selNotas) }); setSelNotas(new Set()); }
    setAviso(`${r.notas.length} nota${r.notas.length > 1 ? "s" : ""} ${recortar ? "recortada" : "copiada"}${r.notas.length > 1 ? "s" : ""}. Clique onde quer colar (ponto azul) e toque em Colar.`);
  };
  const colar = (em = cursor) => {
    if (!faixa || !recorte) return;
    const r = colarNotas(faixa.notas, recorte, em, total);
    mudarFaixa(faixa.id, { notas: r.notas });
    setSelNotas(r.sel);
    setCursor(Math.min(total - 1 / PASSOS_POR_TEMPO, em + recorte.duracao));
  };
  const duplicar = () => {
    if (!faixa) return;
    const r = copiarNotas(faixa.notas, selNotas);
    if (!r) return;
    const ini = Math.min(...faixa.notas.filter(n => selNotas.has(chaveNota(n))).map(n => n.inicio));
    // logo depois do trecho, arredondado para o próximo tempo
    const em = Math.ceil((ini + r.duracao) * 1 - 1e-9);
    setRecorte(r);
    const c = colarNotas(faixa.notas, r, em, total);
    mudarFaixa(faixa.id, { notas: c.notas });
    setSelNotas(c.sel);
  };
  const apagar = () => { if (faixa && selNotas.size) { mudarFaixa(faixa.id, { notas: apagarNotas(faixa.notas, selNotas) }); setSelNotas(new Set()); } };
  const mover = (dt: number, dm: number) => {
    if (!faixa || !selNotas.size) return;
    const r = moverNotas(faixa.notas, selNotas, dt, dm, total);
    if (r.notas !== faixa.notas) { mudarFaixa(faixa.id, { notas: r.notas }); setSelNotas(r.sel); }
  };
  const acoes = (e: KeyboardEvent): boolean => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && k === "c") { copiar(); return true; }
    if (ctrl && k === "x") { copiar(true); return true; }
    if (ctrl && k === "v") { colar(); return true; }
    if (ctrl && k === "d") { duplicar(); return true; }
    if (ctrl && k === "a" && faixa) { setModo("selecionar"); setSelNotas(new Set(faixa.notas.map(chaveNota))); return true; }
    if (!selNotas.size) return false;
    if (e.key === "Delete" || e.key === "Backspace") { apagar(); return true; }
    const passo = e.shiftKey ? 1 : 1 / PASSOS_POR_TEMPO;
    if (e.key === "ArrowLeft") { mover(-passo, 0); return true; }
    if (e.key === "ArrowRight") { mover(passo, 0); return true; }
    if (e.key === "ArrowUp") { mover(0, e.shiftKey ? 12 : 1); return true; }
    if (e.key === "ArrowDown") { mover(0, e.shiftKey ? -12 : -1); return true; }
    if (e.key === "Escape") { setSelNotas(new Set()); return true; }
    return false;
  };
  const acoesRef = useRef(acoes);
  acoesRef.current = acoes;

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
            <div className="flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="O que o clique na grade faz">
              {([["por", "Pôr notas", Pencil], ["selecionar", "Selecionar", BoxSelect]] as const).map(([id, r, Icone]) => (
                <button key={id} type="button" role="radio" aria-checked={modo === id} onClick={() => setModo(id)}
                  title={id === "por" ? "Clique põe (ou tira) uma nota de um quadradinho; arraste para o lado para esticar" : "Clique numa nota ou arraste um retângulo para selecionar; arraste a seleção para mover"}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${modo === id ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icone className="h-3.5 w-3.5" />{r}</button>
              ))}
            </div>
            {modo === "selecionar" && (
              <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Seleção">
                <button type="button" className={botao} onClick={() => copiar()} disabled={!selNotas.size} title="Copiar (Ctrl+C)"><Copy className="h-3.5 w-3.5" />Copiar</button>
                <button type="button" className={botao} onClick={() => copiar(true)} disabled={!selNotas.size} title="Recortar (Ctrl+X)"><Scissors className="h-3.5 w-3.5" />Recortar</button>
                <button type="button" className={botao} onClick={() => colar()} disabled={!recorte} title="Colar no ponto azul (Ctrl+V); serve também em outra faixa"><ClipboardPaste className="h-3.5 w-3.5" />Colar</button>
                <button type="button" className={botao} onClick={duplicar} disabled={!selNotas.size} title="Repetir logo depois (Ctrl+D)"><CopyPlus className="h-3.5 w-3.5" />Duplicar</button>
                <button type="button" className={botao} onClick={apagar} disabled={!selNotas.size} title="Apagar (Delete)"><Trash2 className="h-3.5 w-3.5" />Apagar</button>
                <span className="text-[11px] text-slate-500">{selNotas.size ? `${selNotas.size} selecionada${selNotas.size > 1 ? "s" : ""} · setas movem` : "Arraste um retângulo"}</span>
              </div>
            )}
            <label className="flex items-center gap-1 text-[11px] text-slate-600" title="Na gravação, encaixa as notas na grade (semicolcheias)"><input type="checkbox" checked={grade} onChange={e => setGrade(e.target.checked)} />Encaixar na grade</label>
            <button type="button" className={botao} onClick={() => mudarFaixa(faixa.id, { notas: [] })} disabled={!faixa.notas.length}><Eraser className="h-3.5 w-3.5" />Limpar</button>
          </div>
          <div ref={rolagem} className="relative max-h-[42vh] overflow-auto rounded-lg border border-slate-200">
            <Grade faixa={faixa} total={total} cabeca={cabeca} modo={modo} sel={selNotas} cursor={cursor}
              onPor={(midi, inicio) => {
                const r = porNota(faixa.notas, midi, inicio, inicio, total);
                mudarFaixa(faixa.id, { notas: r.notas });
                // ouvir a nota que entrou
                if (r.entrou) tocador.current?.sint.tocar(faixa.timbre, midi, 0, 0.3, 0, 0.85, tocador.current.ganhoDaFaixa(faixa.id), faixa.variante);
                return r.entrou && faixa.timbre !== "bateria";
              }}
              onEsticar={(midi, inicio, ate) => mudarFaixa(faixa.id, { notas: esticarNota(atualP.current.faixas.find(f => f.id === faixa.id)?.notas ?? [], midi, inicio, ate, total) }, false)}
              onRetangulo={(t0, t1, m0, m1, somar) => {
                const novas = notasNoRetangulo(faixa.notas, t0, t1, m0, m1);
                setSelNotas(s => (somar ? new Set([...s, ...novas]) : novas));
              }}
              onClicarNota={(chave, somar) => setSelNotas(s => { if (somar) { const n = new Set(s); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; } return s.has(chave) ? s : new Set([chave]); })}
              onCursor={t => { setCursor(t); setSelNotas(new Set()); }}
              onArrastoInicio={guardarPasso}
              onArrasto={(base, selBase, dt, dm) => { const r = moverNotas(base, selBase, dt, dm, total); mudarFaixa(faixa.id, { notas: r.notas }, false); setSelNotas(r.sel); }} />
          </div>
          {tocadorPronto && (
            <div className="mt-2">
              <InstrumentoOnline sint={tocadorPronto.sint} timbre={faixa.timbre} destino={tocadorPronto.ganhoDaFaixa(faixa.id)} aoTocar={aoTocar}
                variante={faixa.variante} onVariante={v => mudarFaixa(faixa.id, { variante: v })} />
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

function linhasDaFaixa(f: Faixa, notacao: Notacao): Array<{ midi: number; rotulo: string; preta: boolean }> {
  if (f.timbre === "bateria") return PECAS_BATERIA.map(p => ({ midi: p.midi, rotulo: p.nome, preta: false }));
  // a extensão do instrumento, aumentada para caber as notas gravadas fora dela
  let [lo, hi] = dadosTimbre(f.timbre).faixa;
  for (const n of f.notas) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  const r: Array<{ midi: number; rotulo: string; preta: boolean }> = [];
  for (let m = hi; m >= lo; m--) r.push({ midi: m, rotulo: `${nomeDaNotaExibida(m, notacao)}${Math.floor(m / 12) - 1}`, preta: ehPreta(m) });
  return r;
}

interface PropsGrade {
  faixa: Faixa; total: number; cabeca: React.RefObject<HTMLDivElement | null>;
  modo: "por" | "selecionar"; sel: Set<string>; cursor: number;
  /** Põe ou tira a nota; devolve se entrou uma que dá para esticar arrastando. */
  onPor: (midi: number, inicio: number) => boolean;
  onEsticar: (midi: number, inicio: number, ate: number) => void;
  onRetangulo: (t0: number, t1: number, m0: number, m1: number, somar: boolean) => void;
  onClicarNota: (chave: string, somar: boolean) => void;
  onCursor: (t: number) => void;
  onArrastoInicio: () => void;
  onArrasto: (base: NotaEstudio[], sel: Set<string>, dt: number, dm: number) => void;
}

type Gesto =
  | { tipo: "esticar"; midi: number; inicio: number }
  | { tipo: "retangulo"; x0: number; y0: number; x1: number; y1: number; somar: boolean }
  | { tipo: "mover"; passo0: number; linha0: number; base: NotaEstudio[]; sel: Set<string>; moveu: boolean };

function Grade({ faixa, total, cabeca, modo, sel, cursor, onPor, onEsticar, onRetangulo, onClicarNota, onCursor, onArrastoInicio, onArrasto }: PropsGrade) {
  const tela = useRef<HTMLCanvasElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const [caixa, setCaixa] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const notacao = useNotacao();
  const linhas = useMemo(() => linhasDaFaixa(faixa, notacao), [faixa, notacao]);
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
      ctx.fillStyle = forte ? "#64748b" : tempo ? (escuro ? "#334155" : "#cbd5e1") : (escuro ? "#1e293b" : "#eef2f7");
      ctx.fillRect(s * LARG_PASSO - (forte ? 1 : 0.5), 0, forte ? 2 : 1, alt);
    }
    ctx.fillStyle = "#94a3b8"; ctx.font = "9px sans-serif"; ctx.textAlign = "left";
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
      // selecionada: contorno escuro e grosso
      if (sel.has(chaveNota(n))) { ctx.strokeStyle = escuro ? "#f8fafc" : "#0f172a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x + 1, y, w, h, 4); ctx.stroke(); }
    }
    // ponto de colar (modo selecionar)
    if (modo === "selecionar") {
      const x = cursor * PASSOS_POR_TEMPO * LARG_PASSO;
      ctx.fillStyle = "#2563eb"; ctx.fillRect(x - 1, 0, 2, alt);
      ctx.beginPath(); ctx.arc(x, 6, 5, 0, 7); ctx.fill();
    }
  }, [faixa, linhas, larg, alt, altLinha, passos, total, escuro, sel, modo, cursor]);

  // começa mostrando o meio da extensão (melódicos)
  useEffect(() => {
    const r = tela.current?.closest(".overflow-auto") as HTMLElement | null;
    if (r && faixa.timbre !== "bateria") r.scrollTop = Math.max(0, alt / 2 - r.clientHeight / 2);
  }, [faixa.id, faixa.timbre, alt]);

  const celula = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return { x, y, passo: Math.max(0, Math.min(passos - 1, Math.floor(x / LARG_PASSO))), linha: Math.max(0, Math.min(linhas.length - 1, Math.floor(y / altLinha))) };
  };
  const notaEm = (passo: number, linha: number) => {
    const l = linhas[linha], t = passo / PASSOS_POR_TEMPO;
    return l ? faixa.notas.find(n => n.midi === l.midi && t >= n.inicio - 1e-6 && t < n.inicio + n.dur - 1e-6) : undefined;
  };

  return (
    <div className="flex w-max" style={{ minWidth: "100%" }}>
      <div className="sticky left-0 z-20 shrink-0 border-r border-slate-200 bg-white" style={{ width: ROTULO }} aria-hidden="true">
        {linhas.map(l => (
          <div key={l.midi} className={`flex items-center truncate px-1.5 text-[10px] font-bold ${l.preta ? "bg-slate-100 text-slate-500" : "text-slate-600"}`} style={{ height: altLinha }}>{l.rotulo}</div>
        ))}
      </div>
      <div className="relative">
        <canvas ref={tela} style={{ width: larg, height: alt, touchAction: "none" }} aria-label={`Grade de notas de ${faixa.nome}`} role="img"
          className={modo === "por" ? "cursor-cell" : "cursor-default"}
          onPointerDown={e => {
            const c = celula(e);
            const l = linhas[c.linha];
            if (!l) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const t = c.passo / PASSOS_POR_TEMPO;
            if (modo === "por") {
              if (onPor(l.midi, t)) gesto.current = { tipo: "esticar", midi: l.midi, inicio: t };
              return;
            }
            const n = notaEm(c.passo, c.linha);
            if (n) {
              const chave = chaveNota(n);
              onClicarNota(chave, e.shiftKey || e.ctrlKey || e.metaKey);
              const selAtual = e.shiftKey || e.ctrlKey || e.metaKey ? new Set([...sel, chave]) : sel.has(chave) ? sel : new Set([chave]);
              gesto.current = { tipo: "mover", passo0: c.passo, linha0: c.linha, base: faixa.notas, sel: selAtual, moveu: false };
            } else {
              gesto.current = { tipo: "retangulo", x0: c.x, y0: c.y, x1: c.x, y1: c.y, somar: e.shiftKey || e.ctrlKey || e.metaKey };
            }
          }}
          onPointerMove={e => {
            const g = gesto.current;
            if (!g) return;
            const c = celula(e);
            if (g.tipo === "esticar") onEsticar(g.midi, g.inicio, c.passo / PASSOS_POR_TEMPO);
            else if (g.tipo === "retangulo") {
              g.x1 = c.x; g.y1 = c.y;
              setCaixa({ x: Math.min(g.x0, g.x1), y: Math.min(g.y0, g.y1), w: Math.abs(g.x1 - g.x0), h: Math.abs(g.y1 - g.y0) });
            } else {
              const dt = (c.passo - g.passo0) / PASSOS_POR_TEMPO, dm = linhas[g.linha0].midi - linhas[c.linha].midi;
              if (!dt && !dm && !g.moveu) return;
              if (!g.moveu) { g.moveu = true; onArrastoInicio(); }
              onArrasto(g.base, g.sel, dt, dm);
            }
          }}
          onPointerUp={e => {
            const g = gesto.current;
            gesto.current = null;
            setCaixa(null);
            if (!g || g.tipo !== "retangulo") return;
            const c = celula(e);
            // um clique (sem arrastar) no vazio marca o ponto de colar e solta a seleção
            if (Math.abs(g.x1 - g.x0) < 4 && Math.abs(g.y1 - g.y0) < 4) { onCursor(c.passo / PASSOS_POR_TEMPO); return; }
            const p0 = Math.floor(Math.min(g.x0, g.x1) / LARG_PASSO), p1 = Math.floor(Math.max(g.x0, g.x1) / LARG_PASSO) + 1;
            const l0 = Math.floor(Math.min(g.y0, g.y1) / altLinha), l1 = Math.floor(Math.max(g.y0, g.y1) / altLinha);
            const mAlto = linhas[Math.max(0, l0)]?.midi ?? 127, mBaixo = linhas[Math.min(linhas.length - 1, l1)]?.midi ?? 0;
            onRetangulo(p0 / PASSOS_POR_TEMPO, p1 / PASSOS_POR_TEMPO, mBaixo, mAlto, g.somar);
          }}
          onPointerCancel={() => { gesto.current = null; setCaixa(null); }} />
        {caixa && <div className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/10" style={{ left: caixa.x, top: caixa.y, width: caixa.w, height: caixa.h }} aria-hidden="true" />}
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
