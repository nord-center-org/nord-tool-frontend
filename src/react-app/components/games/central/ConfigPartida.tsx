import { Bot, Minus, Plus, Trophy } from "lucide-react";
import { BIOMAS } from "@/react-app/components/games/jogos/bombas/desenho";
import { RODADAS_COPA } from "@/react-app/utils/games/copa";
import type { ConfigBombas, Formato } from "@/react-app/utils/games/configBombas";
import type { Bioma, Dificuldade, Modo } from "@/react-app/utils/games/bombas";

export type { ConfigBombas, Formato } from "@/react-app/utils/games/configBombas";


const DIFICULDADES: { valor: Dificuldade; rotulo: string }[] = [
  { valor: "facil", rotulo: "Fácil" }, { valor: "medio", rotulo: "Médio" }, { valor: "dificil", rotulo: "Difícil" },
];

/** Botões em pílula no estilo da Central (escuro, com brilho na opção escolhida). */
export function Pilulas<T extends string | number>({ rotulo, opcoes, valor, aoMudar, cor = "cyan" }: {
  rotulo: string; opcoes: { valor: T; rotulo: React.ReactNode }[]; valor: T; aoMudar: (v: T) => void; cor?: "cyan" | "fuchsia" | "lime";
}) {
  const ativo = { cyan: "bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,.55)]", fuchsia: "bg-fuchsia-500 text-white shadow-[0_0_18px_rgba(217,70,239,.55)]", lime: "bg-lime-400 text-slate-950 shadow-[0_0_18px_rgba(163,230,53,.5)]" }[cor];
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
      {opcoes.map(o => (
        <button key={String(o.valor)} type="button" role="radio" aria-checked={valor === o.valor} onClick={() => aoMudar(o.valor)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black uppercase tracking-wide transition ${valor === o.valor ? ativo : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

const rotuloCampo = "text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/70";
const seletor = "mt-1 w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30";

/**
 * Preparação do Bombas Táticas: modo, bioma, quantos bots (0 a 7: sozinho também vale), dificuldade, vitórias e Copa.
 * {@code humanos} = quantas pessoas já vão jogar (você e/ou os celulares).
 */
export default function ConfigPartida({ cfg, mudar, humanos }: { cfg: ConfigBombas; mudar: (c: ConfigBombas) => void; humanos: number }) {
  const maxBots = Math.max(0, 8 - humanos);
  const bots = Math.min(cfg.bots, maxBots);
  const total = humanos + bots;
  const solo = total === 1;
  const set = <K extends keyof ConfigBombas>(k: K, v: ConfigBombas[K]) => mudar({ ...cfg, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={rotuloCampo}>Modo
          <select value={cfg.modo} onChange={e => set("modo", e.target.value as Modo)} className={seletor}>
            <option value="sobrevivencia">{solo ? "Desafio (limpe as caixas)" : "Sobrevivência"}</option>
            {!solo && <option value="times">Times</option>}
            <option value="moedas">{solo ? "Meta de moedas" : "Caça às Moedas"}</option>
          </select>
        </label>
        <label className={rotuloCampo}>Bioma
          <select value={cfg.bioma} onChange={e => set("bioma", e.target.value as Bioma)} className={seletor}>
            {(Object.keys(BIOMAS) as Bioma[]).map(b => <option key={b} value={b}>{BIOMAS[b].nome}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className={rotuloCampo}>Bots</p>
          <div className="mt-1 flex items-center gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10" role="group" aria-label="Quantidade de bots">
            <button type="button" aria-label="Menos bots" disabled={bots <= 0} onClick={() => set("bots", bots - 1)} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
            <span className="flex w-16 items-center justify-center gap-1 font-mono text-lg font-black text-white" aria-live="polite" aria-label={`${bots} bots`}><Bot className="h-4 w-4 text-cyan-300" />{bots}</span>
            <button type="button" aria-label="Mais bots" disabled={bots >= maxBots} onClick={() => set("bots", bots + 1)} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
        <p className="pb-2 text-xs font-bold text-white/60">{humanos} {humanos === 1 ? "pessoa" : "pessoas"} + {bots} {bots === 1 ? "bot" : "bots"} = <span className="text-cyan-300">{total} na arena</span>{solo ? " · sozinho" : ""}</p>
      </div>

      {bots > 0 && <Pilulas rotulo="Dificuldade dos bots" valor={cfg.dificuldade} aoMudar={v => set("dificuldade", v)} cor="fuchsia"
        opcoes={DIFICULDADES.map(d => ({ valor: d.valor, rotulo: `Bots ${d.rotulo}` }))} />}

      {!solo && (
        <label className={rotuloCampo}>Vitórias para vencer
          <select value={cfg.vitorias} onChange={e => set("vitorias", Number(e.target.value))} className={seletor}>
            {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}

      <Pilulas rotulo="Formato" valor={cfg.formato} aoMudar={v => set("formato", v)} cor="lime"
        opcoes={(["unica", ...RODADAS_COPA] as Formato[]).map(f => ({ valor: f, rotulo: f === "unica" ? <><span className="sm:hidden">Única</span><span className="hidden sm:inline">Partida única</span></> : <><Trophy className="h-3.5 w-3.5" />Copa {f}</> }))} />
      {cfg.formato !== "unica" && <p className="text-xs text-white/60">Copa: {cfg.formato} partidas seguidas; cada colocação vale pontos (1º 10, 2º 7, 3º 5, 4º 3…). Quem somar mais fica com a taça.</p>}
      {solo && <p className="text-xs text-lime-300/90">Sozinho: {cfg.modo === "moedas" ? "junte 10 moedas em 2 minutos." : "exploda todas as caixas antes do tempo, sem cair."} Cada tentativa vale como uma partida.</p>}
      {!solo && cfg.modo === "times" && total % 2 === 1 && <p className="text-xs font-semibold text-amber-300">Times precisa de número par: com {total}, a partida vira Sobrevivência.</p>}
    </div>
  );
}
