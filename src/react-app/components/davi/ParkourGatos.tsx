import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { CircleHelp, Gamepad2 } from "lucide-react";

import Joystick from "./Joystick";
import Tour, { type PassoTour } from "./Tour";
import { lerEntrada, useControles } from "./controles";
import {
  desenharArranhadores, desenharBola, desenharCenario, desenharCorda, desenharGato, desenharMarcador, desenharParticulas, desenharPorta,
  desenharRato, passoParticulas, type Particula,
} from "@/react-app/utils/daviJob/desenho";
import { FALAS, FALAS_INTERACAO, sortear } from "@/react-app/utils/daviJob/falas";
import { decidirGato, decidirRato, type EstadoIA, type EstadoRato, type Interesse } from "@/react-app/utils/daviJob/ia";
import {
  distancia, novoCorpo, passoBola, passoCorda, passoCorpo, pontaDaCorda, velocidadeBola, type Bola, type Corda, type Corpo,
} from "@/react-app/utils/daviJob/motor";
import { ALTURA, HUB, LARGURA } from "@/react-app/utils/daviJob/mundo";
import { GATO_H, PELAGENS, pelagemPorId, type Pose } from "@/react-app/utils/daviJob/sprites";

type Anim = "nada" | "arranhar" | "comer" | "dormir" | "patada";
interface Gato { pelagem: string; corpo: Corpo; ia: EstadoIA; anim: Anim; animAte: number; paradoDesde: number; piscaAte: number; proxPisca: number }
interface Rato { corpo: Corpo; estado: EstadoRato; voltaEm: number | null }
interface Estado {
  t: number;
  gatos: Gato[];
  controlado: number;
  bolas: (Bola & { chuteAte: number })[];
  cordas: (Corda & { patadaAte: number })[];
  ratos: Rato[];
  balanco: number[];
  particulas: Particula[];
  porta: number;
  segurada: { i: number; hist: { x: number; y: number; t: number }[] } | null;
}

const PARAM_RATO = { velocidade: 86, pulo: 300, gravidade: 820, largura: LARGURA, altura: ALTURA };
/** No celular a tela mostra uma janela do puleiro (mais alta e maior) e a câmera segue o gatinho. */
const VISTA_CELULAR = 216;

function criarEstado(): Estado {
  const r = Math.random;
  const lugares = [...HUB.nascer].sort(() => r() - 0.5);
  return {
    t: 0,
    gatos: PELAGENS.map((p, i) => ({
      pelagem: p.id, corpo: { ...novoCorpo(lugares[i].x, lugares[i].y - 2), virado: r() < 0.5 ? -1 : 1 },
      ia: { modo: "parar", ate: r() * 2 }, anim: "nada", animAte: 0, paradoDesde: 0, piscaAte: 0, proxPisca: 1 + r() * 4,
    })),
    controlado: 0,
    bolas: [...HUB.bolas.map(b => ({ ...b, vx: 0, vy: 0, r: 4, segurada: false, quica: true, chuteAte: 0 })),
      ...HUB.brinquedos.map(b => ({ ...b, vx: 0, vy: 0, r: 3, segurada: false, quica: false, chuteAte: 0 }))],
    cordas: HUB.cordas.map(c => ({ ...c, angulo: 0, vel: 0, patadaAte: 0 })),
    ratos: [0, 1].map(i => ({ corpo: { ...novoCorpo(lugares[10 + i].x, lugares[10 + i].y - 2, 10) }, estado: { ate: 0 }, voltaEm: null })),
    balanco: HUB.arranhadores.map(() => 0),
    particulas: [],
    porta: 0,
    segurada: null,
  };
}

const interesses: Interesse[] = [
  ...HUB.arranhadores.map(a => ({ x: a.x, y: a.base, tipo: "arranhar" as const })),
  ...HUB.potes.map(p => ({ x: p.x, y: p.y, tipo: "comer" as const })),
  ...HUB.caixas.map(c => ({ x: c.x + Math.min(c.w / 2, 22), y: c.y + c.h, tipo: "dormir" as const })),
];

function poseDe(g: Gato, t: number): { pose: Pose; cauda: 0 | 1; fechado: boolean; cabecaBaixa: boolean } {
  const c = g.corpo;
  const fechado = g.anim === "dormir" || t < g.piscaAte;
  if (!c.noChao) return { pose: "pulo", cauda: 1, fechado: false, cabecaBaixa: false };
  if (g.anim === "arranhar" || g.anim === "patada") return { pose: Math.floor(t * 7) % 2 ? "pulo" : "parado", cauda: 1, fechado: false, cabecaBaixa: false };
  if (g.anim === "comer") return { pose: "parado", cauda: Math.floor(t * 2) % 2 as 0 | 1, fechado: false, cabecaBaixa: Math.floor(t * 4) % 2 === 0 };
  if (Math.abs(c.vx) > 10) return { pose: Math.floor(t * 9) % 2 ? "passo" : "parado", cauda: Math.floor(t * 9) % 2 as 0 | 1, fechado, cabecaBaixa: false };
  return { pose: "parado", cauda: Math.floor(t * 1.4) % 2 as 0 | 1, fechado, cabecaBaixa: false };
}

interface ParkourProps {
  /** Entra na portinha: abre o minigame com o gato que está sendo controlado. */
  onJogar: (pelagem: string) => void;
  pelagemInicial?: string;
}

/** O puleiro dos gatinhos: tudo se mexe e é interativo (gatos, bolinhas, cordinhas, arranhadores, ratos e a portinha). */
export default function ParkourGatos({ onJogar, pelagemInicial }: ParkourProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const estado = useRef<Estado>(criarEstado());
  const cenario = useRef<HTMLCanvasElement | null>(null);
  const controles = useControles(true);
  const [, setTick] = useState(0);
  const [selecionado, setSelecionado] = useState<{ i: number; fala: string } | null>(null);
  const [tour, setTour] = useState(false);
  const [toque] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 768));
  const ultimaInteracao = useRef(0);
  const vista = toque ? VISTA_CELULAR : LARGURA;
  const camera = useRef(0);
  const focoTour = useRef<{ x: number; y: number } | null>(null);
  const pct = useCallback((x: number, y: number) => ({ x: ((x - camera.current) / vista) * 100, y: (y / ALTURA) * 100 }), [vista]);
  const paraTela = useCallback((p: { x: number; y: number }) => pct(p.x, p.y), [pct]);
  const focar = useCallback((p: { x: number; y: number } | null) => { focoTour.current = p; }, []);

  useEffect(() => {
    const i = PELAGENS.findIndex(p => p.id === pelagemInicial);
    if (i >= 0) estado.current.controlado = i;
  }, [pelagemInicial]);

  const emitir = useCallback((x: number, y: number, n: number, cor: string, tipo: Particula["tipo"] = "ponto") => {
    const e = estado.current;
    for (let k = 0; k < n; k++) {
      e.particulas.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 80, vida: 0.7, total: 0.7, cor, tipo });
    }
  }, []);
  const texto = useCallback((x: number, y: number, t: string, cor = "#facc15") => {
    estado.current.particulas.push({ x, y, vx: 0, vy: -18, vida: 1.2, total: 1.2, cor, tipo: "texto", texto: t });
  }, []);

  // ---------- laço do jogo ----------
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const fundo = document.createElement("canvas");
    fundo.width = LARGURA;
    fundo.height = ALTURA;
    desenharCenario(fundo.getContext("2d")!, HUB);
    cenario.current = fundo;
    let ultimo = performance.now();
    let quadro = 0;
    let raf = 0;
    let interagirVisto = controles.current.interagir;

    const loop = (agoraMs: number) => {
      const dt = Math.max(0, Math.min(1 / 30, (agoraMs - ultimo) / 1000));
      ultimo = agoraMs;
      const e = estado.current;
      e.t += dt;
      const t = e.t;
      const plats = HUB.plataformas;

      // Bolinhas em movimento chamam a atenção dos gatos; ratos também.
      const bolaViva = e.bolas.find(b => b.quica && (b.segurada || velocidadeBola(b) > 70));

      e.gatos.forEach((g, i) => {
        const jogador = i === e.controlado;
        let entrada;
        if (jogador) {
          entrada = lerEntrada(controles.current);
          if (Math.abs(entrada.dir) > 0.1 || entrada.pular) { g.anim = "nada"; g.paradoDesde = t; }
        } else {
          const rato = e.ratos.find(r => r.voltaEm === null && distancia(r.corpo, g.corpo) < 110);
          const presa = bolaViva ? { x: bolaViva.x, y: bolaViva.y + bolaViva.r } : rato ? { x: rato.corpo.x, y: rato.corpo.y } : null;
          const d = decidirGato(g.corpo, g.ia, { plats, agora: t, sorteio: Math.random, presa, interesses });
          g.ia = d.ia;
          entrada = (g.ia.modo === "brincar" || g.ia.modo === "comer" || g.ia.modo === "dormir") ? { dir: 0, pular: false, descer: false } : d.entrada;
          g.anim = g.ia.modo === "brincar" ? (g.ia.acao === "arranhar" ? "arranhar" : "patada") : g.ia.modo === "comer" ? "comer" : g.ia.modo === "dormir" ? "dormir" : (t < g.animAte ? g.anim : "nada");
        }
        g.corpo = passoCorpo(g.corpo, plats, dt, entrada, t);
        if (Math.abs(g.corpo.vx) > 6 || !g.corpo.noChao) g.paradoDesde = t;
        if (t > g.proxPisca) { g.piscaAte = t + 0.14; g.proxPisca = t + 2 + Math.random() * 4; }

        // Interações automáticas: parado perto do arranhador/potinho.
        const perto = g.corpo.noChao ? interesses.find(it => Math.abs(it.x - g.corpo.x) < 13 && Math.abs(it.y - g.corpo.y) < 3) : undefined;
        if (jogador && perto && t - g.paradoDesde > 0.35 && g.anim === "nada" && perto.tipo !== "dormir") {
          g.anim = perto.tipo === "arranhar" ? "arranhar" : "comer";
          g.animAte = t + 99;
          if (t - ultimaInteracao.current > 1.2) { texto(g.corpo.x, g.corpo.y - 22, sortear(FALAS_INTERACAO[perto.tipo === "arranhar" ? "arranhar" : "comer"]), "#ffffff"); ultimaInteracao.current = t; }
        }
        if (jogador && !perto && g.anim !== "nada") g.anim = "nada";
        if (g.anim === "arranhar" && perto) {
          const k = HUB.arranhadores.findIndex(a => Math.abs(a.x - perto.x) < 1 && a.base === perto.y);
          if (k >= 0) e.balanco[k] = Math.min(1, e.balanco[k] + dt * 2);
          if (Math.random() < 0.15) emitir(perto.x + (Math.random() - 0.5) * 6, g.corpo.y - 8, 1, "#b39a6b");
        }
        if (g.anim === "dormir" && Math.random() < dt * 0.8) e.particulas.push({ x: g.corpo.x + 6, y: g.corpo.y - 16, vx: 8, vy: -14, vida: 1.6, total: 1.6, cor: "#6366f1", tipo: "z" });

        // Bolinhas e ratinhos de brinquedo: esbarrou, chutou.
        for (const b of e.bolas) {
          if (b.segurada || t < b.chuteAte) continue;
          if (distancia({ x: g.corpo.x + g.corpo.virado * 4, y: g.corpo.y - 5 }, b) < b.r + 8) {
            const dir = Math.sign(b.x - g.corpo.x) || g.corpo.virado;
            b.vx = dir * (b.quica ? 110 + Math.random() * 90 : 70 + Math.random() * 40) + g.corpo.vx * 0.4;
            b.vy = b.quica ? -(130 + Math.random() * 90) : -40;
            b.chuteAte = t + 0.35;
            emitir(b.x, b.y, 3, b.cor);
            if (jogador && b.quica && t - ultimaInteracao.current > 1.5) { texto(g.corpo.x, g.corpo.y - 22, sortear(FALAS_INTERACAO.bola), "#ffffff"); ultimaInteracao.current = t; }
          }
        }
        // Cordinhas: patada quando a pontinha passa perto da cabeça.
        for (const c of e.cordas) {
          const p = pontaDaCorda(c);
          if (t > c.patadaAte && distancia({ x: g.corpo.x + g.corpo.virado * 7, y: g.corpo.y - 11 }, p) < 11) {
            c.vel += (g.corpo.virado || 1) * (1.8 + Math.random());
            c.patadaAte = t + 0.6;
            g.anim = "patada";
            g.animAte = t + 0.4;
            emitir(p.x, p.y, 2, c.cor);
          }
        }
        // Ratos de verdade: pegou!
        for (const r of e.ratos) {
          if (r.voltaEm === null && distancia(g.corpo, r.corpo) < 11) {
            r.voltaEm = t + 3;
            emitir(r.corpo.x, r.corpo.y - 4, 10, "#facc15");
            texto(r.corpo.x, r.corpo.y - 14, jogador ? sortear(FALAS_INTERACAO.rato) : "Peguei!");
          }
        }
      });

      // Ratos fogem pulando pelos puleiros (pique-pega); depois de pegos, voltam em outro lugar.
      for (const r of e.ratos) {
        if (r.voltaEm !== null) {
          if (t >= r.voltaEm) {
            const longe = [...HUB.nascer].sort((a, b) => Math.min(...e.gatos.map(g => distancia(g.corpo, b))) - Math.min(...e.gatos.map(g => distancia(g.corpo, a))))[0];
            r.corpo = novoCorpo(longe.x, longe.y - 2, 10);
            r.voltaEm = null;
          }
          continue;
        }
        const d = decidirRato(r.corpo, r.estado, e.gatos.map(g => ({ x: g.corpo.x, y: g.corpo.y })), plats, t, Math.random);
        r.estado = d.estado;
        r.corpo = passoCorpo(r.corpo, plats, dt, d.entrada, t, PARAM_RATO);
      }

      e.bolas = e.bolas.map(b => ({ ...passoBola(b, plats, dt), chuteAte: b.chuteAte }));
      e.cordas = e.cordas.map(c => ({ ...passoCorda(c, dt), patadaAte: c.patadaAte }));
      e.balanco = e.balanco.map(v => Math.max(0, v - dt * 1.2));
      e.particulas = passoParticulas(e.particulas, dt);
      const jogador = e.gatos[e.controlado];
      const naPorta = HUB.porta && Math.abs(jogador.corpo.x - (HUB.porta.x + HUB.porta.w / 2)) < 26 && Math.abs(jogador.corpo.y - (HUB.porta.y + HUB.porta.h)) < 4;
      e.porta += ((naPorta ? 1 : 0) - e.porta) * Math.min(1, dt * 6);
      const focoX = focoTour.current?.x ?? jogador.corpo.x;
      const alvoCam = Math.max(0, Math.min(LARGURA - vista, focoX - vista / 2));
      camera.current += (alvoCam - camera.current) * Math.min(1, dt * 5);
      if (naPorta && controles.current.interagir !== interagirVisto) onJogar(jogador.pelagem);
      interagirVisto = controles.current.interagir;

      // ---------- desenho ----------
      ctx.save();
      ctx.translate(-Math.round(camera.current), 0);
      ctx.drawImage(fundo, 0, 0);
      desenharArranhadores(ctx, HUB, e.balanco);
      if (HUB.porta) desenharPorta(ctx, HUB.porta, e.porta);
      for (const c of e.cordas) desenharCorda(ctx, c);
      for (const b of e.bolas) desenharBola(ctx, b);
      for (const r of e.ratos) if (r.voltaEm === null) desenharRato(ctx, Math.floor(t * 10) % 2 as 0 | 1, r.corpo.x, r.corpo.y, r.corpo.virado, "#6b7280");
      [...e.gatos.map((g, i) => ({ g, i }))].sort((a, b) => a.g.corpo.y - b.g.corpo.y).forEach(({ g }) => {
        desenharGato(ctx, g.pelagem, poseDe(g, t), g.corpo.x, g.corpo.y, g.corpo.virado);
      });
      desenharMarcador(ctx, jogador.corpo.x, jogador.corpo.y, t);
      desenharParticulas(ctx, e.particulas);
      ctx.restore();

      if (++quadro % 4 === 0) setTick(q => q + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [controles, emitir, texto, onJogar, vista]);

  // ---------- mouse/toque: pegar e jogar bolinhas, clicar nos gatos ----------
  const ponto = (ev: EventoPonteiro<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * vista + camera.current, y: ((ev.clientY - r.top) / r.height) * ALTURA };
  };
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const baixo = (ev: EventoPonteiro<HTMLCanvasElement>) => {
    const p = ponto(ev);
    inicio.current = p;
    const e = estado.current;
    const i = e.bolas.findIndex(b => distancia(b, p) < b.r + 8);
    if (i >= 0) {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      e.bolas[i] = { ...e.bolas[i], segurada: true, vx: 0, vy: 0 };
      e.segurada = { i, hist: [{ ...p, t: e.t }] };
    }
  };
  const mover = (ev: EventoPonteiro<HTMLCanvasElement>) => {
    const e = estado.current;
    if (!e.segurada) return;
    const p = ponto(ev);
    const b = e.bolas[e.segurada.i];
    e.bolas[e.segurada.i] = { ...b, x: Math.max(4, Math.min(LARGURA - 4, p.x)), y: Math.max(4, Math.min(ALTURA - 16, p.y)) };
    e.segurada.hist = [...e.segurada.hist.filter(h => e.t - h.t < 0.1), { ...p, t: e.t }];
  };
  const cima = (ev: EventoPonteiro<HTMLCanvasElement>) => {
    const e = estado.current;
    const p = ponto(ev);
    if (e.segurada) {
      const h = e.segurada.hist;
      const a = h[0], z = h[h.length - 1];
      const dt = Math.max(0.016, z.t - a.t);
      const lim = (v: number) => Math.max(-650, Math.min(650, v));
      const b = e.bolas[e.segurada.i];
      e.bolas[e.segurada.i] = { ...b, segurada: false, vx: lim((z.x - a.x) / dt), vy: lim((z.y - a.y) / dt) };
      e.segurada = null;
      return;
    }
    if (inicio.current && distancia(inicio.current, p) > 6) return;
    const i = e.gatos.findIndex(g => Math.abs(g.corpo.x - p.x) < 11 && p.y <= g.corpo.y + 2 && p.y >= g.corpo.y - GATO_H - 2);
    if (i >= 0) {
      setSelecionado({ i, fala: sortear(FALAS[e.gatos[i].pelagem] ?? ["Miau!"]) });
      const g = e.gatos[i];
      if (g.ia.modo === "dormir") g.ia = { modo: "parar", ate: e.t + 1 };
      emitir(g.corpo.x, g.corpo.y - 14, 3, "#f472b6", "coracao");
    } else {
      setSelecionado(null);
    }
  };

  // Fecha o balão sozinho depois de um tempo.
  useEffect(() => {
    if (!selecionado) return;
    const t = window.setTimeout(() => setSelecionado(null), 6000);
    return () => window.clearTimeout(t);
  }, [selecionado]);

  const e = estado.current;
  const jogador = e.gatos[e.controlado];
  const naPorta = e.porta > 0.6;
  const gSel = selecionado ? e.gatos[selecionado.i] : null;
  const posSel = gSel ? pct(gSel.corpo.x, gSel.corpo.y - GATO_H - 4) : null;
  const porta = HUB.porta!;

  const passos: PassoTour[] = useMemo(() => {
    const s = estado.current;
    const outro = () => s.gatos.find((_, i) => i !== s.controlado)!;
    return [
      { titulo: "Este é você!", texto: toque ? "A setinha amarela marca o seu gatinho. Use o joystick para andar e o botão rosa para pular. Joystick para baixo desce do puleiro." : "A setinha amarela marca o seu gatinho. A e D andam, W ou espaço pulam e S desce do puleiro.", alvo: () => { const g = s.gatos[s.controlado].corpo; return { x: g.x, y: g.y - 8 }; } },
      { titulo: "Fale com os gatinhos", texto: "Clique num gatinho para ele falar com você. No balão, toque em Controlar para trocar de gatinho.", alvo: () => { const g = outro().corpo; return { x: g.x, y: g.y - 8 }; } },
      { titulo: "Bolinhas", texto: "Pegue uma bolinha com o mouse (ou o dedo), arraste e solte para arremessar. Os gatinhos correm atrás!", alvo: () => { const b = s.bolas.find(x => x.quica)!; return { x: b.x, y: b.y }; }, raio: 5 },
      { titulo: "Arranhador", texto: "Pare do lado do postinho para afiar as garras. Ele até balança!", alvo: () => ({ x: HUB.arranhadores[0].x, y: (HUB.arranhadores[0].topo + HUB.arranhadores[0].base) / 2 }), raio: 6 },
      { titulo: "Cordinhas", texto: "Chegue perto da pontinha para dar patadas e ver ela balançar.", alvo: () => pontaDaCorda(s.cordas[0]), raio: 5 },
      { titulo: "Ratinhos de brinquedo", texto: "Esbarre neles para empurrar pelas prateleiras.", alvo: () => { const b = s.bolas.find(x => !x.quica)!; return { x: b.x, y: b.y }; }, raio: 5 },
      { titulo: "Ratos de verdade!", texto: "Eles fogem pulando entre os puleiros, que nem pique-pega. Encoste neles para pegar!", alvo: () => { const r = s.ratos.find(x => x.voltaEm === null) ?? s.ratos[0]; return { x: r.corpo.x, y: r.corpo.y - 3 }; }, raio: 6 },
      { titulo: "Potinhos", texto: "Pare perto do potinho para comer. Nhac nhac!", alvo: () => ({ x: HUB.potes[0].x, y: HUB.potes[0].y - 4 }), raio: 5 },
      { titulo: "Caixinhas", texto: "Os gatinhos gostam de tirar uma soneca aqui. Clique num gato dormindo para acordá-lo.", alvo: () => { const c = HUB.caixas[0]; return { x: c.x + Math.min(c.w / 2, 22), y: c.y + c.h * 0.55 }; }, raio: 7 },
      { titulo: "A portinha", texto: "Chegue perto e toque em Jogar (ou aperte E) para o minigame Caça ao rato. Tem ranking!", alvo: () => ({ x: porta.x + porta.w / 2, y: porta.y + porta.h / 2 }), raio: 7 },
    ];
  }, [toque, porta]);

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl border-4 border-slate-900 bg-white shadow-[6px_6px_0_#0f172a]" style={{ aspectRatio: `${vista} / ${ALTURA}` }}>
        <canvas ref={canvas} width={vista} height={ALTURA} className="block h-full w-full touch-none" style={{ imageRendering: "pixelated" }}
          onPointerDown={baixo} onPointerMove={mover} onPointerUp={cima} onPointerCancel={cima}
          role="img" aria-label="Puleiro dos gatinhos: gatos andando, bolinhas, cordinhas, arranhadores e ratos" />

        {gSel && posSel && (
          <div className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center gap-1 transition-[left,top] duration-200 ease-linear" style={{ left: `${posSel.x}%`, top: `${posSel.y}%` }}>
            {selecionado!.i !== e.controlado && (
              <button type="button" className="pointer-events-auto animate-surgir rounded-lg border-2 border-slate-900 bg-yellow-300 px-2 py-0.5 font-['Press_Start_2P'] text-[8px] text-slate-900 shadow-[2px_2px_0_#0f172a] hover:bg-yellow-200 sm:text-[9px]"
                onClick={() => { estado.current.controlado = selecionado!.i; setSelecionado(null); }}>
                Controlar
              </button>
            )}
            <div className="animate-surgir relative max-w-[11rem] rounded-xl border-2 border-slate-900 bg-white px-2 py-1 text-center text-[11px] font-bold leading-tight text-slate-800 shadow-[2px_2px_0_#0f172a] sm:text-xs">
              <span className="block font-['Press_Start_2P'] text-[7px] text-indigo-600">{pelagemPorId(gSel.pelagem).nome}</span>
              {selecionado!.fala}
              <span className="absolute left-1/2 top-full -mt-[5px] h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-slate-900 bg-white" />
            </div>
          </div>
        )}

        {naPorta && (
          <button type="button" onClick={() => onJogar(jogador.pelagem)}
            className="absolute z-10 -translate-x-1/2 -translate-y-full animate-bounce rounded-xl border-4 border-slate-900 bg-emerald-400 px-3 py-1.5 font-['Press_Start_2P'] text-[10px] text-slate-900 shadow-[3px_3px_0_#0f172a] hover:bg-emerald-300"
            style={{ left: `${pct(porta.x + porta.w / 2, 0).x}%`, top: `${pct(0, porta.y - 4).y}%` }}>
            <Gamepad2 className="mr-1 inline h-4 w-4 -translate-y-px" />Jogar
          </button>
        )}

        <button type="button" onClick={() => setTour(true)} aria-label="Como brincar"
          className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-900 bg-yellow-300 text-slate-900 shadow-[2px_2px_0_#0f172a] transition-transform hover:-translate-y-0.5 hover:bg-yellow-200">
          <CircleHelp className="h-5 w-5" />
        </button>

        {tour && <Tour passos={passos} paraTela={paraTela} onFoco={focar} onFechar={() => { focoTour.current = null; setTour(false); }} />}
      </div>
      {toque && (
        <div className="relative mt-3 h-28 rounded-2xl border-4 border-slate-900 bg-indigo-100 shadow-[4px_4px_0_#0f172a]" aria-label="Controles">
          <Joystick controles={controles} />
          <p className="pointer-events-none absolute inset-x-28 top-1/2 -translate-y-1/2 text-center font-['Press_Start_2P'] text-[7px] leading-4 text-indigo-400">arraste as bolinhas com o dedo</p>
        </div>
      )}
      {!toque && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
          {[["A", "D", "andar"], ["W", "Espaço", "pular"], ["S", "descer"], ["E", "jogar na porta"]].map(l => (
            <span key={l.join()} className="inline-flex items-center gap-1">
              {l.slice(0, -1).map(k => <kbd key={k} className="rounded-md border-2 border-b-4 border-slate-300 bg-white px-1.5 py-0.5 font-['Press_Start_2P'] text-[8px] text-slate-700">{k}</kbd>)}
              {l[l.length - 1]}
            </span>
          ))}
          <span>· arraste as bolinhas com o mouse</span>
        </p>
      )}
    </div>
  );
}
