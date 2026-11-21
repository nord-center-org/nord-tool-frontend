import { Gamepad2, LogOut, Play, Wifi, WifiOff } from "lucide-react";
import { linkDoControle, MAX_JOGADORES_SALA, type JogadorSala } from "@/react-app/utils/games/sala";
import type { VagaBombas } from "@/react-app/components/games/jogos/bombas/BombasTaticas";
import type { EstadoConexao } from "../rede/ClienteSala";
import AvatarCorpo from "./AvatarCorpo";
import ConfigPartida from "./ConfigPartida";
import type { ConfigBombas } from "@/react-app/utils/games/configBombas";
import FundoGamer from "./FundoGamer";
import QrCode from "./QrCode";
import { CORES_JOGADORES } from "./sprites";

/**
 * Modo Tela: o tablet, a TV ou o computador vira o "servidor" da jogatina. Mostra o QR Code e o código bem grandes,
 * quem já entrou pelo celular (com o avatar de corpo inteiro) e a preparação da partida. Ninguém precisa jogar na tela.
 */
export default function ModoTela({ sala, erro, vagas, cfg, mudarCfg, euJogo, onEuJogo, onComecar, onSair }: {
  sala: { codigo: string; estado: EstadoConexao; jogadores: JogadorSala[] } | null; erro: string | null; vagas: VagaBombas[];
  cfg: ConfigBombas; mudarCfg: (c: ConfigBombas) => void; euJogo: boolean; onEuJogo: (v: boolean) => void; onComecar: () => void; onSair: () => void;
}) {
  const humanos = vagas.filter(v => !v.bot).length;
  const celulares = sala?.jogadores.filter(j => j.vaga > 0) ?? [];
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto text-white" role="dialog" aria-modal="true" aria-label="Modo Tela">
      <FundoGamer />
      <div className="relative mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-4 sm:p-8">
        <header className="flex flex-wrap items-center gap-3">
          <Gamepad2 className="h-9 w-9 text-fuchsia-400 drop-shadow-[0_0_10px_rgba(232,121,249,.8)]" />
          <div className="mr-auto">
            <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300 bg-clip-text text-3xl font-black uppercase italic tracking-tight text-transparent sm:text-4xl">Modo Tela</h1>
            <p className="text-sm text-white/60">Esta tela é o servidor: cada pessoa entra pelo celular, que vira o controle.</p>
          </div>
          <button type="button" onClick={onSair} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/15 hover:bg-white/20"><LogOut className="h-4 w-4" />Sair do Modo Tela</button>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section aria-label="Como entrar" className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-slate-950/60 p-6 ring-1 ring-cyan-300/20 backdrop-blur">
            {sala ? (
              <>
                <div className="rounded-3xl bg-white p-2 shadow-[0_0_60px_rgba(34,211,238,.45)]">
                  <QrCode texto={linkDoControle(window.location.origin, sala.codigo)} tamanho={260} rotulo={`QR Code da sala ${sala.codigo}`} />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.4em] text-cyan-300/80">Código da sala</p>
                <p className="font-mono text-6xl font-black tracking-[0.3em] text-white drop-shadow-[0_0_24px_rgba(34,211,238,.7)] sm:text-7xl" aria-label="Código da sala">{sala.codigo}</p>
                <p className="text-center text-sm text-white/60">Leia o QR Code com a câmera, ou abra <b className="text-white">Games → Controle</b> no celular e digite o código.</p>
                <p className={`flex items-center gap-1.5 text-sm font-bold ${sala.estado === "conectado" ? "text-lime-300" : "text-amber-300"}`} aria-live="polite">
                  {sala.estado === "conectado" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  {sala.estado === "conectado" ? "Tela conectada" : sala.estado === "fechada" ? "Sala fechada" : "Conectando…"}
                </p>
              </>
            ) : (
              <p className="text-center text-white/70" aria-live="polite">{erro ?? "Abrindo a sala…"}</p>
            )}
          </section>

          <section aria-label="Jogadores e partida" className="flex flex-col gap-4 rounded-3xl bg-slate-950/60 p-5 ring-1 ring-fuchsia-300/20 backdrop-blur">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-black uppercase tracking-widest text-fuchsia-200">Na arena · Bombas Táticas</h2>
              <span className="text-sm font-bold text-white/60">{celulares.filter(j => j.conectado).length} {celulares.length === 1 ? "celular" : "celulares"} · até {MAX_JOGADORES_SALA}</span>
            </div>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label="Vagas da partida">
              {Array.from({ length: 8 }, (_, i) => {
                const v = vagas[i];
                return (
                  <li key={i} className={`flex flex-col items-center rounded-2xl px-1 pb-2 pt-1 ring-2 transition ${v ? "bg-white/5" : "bg-white/[.02] ring-white/5"}`} style={v ? { ["--tw-ring-color" as string]: CORES_JOGADORES[i], boxShadow: `0 0 18px ${CORES_JOGADORES[i]}55` } : undefined}>
                    <div className="flex h-[72px] items-end">{v ? <AvatarCorpo config={v.avatar} altura={68} acao={v.bot ? "parado" : "andando"} atraso={i * 0.21} /> : <span className="pb-6 text-2xl font-black text-white/10">?</span>}</div>
                    <p className="w-full truncate text-center text-[11px] font-black" style={{ color: v ? CORES_JOGADORES[i] : "rgba(255,255,255,.2)" }}>P{i + 1}</p>
                    <p className="w-full truncate text-center text-[11px] text-white/70">{v ? `${v.nome}${v.bot ? " 🤖" : v.controle !== undefined ? " 📱" : " ⌨️"}` : "livre"}</p>
                  </li>
                );
              })}
            </ul>
            <label className="flex items-center gap-2 text-sm font-bold text-white/80">
              <input type="checkbox" checked={euJogo} onChange={e => onEuJogo(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
              Eu também jogo nesta tela (teclado)
            </label>
            <ConfigPartida cfg={cfg} mudar={mudarCfg} humanos={humanos} />
            <button type="button" onClick={onComecar} disabled={vagas.length === 0}
              className="mt-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-4 text-xl font-black uppercase italic tracking-wider text-white shadow-[0_0_40px_rgba(236,72,153,.55)] transition hover:scale-[1.02] disabled:opacity-40">
              <Play className="h-7 w-7" fill="currentColor" />Começar
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
