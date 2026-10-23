import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Crown, Loader2, RotateCcw, Timer } from "lucide-react";

import GatoPixel, { RatoPixel } from "./GatoPixel";
import Joystick from "./Joystick";
import TituloPixel from "./TituloPixel";
import { lerEntrada, useControles } from "./controles";
import { daviJobService, type Placar } from "@/react-app/services/DaviJobService";
import { TEMPO_INICIAL, forcaDoRato, mensagemFinal, pontoDeNascer, tempoDepoisDePegar } from "@/react-app/utils/daviJob/cacada";
import { desenharCenario, desenharGato, desenharParticulas, desenharRato, passoParticulas, type Particula } from "@/react-app/utils/daviJob/desenho";
import { decidirRato, type EstadoRato } from "@/react-app/utils/daviJob/ia";
import { distancia, novoCorpo, passoCorpo, type Corpo } from "@/react-app/utils/daviJob/motor";
import { ALTURA, ARENA, LARGURA } from "@/react-app/utils/daviJob/mundo";
import { pelagemPorId } from "@/react-app/utils/daviJob/sprites";

type Fase = "intro" | "jogo" | "fim";
const PARAM_GATO = { velocidade: 118, pulo: 300, gravidade: 820, largura: LARGURA, altura: ALTURA };
const mensagem = (e: unknown) => (e instanceof Error && e.message ? e.message : "Não foi possível salvar a pontuação.");

/** Minigame: pegue o rato que foge pulando entre os puleiros antes do tempo acabar. Cada rato pego deixa o próximo mais rápido. */
export default function CacaAoRato({ pelagem, onSair }: { pelagem: string; onSair: () => void }) {
  const [fase, setFase] = useState<Fase>("intro");
  const [partida, setPartida] = useState(0);
  const [pontos, setPontos] = useState(0);
  const [tempo, setTempo] = useState(TEMPO_INICIAL);
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [recordeAntes, setRecordeAntes] = useState<number | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);
  const [contagem, setContagem] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controles = useControles(fase === "jogo");
  const [toque] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768));
  // No celular, janela mais alta com a câmera seguindo o gato.
  const vista = toque ? 216 : LARGURA;

  // Recorde de antes da partida (para dizer "novo recorde").
  useEffect(() => {
    daviJobService.placar().then(p => setRecordeAntes(p?.meuRecorde?.nrPontos ?? null)).catch(() => setRecordeAntes(null));
  }, []);

  // ---------- introdução: título, perseguição e contagem 3, 2, 1, JÁ! ----------
  useEffect(() => {
    if (fase !== "intro") return;
    const passos: [number, string | null][] = [[1900, "3"], [2800, "2"], [3700, "1"], [4600, "JÁ!"]];
    const ts = passos.map(([ms, v]) => window.setTimeout(() => setContagem(v), ms));
    ts.push(window.setTimeout(() => { setContagem(null); setFase("jogo"); }, 5300));
    return () => ts.forEach(window.clearTimeout);
  }, [fase, partida]);

  // ---------- partida ----------
  useEffect(() => {
    if (fase !== "jogo") return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const fundo = document.createElement("canvas");
    fundo.width = LARGURA;
    fundo.height = ALTURA;
    desenharCenario(fundo.getContext("2d")!, ARENA, "arena");
    let gato: Corpo = novoCorpo(240, 256);
    let rato: Corpo = { ...novoCorpo(pontoDeNascer(ARENA.nascer, gato, Math.random).x, 60, 10) };
    let estadoRato: EstadoRato = { ate: 0 };
    let pegos = 0;
    let restante = TEMPO_INICIAL;
    let renasce = 0;
    let particulas: Particula[] = [];
    let t = 0;
    let ultimo = performance.now();
    let raf = 0;
    let fim = false;
    let quadro = 0;
    let camera = Math.max(0, Math.min(LARGURA - vista, 240 - vista / 2));

    const loop = (ms: number) => {
      const dt = Math.max(0, Math.min(1 / 30, (ms - ultimo) / 1000));
      ultimo = ms;
      t += dt;
      restante = Math.max(0, restante - dt);
      gato = passoCorpo(gato, ARENA.plataformas, dt, lerEntrada(controles.current), t, PARAM_GATO);
      const forca = forcaDoRato(pegos);
      if (renasce && t >= renasce) {
        const p = pontoDeNascer(ARENA.nascer, gato, Math.random);
        rato = novoCorpo(p.x, p.y - 30, 10);
        estadoRato = { ate: 0 };
        renasce = 0;
      }
      if (!renasce) {
        const d = decidirRato(rato, estadoRato, [gato], ARENA.plataformas, t, Math.random, forca.alcance);
        estadoRato = d.estado;
        rato = passoCorpo(rato, ARENA.plataformas, dt, d.entrada, t, { ...PARAM_GATO, velocidade: forca.velocidade, pulo: forca.pulo });
        if (distancia(gato, rato) < 12) {
          pegos++;
          restante = tempoDepoisDePegar(restante);
          for (let k = 0; k < 14; k++) particulas.push({ x: rato.x, y: rato.y - 4, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 120, vida: 0.8, total: 0.8, cor: k % 2 ? "#facc15" : "#f472b6", tipo: "ponto" });
          particulas.push({ x: rato.x, y: rato.y - 16, vx: 0, vy: -24, vida: 1, total: 1, cor: "#4ade80", tipo: "texto", texto: "+1" });
          particulas.push({ x: gato.x, y: gato.y - 28, vx: 0, vy: -10, vida: 1.2, total: 1.2, cor: "#facc15", tipo: "texto", texto: `+${3}s` });
          renasce = t + 0.45;
          setPontos(pegos);
        }
      }
      particulas = passoParticulas(particulas, dt);

      camera += (Math.max(0, Math.min(LARGURA - vista, gato.x - vista / 2)) - camera) * Math.min(1, dt * 5);
      ctx.save();
      ctx.translate(-Math.round(camera), 0);
      ctx.drawImage(fundo, 0, 0);
      if (!renasce) desenharRato(ctx, Math.floor(t * 12) % 2 as 0 | 1, rato.x, rato.y, rato.virado, "#9ca3af");
      const andando = Math.abs(gato.vx) > 10;
      desenharGato(ctx, pelagem, { pose: !gato.noChao ? "pulo" : andando && Math.floor(t * 10) % 2 ? "passo" : "parado", cauda: Math.floor(t * (andando ? 10 : 2)) % 2 as 0 | 1 }, gato.x, gato.y, gato.virado);
      desenharParticulas(ctx, particulas);
      ctx.restore();

      if (++quadro % 6 === 0) setTempo(restante);
      if (restante <= 0 && !fim) {
        fim = true;
        setTempo(0);
        setFase("fim");
        daviJobService.registrar(pegos).then(p => setPlacar(p ?? null)).catch(e => setErro(mensagem(e)));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fase, pelagem, controles, partida, vista]);

  const jogarDeNovo = () => {
    setPontos(0);
    setTempo(TEMPO_INICIAL);
    setPlacar(null);
    setErro(null);
    setRecordeAntes(placar?.meuRecorde?.nrPontos ?? recordeAntes ?? null);
    setPartida(p => p + 1);
    setFase("intro");
  };

  const nome = pelagemPorId(pelagem).nome;
  const acabando = tempo <= 5;

  return (
    <div>
    <div className="nt-abre relative overflow-hidden rounded-2xl border-4 border-slate-900 bg-indigo-950 shadow-[6px_6px_0_#0f172a]" style={{ aspectRatio: `${vista} / ${ALTURA}` }}>
      <canvas ref={canvas} width={vista} height={ALTURA} className="block h-full w-full" style={{ imageRendering: "pixelated" }}
        role="img" aria-label={`Caça ao rato com ${nome}`} />

      {fase === "jogo" && (
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2 font-['Press_Start_2P'] text-[9px] text-white sm:text-xs">
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900/70 px-2 py-1.5">
            <RatoPixel tamanho={26} /> <span aria-live="polite">{pontos}</span>
          </div>
          <div className={`flex min-w-[7rem] flex-col gap-1 rounded-xl border-2 border-slate-900 bg-slate-900/70 px-2 py-1.5 ${acabando ? "nt-pisca-tempo text-red-300" : ""}`}>
            <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {Math.ceil(tempo)}s</span>
            <span className="block h-1.5 overflow-hidden rounded bg-white/20"><span className={`block h-full ${acabando ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (tempo / 45) * 100)}%` }} /></span>
          </div>
        </div>
      )}

      {fase === "intro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-indigo-950/90 px-4 text-center">
          <div className={`nt-cai-pixel transition-opacity duration-300 ${contagem ? "opacity-15" : ""}`}><TituloPixel texto="CAÇA AO RATO" tamanho="text-xl sm:text-4xl" /></div>
          <p className={`nt-cai-pixel transition-opacity duration-300 ${contagem ? "opacity-15" : ""} max-w-md font-['Press_Start_2P'] text-[8px] leading-5 text-indigo-200 sm:text-[10px]`} style={{ animationDelay: "350ms" }}>
            O rato foge pulando pelos puleiros. Pegue o máximo que der antes do tempo acabar! Cada rato vale +3s, mas o próximo fica mais rápido.
          </p>
          <div className="pointer-events-none absolute bottom-6 left-0 flex items-end gap-10">
            <div className="nt-corre-tela flex items-end gap-12">
              <span className="nt-pula-pixel"><RatoPixel tamanho={44} /></span>
              <span className="nt-pula-pixel" style={{ animationDelay: "0.18s" }}><GatoPixel pelagem={pelagem} quadro={{ pose: "passo", cauda: 1 }} tamanho={60} /></span>
            </div>
          </div>
          {contagem && (
            <p key={contagem} className="nt-contagem absolute inset-0 flex items-center justify-center font-['Press_Start_2P'] text-6xl text-yellow-300 sm:text-8xl"
              style={{ textShadow: "4px 4px 0 #1e1b4b, 8px 8px 0 rgba(0,0,0,0.3)" }} aria-live="assertive">
              {contagem}
            </p>
          )}
          <button type="button" onClick={() => { setContagem(null); setFase("jogo"); }}
            className="absolute right-2 top-2 rounded-lg border-2 border-white/40 px-2 py-1 font-['Press_Start_2P'] text-[8px] text-white/80 hover:bg-white/10">Pular</button>
        </div>
      )}

      {fase === "fim" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-indigo-950/85 p-2 sm:p-4">
          <div className="nt-cai-pixel w-full max-w-md rounded-2xl border-4 border-slate-900 bg-white p-3 text-slate-800 shadow-[4px_4px_0_#0f172a] sm:p-5">
            <p className="text-center font-['Press_Start_2P'] text-[10px] text-slate-500 sm:text-xs">FIM DE JOGO</p>
            <p className="mt-2 text-center font-['Press_Start_2P'] text-sm text-indigo-700 sm:text-lg">{nome} pegou {pontos} rato{pontos === 1 ? "" : "s"}</p>
            {recordeAntes !== undefined && (
              <p className="mt-1 text-center font-['Press_Start_2P'] text-[9px] text-pink-600 sm:text-[11px]">{mensagemFinal(pontos, recordeAntes)}</p>
            )}
            <div className="mt-3 rounded-xl border-2 border-slate-900 bg-slate-50 p-2">
              <p className="mb-1 flex items-center gap-1 font-['Press_Start_2P'] text-[9px] text-slate-600"><Crown className="h-4 w-4 text-yellow-500" /> RANKING</p>
              {!placar && !erro && <p className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Salvando pontuação…</p>}
              {erro && <p role="alert" className="py-2 text-center text-xs text-red-600">{erro}</p>}
              {placar && (
                <ol className="space-y-0.5" aria-label="Ranking">
                  {placar.ranking.map(l => (
                    <li key={l.idUsuario} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${l.flProprio ? "bg-yellow-200 font-black" : ""}`}>
                      <span className="w-6 text-center font-['Press_Start_2P'] text-[9px]">{l.nrPosicao <= 3 ? ["🥇", "🥈", "🥉"][l.nrPosicao - 1] : l.nrPosicao}</span>
                      <span className="min-w-0 flex-1 truncate">{l.flProprio ? `${l.nmNome} (você)` : l.nmNome}</span>
                      <span className="font-['Press_Start_2P'] text-[9px]">{l.nrPontos}</span>
                    </li>
                  ))}
                  {placar.meuRecorde && !placar.ranking.some(l => l.flProprio) && (
                    <li className="mt-1 flex items-center gap-2 rounded-lg border-t border-dashed border-slate-300 bg-yellow-200 px-2 py-1 text-xs font-black">
                      <span className="w-6 text-center font-['Press_Start_2P'] text-[9px]">{placar.meuRecorde.nrPosicao}</span>
                      <span className="min-w-0 flex-1 truncate">Seu recorde</span>
                      <span className="font-['Press_Start_2P'] text-[9px]">{placar.meuRecorde.nrPontos}</span>
                    </li>
                  )}
                </ol>
              )}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={jogarDeNovo} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-emerald-400 px-3 py-2 font-['Press_Start_2P'] text-[9px] text-slate-900 shadow-[2px_2px_0_#0f172a] hover:bg-emerald-300">
                <RotateCcw className="h-4 w-4" /> Jogar de novo
              </button>
              <button type="button" onClick={onSair} className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-white px-3 py-2 font-['Press_Start_2P'] text-[9px] text-slate-900 shadow-[2px_2px_0_#0f172a] hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" /> Voltar ao puleiro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    {toque && (
      <div className="relative mt-3 h-28 rounded-2xl border-4 border-slate-900 bg-indigo-200 shadow-[4px_4px_0_#0f172a]" aria-label="Controles">
        <Joystick controles={controles} />
      </div>
    )}
    </div>
  );
}
