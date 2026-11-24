import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, AudioLines, Captions, ChevronLeft, ChevronRight, Download, Flag, LayoutTemplate, Loader2, Pause, Play, Plus, Redo2,
  Scissors, SkipBack, SlidersHorizontal, Trash2, Type, Undo2, Upload, X,
} from "lucide-react";
import {
  DIMENSOES, FILTRO_NEUTRO, PRESETS, layoutPadrao, moverCamada, paraFrente, redimensionarCamada, type Camada, type Filtro, type Formato, type Layout,
} from "@/react-app/utils/drumcamAoVivo";
import {
  apagarIntervalo, apagarTrecho, aparar, camadasNoTempo, destaqueNoTempo, dividir, duracaoEditada, iniciosEditados, intervalo, lerProjeto, lerSrt,
  linearParaDb, mono, moverTrecho, novoProjeto, novoTexto, paraFonte, paraSrt, pedacosEditados, picos, relogioEdicao, sincronizarAudio,
  type CenaEdicao, type Destaque, type EstiloTexto, type ProjetoEdicao, type TextoEdicao, type TipoTransicao,
} from "@/react-app/utils/editorVideo";
import { edicoes, faixas, galeria, idAleatorio, type ItemGaleria } from "../armazenamento";
import { BotaoIcone, Deslizador } from "../ui";
import { MotorEdicao, type FonteEdicao } from "./motor";

const CORES = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#fb7185", "#2dd4bf", "#f97316"];
type Aba = "cortes" | "layout" | "audio" | "textos" | "cor";
const ABAS: { id: Aba; nome: string; icone: typeof Play }[] = [
  { id: "cortes", nome: "Cortes", icone: Scissors },
  { id: "layout", nome: "Layout", icone: LayoutTemplate },
  { id: "audio", nome: "Áudio", icone: AudioLines },
  { id: "textos", nome: "Textos", icone: Type },
  { id: "cor", nome: "Cor", icone: SlidersHorizontal },
];
const LAYOUTS: [Layout, string][] = [["unica", "Só a principal"], ["pip", "Janela no canto"], ["lado", "Lado a lado"], ["empilhado", "Empilhado"], ["destaque", "Destaque"], ["grade", "Grade"]];
const novoId = () => idAleatorio().replace(/[^\w-]/g, "");

/** Layout do instante: muda a cena que cobre o instante (a mais nova) ou, fora de cena, o layout geral. */
function mudarCamadasNoTempo(p: ProjetoEdicao, tFonte: number, f: (c: Camada[]) => Camada[]): ProjetoEdicao {
  for (let i = p.cenas.length - 1; i >= 0; i--) {
    const c = p.cenas[i];
    if (tFonte >= c.inicio && tFonte < c.fim) return { ...p, cenas: p.cenas.map((x, k) => (k === i ? { ...x, camadas: f(x.camadas) } : x)) };
  }
  return { ...p, camadasBase: f(p.camadasBase) };
}
const cenaNoTempo = (cenas: CenaEdicao[], t: number) => [...cenas].reverse().find(c => t >= c.inicio && t < c.fim) ?? null;

/**
 * Drumcam v5 — editor de vídeo de uma gravação da Galeria. Além de cortar, aparar, mudar a ordem, pôr transições,
 * legendas e textos, refaz o layout das câmeras por trecho (quando a gravação guardou cada câmera separada), destaca o
 * áudio de uma câmera num trecho (o solo) e volta sozinho, trata o áudio e importa o áudio da mesa, sincronizado
 * sozinho com a câmera (com ajuste fino). Nada sai do aparelho; o vídeo final vai para a Galeria.
 */
export default function EditorVideo({ item, fechar }: { item: ItemGaleria; fechar: () => void }) {
  const [projeto, setProjeto] = useState<ProjetoEdicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [aba, setAba] = useState<Aba>("cortes");
  const [selTrecho, setSelTrecho] = useState<string | null>(null);
  const [selCamera, setSelCamera] = useState<string | null>(null);
  const [selTexto, setSelTexto] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<{ entrada: number | null; saida: number | null }>({ entrada: null, saida: null });
  const [exportando, setExportando] = useState<number | null>(null);
  const [ondaExterna, setOndaExterna] = useState<{ picos: number[]; duracao: number } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const motor = useRef<MotorEdicao | null>(null);
  const fontes = useRef<FonteEdicao[]>([]);
  const desfazer = useRef<ProjetoEdicao[]>([]);
  const refazer = useRef<ProjetoEdicao[]>([]);
  const ultimoGrupo = useRef<{ grupo: string; quando: number } | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const multicam = !!item.multicam;

  // ---------------------------------------------------------- abrir
  useEffect(() => {
    let vivo = true;
    let m: MotorEdicao | null = null;
    (async () => {
      try {
        const lista: FonteEdicao[] = [];
        const cameras: { id: string; nome: string }[] = [];
        if (item.multicam) {
          for (const f of item.multicam.faixas) {
            const blob = await faixas.ler(f.faixaId);
            if (blob) { lista.push({ camera: f.camera, blob, inicio: f.inicio }); cameras.push({ id: f.camera, nome: f.nome }); }
          }
        }
        if (!lista.length) { lista.push({ camera: "video", blob: item.blob, inicio: 0 }); cameras.push({ id: "video", nome: "Vídeo" }); }
        const mc = lista[0].camera === "video" ? undefined : item.multicam;
        const camadasIniciais = mc?.camadas.filter(c => cameras.some(x => x.id === c.id)) ?? [];
        const camadas = camadasIniciais.length ? camadasIniciais : layoutPadrao(cameras.map(c => c.id), "unica", mc?.formato ?? "16:9").map(c => ({ ...c, ajuste: "conter" as const }));
        let padrao = novoProjeto({
          cameras, duracao: item.duracao ?? 0, formato: mc?.formato ?? "16:9", camadas, filtros: mc?.filtros,
          canais: mc ? Object.fromEntries(Object.entries(mc.canais).map(([id, c]) => [id, { ganhoDb: Math.round(linearParaDb(c.ganho) * 10) / 10, mudo: c.mudo, pan: c.pan }])) : undefined,
        });
        m = new MotorEdicao(padrao);
        await m.carregar(lista);
        if (!vivo) return;
        // Duração real (o item pode não ter) e formato do vídeo único pelo tamanho da imagem.
        const duracao = Math.max(item.duracao ?? 0, m.duracaoDasFontes()) || 1;
        let formato = padrao.formato;
        if (!mc) {
          const v = m.comp.fontes.get("video")?.video;
          const r = v?.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
          formato = r > 1.2 ? "16:9" : r < 0.8 ? "9:16" : "1:1";
        }
        padrao = { ...padrao, duracao, formato, cortes: [{ id: "t1", inicio: 0, fim: duracao }] };
        // As trocas de layout feitas ao vivo viram cenas.
        const trocas = mc?.trocas ?? [];
        padrao.cenas = trocas.slice(1).map((x, i) => ({ id: `c${i + 1}`, inicio: x.t, fim: trocas[i + 2]?.t ?? duracao, camadas: x.camadas }));
        const guardado = await edicoes.ler(item.id).catch(() => undefined);
        const p = guardado ? lerProjeto(guardado.projeto, padrao) : padrao;
        m.atualizar(p);
        if (p.externo) await m.ligarExterno(p.externo.faixaId, await faixas.ler(p.externo.faixaId)).catch(() => undefined);
        fontes.current = lista;
        motor.current = m;
        m.ouvir((tempo, toca) => { setT(tempo); setTocando(toca); });
        setProjeto(p);
        setSelCamera(cameras[0].id);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não deu para abrir o vídeo no editor.");
      }
    })();
    return () => { vivo = false; m?.fechar(); motor.current = null; };
  }, [item]);

  // O programa (canvas) entra na tela.
  useEffect(() => {
    const m = motor.current, p = palco.current;
    if (!m || !p || !projeto) return;
    m.comp.canvas.className = "absolute inset-0 h-full w-full";
    if (m.comp.canvas.parentElement !== p) p.prepend(m.comp.canvas);
  }, [projeto]);

  // Cada mudança vai para o motor e, logo depois, para o aparelho.
  useEffect(() => {
    if (!projeto) return;
    motor.current?.atualizar(projeto);
    const id = setTimeout(() => {
      void edicoes.guardar({ id: item.id, projeto, atualizadoEm: Date.now(), faixas: projeto.externo ? [projeto.externo.faixaId] : [] }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(id);
  }, [projeto, item.id]);

  /** Muda o projeto guardando o desfazer (mexidas seguidas do mesmo controle viram uma só). */
  const mudar = useCallback((f: (p: ProjetoEdicao) => ProjetoEdicao, grupo?: string) => {
    setProjeto(p => {
      if (!p) return p;
      const n = f(p);
      if (n === p) return p;
      const agora = Date.now();
      const juntar = grupo && ultimoGrupo.current?.grupo === grupo && agora - ultimoGrupo.current.quando < 800;
      if (!juntar) { desfazer.current.push(p); if (desfazer.current.length > 100) desfazer.current.shift(); }
      ultimoGrupo.current = grupo ? { grupo, quando: agora } : null;
      refazer.current = [];
      return n;
    });
  }, []);
  const voltar = useCallback(() => setProjeto(p => { const a = desfazer.current.pop(); if (!a || !p) return p; refazer.current.push(p); return a; }), []);
  const avancar = useCallback(() => setProjeto(p => { const a = refazer.current.pop(); if (!a || !p) return p; desfazer.current.push(p); return a; }), []);

  const total = projeto ? duracaoEditada(projeto.cortes) : 0;
  const tFonte = projeto ? paraFonte(projeto.cortes, t)?.tFonte ?? 0 : 0;
  const ir = useCallback((tempo: number) => { void motor.current?.irPara(Math.max(0, Math.min(tempo, total))); }, [total]);
  const alternar = useCallback(() => { const m = motor.current; if (!m) return; if (m.tocando) m.pausar(); else void m.tocar(); }, []);

  /** Intervalo marcado (entrada/saída) na gravação; sem marcas, o trecho atual. */
  const intervaloAlvo = useCallback((): { inicio: number; fim: number } | null => {
    if (!projeto) return null;
    const { entrada, saida } = marcas;
    if (entrada !== null && saida !== null && Math.abs(saida - entrada) >= 0.1) {
      const a = paraFonte(projeto.cortes, Math.min(entrada, saida)), b = paraFonte(projeto.cortes, Math.max(entrada, saida) - 0.001);
      if (a && b) return intervalo(a.tFonte, b.indice === a.indice ? b.tFonte : projeto.cortes[a.indice].fim, projeto.duracao);
    }
    const pos = paraFonte(projeto.cortes, t);
    if (!pos) return null;
    const tr = projeto.cortes[pos.indice];
    return { inicio: tr.inicio, fim: tr.fim };
  }, [projeto, marcas, t]);

  const dividirAqui = useCallback(() => mudar(p => ({ ...p, cortes: dividir(p.cortes, t, novoId()) })), [mudar, t]);
  const apagarSelecao = useCallback(() => {
    const { entrada, saida } = marcas;
    if (entrada !== null && saida !== null) { mudar(p => ({ ...p, cortes: apagarIntervalo(p.cortes, entrada, saida, novoId) })); setMarcas({ entrada: null, saida: null }); return; }
    if (selTrecho) mudar(p => ({ ...p, cortes: apagarTrecho(p.cortes, selTrecho) }));
  }, [marcas, selTrecho, mudar]);

  // ---------------------------------------------------------- teclado
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) avancar(); else voltar(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); avancar(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === " ") { e.preventDefault(); alternar(); }
      else if (k === "s") dividirAqui();
      else if (k === "i") setMarcas(m => ({ ...m, entrada: t }));
      else if (k === "o") setMarcas(m => ({ ...m, saida: t }));
      else if (k === "delete" || k === "backspace") apagarSelecao();
      else if (k === "arrowleft") ir(t - (e.shiftKey ? 1 : 1 / 30));
      else if (k === "arrowright") ir(t + (e.shiftKey ? 1 : 1 / 30));
      else if (k === "home") ir(0);
      else if (k === "escape" && exportando === null) fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alternar, dividirAqui, apagarSelecao, ir, t, voltar, avancar, fechar, exportando]);

  // ---------------------------------------------------------- arrastar câmeras no programa (aba Layout)
  const camadasAgora = projeto ? camadasNoTempo(projeto, tFonte) : [];
  const cenaAgora = projeto ? cenaNoTempo(projeto.cenas, tFonte) : null;
  const arrasto = useRef<{ id: string; canto: "mover" | "no" | "ne" | "so" | "se"; x: number; y: number; base: Camada } | null>(null);
  const iniciarArrasto = (e: React.PointerEvent, id: string, canto: "mover" | "no" | "ne" | "so" | "se") => {
    e.stopPropagation();
    const base = camadasAgora.find(c => c.id === id);
    if (!base) return;
    setSelCamera(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrasto.current = { id, canto, x: e.clientX, y: e.clientY, base };
  };
  const moverArrasto = (e: React.PointerEvent) => {
    const a = arrasto.current, p = palco.current;
    if (!a || !p) return;
    const r = p.getBoundingClientRect();
    const dx = (e.clientX - a.x) / r.width, dy = (e.clientY - a.y) / r.height;
    const nova = a.canto === "mover" ? moverCamada(a.base, dx, dy) : redimensionarCamada(a.base, a.canto, dx, dy);
    mudar(p => mudarCamadasNoTempo(p, tFonte, cs => cs.map(c => (c.id === a.id ? nova : c))), `arrasto-${a.id}`);
  };

  // ---------------------------------------------------------- áudio externo
  const [referenciaAudio, setReferenciaAudio] = useState("");
  useEffect(() => { if (projeto && !referenciaAudio) setReferenciaAudio(projeto.cameras[0].id); }, [projeto, referenciaAudio]);
  const decodificar = async (blob: Blob) => {
    const m = motor.current;
    if (!m) throw new Error("O editor ainda não abriu.");
    const buf = await m.comp.audio.decodeAudioData(await blob.arrayBuffer());
    return { amostras: mono(Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i))), taxa: buf.sampleRate };
  };
  const sincronizar = async (faixaId: string, blobExterno: Blob, referencia: string) => {
    setSincronizando(true);
    setAviso("Sincronizando o áudio com a câmera…");
    try {
      await new Promise(ok => setTimeout(ok, 30));
      const ref = fontes.current.find(f => f.camera === referencia) ?? fontes.current[0];
      const [a, b] = await Promise.all([decodificar(ref.blob), decodificar(blobExterno)]);
      setOndaExterna({ picos: picos(b.amostras, 1200), duracao: b.amostras.length / b.taxa });
      const r = sincronizarAudio(a.amostras, a.taxa, b.amostras, b.taxa);
      // O 0 da gravação é o segundo `inicio` do arquivo da câmera.
      const deslocamento = Math.round((r.deslocamento + ref.inicio) * 1000) / 1000;
      mudar(p => ({ ...p, externo: p.externo && p.externo.faixaId === faixaId ? { ...p.externo, deslocamento, confianca: r.confianca } : p.externo }));
      setAviso(r.confianca >= 0.5 ? `Sincronizado: o áudio importado começa ${Math.abs(deslocamento).toFixed(3).replace(".", ",")} s ${deslocamento >= 0 ? "antes" : "depois"} da gravação.`
        : "Sincronizei, mas o encaixe ficou incerto (os dois áudios são muito diferentes). Confira ouvindo e ajuste no fino.");
    } catch (e) {
      setAviso(e instanceof Error ? `Não deu para sincronizar: ${e.message}` : "Não deu para sincronizar.");
    } finally {
      setSincronizando(false);
    }
  };
  const importarAudio = async (arquivo: File) => {
    const m = motor.current;
    if (!m || !projeto) return;
    const faixaId = `ext-${novoId()}`;
    try {
      await faixas.guardar(faixaId, arquivo);
      if (projeto.externo) await faixas.apagar(projeto.externo.faixaId).catch(() => undefined);
      await m.ligarExterno(faixaId, arquivo);
      mudar(p => ({ ...p, externo: { faixaId, nome: arquivo.name, deslocamento: 0, ganhoDb: 0, substituir: false } }));
      await sincronizar(faixaId, arquivo, referenciaAudio);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não deu para importar o áudio.");
    }
  };

  // ---------------------------------------------------------- exportar
  const exportar = async () => {
    const m = motor.current;
    if (!m || !projeto) return;
    setExportando(0);
    setAviso(null);
    try {
      const blob = await m.exportar(f => setExportando(f));
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const base = item.nome.replace(/\.[^.]+$/, "");
      await galeria.salvar({
        id: idAleatorio(), tipo: "video", nome: `${base} (editado).${ext}`, origem: "edicao", criadoEm: Date.now(), duracao: total, tamanho: blob.size,
        mime: blob.type, blob, miniatura: m.comp.miniatura(),
      });
      setAviso("Vídeo editado pronto na Galeria.");
    } catch (e) {
      setAviso(e instanceof Error ? `A exportação não terminou: ${e.message}` : "A exportação não terminou.");
    } finally {
      setExportando(null);
    }
  };
  const cancelarExportacao = () => { void motor.current?.cancelarExportacao(); setExportando(null); setAviso("Exportação cancelada."); };

  const baixarSrt = () => {
    if (!projeto) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([paraSrt(projeto)], { type: "application/x-subrip" }));
    a.download = `${item.nome.replace(/\.[^.]+$/, "")}.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const razao = projeto?.formato === "9:16" ? 9 / 16 : projeto?.formato === "1:1" ? 1 : 16 / 9;
  const proporcaoCss = projeto?.formato === "9:16" ? "9 / 16" : projeto?.formato === "1:1" ? "1 / 1" : "16 / 9";
  const nomeCam = (id: string) => projeto?.cameras.find(c => c.id === id)?.nome ?? id;
  const corCam = (id: string) => CORES[Math.max(0, projeto?.cameras.findIndex(c => c.id === id) ?? 0) % CORES.length];
  const destaqueAgora = projeto ? destaqueNoTempo(projeto.destaques, tFonte) : null;

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#0f1115] text-slate-200" role="dialog" aria-modal aria-label={`Editor de vídeo: ${item.nome}`} data-tema-fixo>
      {/* Barra de cima */}
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/10 bg-[#181b22] px-2">
        <BotaoIcone rotulo="Fechar o editor (Esc)" onClick={fechar}><X className="h-4 w-4" /></BotaoIcone>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-white" title={item.nome}>
          Editor · {item.nome}
          {!multicam && <span className="ml-2 text-[11px] font-normal text-slate-500">(vídeo de uma câmera só)</span>}
        </p>
        <BotaoIcone rotulo="Desfazer (Ctrl+Z)" onClick={voltar} disabled={!desfazer.current.length}><Undo2 className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo="Refazer (Ctrl+Shift+Z)" onClick={avancar} disabled={!refazer.current.length}><Redo2 className="h-4 w-4" /></BotaoIcone>
        <button type="button" onClick={() => void exportar()} disabled={!projeto || exportando !== null}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50">
          <Download className="h-4 w-4" />Exportar
        </button>
      </header>

      {erro ? (
        <p role="alert" className="m-6 rounded-md bg-red-950/60 p-4 text-sm text-red-200">{erro}</p>
      ) : !projeto ? (
        <p className="m-auto flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Abrindo as câmeras…</p>
      ) : (<>
        <div className="grid min-h-0 flex-1 gap-2 overflow-auto p-2 lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          {/* Programa */}
          <div className="flex flex-col gap-2 lg:min-h-0">
            <div className="grid h-[34vh] shrink-0 place-items-center rounded-lg bg-black/40 p-1 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink" style={{ containerType: "size" }}>
              {/* O maior retângulo do formato que cabe na caixa (largura ou altura manda). */}
              <div ref={palco} className="relative overflow-hidden bg-black" style={{ aspectRatio: proporcaoCss, width: `min(100cqw, calc(100cqh * ${razao}))` }}
                onPointerMove={moverArrasto} onPointerUp={() => { arrasto.current = null; }}>
                {aba === "layout" && [...camadasAgora].filter(c => c.visivel).sort((a, b) => b.z - a.z).map(c => (
                  <div key={c.id} onPointerDown={e => iniciarArrasto(e, c.id, "mover")}
                    className={`absolute cursor-move border-2 ${selCamera === c.id ? "border-sky-400" : "border-white/30 hover:border-white/70"}`}
                    style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, zIndex: 10 + c.z }}>
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-bold" style={{ color: corCam(c.id) }}>{nomeCam(c.id)}</span>
                    {selCamera === c.id && (["no", "ne", "so", "se"] as const).map(k => (
                      <span key={k} onPointerDown={e => iniciarArrasto(e, c.id, k)} aria-hidden
                        className={`absolute h-3 w-3 rounded-sm border border-white bg-sky-500 ${k[0] === "n" ? "-top-1.5" : "-bottom-1.5"} ${k[1] === "o" ? "-left-1.5" : "-right-1.5"} ${k === "no" || k === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`} />
                    ))}
                  </div>
                ))}
                {destaqueAgora && (
                  <span className="pointer-events-none absolute right-2 top-2 z-50 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold" style={{ color: corCam(destaqueAgora.camera) }}>
                    Áudio em destaque: {nomeCam(destaqueAgora.camera)}
                  </span>
                )}
              </div>
            </div>
            {/* Transporte */}
            <div className="flex flex-wrap items-center gap-1">
              <BotaoIcone rotulo="Começo (Home)" onClick={() => ir(0)}><SkipBack className="h-4 w-4" /></BotaoIcone>
              <BotaoIcone rotulo="Quadro anterior (←)" onClick={() => ir(t - 1 / 30)}><ChevronLeft className="h-4 w-4" /></BotaoIcone>
              <button type="button" onClick={alternar} aria-label={tocando ? "Pausar (espaço)" : "Tocar (espaço)"} title={tocando ? "Pausar (espaço)" : "Tocar (espaço)"}
                className="inline-flex h-8 w-12 items-center justify-center rounded-md bg-sky-600 text-white hover:bg-sky-500">
                {tocando ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
              <BotaoIcone rotulo="Próximo quadro (→)" onClick={() => ir(t + 1 / 30)}><ChevronRight className="h-4 w-4" /></BotaoIcone>
              <span className="mx-1 font-mono text-xs tabular-nums text-slate-300">{relogioEdicao(t)} / {relogioEdicao(total)}</span>
              <span className="mx-1 h-5 w-px bg-white/10" />
              <BotaoIcone rotulo="Marcar entrada (I)" ativo={marcas.entrada !== null} onClick={() => setMarcas(m => ({ ...m, entrada: t }))}><Flag className="h-4 w-4" />I</BotaoIcone>
              <BotaoIcone rotulo="Marcar saída (O)" ativo={marcas.saida !== null} onClick={() => setMarcas(m => ({ ...m, saida: t }))}><Flag className="h-4 w-4 -scale-x-100" />O</BotaoIcone>
              {(marcas.entrada !== null || marcas.saida !== null) && <BotaoIcone rotulo="Limpar marcas" onClick={() => setMarcas({ entrada: null, saida: null })}><X className="h-4 w-4" /></BotaoIcone>}
              <span className="mx-1 h-5 w-px bg-white/10" />
              <BotaoIcone rotulo="Dividir aqui (S)" onClick={dividirAqui}><Scissors className="h-4 w-4" /></BotaoIcone>
              <BotaoIcone rotulo="Apagar o trecho selecionado ou o intervalo marcado (Delete)" onClick={apagarSelecao} disabled={!selTrecho && (marcas.entrada === null || marcas.saida === null)}><Trash2 className="h-4 w-4" /></BotaoIcone>
              {aviso && <span role="status" className="ml-auto max-w-full truncate text-[11px] text-amber-200" title={aviso}>{aviso}</span>}
            </div>
          </div>

          {/* Painel do lado */}
          <aside className="flex min-h-[50vh] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#181b22] lg:min-h-0">
            <div className="flex shrink-0 border-b border-white/10" role="tablist" aria-label="Ferramentas do editor">
              {ABAS.map(a => (
                <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-bold ${aba === a.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>
                  <a.icone className="h-4 w-4" />{a.nome}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-2.5 text-xs">
              {aba === "cortes" && <PainelCortes projeto={projeto} mudar={mudar} sel={selTrecho} setSel={setSelTrecho} t={t} ir={ir} />}
              {aba === "layout" && (
                <PainelLayout projeto={projeto} mudar={mudar} tFonte={tFonte} cena={cenaAgora} camadas={camadasAgora} selCamera={selCamera} setSelCamera={setSelCamera}
                  intervaloAlvo={intervaloAlvo} nomeCam={nomeCam} multicam={multicam} />
              )}
              {aba === "audio" && (
                <PainelAudio projeto={projeto} mudar={mudar} intervaloAlvo={intervaloAlvo} nomeCam={nomeCam} corCam={corCam} irParaGravacao={tf => motor.current?.irParaGravacao(tf)}
                  importar={f => void importarAudio(f)} sincronizando={sincronizando} referencia={referenciaAudio} setReferencia={setReferenciaAudio}
                  ressincronizar={async () => { const e = projeto.externo; if (!e) return; const b = await faixas.ler(e.faixaId); if (b) await sincronizar(e.faixaId, b, referenciaAudio); }}
                  removerExterno={() => { const e = projeto.externo; if (!e) return; motor.current?.desligarExterno(); void faixas.apagar(e.faixaId); setOndaExterna(null); mudar(p => ({ ...p, externo: null })); }} />
              )}
              {aba === "textos" && (
                <PainelTextos projeto={projeto} mudar={mudar} sel={selTexto} setSel={setSelTexto} intervaloAlvo={intervaloAlvo} tFonte={tFonte} baixarSrt={baixarSrt}
                  irParaGravacao={tf => motor.current?.irParaGravacao(tf)} />
              )}
              {aba === "cor" && <PainelCor projeto={projeto} mudar={mudar} sel={selCamera} setSel={setSelCamera} nomeCam={nomeCam} />}
            </div>
          </aside>
        </div>

        <LinhaDoTempo projeto={projeto} t={t} total={total} ir={ir} marcas={marcas} selTrecho={selTrecho} setSelTrecho={setSelTrecho} mudar={mudar}
          nomeCam={nomeCam} corCam={corCam} ondaExterna={ondaExterna} selTexto={selTexto} setSelTexto={id => { setSelTexto(id); setAba("textos"); }} />
      </>)}

      {exportando !== null && (
        <div className="fixed inset-0 z-[96] grid place-items-center bg-black/70" role="alertdialog" aria-label="Exportando">
          <div className="w-80 rounded-lg bg-[#181b22] p-4 ring-1 ring-white/10">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Loader2 className="h-4 w-4 animate-spin" />Exportando o vídeo…</p>
            <p className="mb-2 text-[11px] text-slate-400">Leva o tempo do vídeo editado ({relogioEdicao(total)}). Deixe esta tela aberta.</p>
            <div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-red-500" style={{ width: `${Math.round(exportando * 100)}%` }} /></div>
            <button type="button" onClick={cancelarExportacao} className="mt-3 w-full rounded-md bg-white/10 py-1.5 text-xs font-bold hover:bg-white/20">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

type Mudar = (f: (p: ProjetoEdicao) => ProjetoEdicao, grupo?: string) => void;

function Secao({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span className="mr-auto">{titulo}</span>{acoes}</h4>
      {children}
    </section>
  );
}
const botao = "inline-flex items-center justify-center gap-1 rounded-md bg-white/5 px-2 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 disabled:opacity-40";
const campo = "w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white";

// ---------------------------------------------------------------- Cortes e transições

function PainelCortes({ projeto, mudar, sel, setSel, t, ir }: { projeto: ProjetoEdicao; mudar: Mudar; sel: string | null; setSel: (id: string | null) => void; t: number; ir: (t: number) => void }) {
  const inicios = iniciosEditados(projeto.cortes);
  const trecho = projeto.cortes.find(x => x.id === sel) ?? null;
  const tr = trecho ? projeto.transicoes[trecho.id] ?? { tipo: "corte" as TipoTransicao, duracao: 0.5 } : null;
  return (<>
    <p className="text-[11px] leading-snug text-slate-400">
      <b className="text-slate-200">S</b> divide no cursor, <b className="text-slate-200">I</b> e <b className="text-slate-200">O</b> marcam um intervalo e <b className="text-slate-200">Delete</b> apaga o trecho ou o intervalo.
      Arraste as pontas do trecho na linha do tempo para aparar.
    </p>
    <Secao titulo={`Trechos (${projeto.cortes.length})`}>
      <ul className="space-y-1">
        {projeto.cortes.map((c, i) => (
          <li key={c.id}>
            <button type="button" onClick={() => { setSel(c.id); ir(inicios[i]); }} aria-pressed={sel === c.id}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${sel === c.id ? "bg-sky-600/30 ring-1 ring-sky-500" : "bg-white/5 hover:bg-white/10"}`}>
              <span className="font-bold text-white">{i + 1}</span>
              <span className="flex-1 font-mono text-[11px] text-slate-300">{relogioEdicao(c.inicio)} → {relogioEdicao(c.fim)}</span>
              <span className="text-[10px] text-slate-500">{relogioEdicao(c.fim - c.inicio)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Secao>
    {trecho && tr && (
      <Secao titulo={`Trecho ${projeto.cortes.indexOf(trecho) + 1}`}>
        <div className="mb-2 flex flex-wrap gap-1">
          <button type="button" className={botao} onClick={() => mudar(p => ({ ...p, cortes: moverTrecho(p.cortes, trecho.id, -1) }))}><ArrowLeft className="h-3.5 w-3.5" />Antes</button>
          <button type="button" className={botao} onClick={() => mudar(p => ({ ...p, cortes: moverTrecho(p.cortes, trecho.id, 1) }))}><ArrowRight className="h-3.5 w-3.5" />Depois</button>
          <button type="button" className={botao} title="O começo do trecho vai para o segundo da gravação em que o cursor está"
            onClick={() => { const f = paraFonte(projeto.cortes, t); if (f) mudar(p => ({ ...p, cortes: aparar(p.cortes, trecho.id, "inicio", f.tFonte, p.duracao) })); }}>Começa aqui</button>
          <button type="button" className={botao}
            onClick={() => { const f = paraFonte(projeto.cortes, t); if (f) mudar(p => ({ ...p, cortes: aparar(p.cortes, trecho.id, "fim", f.tFonte, p.duracao) })); }}>Termina aqui</button>
          <button type="button" className={`${botao} text-red-300`} disabled={projeto.cortes.length <= 1} onClick={() => { mudar(p => ({ ...p, cortes: apagarTrecho(p.cortes, trecho.id) })); setSel(null); }}><Trash2 className="h-3.5 w-3.5" />Apagar</button>
        </div>
        <label className="block text-[11px] text-slate-400">Transição na entrada
          <select value={tr.tipo} className={`${campo} mt-1`} aria-label="Transição na entrada do trecho"
            onChange={e => mudar(p => ({ ...p, transicoes: { ...p.transicoes, [trecho.id]: { ...tr, tipo: e.target.value as TipoTransicao } } }))}>
            <option value="corte">Corte seco</option>
            <option value="escurecer">Escurecer (passa pelo preto)</option>
            <option value="clarear">Clarear (passa pelo branco)</option>
          </select>
        </label>
        {tr.tipo !== "corte" && (
          <Deslizador rotulo="Duração da transição" valor={tr.duracao} min={0.1} max={3} passo={0.1} padrao={0.5} sufixo=" s"
            onChange={v => mudar(p => ({ ...p, transicoes: { ...p.transicoes, [trecho.id]: { ...tr, duracao: v } } }), `tr-${trecho.id}`)} />
        )}
      </Secao>
    )}
  </>);
}

// ---------------------------------------------------------------- Layout multi-câmera

function PainelLayout({ projeto, mudar, tFonte, cena, camadas, selCamera, setSelCamera, intervaloAlvo, nomeCam, multicam }: {
  projeto: ProjetoEdicao; mudar: Mudar; tFonte: number; cena: CenaEdicao | null; camadas: Camada[]; selCamera: string | null; setSelCamera: (id: string) => void;
  intervaloAlvo: () => { inicio: number; fim: number } | null; nomeCam: (id: string) => string; multicam: boolean;
}) {
  const [principal, setPrincipal] = useState(projeto.cameras[0]?.id ?? "");
  const ids = [principal, ...projeto.cameras.map(c => c.id).filter(id => id !== principal)];
  const sel = camadas.find(c => c.id === selCamera) ?? null;
  const mudarAqui = (f: (c: Camada[]) => Camada[], grupo?: string) => mudar(p => mudarCamadasNoTempo(p, tFonte, f), grupo);
  const mudarSel = (f: (c: Camada) => Camada, grupo?: string) => selCamera && mudarAqui(cs => {
    const existe = cs.some(c => c.id === selCamera);
    const base = existe ? cs : [...cs, { id: selCamera, x: 0.6, y: 0.6, w: 0.35, h: 0.35, z: cs.length, ajuste: "cobrir" as const, raio: 0, visivel: true, espelhar: false }];
    return base.map(c => (c.id === selCamera ? f(c) : c));
  }, grupo);
  /** Janela da câmera escolhida num canto, do tamanho pedido (mesma proporção do vídeo). */
  const noCanto = (v: "cima" | "baixo", h: "esq" | "dir") => mudarSel(c => {
    const w = c.w >= 0.95 ? 0.3 : c.w, m = 0.03;
    return { ...c, w, h: w, x: h === "esq" ? m : 1 - m - w, y: v === "cima" ? m : 1 - m - w, visivel: true, z: Math.max(...camadas.map(x => x.z), 0) + 1 };
  });
  const novaCena = () => {
    const iv = intervaloAlvo();
    if (!iv) return;
    mudar(p => ({ ...p, cenas: [...p.cenas, { id: novoId(), inicio: iv.inicio, fim: iv.fim, camadas: camadasNoTempo(p, tFonte) }] }));
  };
  const formatos: Formato[] = ["16:9", "9:16", "1:1"];
  return (<>
    {!multicam && (
      <p className="rounded-md bg-amber-950/40 p-2 text-[11px] leading-snug text-amber-200">
        Este vídeo tem uma imagem só. Para mudar a posição de cada câmera depois de gravado, grave no Estúdio com
        “Guardar cada câmera separada” (ou em Alta qualidade). Aqui ainda dá para enquadrar, dar zoom e mudar o formato.
      </p>
    )}
    <Secao titulo="Editando agora">
      <p className="mb-1.5 text-[11px] text-slate-300">
        {cena ? <>Layout do trecho <b>{relogioEdicao(cena.inicio)} → {relogioEdicao(cena.fim)}</b> da gravação.</> : <>Layout geral (vale onde não há trecho com layout próprio).</>}
      </p>
      <div className="flex flex-wrap gap-1">
        <button type="button" className={botao} onClick={novaCena} title="Cria um layout só para o intervalo marcado (I/O) ou, sem marcas, para o trecho atual"><Plus className="h-3.5 w-3.5" />Layout para o intervalo</button>
        {cena && <button type="button" className={`${botao} text-red-300`} onClick={() => mudar(p => ({ ...p, cenas: p.cenas.filter(c => c.id !== cena.id) }))}><Trash2 className="h-3.5 w-3.5" />Tirar este layout</button>}
      </div>
    </Secao>
    {multicam && (
      <Secao titulo="Arrumação rápida">
        <label className="mb-1.5 block text-[11px] text-slate-400">Câmera principal
          <select value={principal} onChange={e => setPrincipal(e.target.value)} className={`${campo} mt-1`} aria-label="Câmera principal">
            {projeto.cameras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-1">
          {LAYOUTS.map(([l, r]) => <button key={l} type="button" className={botao} onClick={() => mudarAqui(() => layoutPadrao(ids, l, projeto.formato))}>{r}</button>)}
        </div>
      </Secao>
    )}
    <Secao titulo="Câmera">
      <div className="mb-1.5 flex flex-wrap gap-1">
        {projeto.cameras.map(c => {
          const vis = camadas.find(x => x.id === c.id)?.visivel ?? false;
          return (
            <button key={c.id} type="button" onClick={() => setSelCamera(c.id)} aria-pressed={selCamera === c.id}
              className={`rounded-md px-2 py-1 text-[11px] font-bold ${selCamera === c.id ? "bg-sky-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"} ${vis ? "" : "opacity-50"}`}>{c.nome}</button>
          );
        })}
      </div>
      {selCamera && (<>
        <div className="mb-1 flex flex-wrap gap-1">
          <button type="button" className={botao} onClick={() => mudarSel(c => ({ ...c, visivel: !(sel?.visivel ?? false) }))}>{sel?.visivel ? "Esconder" : "Mostrar"}</button>
          <button type="button" className={botao} onClick={() => mudarAqui(cs => paraFrente(cs, selCamera))}>Para a frente</button>
          <button type="button" className={botao} onClick={() => mudarSel(c => ({ ...c, x: 0, y: 0, w: 1, h: 1, visivel: true }))}>Tela cheia</button>
          <button type="button" className={botao} onClick={() => mudarSel(c => ({ ...c, ajuste: c.ajuste === "cobrir" ? "conter" : "cobrir" }))}>{sel?.ajuste === "conter" ? "Cobrir (cortar sobras)" : "Mostrar tudo"}</button>
          <button type="button" className={botao} onClick={() => mudarSel(c => ({ ...c, espelhar: !c.espelhar }))}>Espelhar</button>
        </div>
        {multicam && (
          <div className="mb-1 grid grid-cols-2 gap-1">
            <button type="button" className={botao} onClick={() => noCanto("cima", "esq")}>Janela em cima, à esquerda</button>
            <button type="button" className={botao} onClick={() => noCanto("cima", "dir")}>Janela em cima, à direita</button>
            <button type="button" className={botao} onClick={() => noCanto("baixo", "esq")}>Janela embaixo, à esquerda</button>
            <button type="button" className={botao} onClick={() => noCanto("baixo", "dir")}>Janela embaixo, à direita</button>
          </div>
        )}
        {sel && (<>
          <Deslizador rotulo="Tamanho" valor={Math.round(sel.w * 100)} min={10} max={100} padrao={100} sufixo="%"
            onChange={v => mudarSel(c => { const w = v / 100, h = Math.min(1, c.h * (w / c.w)); return { ...c, w, h, x: Math.min(c.x, 1 - w), y: Math.min(c.y, 1 - h) }; }, `tam-${selCamera}`)} />
          <Deslizador rotulo="Cantos arredondados" valor={Math.round(sel.raio * 100)} min={0} max={30} padrao={0} sufixo="%" onChange={v => mudarSel(c => ({ ...c, raio: v / 100 }), `raio-${selCamera}`)} />
        </>)}
        <p className="text-[11px] text-slate-500">No vídeo: arraste a câmera para mover e os cantos azuis para mudar o tamanho de {nomeCam(selCamera)}.</p>
      </>)}
    </Secao>
    <Secao titulo="Formato do vídeo">
      <div className="flex gap-1">
        {formatos.map(f => (
          <button key={f} type="button" aria-pressed={projeto.formato === f} onClick={() => mudar(p => ({ ...p, formato: f }))}
            className={`flex-1 rounded-md px-2 py-1 font-bold ${projeto.formato === f ? "bg-white/20 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>{f}</button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">{DIMENSOES[projeto.formato].w}×{DIMENSOES[projeto.formato].h}</p>
    </Secao>
    {projeto.cenas.length > 0 && (
      <Secao titulo={`Layouts por trecho (${projeto.cenas.length})`}>
        <ul className="space-y-1">
          {projeto.cenas.map(c => (
            <li key={c.id} className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
              <span className="flex-1 font-mono text-[11px]">{relogioEdicao(c.inicio)} → {relogioEdicao(c.fim)}</span>
              <button type="button" className="rounded p-1 text-slate-400 hover:text-red-300" aria-label="Tirar este layout" onClick={() => mudar(p => ({ ...p, cenas: p.cenas.filter(x => x.id !== c.id) }))}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      </Secao>
    )}
  </>);
}

// ---------------------------------------------------------------- Áudio

function PainelAudio({ projeto, mudar, intervaloAlvo, nomeCam, corCam, irParaGravacao, importar, sincronizando, referencia, setReferencia, ressincronizar, removerExterno }: {
  projeto: ProjetoEdicao; mudar: Mudar; intervaloAlvo: () => { inicio: number; fim: number } | null; nomeCam: (id: string) => string; corCam: (id: string) => string;
  irParaGravacao: (t: number) => void; importar: (f: File) => void; sincronizando: boolean; referencia: string; setReferencia: (id: string) => void;
  ressincronizar: () => Promise<void>; removerExterno: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [camDestaque, setCamDestaque] = useState(projeto.cameras[1]?.id ?? projeto.cameras[0]?.id ?? "");
  const m = projeto.melhoria;
  const ext = projeto.externo;
  const mudarDestaque = (id: string, d: Partial<Destaque>, grupo?: string) => mudar(p => ({ ...p, destaques: p.destaques.map(x => (x.id === id ? { ...x, ...d } : x)) }), grupo);
  const novoDestaque = () => {
    const iv = intervaloAlvo();
    if (!iv || !camDestaque) return;
    mudar(p => ({ ...p, destaques: [...p.destaques, { id: novoId(), inicio: iv.inicio, fim: iv.fim, camera: camDestaque, ganhoDb: 6, abaixarDb: 6 }] }));
  };
  const ajustar = (ms: number) => mudar(p => (p.externo ? { ...p, externo: { ...p.externo, deslocamento: Math.round((p.externo.deslocamento + ms / 1000) * 1000) / 1000 } } : p), "fino");
  return (<>
    <Secao titulo="Mixer">
      {projeto.cameras.map(c => {
        const canal = projeto.canais[c.id];
        return (
          <div key={c.id} className="mb-1.5 rounded-md bg-white/5 p-1.5">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: corCam(c.id) }} />
              <b className="flex-1 truncate text-white">{c.nome}</b>
              <BotaoIcone rotulo={canal.mudo ? `Tirar o mudo de ${c.nome}` : `Deixar ${c.nome} mudo`} ativo={canal.mudo}
                onClick={() => mudar(p => ({ ...p, canais: { ...p.canais, [c.id]: { ...canal, mudo: !canal.mudo } } }))}>M</BotaoIcone>
            </div>
            <Deslizador rotulo="Volume" valor={canal.ganhoDb} min={-30} max={12} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => ({ ...p, canais: { ...p.canais, [c.id]: { ...canal, ganhoDb: v } } }), `vol-${c.id}`)} />
            <Deslizador rotulo="Pan (esquerda ↔ direita)" valor={canal.pan} min={-1} max={1} passo={0.05} padrao={0} onChange={v => mudar(p => ({ ...p, canais: { ...p.canais, [c.id]: { ...canal, pan: v } } }), `pan-${c.id}`)} />
          </div>
        );
      })}
    </Secao>

    {projeto.cameras.length > 1 && (
      <Secao titulo="Destaque por trecho (solo)">
        <p className="mb-1.5 text-[11px] leading-snug text-slate-400">Marque o trecho do solo (I e O) ou pare no trecho, escolha a câmera e destaque: ela sobe e as outras descem; no fim, volta tudo ao normal, com rampa suave.</p>
        <div className="mb-1.5 flex gap-1">
          <select value={camDestaque} onChange={e => setCamDestaque(e.target.value)} className={campo} aria-label="Câmera para destacar">
            {projeto.cameras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button type="button" className={botao} onClick={novoDestaque}><Plus className="h-3.5 w-3.5" />Destacar</button>
        </div>
        <Deslizador rotulo="Rampa de entrada e saída" valor={projeto.rampa} min={0} max={2} passo={0.05} padrao={0.3} sufixo=" s" onChange={v => mudar(p => ({ ...p, rampa: v }), "rampa")} />
        <ul className="space-y-1.5">
          {projeto.destaques.map(d => (
            <li key={d.id} className="rounded-md bg-white/5 p-1.5" style={{ borderLeft: `3px solid ${corCam(d.camera)}` }}>
              <div className="flex items-center gap-1">
                <button type="button" className="flex-1 text-left font-mono text-[11px] text-slate-200 hover:underline" onClick={() => irParaGravacao(d.inicio)}>{relogioEdicao(d.inicio)} → {relogioEdicao(d.fim)}</button>
                <select value={d.camera} onChange={e => mudarDestaque(d.id, { camera: e.target.value })} className="rounded bg-black/30 px-1 py-0.5 text-[11px]" aria-label="Câmera em destaque">
                  {projeto.cameras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <button type="button" className="rounded p-1 text-slate-400 hover:text-red-300" aria-label="Tirar o destaque" onClick={() => mudar(p => ({ ...p, destaques: p.destaques.filter(x => x.id !== d.id) }))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <Deslizador rotulo={`Subir ${nomeCam(d.camera)}`} valor={d.ganhoDb} min={0} max={18} passo={0.5} padrao={6} sufixo=" dB" onChange={v => mudarDestaque(d.id, { ganhoDb: v }, `dg-${d.id}`)} />
              <Deslizador rotulo="Abaixar as outras" valor={d.abaixarDb} min={0} max={40} passo={0.5} padrao={6} sufixo=" dB" onChange={v => mudarDestaque(d.id, { abaixarDb: v }, `da-${d.id}`)} />
            </li>
          ))}
        </ul>
      </Secao>
    )}

    <Secao titulo="Melhorar o áudio">
      {([["tirarRonco", "Tirar ronco e vento (corta abaixo de 80 Hz)"], ["tirarChiado", "Tirar chiado (corta acima de 12 kHz)"], ["nivelar", "Nivelar o volume (compressor)"]] as const).map(([k, r]) => (
        <label key={k} className="flex items-center gap-2 py-0.5 text-[11px] text-slate-300">
          <input type="checkbox" checked={m[k]} className="accent-sky-500" onChange={e => mudar(p => ({ ...p, melhoria: { ...p.melhoria, [k]: e.target.checked } }))} />{r}
        </label>
      ))}
      <Deslizador rotulo="Graves" valor={m.graves} min={-12} max={12} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => ({ ...p, melhoria: { ...p.melhoria, graves: v } }), "eq-g")} />
      <Deslizador rotulo="Médios" valor={m.medios} min={-12} max={12} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => ({ ...p, melhoria: { ...p.melhoria, medios: v } }), "eq-m")} />
      <Deslizador rotulo="Agudos" valor={m.agudos} min={-12} max={12} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => ({ ...p, melhoria: { ...p.melhoria, agudos: v } }), "eq-a")} />
      <Deslizador rotulo="Ganho final" valor={m.ganhoDb} min={-12} max={18} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => ({ ...p, melhoria: { ...p.melhoria, ganhoDb: v } }), "ganho")} />
      <p className="text-[10px] text-slate-500">Um limitador segura os picos, para o som não estourar.</p>
    </Secao>

    <Secao titulo="Áudio da mesa / live">
      <input ref={entrada} type="file" accept="audio/*,video/*,.wav,.mp3,.m4a,.flac,.ogg" className="hidden" aria-label="Áudio para importar"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importar(f); }} />
      {projeto.cameras.length > 1 && (
        <label className="mb-1.5 block text-[11px] text-slate-400">Sincronizar pelo áudio de
          <select value={referencia} onChange={e => setReferencia(e.target.value)} className={`${campo} mt-1`} aria-label="Câmera de referência para sincronizar">
            {projeto.cameras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      )}
      {!ext ? (<>
        <button type="button" className={`${botao} w-full`} onClick={() => entrada.current?.click()} disabled={sincronizando}><Upload className="h-3.5 w-3.5" />Importar áudio (sincroniza sozinho)</button>
        <p className="mt-1 text-[10px] text-slate-500">WAV, MP3, M4A, FLAC ou até um vídeo. O NordTool acha o atraso pelas batidas e encaixa o áudio no vídeo.</p>
      </>) : (
        <div className="rounded-md bg-white/5 p-1.5">
          <p className="mb-1 truncate font-bold text-white" title={ext.nome}>{ext.nome}</p>
          <p className="mb-1 font-mono text-[11px] text-slate-300">
            Deslocamento: {ext.deslocamento >= 0 ? "+" : ""}{ext.deslocamento.toFixed(3).replace(".", ",")} s
            {ext.confianca !== undefined && <span className={`ml-1 ${ext.confianca >= 0.5 ? "text-emerald-300" : "text-amber-300"}`}>· encaixe {ext.confianca >= 0.75 ? "ótimo" : ext.confianca >= 0.5 ? "bom" : "incerto"}</span>}
          </p>
          <div className="mb-1 flex flex-wrap gap-1" role="group" aria-label="Ajuste fino da sincronia">
            {[-100, -10, -1, 1, 10, 100].map(ms => <button key={ms} type="button" className={botao} onClick={() => ajustar(ms)}>{ms > 0 ? "+" : ""}{ms} ms</button>)}
          </div>
          <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-400">Em ms:
            <input type="number" step={1} value={Math.round(ext.deslocamento * 1000)} className={campo} aria-label="Deslocamento em milissegundos"
              onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) mudar(p => (p.externo ? { ...p, externo: { ...p.externo, deslocamento: v / 1000 } } : p), "fino"); }} />
          </label>
          <Deslizador rotulo="Volume do áudio importado" valor={ext.ganhoDb} min={-30} max={12} passo={0.5} padrao={0} sufixo=" dB" onChange={v => mudar(p => (p.externo ? { ...p, externo: { ...p.externo, ganhoDb: v } } : p), "ext-g")} />
          <label className="flex items-center gap-2 py-0.5 text-[11px] text-slate-300">
            <input type="checkbox" checked={ext.substituir} className="accent-sky-500" onChange={e => mudar(p => (p.externo ? { ...p, externo: { ...p.externo, substituir: e.target.checked } } : p))} />
            Usar só este áudio (as câmeras ficam mudas)
          </label>
          <div className="mt-1 flex gap-1">
            <button type="button" className={botao} disabled={sincronizando} onClick={() => void ressincronizar()}>{sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Sincronizar de novo</button>
            <button type="button" className={botao} onClick={() => entrada.current?.click()}>Trocar</button>
            <button type="button" className={`${botao} text-red-300`} onClick={removerExterno}><Trash2 className="h-3.5 w-3.5" />Tirar</button>
          </div>
        </div>
      )}
    </Secao>
  </>);
}

// ---------------------------------------------------------------- Textos e legendas

function PainelTextos({ projeto, mudar, sel, setSel, intervaloAlvo, tFonte, baixarSrt, irParaGravacao }: {
  projeto: ProjetoEdicao; mudar: Mudar; sel: string | null; setSel: (id: string | null) => void; intervaloAlvo: () => { inicio: number; fim: number } | null;
  tFonte: number; baixarSrt: () => void; irParaGravacao: (t: number) => void;
}) {
  const srt = useRef<HTMLInputElement>(null);
  const texto = projeto.textos.find(x => x.id === sel) ?? null;
  const mudarTexto = (d: Partial<TextoEdicao>, grupo?: string) => texto && mudar(p => ({ ...p, textos: p.textos.map(x => (x.id === texto.id ? { ...x, ...d } : x)) }), grupo);
  const adicionar = (estilo: EstiloTexto) => {
    const marcado = intervaloAlvo();
    // Sem marca, 3 segundos a partir de onde o cursor está.
    const iv = marcado && marcado.fim - marcado.inicio < projeto.duracao - 0.01 ? marcado : intervalo(tFonte, tFonte + 3, projeto.duracao);
    const n = novoTexto(novoId(), iv.inicio, iv.fim, estilo, estilo === "legenda" ? "Legenda" : estilo === "titulo" ? "Título" : "Texto");
    mudar(p => ({ ...p, textos: [...p.textos, n] }));
    setSel(n.id);
  };
  const lerArquivoSrt = async (f: File) => {
    const lidos = lerSrt(await f.text(), projeto.cortes, novoId);
    if (lidos.length) mudar(p => ({ ...p, textos: [...p.textos, ...lidos] }));
  };
  return (<>
    <Secao titulo="Adicionar">
      <div className="grid grid-cols-3 gap-1">
        <button type="button" className={botao} onClick={() => adicionar("legenda")}><Captions className="h-3.5 w-3.5" />Legenda</button>
        <button type="button" className={botao} onClick={() => adicionar("titulo")}><Type className="h-3.5 w-3.5" />Título</button>
        <button type="button" className={botao} onClick={() => adicionar("livre")}><Plus className="h-3.5 w-3.5" />Texto</button>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">Entra no intervalo marcado (I/O) ou por 3 s a partir do cursor.</p>
      <div className="mt-1.5 flex gap-1">
        <input ref={srt} type="file" accept=".srt,text/plain" className="hidden" aria-label="Legendas SRT" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void lerArquivoSrt(f); }} />
        <button type="button" className={botao} onClick={() => srt.current?.click()}><Upload className="h-3.5 w-3.5" />Importar .srt</button>
        <button type="button" className={botao} onClick={baixarSrt} disabled={!projeto.textos.some(x => x.estilo === "legenda")}><Download className="h-3.5 w-3.5" />Baixar .srt</button>
      </div>
    </Secao>
    {texto && (
      <Secao titulo="Texto selecionado">
        <textarea value={texto.texto} onChange={e => mudarTexto({ texto: e.target.value }, `txt-${texto.id}`)} rows={2} className={campo} aria-label="Texto" />
        <div className="my-1 flex flex-wrap gap-1">
          <button type="button" className={botao} onClick={() => mudarTexto({ inicio: Math.min(tFonte, texto.fim - 0.1) })}>Começa aqui</button>
          <button type="button" className={botao} onClick={() => mudarTexto({ fim: Math.max(tFonte, texto.inicio + 0.1) })}>Termina aqui</button>
          <button type="button" className={`${botao} text-red-300`} onClick={() => { mudar(p => ({ ...p, textos: p.textos.filter(x => x.id !== texto.id) })); setSel(null); }}><Trash2 className="h-3.5 w-3.5" />Apagar</button>
        </div>
        <p className="mb-1 font-mono text-[11px] text-slate-400">{relogioEdicao(texto.inicio)} → {relogioEdicao(texto.fim)} da gravação</p>
        <label className="mb-1 block text-[11px] text-slate-400">Estilo
          <select value={texto.estilo} onChange={e => mudarTexto({ estilo: e.target.value as EstiloTexto })} className={`${campo} mt-1`} aria-label="Estilo do texto">
            <option value="legenda">Legenda (embaixo, com faixa)</option>
            <option value="titulo">Título</option>
            <option value="livre">Texto livre</option>
          </select>
        </label>
        <Deslizador rotulo="Tamanho" valor={Math.round(texto.tamanho * 1000) / 10} min={2} max={20} passo={0.5} padrao={5.5} sufixo="%" onChange={v => mudarTexto({ tamanho: v / 100 }, `tt-${texto.id}`)} />
        <Deslizador rotulo="Posição na horizontal" valor={Math.round(texto.x * 100)} min={5} max={95} padrao={50} sufixo="%" onChange={v => mudarTexto({ x: v / 100 }, `tx-${texto.id}`)} />
        <Deslizador rotulo="Posição na vertical" valor={Math.round(texto.y * 100)} min={5} max={95} padrao={88} sufixo="%" onChange={v => mudarTexto({ y: v / 100 }, `ty-${texto.id}`)} />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-400">Cor <input type="color" value={texto.cor} onChange={e => mudarTexto({ cor: e.target.value }, `tc-${texto.id}`)} aria-label="Cor do texto" /></label>
          <label className="flex items-center gap-1 text-[11px] text-slate-300"><input type="checkbox" checked={texto.fundo} className="accent-sky-500" onChange={e => mudarTexto({ fundo: e.target.checked })} />Faixa escura atrás</label>
        </div>
      </Secao>
    )}
    <Secao titulo={`Textos (${projeto.textos.length})`}>
      {projeto.textos.length === 0 ? <p className="text-[11px] text-slate-500">Nenhum ainda.</p> : (
        <ul className="space-y-1">
          {[...projeto.textos].sort((a, b) => a.inicio - b.inicio).map(x => (
            <li key={x.id}>
              <button type="button" onClick={() => { setSel(x.id); irParaGravacao(x.inicio); }} aria-pressed={sel === x.id}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${sel === x.id ? "bg-sky-600/30 ring-1 ring-sky-500" : "bg-white/5 hover:bg-white/10"}`}>
                <span className="font-mono text-[10px] text-slate-400">{relogioEdicao(x.inicio)}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-white">{x.texto || "(vazio)"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  </>);
}

// ---------------------------------------------------------------- Cor

function PainelCor({ projeto, mudar, sel, setSel, nomeCam }: { projeto: ProjetoEdicao; mudar: Mudar; sel: string | null; setSel: (id: string) => void; nomeCam: (id: string) => string }) {
  const id = sel ?? projeto.cameras[0]?.id ?? "";
  const f = projeto.filtros[id] ?? FILTRO_NEUTRO;
  const mudarFiltro = (d: Partial<Filtro>, grupo?: string) => mudar(p => ({ ...p, filtros: { ...p.filtros, [id]: { ...(p.filtros[id] ?? FILTRO_NEUTRO), ...d } } }), grupo);
  return (<>
    {projeto.cameras.length > 1 && (
      <div className="flex flex-wrap gap-1">
        {projeto.cameras.map(c => (
          <button key={c.id} type="button" onClick={() => setSel(c.id)} aria-pressed={id === c.id}
            className={`rounded-md px-2 py-1 text-[11px] font-bold ${id === c.id ? "bg-sky-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{c.nome}</button>
        ))}
      </div>
    )}
    <Secao titulo={`Visual de ${nomeCam(id)}`}>
      <div className="mb-1.5 grid grid-cols-2 gap-1">
        {Object.entries(PRESETS).map(([k, pr]) => <button key={k} type="button" className={botao} onClick={() => mudarFiltro(pr.filtro)}>{pr.nome}</button>)}
      </div>
      <Deslizador rotulo="Brilho" valor={f.brilho} min={50} max={150} padrao={100} sufixo="%" onChange={v => mudarFiltro({ brilho: v }, `fb-${id}`)} />
      <Deslizador rotulo="Contraste" valor={f.contraste} min={50} max={150} padrao={100} sufixo="%" onChange={v => mudarFiltro({ contraste: v }, `fc-${id}`)} />
      <Deslizador rotulo="Saturação" valor={f.saturacao} min={0} max={200} padrao={100} sufixo="%" onChange={v => mudarFiltro({ saturacao: v }, `fs-${id}`)} />
      <Deslizador rotulo="Temperatura" valor={f.temperatura} min={-50} max={50} padrao={0} onChange={v => mudarFiltro({ temperatura: v }, `ft-${id}`)} />
      <Deslizador rotulo="Vinheta" valor={f.vinheta} min={0} max={80} padrao={0} sufixo="%" onChange={v => mudarFiltro({ vinheta: v }, `fv-${id}`)} />
    </Secao>
  </>);
}

// ---------------------------------------------------------------- Linha do tempo

function LinhaDoTempo({ projeto, t, total, ir, marcas, selTrecho, setSelTrecho, mudar, nomeCam, corCam, ondaExterna, selTexto, setSelTexto }: {
  projeto: ProjetoEdicao; t: number; total: number; ir: (t: number) => void; marcas: { entrada: number | null; saida: number | null };
  selTrecho: string | null; setSelTrecho: (id: string) => void; mudar: Mudar; nomeCam: (id: string) => string; corCam: (id: string) => string;
  ondaExterna: { picos: number[]; duracao: number } | null; selTexto: string | null; setSelTexto: (id: string) => void;
}) {
  const [pps, setPps] = useState(40);
  const caixa = useRef<HTMLDivElement>(null);
  const largura = Math.max(1, total * pps);
  const inicios = useMemo(() => iniciosEditados(projeto.cortes), [projeto.cortes]);
  // Cabe tudo na largura quando abre.
  useEffect(() => {
    const w = caixa.current?.clientWidth;
    if (w && total > 0) setPps(Math.max(2, Math.min(200, (w - 90) / total)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, []);
  // Acompanha o cursor tocando.
  useEffect(() => {
    const c = caixa.current;
    if (!c) return;
    const x = t * pps + 80;
    if (x < c.scrollLeft + 80 || x > c.scrollLeft + c.clientWidth - 40) c.scrollLeft = Math.max(0, x - c.clientWidth / 3);
  }, [t, pps]);

  const tempoDoPonto = (clientX: number) => {
    const c = caixa.current!;
    const r = c.getBoundingClientRect();
    return Math.max(0, Math.min(total, (clientX - r.left + c.scrollLeft - 80) / pps));
  };
  const arrastoCursor = useRef(false);
  const aparo = useRef<{ id: string; lado: "inicio" | "fim"; x: number; base: number } | null>(null);
  const moverPonteiro = (e: React.PointerEvent) => {
    if (arrastoCursor.current) ir(tempoDoPonto(e.clientX));
    const a = aparo.current;
    if (a) {
      const tf = a.base + (e.clientX - a.x) / pps;
      mudar(p => ({ ...p, cortes: aparar(p.cortes, a.id, a.lado, tf, p.duracao) }), `aparo-${a.id}-${a.lado}`);
    }
  };
  const soltar = () => { arrastoCursor.current = false; aparo.current = null; };
  const passoRegua = pps > 60 ? 1 : pps > 25 ? 2 : pps > 10 ? 5 : pps > 4 ? 15 : 30;
  const marcasRegua = Array.from({ length: Math.floor(total / passoRegua) + 1 }, (_, i) => i * passoRegua);
  const faixa = "relative h-7 border-b border-white/5";
  const rotulo = "sticky left-0 z-20 flex w-20 shrink-0 items-center bg-[#14171d] px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500";
  const blocos = (a: number, b: number) => pedacosEditados(projeto.cortes, a, b);

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#14171d]">
      <div className="flex h-7 items-center gap-1 border-b border-white/10 px-2 text-[10px] text-slate-500">
        <span className="mr-auto">Linha do tempo · clique para ir · arraste as pontas dos trechos para aparar</span>
        <span>Zoom</span>
        <input type="range" min={2} max={200} value={pps} onChange={e => setPps(Number(e.target.value))} aria-label="Zoom da linha do tempo" className="w-28 accent-sky-500" />
      </div>
      <div ref={caixa} className="relative max-h-[34vh] overflow-auto" onPointerMove={moverPonteiro} onPointerUp={soltar} onPointerLeave={soltar}>
        <div style={{ width: largura + 100 }} className="relative">
          {/* Régua */}
          <div className="flex h-6 border-b border-white/10">
            <div className={rotulo}>Tempo</div>
            <div className="relative flex-1 cursor-pointer" onPointerDown={e => { arrastoCursor.current = true; ir(tempoDoPonto(e.clientX)); }}>
              {marcasRegua.map(s => (
                <span key={s} className="absolute top-0 h-full border-l border-white/10 pl-0.5 text-[9px] text-slate-500" style={{ left: s * pps }}>{relogioEdicao(s).replace(/,\d$/, "")}</span>
              ))}
              {marcas.entrada !== null && marcas.saida !== null && (
                <span className="absolute top-0 h-full bg-yellow-400/20" style={{ left: Math.min(marcas.entrada, marcas.saida) * pps, width: Math.abs(marcas.saida - marcas.entrada) * pps }} />
              )}
            </div>
          </div>
          {/* Vídeo */}
          <div className="flex">
            <div className={rotulo}>Vídeo</div>
            <div className={`${faixa} flex-1`}>
              {projeto.cortes.map((c, i) => {
                const tr = projeto.transicoes[c.id];
                return (
                  <div key={c.id} onPointerDown={e => { e.stopPropagation(); setSelTrecho(c.id); ir(tempoDoPonto(e.clientX)); }}
                    className={`absolute top-0.5 bottom-0.5 overflow-hidden rounded-sm border text-[10px] ${selTrecho === c.id ? "border-sky-300 bg-sky-600/60" : "border-sky-900 bg-sky-800/50 hover:bg-sky-700/60"}`}
                    style={{ left: inicios[i] * pps, width: Math.max(2, (c.fim - c.inicio) * pps) }} title={`Trecho ${i + 1}: ${relogioEdicao(c.inicio)} → ${relogioEdicao(c.fim)} da gravação`}>
                    <span className="pointer-events-none absolute left-2 top-0.5 whitespace-nowrap text-white/90">{i + 1}{tr && tr.tipo !== "corte" ? (tr.tipo === "escurecer" ? " ◐" : " ◑") : ""}</span>
                    {(["inicio", "fim"] as const).map(lado => (
                      <span key={lado} role="separator" aria-label={`Aparar o ${lado === "inicio" ? "começo" : "fim"} do trecho ${i + 1}`}
                        onPointerDown={e => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setSelTrecho(c.id); aparo.current = { id: c.id, lado, x: e.clientX, base: lado === "inicio" ? c.inicio : c.fim }; }}
                        className={`absolute top-0 h-full w-1.5 cursor-ew-resize bg-white/40 hover:bg-white ${lado === "inicio" ? "left-0" : "right-0"}`} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Layouts */}
          <div className="flex">
            <div className={rotulo}>Layout</div>
            <div className={`${faixa} flex-1`}>
              {projeto.cenas.flatMap(c => blocos(c.inicio, c.fim).map((b, k) => (
                <div key={`${c.id}-${k}`} className="absolute top-1 bottom-1 rounded-sm border border-violet-400/60 bg-violet-600/30" style={{ left: b.inicio * pps, width: Math.max(2, (b.fim - b.inicio) * pps) }} title="Layout próprio deste trecho" />
              )))}
            </div>
          </div>
          {/* Destaques de áudio */}
          {projeto.cameras.length > 1 && (
            <div className="flex">
              <div className={rotulo}>Destaque</div>
              <div className={`${faixa} flex-1`}>
                {projeto.destaques.flatMap(d => blocos(d.inicio, d.fim).map((b, k) => (
                  <div key={`${d.id}-${k}`} className="absolute top-1 bottom-1 overflow-hidden rounded-sm px-1 text-[9px] font-bold text-black"
                    style={{ left: b.inicio * pps, width: Math.max(2, (b.fim - b.inicio) * pps), background: corCam(d.camera) }} title={`Áudio em destaque: ${nomeCam(d.camera)}`}>{nomeCam(d.camera)}</div>
                )))}
              </div>
            </div>
          )}
          {/* Textos */}
          <div className="flex">
            <div className={rotulo}>Textos</div>
            <div className={`${faixa} flex-1`}>
              {projeto.textos.flatMap(x => blocos(x.inicio, x.fim).map((b, k) => (
                <button key={`${x.id}-${k}`} type="button" onPointerDown={e => e.stopPropagation()} onClick={() => setSelTexto(x.id)}
                  className={`absolute top-1 bottom-1 overflow-hidden truncate rounded-sm px-1 text-left text-[9px] ${selTexto === x.id ? "bg-amber-300 text-black" : "bg-amber-500/40 text-amber-50"}`}
                  style={{ left: b.inicio * pps, width: Math.max(2, (b.fim - b.inicio) * pps) }} title={x.texto}>{x.texto}</button>
              )))}
            </div>
          </div>
          {/* Áudio externo */}
          {projeto.externo && (
            <div className="flex">
              <div className={rotulo}>Mesa</div>
              <div className={`${faixa} flex-1`}>
                {ondaExterna ? (
                  <svg className="absolute inset-0 h-full" width={largura} preserveAspectRatio="none" viewBox={`0 0 ${largura} 28`} aria-hidden>
                    {projeto.cortes.map((c, i) => {
                      // Cada trecho mostra o pedaço do áudio importado que toca nele.
                      const n = ondaExterna.picos.length;
                      const pts: string[] = [];
                      for (let x = 0; x <= (c.fim - c.inicio) * pps; x += 2) {
                        const tExt = c.inicio + x / pps + (projeto.externo?.deslocamento ?? 0);
                        const v = tExt < 0 ? 0 : ondaExterna.picos[Math.floor((tExt / ondaExterna.duracao) * n)] ?? 0;
                        pts.push(`${inicios[i] * pps + x},${14 - v * 13} ${inicios[i] * pps + x},${14 + v * 13}`);
                      }
                      return <polyline key={c.id} points={pts.join(" ")} fill="none" stroke="#34d399" strokeWidth={1} />;
                    })}
                  </svg>
                ) : <span className="absolute left-2 top-1.5 text-[10px] text-emerald-300">{projeto.externo.nome} ({projeto.externo.deslocamento >= 0 ? "+" : ""}{projeto.externo.deslocamento.toFixed(3).replace(".", ",")} s)</span>}
              </div>
            </div>
          )}
          {/* Cursor */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500" style={{ left: 80 + t * pps }} />
          {marcas.entrada !== null && <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-300" style={{ left: 80 + marcas.entrada * pps }} />}
          {marcas.saida !== null && <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-300" style={{ left: 80 + marcas.saida * pps }} />}
        </div>
      </div>
    </div>
  );
}
