import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Battery, BatteryCharging, Camera, Circle, Clock, Flashlight, Grid2x2, Grid3x3, Maximize2, Mic, MicOff, Minimize2,
  Pencil, Power, Radar, Square, Volume2, VolumeX, X,
} from "lucide-react";
import {
  botoesDeZoom, fracaoDeMovimento, limiarDaSensibilidade, nomeDoArquivo, novoAvisoDeMovimento, zoomPorPinca, formatoDeGravacao,
} from "@/react-app/utils/drumcamAoVivo";
import { useAoVivo, useConexao } from "./AoVivo";
import { galeria, idAleatorio } from "./armazenamento";
import { BotaoIcone, Deslizador, Painel, VideoAoVivo } from "./ui";

interface Evento { id: string; camera: string; nome: string; hora: number; miniatura: string }
interface Ajustes { movimento: boolean; sensibilidade: number; gravarClipes: boolean; som: boolean; notificar: boolean; relogio: boolean }
const AJUSTES_PADRAO: Ajustes = { movimento: false, sensibilidade: 6, gravarClipes: true, som: true, notificar: false, relogio: true };

function lerAjustes(): Ajustes {
  try { return { ...AJUSTES_PADRAO, ...JSON.parse(localStorage.getItem("drumcam-monitor") || "{}") }; } catch { return AJUSTES_PADRAO; }
}

/** Bipe curto de alerta (sem arquivo de som). */
function bipe() {
  try {
    const ac = new AudioContext(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.18);
    setTimeout(() => void ac.close(), 400);
  } catch { /* sem áudio */ }
}

/**
 * Monitoramento (estilo central de segurança): todas as câmeras ao vivo em grade, leves (qualidade baixa) para
 * ficarem fluidas; a que vai para a tela cheia sobe para a qualidade alta. Zoom por pinça e por botões (0,5×, 1×,
 * 2×…), foto, lanterna, ouvir, renomear, detecção de movimento com aviso e clipe gravado, e a lista de eventos.
 */
export default function MonitorDrumcam() {
  const { cameras, estado } = useAoVivo();
  const aoVivo = useMemo(() => cameras.filter(c => c.tipo === "aovivo"), [cameras]);
  const [foco, setFoco] = useState<string | null>(null);
  const [grade, setGrade] = useState<0 | 1 | 4 | 9>(0);
  const [ajustes, setAjustes] = useState<Ajustes>(lerAjustes);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const raiz = useRef<HTMLDivElement>(null);
  const [cheia, setCheia] = useState(false);

  useEffect(() => { try { localStorage.setItem("drumcam-monitor", JSON.stringify(ajustes)); } catch { /* sem armazenamento */ } }, [ajustes]);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (foco && !aoVivo.some(c => c.id === foco)) setFoco(null); }, [aoVivo, foco]);
  useEffect(() => {
    const f = () => setCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const mudar = (p: Partial<Ajustes>) => {
    if (p.notificar && typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    setAjustes(a => ({ ...a, ...p }));
  };

  const aoMovimento = useCallback((ev: Evento) => {
    setEventos(e => [ev, ...e].slice(0, 60));
    if (ajustes.som) bipe();
    if (ajustes.notificar && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try { new Notification("Movimento", { body: `${ev.nome} · ${new Date(ev.hora).toLocaleTimeString("pt-BR")}`, icon: "/icones/icone-192.png", tag: `mov-${ev.camera}` }); } catch { /* sem notificação */ }
    }
  }, [ajustes.som, ajustes.notificar]);

  const colunas = grade || (aoVivo.length <= 1 ? 1 : aoVivo.length <= 4 ? 2 : 3);
  const visiveis = grade ? aoVivo.slice(0, grade) : aoVivo;

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void raiz.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div ref={raiz} className={`grid gap-2 lg:grid-cols-[minmax(0,1fr)_260px] ${cheia ? "h-screen bg-[#0f1115] p-2" : ""}`}>
      <Painel titulo={`Monitoramento · ${aoVivo.length} câmera${aoVivo.length === 1 ? "" : "s"}`} corpo="p-1.5" acoes={
        <span className="flex items-center gap-1">
          <span className="mr-1 hidden font-mono text-[11px] text-slate-400 sm:inline">{new Date(agora).toLocaleString("pt-BR")}</span>
          <BotaoIcone rotulo="Grade automática" ativo={grade === 0} onClick={() => setGrade(0)}>Auto</BotaoIcone>
          <BotaoIcone rotulo="Grade 2×2" ativo={grade === 4} onClick={() => setGrade(4)}><Grid2x2 className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo="Grade 3×3" ativo={grade === 9} onClick={() => setGrade(9)}><Grid3x3 className="h-4 w-4" /></BotaoIcone>
          <BotaoIcone rotulo={cheia ? "Sair da tela cheia" : "Tela cheia"} onClick={telaCheia}>{cheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</BotaoIcone>
        </span>}>
        {aoVivo.length === 0 ? (
          <p className="grid h-60 place-items-center text-center text-sm text-slate-500">{estado === "conectado" ? "Nenhuma câmera ao vivo. Ligue uma em Câmeras." : "Conectando ao NordTool…"}</p>
        ) : foco ? (
          <TelaFoco id={foco} nome={aoVivo.find(c => c.id === foco)?.nome ?? ""} relogio={ajustes.relogio} agora={agora} fechar={() => setFoco(null)} />
        ) : (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
            {visiveis.map(c => (
              <Mosaico key={c.id} id={c.id} nome={c.nome} ajustes={ajustes} agora={agora} abrir={() => setFoco(c.id)} aoMovimento={aoMovimento} />
            ))}
          </div>
        )}
      </Painel>

      <div className="grid min-h-0 gap-2 lg:grid-rows-[auto_minmax(0,1fr)]">
        <Painel titulo="Detecção de movimento" acoes={
          <BotaoIcone rotulo={ajustes.movimento ? "Desligar detecção" : "Ligar detecção"} ativo={ajustes.movimento} onClick={() => mudar({ movimento: !ajustes.movimento })}><Radar className="h-4 w-4" /></BotaoIcone>}>
          <div className="space-y-1 text-xs text-slate-300">
            <Deslizador rotulo="Sensibilidade" valor={ajustes.sensibilidade} min={1} max={10} padrao={6} onChange={v => mudar({ sensibilidade: v })} />
            {([["gravarClipes", "Gravar clipe de 15 s ao detectar"], ["som", "Bipe de alerta"], ["notificar", "Notificação do aparelho"], ["relogio", "Data e hora sobre a imagem"]] as const).map(([k, r]) => (
              <label key={k} className="flex items-center gap-2 py-0.5">
                <input type="checkbox" checked={ajustes[k]} onChange={e => mudar({ [k]: e.target.checked })} className="accent-sky-500" />{r}
              </label>
            ))}
            <p className="pt-1 text-[11px] text-slate-500">A detecção roda neste aparelho, com esta tela aberta.</p>
          </div>
        </Painel>
        <Painel titulo="Eventos" acoes={eventos.length ? <button type="button" onClick={() => setEventos([])} className="text-[11px] text-slate-400 hover:text-white">Limpar</button> : undefined}>
          {eventos.length === 0 ? <p className="p-1 text-xs text-slate-500">{ajustes.movimento ? "Nenhum movimento por enquanto." : "Ligue a detecção de movimento para ver os eventos aqui."}</p> : (
            <ul className="space-y-1">
              {eventos.map(e => (
                <li key={e.id}>
                  <button type="button" onClick={() => setFoco(e.camera)} className="flex w-full items-center gap-2 rounded p-1 text-left hover:bg-white/5">
                    <img src={e.miniatura} alt="" className="h-9 w-16 rounded object-cover" />
                    <span className="min-w-0 text-xs"><span className="block truncate font-semibold text-slate-200">{e.nome}</span>
                      <span className="text-slate-500">{new Date(e.hora).toLocaleTimeString("pt-BR")}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}

/** Uma câmera na grade: leve, com nome, situação, bateria, relógio e detecção de movimento. */
function Mosaico({ id, nome, ajustes, agora, abrir, aoMovimento }: { id: string; nome: string; ajustes: Ajustes; agora: number; abrir: () => void; aoMovimento: (e: Evento) => void }) {
  const c = useConexao(id, "baixa");
  const video = useRef<HTMLVideoElement | null>(null);
  const [alerta, setAlerta] = useState(0);
  const [clipe, setClipe] = useState(false);
  const pronto = useCallback((v: HTMLVideoElement) => { video.current = v; }, []);

  // Detecção: compara quadros pequenos (64×36) a cada 300 ms.
  useEffect(() => {
    if (!ajustes.movimento) return;
    const tela = document.createElement("canvas");
    tela.width = 64; tela.height = 36;
    const ctx = tela.getContext("2d", { willReadFrequently: true })!;
    let anterior: Uint8ClampedArray | null = null, ultimoAviso = 0;
    const historico: boolean[] = [];
    const t = setInterval(() => {
      const v = video.current;
      if (!v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 64, 36);
      const atual = ctx.getImageData(0, 0, 64, 36).data;
      if (anterior) {
        historico.push(fracaoDeMovimento(anterior, atual) >= limiarDaSensibilidade(ajustes.sensibilidade));
        if (historico.length > 6) historico.shift();
        const agoraMs = Date.now();
        if (novoAvisoDeMovimento(historico, ultimoAviso, agoraMs)) {
          ultimoAviso = agoraMs;
          setAlerta(agoraMs);
          const mini = document.createElement("canvas");
          mini.width = 160; mini.height = 90;
          mini.getContext("2d")!.drawImage(v, 0, 0, 160, 90);
          const miniatura = mini.toDataURL("image/jpeg", 0.7);
          aoMovimento({ id: `${id}-${agoraMs}`, camera: id, nome, hora: agoraMs, miniatura });
          if (ajustes.gravarClipes && c?.stream) void gravarClipe(c.stream, nome, miniatura, setClipe);
        }
      }
      anterior = atual;
    }, 300);
    return () => clearInterval(t);
  }, [ajustes.movimento, ajustes.sensibilidade, ajustes.gravarClipes, aoMovimento, c?.stream, id, nome]);

  const piscando = agora - alerta < 4000;
  const e = c?.estado;
  return (
    <button type="button" onClick={abrir} aria-label={`Abrir ${nome}`}
      className={`group relative aspect-video overflow-hidden rounded bg-black text-left ring-2 ${piscando ? "ring-red-500" : "ring-transparent hover:ring-sky-500/60"}`}>
      <VideoAoVivo stream={c?.stream ?? null} className="h-full w-full object-cover" aoPronto={pronto}
        estilo={c?.zoomDigital && c.zoomDigital > 1 ? { transform: `scale(${c.zoomDigital})` } : undefined} />
      <span className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent px-2 py-1 text-[11px] font-semibold text-white">
        <span className={`h-2 w-2 rounded-full ${c?.situacao === "aovivo" ? "bg-emerald-400" : c?.situacao === "caiu" ? "bg-red-500" : "animate-pulse bg-yellow-400"}`} />
        <span className="truncate">{nome}</span>
        {(e?.gravando || clipe) && <span className="flex items-center gap-0.5 rounded bg-red-600 px-1 text-[10px]"><Circle className="h-2 w-2 fill-current" />REC</span>}
        {e?.bateria != null && <span className="ml-auto flex items-center gap-0.5 text-slate-200">{e.carregando ? <BatteryCharging className="h-3.5 w-3.5" /> : <Battery className="h-3.5 w-3.5" />}{e.bateria}%</span>}
      </span>
      {ajustes.relogio && <span className="absolute bottom-1 left-1.5 font-mono text-[10px] text-white/80 [text-shadow:0_1px_2px_#000]">{new Date(agora).toLocaleString("pt-BR")}</span>}
      {piscando && <span className="absolute bottom-1 right-1.5 rounded bg-red-600 px-1 text-[10px] font-bold text-white">Movimento</span>}
      {c?.situacao !== "aovivo" && <span className="absolute inset-0 grid place-items-center text-xs text-slate-400">{c?.situacao === "caiu" ? "Reconectando…" : "Conectando…"}</span>}
    </button>
  );
}

/** Clipe de 15 s de uma câmera (movimento ou manual), direto para a galeria. */
async function gravarClipe(stream: MediaStream, nome: string, miniatura: string, gravando: (b: boolean) => void, segundos = 15, origem: "movimento" | "clipe" = "movimento") {
  const { mime } = formatoDeGravacao(m => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 2_500_000 });
  const partes: Blob[] = [];
  rec.ondataavailable = ev => { if (ev.data.size) partes.push(ev.data); };
  gravando(true);
  rec.start(1000);
  await new Promise(r => setTimeout(r, segundos * 1000));
  await new Promise<void>(ok => { rec.onstop = () => ok(); rec.stop(); });
  gravando(false);
  const blob = new Blob(partes, { type: rec.mimeType || "video/webm" });
  await galeria.salvar({
    id: idAleatorio(), tipo: "video", nome: nomeDoArquivo(`${origem === "movimento" ? "Movimento" : "Clipe"} ${nome}`, new Date(), blob.type.includes("mp4") ? "mp4" : "webm"),
    origem, camera: nome, criadoEm: Date.now(), duracao: segundos, tamanho: blob.size, mime: blob.type, blob, miniatura,
  });
}

/** Câmera em tela cheia, qualidade alta, com todos os controles. */
function TelaFoco({ id, nome, relogio, agora, fechar }: { id: string; nome: string; relogio: boolean; agora: number; fechar: () => void }) {
  const c = useConexao(id, "alta");
  const [ouvir, setOuvir] = useState(false);
  const [editando, setEditando] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [aviso, setAviso] = useState<string | null>(null);
  const [clipe, setClipe] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<{ dist: number; zoom: number } | null>(null);
  const enviar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const e = c?.estado;
  const fator = e ? e.lentes.find(l => l.id === e.lente)?.fator ?? 1 : 1;
  const zoomAtual = fator * (e?.zoom?.valor ?? 1) * (c?.zoomDigital || 1);
  const [zoomLocal, setZoomLocal] = useState<number | null>(null);
  const zoomMostrado = zoomLocal ?? zoomAtual;
  const minZoom = e?.lentes.some(l => l.fator === 0.5 && !l.frente) ? 0.5 : Math.max(0.5, e?.zoom?.min ?? 1);
  const maxZoom = Math.max(e?.zoom?.max ?? 1, ...(e?.lentes.map(l => l.fator) ?? [1]), 8);

  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto); }, [foto]);

  // Zoom com atraso curto (a pinça manda muitos valores; a câmera recebe o último).
  const pedirZoom = (z: number) => {
    setZoomLocal(z);
    if (enviar.current) clearTimeout(enviar.current);
    enviar.current = setTimeout(() => { void c?.zoom(z).catch(() => undefined).finally(() => setZoomLocal(null)); }, 120);
  };

  const distancia = () => { const [a, b] = [...toques.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const onPointerDown = (ev: React.PointerEvent) => {
    toques.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    if (toques.current.size === 2) pinca.current = { dist: distancia(), zoom: zoomMostrado };
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    if (!toques.current.has(ev.pointerId)) return;
    toques.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinca.current && toques.current.size === 2) pedirZoom(zoomPorPinca(pinca.current.zoom, pinca.current.dist, distancia(), minZoom, maxZoom));
  };
  const onPointerUp = (ev: React.PointerEvent) => { toques.current.delete(ev.pointerId); if (toques.current.size < 2) pinca.current = null; };
  const onWheel = (ev: React.WheelEvent) => { pedirZoom(Math.min(maxZoom, Math.max(minZoom, Math.round(zoomMostrado * (ev.deltaY < 0 ? 1.1 : 1 / 1.1) * 100) / 100))); };

  const tirarFoto = async () => {
    if (!c) return;
    setAviso("Tirando a foto na resolução da câmera…");
    try {
      const blob = await c.foto();
      const url = URL.createObjectURL(blob);
      setFoto(url);
      const mini = await miniaturaDaImagem(url);
      await galeria.salvar({ id: idAleatorio(), tipo: "foto", nome: nomeDoArquivo(`Foto ${nome}`, new Date(), "jpg"), origem: "foto", camera: nome, criadoEm: Date.now(), tamanho: blob.size, mime: blob.type || "image/jpeg", blob, miniatura: mini });
      setAviso("Foto salva na Galeria.");
    } catch (err) { setAviso((err as Error).message); }
  };

  const renomear = async () => {
    setEditando(false);
    if (!c || !novoNome.trim() || novoNome === nome) return;
    await c.comando({ c: "nome", nome: novoNome.trim() }).catch(err => setAviso((err as Error).message));
  };

  return (
    <div className="space-y-2">
      <div ref={area} className="relative aspect-video touch-none overflow-hidden rounded bg-black"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
        onDoubleClick={() => pedirZoom(1)}>
        <VideoAoVivo stream={c?.stream ?? null} mudo={!ouvir} className="h-full w-full object-contain"
          estilo={{ transform: c?.zoomDigital && c.zoomDigital > 1 ? `scale(${c.zoomDigital})` : undefined }} />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white">
          <span className={`h-2 w-2 rounded-full ${c?.situacao === "aovivo" ? "bg-emerald-400" : "animate-pulse bg-yellow-400"}`} />{nome}
          {e && <span className="text-slate-300">· {e.largura}×{e.altura}</span>}
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 font-mono text-xs font-bold text-white">{zoomMostrado.toFixed(1).replace(".", ",")}×</span>
        {relogio && <span className="absolute bottom-2 left-2 font-mono text-xs text-white/90 [text-shadow:0_1px_2px_#000]">{new Date(agora).toLocaleString("pt-BR")}</span>}
        <button type="button" onClick={fechar} aria-label="Voltar para a grade" className="absolute bottom-2 right-2 rounded bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex gap-1 rounded-md bg-black/30 p-1">
          {e && botoesDeZoom(e.zoom, e.lentes).map(z => (
            <button key={z} type="button" onClick={() => pedirZoom(z)} aria-pressed={Math.abs(zoomMostrado - z) < 0.05}
              className={`h-7 min-w-9 rounded-full px-2 text-xs font-black ${Math.abs(zoomMostrado - z) < 0.05 ? "bg-yellow-400 text-black" : "bg-white/10 text-white hover:bg-white/20"}`}>
              {String(z).replace(".", ",")}×
            </button>
          ))}
        </span>
        <input type="range" min={minZoom} max={maxZoom} step={0.1} value={zoomMostrado} onChange={ev => pedirZoom(Number(ev.target.value))}
          aria-label="Zoom" className="w-32 accent-yellow-400" />
        <BotaoIcone rotulo="Foto" onClick={() => void tirarFoto()}><Camera className="h-4 w-4" /></BotaoIcone>
        <BotaoIcone rotulo={clipe ? "Gravando clipe…" : "Gravar clipe de 30 s"} perigo={clipe} disabled={clipe || !c?.stream}
          onClick={() => c?.stream && void gravarClipe(c.stream, nome, "", setClipe, 30, "clipe")}>{clipe ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</BotaoIcone>
        <BotaoIcone rotulo={ouvir ? "Parar de ouvir" : "Ouvir o áudio da câmera"} ativo={ouvir} onClick={() => setOuvir(o => !o)}>{ouvir ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</BotaoIcone>
        {e?.lanterna !== null && e?.lanterna !== undefined && (
          <BotaoIcone rotulo="Lanterna" ativo={e.lanterna} onClick={() => void c?.comando({ c: "lanterna", ligada: !e.lanterna })}><Flashlight className="h-4 w-4" /></BotaoIcone>
        )}
        {e && <BotaoIcone rotulo={e.microfone ? "Desligar o microfone da câmera" : "Ligar o microfone da câmera"} ativo={e.microfone}
          onClick={() => void c?.comando({ c: "microfone", ligado: !e.microfone })}>{e.microfone ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</BotaoIcone>}
        {e && e.lentes.length > 1 && (
          <select value={e.lente} onChange={ev => void c?.comando({ c: "lente", lente: ev.target.value })} aria-label="Lente"
            className="h-8 rounded-md bg-white/5 px-2 text-xs text-slate-200">
            {e.lentes.map(l => <option key={l.id} value={l.id} className="bg-slate-900">{l.nome}</option>)}
          </select>
        )}
        <select defaultValue="1080" onChange={ev => void c?.comando({ c: "resolucao", altura: Number(ev.target.value) })} aria-label="Resolução"
          className="h-8 rounded-md bg-white/5 px-2 text-xs text-slate-200">
          {[720, 1080, 1440, 2160].map(a => <option key={a} value={a} className="bg-slate-900">{a === 2160 ? "4K" : `${a}p`}</option>)}
        </select>
        {editando ? (
          <span className="flex gap-1">
            <input value={novoNome} onChange={ev => setNovoNome(ev.target.value)} maxLength={60} aria-label="Nome da câmera" autoFocus
              onKeyDown={ev => { if (ev.key === "Enter") void renomear(); }} className="h-8 rounded-md bg-black/40 px-2 text-xs text-white" />
            <BotaoIcone rotulo="Salvar nome" ativo onClick={() => void renomear()}>OK</BotaoIcone>
          </span>
        ) : <BotaoIcone rotulo="Renomear câmera" onClick={() => { setNovoNome(nome); setEditando(true); }}><Pencil className="h-4 w-4" /></BotaoIcone>}
        <BotaoIcone rotulo="Desligar câmera" perigo onClick={() => {
          if (!c || !confirm(`Desligar a câmera "${nome}"? Ela sai do ar e, para voltar, alguém liga de novo no aparelho dela.`)) return;
          void c.comando({ c: "desligar" }).then(() => setAviso(`"${nome}" foi desligada.`)).catch(err => setAviso((err as Error).message));
        }}><Power className="h-4 w-4" />Desligar</BotaoIcone>
        {e?.bateria != null && <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">{e.carregando ? <BatteryCharging className="h-4 w-4" /> : <Battery className="h-4 w-4" />}{e.bateria}%</span>}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-slate-500"><Clock className="h-3 w-3" />Pinça (ou rodinha do mouse) para zoom; duplo toque volta a 1×. {e?.zoom ? "Zoom óptico/digital da própria câmera." : "Esta câmera não tem zoom próprio: o zoom é digital, aqui."}</p>
      {aviso && <p className="rounded bg-white/5 px-2 py-1 text-xs text-slate-200" role="status">{aviso}</p>}
      {foto && (
        <div className="flex items-center gap-2 rounded bg-white/5 p-2">
          <img src={foto} alt={`Foto de ${nome}`} className="h-20 rounded" />
          <a href={foto} download={nomeDoArquivo(`Foto ${nome}`, new Date(), "jpg")} className="rounded bg-sky-600 px-2 py-1 text-xs font-bold text-white">Baixar</a>
        </div>
      )}
    </div>
  );
}

async function miniaturaDaImagem(url: string): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);
  const c = document.createElement("canvas");
  c.width = 320; c.height = Math.round(320 * (img.naturalHeight || 9) / (img.naturalWidth || 16));
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}
