import { useCallback, useMemo, useState, type ReactNode, type ComponentProps } from "react";
import MolduraPartida, { type FasePartida, type ResultadoPartida, type VagaJogo } from "../../comum/MolduraPartida";
import { META_MOEDAS_SOLO, type Bioma, type Modo, type ModoBombas } from "@/react-app/utils/games/bombas";
import { criarMotorBombas } from "./motorBombas";
import { BIOMAS } from "./desenho";
import { avatarDaVaga } from "../../central/sprites";
import { ETAPAS_CAMPANHA } from "@/react-app/utils/games/campanhaBombas";
import PainelControles from "../../entrada/PainelControles";
import GuiaBombas from "./GuiaBombas";
import { marcarGuiaBombas, precisaGuiaBombas } from "./guia";

/** Uma vaga da partida: bot, quem está na tela (teclado/toque), um gamepad próprio ou um celular da sala. */
export type VagaBombas = VagaJogo;
export type ResultadoBombas = ResultadoPartida;
export type FaseBombas = FasePartida;

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const TITULO_MODO: Record<Modo, string> = { sobrevivencia: "Sobrevivência", times: "Times", moedas: "Caça às Moedas" };

/** Bombas Táticas: a arena em grade dentro da moldura comum das partidas. */
export default function BombasTaticas({ vagas, modo, bioma, onModo, codigoSala, onAbrirSala, preparacao, modoArena, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoBombas; bioma: Bioma; onModo?: (m: ModoBombas) => void; codigoSala?: string; onAbrirSala?: () => void; preparacao?: ReactNode; modoArena?: Modo }) {
  const [tela, setTela] = useState<"menu" | "jogo" | "opcoes">("menu");
  const [modoInterno, setModoInterno] = useState<ModoBombas>(modo);
  const [etapa, setEtapa] = useState(0);
  const [painel, setPainel] = useState(false);
  const [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const campanha = modoInterno === "campanha";
  const usadas = useMemo(() => {
    if (!campanha || vagas.length === 8) return vagas;
    const humanos = vagas.filter(v => !v.bot);
    return Array.from({ length: 8 }, (_, i) => humanos[i] ?? { nome: "Aperte Start", bot: null, avatar: avatarDaVaga(i, null), reserva: true, controle: 100 + i });
  }, [vagas, campanha]);
  const solo = usadas.length === 1;
  let checkpoint = 0;
  try { checkpoint = Math.max(0, Math.min(8, Number(localStorage.getItem("nord-bombas-checkpoint-v1")) || 0)); } catch { /* sem armazenamento */ }
  const iniciar = (m: ModoBombas, checkpoint = 0) => { setResultado(null); setModoInterno(m); setEtapa(checkpoint); if (m === "campanha" && checkpoint === 0) { try { localStorage.removeItem("nord-bombas-checkpoint-v1"); } catch { /* sem armazenamento */ } } onModo?.(m); setTela("jogo"); };
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorBombas(caixa, usadas, modoInterno, bioma, ganchos, etapa), [usadas, modoInterno, bioma, etapa]);
  if (tela === "opcoes") return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950 p-5 text-white"><div className="mx-auto max-w-2xl space-y-5"><button onClick={() => setTela("menu")} className="rounded-xl bg-white/10 px-4 py-2">Voltar ao menu de Bombas Táticas</button><h1 className="text-2xl font-black text-amber-200">Configurações do jogo</h1>{preparacao ?? <p>As regras da arena são escolhidas ao abrir esta partida.</p>}<button onClick={() => setPainel(true)} className="w-full rounded-xl bg-cyan-400/20 p-4 font-bold">Teclado, joystick e controle de videogame</button></div>{painel && <PainelControles onFechar={() => setPainel(false)} />}</div>;
  if (tela === "menu") return <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,#244e66,#07121f_70%)] text-white">
    <header className="flex items-center justify-between p-5"><button onClick={resto.onSair} className="rounded-xl bg-white/10 px-4 py-2">Voltar ao Nord Games</button><span className="text-xs font-bold tracking-widest text-cyan-200">NORD · ORIGINAL</span></header>
    <main className="m-auto grid w-full max-w-5xl gap-8 p-6 md:grid-cols-2">
      <div><p className="mb-3 text-xs font-black tracking-[0.35em] text-amber-200">ACENDA A ÚLTIMA CENTELHA</p><h1 className="text-5xl font-black leading-tight sm:text-7xl">BOMBAS<br/><span className="text-amber-300">TÁTICAS</span></h1><p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300">O Núcleo Rebelde apagou as três regiões. Atravesse a usina, a serra congelada e a fornalha para restaurar a energia. Leve seus amigos nesta missão.</p><p className="mt-4 text-xs text-cyan-100">Campanha: 9 fases · 3 chefes · até 8 em coop<br/>Start entra no meio da fase e usa 1 vida extra.</p></div>
      <div className="space-y-3 self-center rounded-3xl border border-white/15 bg-slate-950/50 p-6 shadow-2xl">
        <button onClick={() => iniciar("campanha")} className="w-full rounded-xl bg-amber-300 p-4 text-left font-black text-slate-950">Nova campanha <span className="block text-xs font-normal">3 vidas extras compartilhadas · comece sua aventura</span></button>
        {checkpoint > 0 && <button onClick={() => iniciar("campanha", checkpoint)} className="w-full rounded-xl bg-emerald-500/20 p-4 text-left font-black text-emerald-100">Continuar · fase {checkpoint + 1}<span className="block text-xs font-normal">{ETAPAS_CAMPANHA[checkpoint].nome} · checkpoint neste aparelho</span></button>}
        <button onClick={() => iniciar(modoArena ?? (modo === "campanha" ? "sobrevivencia" : modo))} className="w-full rounded-xl bg-cyan-400/20 p-4 text-left font-black text-cyan-100">Batalha na arena <span className="block text-xs font-normal">Competitivo · revanche nas bordas ao cair</span></button>
        <button onClick={() => setTela("opcoes")} className="w-full rounded-xl border border-white/20 p-4 text-left font-bold">Configurações · arena, bots e controles</button>
        {codigoSala ? <p className="rounded-xl border border-cyan-200/20 p-3 text-sm">Sala <strong className="font-mono text-xl text-amber-200">{codigoSala}</strong> · conecte o celular e aperte Start</p> : onAbrirSala && <button onClick={onAbrirSala} className="w-full rounded-xl border border-white/20 p-3 font-bold">Conectar celulares · coop local</button>}
        <p className="text-xs leading-relaxed text-slate-400">Direcional: mover · A: bomba · B: habilidade<br/>Na revanche, B muda a distância do arremesso. Elimine um rival para voltar à arena.</p>
      </div>
    </main>
  </div>;
  return (
    <MolduraPartida {...resto} onCoopLocal={onAbrirSala} cooperativoContinuo={campanha} onFim={r => { setResultado(r); resto.onFim?.(r); }} avisoFim={<>{resto.avisoFim}{campanha && <p className="mt-4 max-w-md text-sm text-slate-400">{resultado?.vencedor !== null ? "O Núcleo Rebelde foi desligado. A energia voltou às três regiões. Obrigado por jogar! Criação e personagens: Nord Games." : "As regiões ainda precisam de vocês. Volte ao menu para retomar o checkpoint com três vidas extras."}</p>}</>} onSair={() => setTela("menu")} vitoriasParaVencer={campanha ? 1 : resto.vitoriasParaVencer} vagas={usadas} criarMotor={criarMotor} bpm={modo === "moedas" ? 140 : 128}
      titulo="Bombas Táticas" modoRotulo={campanha ? "Campanha · A última centelha" : solo ? (modo === "moedas" ? "Meta de moedas" : "Desafio") : TITULO_MODO[modoInterno as Modo]}
      detalhe={`${campanha ? `9 fases · 3 chefes · Start entra usando 1 vida extra${codigoSala ? ` · Sala ${codigoSala}` : ""}` : BIOMAS[bioma].nome}${solo ? ` · ${modo === "moedas" ? `junte ${META_MOEDAS_SOLO} moedas em 2 min` : "exploda todas as caixas sem cair"}` : ""}`}
      botoes={{ a: "Bomba", b: "Ação" }}
      guia={<GuiaBombas campanha={campanha} modo={campanha ? "sobrevivencia" : modoInterno as Modo} solo={solo} vagas={vagas} />} guiaInicial={precisaGuiaBombas()} onGuiaFechado={marcarGuiaBombas}
      textosSolo={{ venceu: campanha ? "Energia restaurada! As três regiões estão livres. Obrigado por jogar Bombas Táticas · Nord Games." : modo === "moedas" ? "Tesouro completo!" : "Arena limpa!", perdeu: "Mais uma tentativa?" }}
      ajudaTeclado="Setas/WASD andam · Espaço/Z solta bomba · X/Shift detona ou arremessa · Start: entrar (1 vida extra) · Esc: pausa" />
  );
}
