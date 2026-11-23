import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Circle, Columns2, Eye, EyeOff, FlipHorizontal, Grid2x2, Headphones, ImageDown, LayoutTemplate, Loader2,
  PictureInPicture2, Rows2, Square, SquareStack, Video, Volume2, VolumeX,
} from "lucide-react";
import {
  CANAL_PADRAO, FILTRO_NEUTRO, PRESETS, alinhamento, botoesDeZoom, dbDoGanho, duracaoTexto, layoutPadrao, moverCamada, nomeDoArquivo,
  paraFrente, redimensionarCamada, type Camada, type Canal, type Filtro, type Formato, type Layout,
} from "@/react-app/utils/drumcamAoVivo";
import { useAoVivo, useConexao } from "./AoVivo";
import { Compositor } from "./compositor";
import { galeria, idAleatorio } from "./armazenamento";
import type { ConexaoCamera } from "./conexaoCamera";
import { BotaoIcone, Deslizador, Medidor, Painel } from "./ui";

const CENAS: { id: Layout; nome: string; icone: typeof Columns2 }[] = [
  { id: "lado", nome: "Lado a lado", icone: Columns2 },
  { id: "pip", nome: "Janelinha (PiP)", icone: PictureInPicture2 },
  { id: "destaque", nome: "Destaque", icone: LayoutTemplate },
  { id: "grade", nome: "Grade", icone: Grid2x2 },
  { id: "empilhado", nome: "Empilhado", icone: Rows2 },
  { id: "unica", nome: "Uma câmera", icone: Square },
];

type Modo = "rapido" | "hq";
interface Montagem { etapa: string; progresso: number }

/**
 * Estúdio (estilo mesa de transmissão): escolhe as câmeras (fontes), a cena (layout), arrasta e redimensiona cada
 * câmera no programa, ajusta filtros e o mixer de áudio, e grava. "Rápido" grava o programa ao vivo; "Alta
 * qualidade" também manda cada câmera gravar no próprio aparelho e, no fim, monta o vídeo com os arquivos dela.
 */
export default function EstudioDrumcam({ aoGravar }: { aoGravar?: (id: string) => void }) {
  // O compositor nasce e morre com a tela (no modo estrito do React, a tela monta duas vezes).
  const [comp, setComp] = useState<Compositor | null>(null);
  useEffect(() => { const c = new Compositor("16:9"); setComp(c); return () => c.fechar(); }, []);
  if (!comp) return null;
  return <Estudio comp={comp} aoGravar={aoGravar} />;
}

function Estudio({ comp, aoGravar }: { comp: Compositor; aoGravar?: (id: string) => void }) {
  const { cameras } = useAoVivo();
  const aoVivo = useMemo(() => cameras.filter(c => c.tipo === "aovivo"), [cameras]);

  const [usadas, setUsadas] = useState<string[]>([]);
  const [cena, setCena] = useState<Layout>("lado");
  const [formato, setFormato] = useState<Formato>("16:9");
  const [camadas, setCamadas] = useState<Camada[]>([]);
  const [filtros, setFiltros] = useState<Record<string, Filtro>>({});
  const [canais, setCanais] = useState<Record<string, Canal>>({});
  const [mestre, setMestre] = useState(1);
  const [ouvir, setOuvir] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [proporcao, setProporcao] = useState(false);
  const [modo, setModo] = useState<Modo>("rapido");
  const [gravando, setGravando] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [montagem, setMontagem] = useState<Montagem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const conexoes = useRef(new Map<string, ConexaoCamera>());
  const sessao = useRef<string | null>(null);

  // Câmeras novas entram sozinhas (até 4) quando o estúdio está vazio.
  useEffect(() => {
    setUsadas(u => {
      const vivas = u.filter(id => aoVivo.some(c => c.id === id));
      if (vivas.length || !aoVivo.length) return vivas.length === u.length ? u : vivas;
      return aoVivo.slice(0, 2).map(c => c.id);
    });
  }, [aoVivo]);

  // Trocar a cena, o formato ou as câmeras refaz as posições.
  useEffect(() => { setCamadas(layoutPadrao(usadas, cena, formato)); }, [usadas, cena, formato]);
  useEffect(() => { comp.redimensionar(formato); }, [comp, formato]);
  useEffect(() => {
    for (const c of camadas) { const f = comp.fontes.get(c.id); if (f) f.camada = c; }
  }, [camadas, comp]);
  useEffect(() => {
    for (const [id, f] of comp.fontes) { f.filtro = filtros[id] ?? FILTRO_NEUTRO; f.canal = canais[id] ?? CANAL_PADRAO; }
    comp.aplicarMixer(mestre);
  }, [filtros, canais, mestre, comp]);
  useEffect(() => { comp.ouvir(ouvir); if (ouvir) void comp.audio.resume(); }, [ouvir, comp]);
  useEffect(() => { if (gravando === null) return; const t = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(t); }, [gravando]);

  // O programa (canvas) entra na tela.
  const palco = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const p = palco.current;
    if (!p) return;
    comp.canvas.className = "absolute inset-0 h-full w-full";
    p.prepend(comp.canvas);
  }, [comp]);

  const nome = (id: string) => aoVivo.find(c => c.id === id)?.nome ?? "Câmera";
  const sel = camadas.find(c => c.id === selecionada) ?? null;
  const filtroSel = selecionada ? filtros[selecionada] ?? FILTRO_NEUTRO : FILTRO_NEUTRO;
  const mudarFiltro = (p: Partial<Filtro>) => selecionada && setFiltros(f => ({ ...f, [selecionada]: { ...(f[selecionada] ?? FILTRO_NEUTRO), ...p } }));
  const mudarCanal = (id: string, p: Partial<Canal>) => setCanais(c => ({ ...c, [id]: { ...(c[id] ?? CANAL_PADRAO), ...p } }));
  const mudarCamada = (id: string, f: (c: Camada) => Camada) => setCamadas(cs => cs.map(c => (c.id === id ? f(c) : c)));

  const registrar = useCallback((id: string, c: ConexaoCamera | null) => {
    if (c) conexoes.current.set(id, c); else { conexoes.current.delete(id); comp.remover(id); }
  }, [comp]);

  // ---------------------------------------------------------- arrastar e redimensionar no programa
  const arrasto = useRef<{ id: string; canto: "mover" | "no" | "ne" | "so" | "se"; x: number; y: number; base: Camada } | null>(null);
  const iniciarArrasto = (e: React.PointerEvent, id: string, canto: "mover" | "no" | "ne" | "so" | "se") => {
    e.stopPropagation();
    const base = camadas.find(c => c.id === id);
    if (!base || gravando !== null && modo === "hq") return;
    setSelecionada(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrasto.current = { id, canto, x: e.clientX, y: e.clientY, base };
  };
  const moverArrasto = (e: React.PointerEvent) => {
    const a = arrasto.current, p = palco.current;
    if (!a || !p) return;
    const r = p.getBoundingClientRect();
    const dx = (e.clientX - a.x) / r.width, dy = (e.clientY - a.y) / r.height;
    const fonte = comp.fontes.get(a.id)?.video;
    const prop = proporcao && fonte?.videoWidth ? (fonte.videoWidth / fonte.videoHeight) * (r.height / r.width) : undefined;
    mudarCamada(a.id, () => (a.canto === "mover" ? moverCamada(a.base, dx, dy) : redimensionarCamada(a.base, a.canto as "no", dx, dy, prop)));
  };

  // ---------------------------------------------------------- gravação
  const gravar = async () => {
    if (!usadas.length) { setAviso("Escolha ao menos uma câmera em Fontes."); return; }
    setAviso(null);
    void comp.audio.resume();
    if (modo === "hq") {
      const s = idAleatorio().replace(/[^\w-]/g, "");
      sessao.current = s;
      const falhas: string[] = [];
      await Promise.all(usadas.map(async id => {
        try { await conexoes.current.get(id)?.comando({ c: "gravar", sessao: s }); } catch { falhas.push(nome(id)); }
      }));
      if (falhas.length) setAviso(`Não começaram a gravar no aparelho: ${falhas.join(", ")}. O programa ao vivo grava assim mesmo.`);
    }
    comp.gravar();
    setGravando(Date.now());
  };

  const parar = async () => {
    if (!comp.gravando) return;
    const miniatura = comp.miniatura();
    const { blob, duracao } = await comp.parar();
    setGravando(null);
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const id = idAleatorio();
    await galeria.salvar({ id, tipo: "video", nome: nomeDoArquivo("Estúdio", new Date(), ext), origem: "estudio", criadoEm: Date.now(), duracao, tamanho: blob.size, mime: blob.type, blob, miniatura });
    aoGravar?.(id);
    if (modo === "hq" && sessao.current) await montarAltaQualidade(sessao.current, duracao);
  };

  /** Pega o arquivo de cada câmera e monta o vídeo de novo, com a mesma cena, filtros e mixer. */
  const montarAltaQualidade = async (s: string, duracaoPrograma: number) => {
    const arquivos: { id: string; blob: Blob; inicio: number; diferenca: number }[] = [];
    try {
      for (const [i, id] of usadas.entries()) {
        const c = conexoes.current.get(id);
        if (!c) continue;
        setMontagem({ etapa: `Parando ${nome(id)}…`, progresso: 0 });
        const r = await c.comando({ c: "parar" }, { prazo: 30_000 });
        const arq = r.arquivo as { inicio: number } | null;
        if (!arq) continue;
        const resp = await c.comando({ c: "arquivo", sessao: s }, {
          prazo: 60_000,
          progresso: f => setMontagem({ etapa: `Recebendo o vídeo de ${nome(id)} (${i + 1} de ${usadas.length})`, progresso: f }),
        });
        arquivos.push({ id, blob: resp.blob as Blob, inicio: arq.inicio, diferenca: c.diferenca });
      }
      if (!arquivos.length) throw new Error("Nenhuma câmera mandou o vídeo.");
      setMontagem({ etapa: "Montando em alta qualidade (leva o tempo do vídeo)…", progresso: 0 });
      const blob = await montar(arquivos, camadas, filtros, canais, mestre, formato, duracaoPrograma, f => setMontagem({ etapa: "Montando em alta qualidade (leva o tempo do vídeo)…", progresso: f }));
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const id = idAleatorio();
      await galeria.salvar({ id, tipo: "video", nome: nomeDoArquivo("Estúdio HQ", new Date(), ext), origem: "montagem", criadoEm: Date.now(), duracao: duracaoPrograma, tamanho: blob.size, mime: blob.type, blob, miniatura: comp.miniatura() });
      aoGravar?.(id);
      setAviso("Vídeo em alta qualidade pronto na Galeria.");
    } catch (err) {
      setAviso(`A montagem em alta qualidade não terminou: ${(err as Error).message} A versão ao vivo está na Galeria.`);
    } finally {
      setMontagem(null);
    }
  };

  const fotoDoPrograma = async () => {
    const blob = await new Promise<Blob | null>(ok => comp.canvas.toBlob(ok, "image/jpeg", 0.92));
    if (!blob) return;
    await galeria.salvar({ id: idAleatorio(), tipo: "foto", nome: nomeDoArquivo("Programa", new Date(), "jpg"), origem: "foto", criadoEm: Date.now(), tamanho: blob.size, mime: blob.type, blob, miniatura: comp.miniatura() });
    setAviso("Foto do programa salva na Galeria.");
  };

  const proporcaoCss = formato === "16:9" ? "16 / 9" : formato === "9:16" ? "9 / 16" : "1 / 1";
  const ordenadas = [...camadas].sort((a, b) => b.z - a.z);

  return (
    <div className="grid gap-2 lg:grid-cols-[230px_minmax(0,1fr)_270px]">
      {usadas.map(id => <FonteEstudio key={id} id={id} comp={comp} camada={camadas.find(c => c.id === id)} registrar={registrar} />)}

      {/* Coluna da esquerda: cenas e fontes */}
      <div className="grid min-h-0 gap-2 lg:grid-rows-[auto_minmax(0,1fr)]">
        <Painel titulo="Cenas">
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {CENAS.map(c => (
              <button key={c.id} type="button" onClick={() => setCena(c.id)} aria-pressed={cena === c.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold ${cena === c.id ? "bg-sky-600/90 text-white" : "text-slate-300 hover:bg-white/5"}`}>
                <c.icone className="h-4 w-4 shrink-0" />{c.nome}
              </button>
            ))}
          </div>
        </Painel>
        <Painel titulo="Fontes" acoes={<span className="text-[10px] text-slate-500">{usadas.length} no vídeo</span>}>
          {aoVivo.length === 0 ? (
            <p className="p-2 text-xs text-slate-400">Nenhuma câmera ao vivo. Em outro celular, abra Repertório → Estúdio → Câmeras e toque em “Usar este aparelho como câmera”.</p>
          ) : (
            <ul className="space-y-1">
              {aoVivo.map(c => {
                const usada = usadas.includes(c.id);
                const camada = camadas.find(x => x.id === c.id);
                return (
                  <li key={c.id} className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${selecionada === c.id ? "bg-white/10" : "hover:bg-white/5"}`}>
                    <input type="checkbox" checked={usada} aria-label={`Usar ${c.nome} no vídeo`} className="accent-sky-500"
                      onChange={e => setUsadas(u => (e.target.checked ? [...u, c.id] : u.filter(x => x !== c.id)))} disabled={gravando !== null} />
                    <button type="button" onClick={() => usada && setSelecionada(c.id)} className="min-w-0 flex-1 truncate text-left text-xs text-slate-200" title={c.nome}>
                      <Video className="mr-1 inline h-3.5 w-3.5 text-slate-500" />{c.nome}
                    </button>
                    {usada && camada && (
                      <>
                        <button type="button" title={camada.visivel ? "Esconder" : "Mostrar"} aria-label={camada.visivel ? `Esconder ${c.nome}` : `Mostrar ${c.nome}`}
                          onClick={() => mudarCamada(c.id, x => ({ ...x, visivel: !x.visivel }))} className="rounded p-1 text-slate-400 hover:bg-white/10">
                          {camada.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" title="Para a frente" aria-label={`Trazer ${c.nome} para a frente`} onClick={() => setCamadas(cs => paraFrente(cs, c.id))} className="rounded p-1 text-slate-400 hover:bg-white/10"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Para trás" aria-label={`Mandar ${c.nome} para trás`} onClick={() => mudarCamada(c.id, x => ({ ...x, z: Math.min(...camadas.map(k => k.z)) - 1 }))} className="rounded p-1 text-slate-400 hover:bg-white/10"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>

      {/* Centro: programa */}
      <div className="min-w-0 space-y-2">
        <Painel titulo="Programa" corpo="p-2" acoes={
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            {gravando !== null ? <span className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-white"><Circle className="h-2.5 w-2.5 animate-pulse fill-current" />REC {duracaoTexto((agora - gravando) / 1000)}</span>
              : <span className="text-slate-500">{formato} · 30 fps</span>}
          </span>}>
          <div className="mx-auto w-full" style={{ maxWidth: formato === "16:9" ? "100%" : formato === "1:1" ? "70vh" : "45vh" }}>
            <div ref={palco} className="relative w-full overflow-hidden rounded bg-black ring-1 ring-white/10" style={{ aspectRatio: proporcaoCss }}
              onPointerMove={moverArrasto} onPointerUp={() => { arrasto.current = null; }} onPointerDown={() => setSelecionada(null)}>
              {!usadas.length && <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">Escolha as câmeras em Fontes</p>}
              {ordenadas.filter(c => c.visivel).map(c => (
                <div key={c.id} role="button" tabIndex={0} aria-label={`Mover ${nome(c.id)}`}
                  onPointerDown={e => iniciarArrasto(e, c.id, "mover")}
                  className={`absolute cursor-move touch-none ${selecionada === c.id ? "outline outline-2 outline-red-500" : "hover:outline hover:outline-1 hover:outline-white/50"}`}
                  style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%`, zIndex: 10 + c.z }}>
                  {selecionada === c.id && (
                    <>
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-red-600 px-1 text-[10px] font-bold text-white">{nome(c.id)}</span>
                      {(["no", "ne", "so", "se"] as const).map(k => (
                        <span key={k} onPointerDown={e => iniciarArrasto(e, c.id, k)} aria-hidden
                          className={`absolute h-3.5 w-3.5 touch-none rounded-sm border-2 border-white bg-red-500 ${k[0] === "n" ? "-top-1.5" : "-bottom-1.5"} ${k[1] === "o" ? "-left-1.5" : "-right-1.5"} ${k === "no" || k === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"}`} />
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
          {aviso && <p className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-200" role="status">{aviso}</p>}
          {montagem && (
            <div className="mt-2 rounded bg-sky-500/10 p-2 text-xs text-sky-100" role="status">
              <p className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />{montagem.etapa}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-sky-500" style={{ width: `${Math.round(montagem.progresso * 100)}%` }} /></div>
            </div>
          )}
        </Painel>

        {/* Mixer */}
        <Painel titulo="Mixer de áudio" acoes={
          <BotaoIcone rotulo={ouvir ? "Parar de ouvir a mistura" : "Ouvir a mistura neste aparelho (use fone)"} ativo={ouvir} onClick={() => setOuvir(o => !o)}><Headphones className="h-4 w-4" /></BotaoIcone>}>
          <div className="space-y-1.5">
            {usadas.map(id => {
              const canal = canais[id] ?? CANAL_PADRAO;
              return (
                <div key={id} className="grid grid-cols-[minmax(0,90px)_auto_minmax(0,1fr)_auto] items-center gap-2 rounded bg-black/20 px-2 py-1.5">
                  <span className="truncate text-xs font-semibold text-slate-200" title={nome(id)}>{nome(id)}</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => mudarCanal(id, { mudo: !canal.mudo })} aria-pressed={canal.mudo} title="Mudo" aria-label={`Mudo ${nome(id)}`}
                      className={`h-6 w-6 rounded text-[10px] font-black ${canal.mudo ? "bg-red-600 text-white" : "bg-white/10 text-slate-300"}`}>{canal.mudo ? <VolumeX className="mx-auto h-3.5 w-3.5" /> : <Volume2 className="mx-auto h-3.5 w-3.5" />}</button>
                    <button type="button" onClick={() => mudarCanal(id, { solo: !canal.solo })} aria-pressed={canal.solo} title="Solo" aria-label={`Solo ${nome(id)}`}
                      className={`h-6 w-6 rounded text-[10px] font-black ${canal.solo ? "bg-yellow-500 text-black" : "bg-white/10 text-slate-300"}`}>S</button>
                  </span>
                  <span className="min-w-0 space-y-1">
                    <Medidor ler={() => comp.niveis().canais[id] ?? 0} />
                    <input type="range" min={0} max={2} step={0.01} value={canal.ganho} aria-label={`Volume ${nome(id)}`}
                      onChange={e => mudarCanal(id, { ganho: Number(e.target.value) })} onDoubleClick={() => mudarCanal(id, { ganho: 1 })} className="w-full accent-sky-500" />
                  </span>
                  <span className="w-16 text-right text-[11px] tabular-nums text-slate-400">{canal.ganho === 0 ? "-∞" : dbDoGanho(canal.ganho).toFixed(1)} dB
                    <input type="range" min={-1} max={1} step={0.05} value={canal.pan} aria-label={`Pan ${nome(id)}`} title="Esquerda / direita"
                      onChange={e => mudarCanal(id, { pan: Number(e.target.value) })} onDoubleClick={() => mudarCanal(id, { pan: 0 })} className="mt-1 w-full accent-slate-400" />
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-[minmax(0,90px)_minmax(0,1fr)_auto] items-center gap-2 rounded border border-white/10 px-2 py-1.5">
              <span className="text-xs font-black text-white">Mestre</span>
              <span className="space-y-1">
                <Medidor ler={() => comp.niveis().mestre} />
                <input type="range" min={0} max={2} step={0.01} value={mestre} aria-label="Volume mestre" onChange={e => setMestre(Number(e.target.value))} onDoubleClick={() => setMestre(1)} className="w-full accent-red-500" />
              </span>
              <span className="w-16 text-right text-[11px] tabular-nums text-slate-400">{mestre === 0 ? "-∞" : dbDoGanho(mestre).toFixed(1)} dB</span>
            </div>
          </div>
        </Painel>
      </div>

      {/* Direita: controles e propriedades */}
      <div className="grid min-h-0 gap-2 lg:grid-rows-[auto_minmax(0,1fr)]">
        <Painel titulo="Controles">
          <div className="space-y-2">
            {gravando === null ? (
              <button type="button" onClick={() => void gravar()} disabled={!!montagem}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50">
                <Circle className="h-4 w-4 fill-current" />Iniciar gravação
              </button>
            ) : (
              <button type="button" onClick={() => void parar()} className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-200 py-2.5 text-sm font-black text-slate-900 hover:bg-white">
                <Square className="h-4 w-4 fill-current" />Parar ({duracaoTexto((agora - gravando) / 1000)})
              </button>
            )}
            <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Qualidade da gravação">
              {([["rapido", "Rápido", "Grava o programa ao vivo"], ["hq", "Alta qualidade", "Cada câmera grava e o vídeo é montado no fim"]] as const).map(([m, r, d]) => (
                <button key={m} type="button" role="radio" aria-checked={modo === m} title={d} disabled={gravando !== null} onClick={() => setModo(m)}
                  className={`rounded-md px-2 py-1.5 text-xs font-bold ${modo === m ? "bg-sky-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{r}</button>
              ))}
            </div>
            <p className="text-[11px] leading-snug text-slate-500">{modo === "hq" ? "Cada câmera grava no próprio aparelho na qualidade máxima; ao parar, os vídeos vêm para cá e o NordTool monta com a mesma cena, filtros e volumes (leva o tempo do vídeo)." : "Grava o que está no programa agora, até 1080p. Fica pronto na hora, na Galeria."}</p>
            <div className="flex gap-1">
              {(["16:9", "9:16", "1:1"] as Formato[]).map(f => (
                <button key={f} type="button" onClick={() => setFormato(f)} disabled={gravando !== null} aria-pressed={formato === f}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-bold ${formato === f ? "bg-white/20 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>{f}</button>
              ))}
              <BotaoIcone rotulo="Foto do programa" onClick={() => void fotoDoPrograma()}><ImageDown className="h-4 w-4" /></BotaoIcone>
            </div>
          </div>
        </Painel>
        <Painel titulo={sel ? `Propriedades · ${nome(sel.id)}` : "Propriedades"}>
          {!sel ? <p className="p-1 text-xs text-slate-500">Toque numa câmera no programa (ou em Fontes) para ajustar posição, filtros e zoom.</p> : (
            <div className="space-y-3">
              <PropriedadesCamera conexao={conexoes.current.get(sel.id) ?? null} />
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Filtro</p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <button key={k} type="button" onClick={() => mudarFiltro(p.filtro)} className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10">{p.nome}</button>
                  ))}
                </div>
                <Deslizador rotulo="Brilho" valor={filtroSel.brilho} min={0} max={200} padrao={100} sufixo="%" onChange={v => mudarFiltro({ brilho: v })} />
                <Deslizador rotulo="Contraste" valor={filtroSel.contraste} min={0} max={200} padrao={100} sufixo="%" onChange={v => mudarFiltro({ contraste: v })} />
                <Deslizador rotulo="Saturação" valor={filtroSel.saturacao} min={0} max={250} padrao={100} sufixo="%" onChange={v => mudarFiltro({ saturacao: v })} />
                <Deslizador rotulo="Temperatura" valor={filtroSel.temperatura} min={-100} max={100} padrao={0} onChange={v => mudarFiltro({ temperatura: v })} />
                <Deslizador rotulo="Matiz" valor={filtroSel.matiz} min={-180} max={180} padrao={0} sufixo="°" onChange={v => mudarFiltro({ matiz: v })} />
                <Deslizador rotulo="Preto e branco" valor={filtroSel.pb} min={0} max={100} padrao={0} sufixo="%" onChange={v => mudarFiltro({ pb: v })} />
                <Deslizador rotulo="Sépia" valor={filtroSel.sepia} min={0} max={100} padrao={0} sufixo="%" onChange={v => mudarFiltro({ sepia: v })} />
                <Deslizador rotulo="Desfoque" valor={filtroSel.desfoque} min={0} max={10} passo={0.5} padrao={0} sufixo=" px" onChange={v => mudarFiltro({ desfoque: v })} />
                <Deslizador rotulo="Vinheta" valor={filtroSel.vinheta} min={0} max={100} padrao={0} sufixo="%" onChange={v => mudarFiltro({ vinheta: v })} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Posição</p>
                <div className="grid grid-cols-4 gap-1 text-[11px]">
                  {(["x", "y", "w", "h"] as const).map(k => (
                    <label key={k} className="text-slate-400">{k === "x" ? "X" : k === "y" ? "Y" : k === "w" ? "Larg." : "Alt."}
                      <input type="number" min={0} max={100} value={Math.round(sel[k] * 100)} aria-label={`${k} em %`}
                        onChange={e => mudarCamada(sel.id, c => ({ ...c, [k]: Math.min(1, Math.max(0, Number(e.target.value) / 100)) }))}
                        className="w-full rounded bg-black/40 px-1 py-0.5 text-slate-100" />
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <BotaoIcone rotulo="Preencher (corta as sobras)" ativo={sel.ajuste === "cobrir"} onClick={() => mudarCamada(sel.id, c => ({ ...c, ajuste: "cobrir" }))}>Preencher</BotaoIcone>
                  <BotaoIcone rotulo="Caber inteira (com faixas)" ativo={sel.ajuste === "conter"} onClick={() => mudarCamada(sel.id, c => ({ ...c, ajuste: "conter" }))}>Caber</BotaoIcone>
                  <BotaoIcone rotulo="Espelhar" ativo={sel.espelhar} onClick={() => mudarCamada(sel.id, c => ({ ...c, espelhar: !c.espelhar }))}><FlipHorizontal className="h-4 w-4" /></BotaoIcone>
                  <BotaoIcone rotulo="Manter a proporção ao redimensionar" ativo={proporcao} onClick={() => setProporcao(p => !p)}><SquareStack className="h-4 w-4" /></BotaoIcone>
                  <BotaoIcone rotulo="Tela cheia" onClick={() => mudarCamada(sel.id, c => ({ ...c, x: 0, y: 0, w: 1, h: 1 }))}>Cheia</BotaoIcone>
                </div>
                <Deslizador rotulo="Cantos arredondados" valor={Math.round(sel.raio * 100)} min={0} max={50} padrao={0} sufixo="%" onChange={v => mudarCamada(sel.id, c => ({ ...c, raio: v / 100 }))} />
              </div>
              <button type="button" onClick={() => setFiltros(f => ({ ...f, [sel.id]: FILTRO_NEUTRO }))} className="w-full rounded bg-white/5 py-1 text-xs text-slate-400 hover:bg-white/10">Restaurar filtro</button>
            </div>
          )}
        </Painel>
      </div>
    </div>
  );
}

/** Liga uma câmera ao compositor (vídeo escondido + áudio no mixer). */
function FonteEstudio({ id, comp, camada, registrar }: { id: string; comp: Compositor; camada?: Camada; registrar: (id: string, c: ConexaoCamera | null) => void }) {
  const conexao = useConexao(id, "media");
  const video = useMemo(() => { const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.autoplay = true; return v; }, []);
  useEffect(() => { registrar(id, conexao); return () => registrar(id, null); }, [id, conexao, registrar]);
  useEffect(() => {
    const s = conexao?.stream ?? null;
    if (video.srcObject !== s) { video.srcObject = s; if (s) void video.play().catch(() => undefined); }
    if (camada) {
      const f = comp.fonte(id, video, camada, s);
      f.zoomDigital = conexao?.zoomDigital ?? 1;
      comp.aplicarMixer();
    }
  }, [conexao, conexao?.stream, conexao?.zoomDigital, camada, comp, id, video]);
  return null;
}

/** Zoom e lente da câmera selecionada (no próprio aparelho). */
function PropriedadesCamera({ conexao }: { conexao: ConexaoCamera | null }) {
  const e = conexao?.estado;
  if (!conexao || !e) return <p className="text-[11px] text-slate-500">Conectando à câmera…</p>;
  const botoes = botoesDeZoom(e.zoom, e.lentes);
  const zoomAtual = (e.lentes.find(l => l.id === e.lente)?.fator ?? 1) * (e.zoom?.valor ?? 1) * (conexao.zoomDigital || 1);
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Câmera · {e.largura}×{e.altura}{e.bateria !== null ? ` · ${e.bateria}%` : ""}</p>
      <div className="flex flex-wrap gap-1">
        {botoes.map(z => (
          <BotaoIcone key={z} rotulo={`Zoom ${z}×`} ativo={Math.abs(zoomAtual - z) < 0.05} onClick={() => void conexao.zoom(z)}>{String(z).replace(".", ",")}×</BotaoIcone>
        ))}
      </div>
    </div>
  );
}

/**
 * Montagem em alta qualidade: toca os arquivos de cada câmera juntos (alinhados pelo relógio), desenha com a mesma
 * cena, filtros e mixer e grava. Leva o tempo do vídeo.
 */
async function montar(arquivos: { id: string; blob: Blob; inicio: number; diferenca: number }[], camadas: Camada[], filtros: Record<string, Filtro>,
  canais: Record<string, Canal>, mestre: number, formato: Formato, duracao: number, progresso: (f: number) => void): Promise<Blob> {
  const comp = new Compositor(formato);
  const atrasos = alinhamento(arquivos);
  const urls: string[] = [];
  try {
    const videos = await Promise.all(arquivos.map(async a => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(a.blob);
      urls.push(url);
      v.src = url; v.playsInline = true; v.preload = "auto";
      await new Promise<void>((ok, erro) => { v.onloadeddata = () => ok(); v.onerror = () => erro(new Error("Vídeo de uma câmera não abriu.")); });
      v.currentTime = atrasos[a.id] ?? 0;
      await new Promise<void>(ok => { v.onseeked = () => ok(); setTimeout(ok, 1500); });
      const camada = camadas.find(c => c.id === a.id) ?? layoutPadrao([a.id], "unica")[0];
      const f = comp.fonte(a.id, v, camada, v);
      f.filtro = filtros[a.id] ?? FILTRO_NEUTRO;
      f.canal = canais[a.id] ?? CANAL_PADRAO;
      return v;
    }));
    comp.aplicarMixer(mestre);
    await comp.audio.resume();
    comp.gravar();
    await Promise.all(videos.map(v => v.play()));
    const inicio = performance.now();
    await new Promise<void>(ok => {
      const t = setInterval(() => {
        const passou = (performance.now() - inicio) / 1000;
        progresso(Math.min(1, passou / Math.max(1, duracao)));
        if (videos.every(v => v.ended || v.paused) || passou > duracao + 2) { clearInterval(t); ok(); }
      }, 250);
    });
    videos.forEach(v => v.pause());
    return (await comp.parar()).blob;
  } finally {
    comp.fechar();
    urls.forEach(u => URL.revokeObjectURL(u));
  }
}
