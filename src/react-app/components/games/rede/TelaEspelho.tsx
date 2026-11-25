import { useEffect, useRef, useState } from "react";
import type { Dificuldade } from "@/react-app/utils/games/bombas";
import type { MetaEspelho, PartidaEspelho, QuadroEspelho } from "@/react-app/utils/games/espelho";
import { lerAvatar } from "@/react-app/utils/avatar";
import type { MotorJogo, VagaJogo } from "../comum/MolduraPartida";
import { fabricaDoMotor } from "../jogos/fabricas";
import { vibrar } from "../entrada/entrada";
import { CORES_JOGADORES } from "../central/sprites";

/**
 * O jogo inteiro no celular: monta o mesmo motor da tela e desenha cada quadro que chega (com os sons e efeitos dos
 * eventos). Entre dois quadros, o motor interpola o movimento. Mostra o placar, a contagem e as telas de fim.
 */
export default function TelaEspelho({ partida, assinar }: { partida: PartidaEspelho; assinar: (f: (q: QuadroEspelho) => void) => () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState<MetaEspelho | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    let motor: MotorJogo | null = null;
    let fila: QuadroEspelho | null = null;
    let ultimo = -1;
    let chegou = performance.now();
    let intervalo = 33;
    let metaAtual: MetaEspelho | null = null;
    let ultimaMeta = 0;
    let quadro = 0;
    let antes = performance.now();
    const eu = partida.eu;
    // A vaga deste celular é "privada": pode mostrar o que é segredo dela (mão, frota). As outras pessoas aparecem
    // como celulares (controle), para o motor não achar que alguém joga no teclado daqui.
    const vagas: VagaJogo[] = partida.vagas.map((v, i) => ({
      nome: v.nome, bot: v.bot as Dificuldade | null, avatar: lerAvatar(JSON.stringify(v.avatar ?? {}), 9000 + i),
      controle: i === eu || v.bot ? undefined : 1, privada: i === eu,
    }));
    const ganchos = {
      morte: (i: number) => { if (i === eu) vibrar([60, 40, 120]); },
      vibrarLocal: (i: number, p: number | number[]) => { if (i === eu) vibrar(p); },
      privado: () => undefined,
    };
    const desassinar = assinar(q => {
      // Quadro velho (chegou fora de ordem) é descartado; um número bem menor indica que a tela recomeçou a contagem.
      if (q.n <= ultimo && q.n > ultimo - 200) return;
      const agora = performance.now();
      intervalo = Math.min(200, Math.max(16, agora - chegou));
      chegou = agora;
      ultimo = q.n;
      if (fila) q = { ...q, ev: [...fila.ev, ...q.ev] };
      fila = q;
    });
    const obs = new ResizeObserver(() => motor?.redimensionar());
    void fabricaDoMotor(partida.jogo).then(f => {
      if (!vivo) return;
      if (!f || !caixa.current) { setFalhou(true); return; }
      motor = f(caixa.current, vagas, partida.modo, partida.cenario, ganchos);
      motor.iniciarRodada();
      obs.observe(caixa.current);
      const laco = (agora: number) => {
        if (!vivo || !motor) return;
        const dt = Math.min(0.1, (agora - antes) / 1000);
        antes = agora;
        if (fila) {
          motor.aplicar?.(fila.s, fila.ev);
          metaAtual = fila.m;
          fila = null;
          if (agora - ultimaMeta > 150 || metaAtual.fase !== "jogando") { ultimaMeta = agora; setMeta(metaAtual); }
        }
        const alfa = Math.min(1, (agora - chegou) / intervalo);
        motor.desenhar(alfa, metaAtual?.pausado ? 0 : dt, metaAtual?.fase ?? "contagem", metaAtual?.ultimo?.vencedor ?? null);
        quadro = requestAnimationFrame(laco);
      };
      quadro = requestAnimationFrame(laco);
    }).catch(() => setFalhou(true));
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      obs.disconnect();
      desassinar();
      motor?.destruir();
    };
  }, [partida, assinar]);

  const placar = meta?.placar;
  const vencedor = meta?.ultimo?.vencedor ?? null;
  const time = meta?.ultimo?.time ?? null;
  return (
    <div className="relative flex h-full w-full flex-col">
      <ul className="flex shrink-0 gap-1 overflow-x-auto px-2 pb-1" aria-label="Placar">
        {partida.vagas.map((v, i) => {
          const j = placar?.jogadores[i];
          return (
            <li key={i} className={`flex shrink-0 flex-col rounded-lg px-1.5 py-0.5 text-[10px] leading-tight ${j && !j.vivo ? "opacity-40" : ""}`}
              style={{ boxShadow: `inset 0 0 0 2px ${CORES_JOGADORES[i]}`, background: i === partida.eu ? `${CORES_JOGADORES[i]}40` : "rgba(255,255,255,.05)" }}>
              <span className="font-black" style={{ color: CORES_JOGADORES[i] }}>P{i + 1}{i === partida.eu ? " (você)" : v.bot ? " 🤖" : ""}</span>
              <span className="tabular-nums text-white/80">{j?.texto ?? ""}{partida.vagas.length > 1 ? ` ★${meta?.vitorias[i] ?? 0}` : ""}</span>
            </li>
          );
        })}
        {placar && <li className="ml-auto shrink-0 self-center rounded-lg bg-white/10 px-2 py-1 font-mono text-xs font-black tabular-nums">{Math.floor(placar.tempo / 60)}:{String(placar.tempo % 60).padStart(2, "0")}</li>}
      </ul>
      <div ref={caixa} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" aria-label="O jogo neste celular">
        {falhou && <p className="text-sm text-white/60">Este jogo ainda não aparece no celular: olhe a tela grande.</p>}
        {!meta && !falhou && <p className="absolute text-sm text-white/60">Conectando ao jogo…</p>}
        {meta?.fase === "contagem" && (
          <span key={meta.contagem} className="pointer-events-none absolute text-7xl font-black drop-shadow-[0_6px_0_rgba(0,0,0,.6)]">{meta.contagem > 0 ? meta.contagem : "JÁ!"}</span>
        )}
        {meta?.pausado && <p className="absolute rounded-xl bg-black/70 px-4 py-2 text-xl font-black">Pausado</p>}
        {(meta?.fase === "fimRodada" || meta?.fase === "fimPartida") && (
          <div className="absolute inset-x-4 rounded-2xl bg-black/75 p-4 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-white/60">{meta.fase === "fimPartida" ? "Fim da partida" : `Fim da rodada ${meta.rodada}`}</p>
            <p className="mt-1 text-xl font-black">
              {time !== null ? `Time ${time === 0 ? "Ímpar" : "Par"} venceu` : vencedor === null ? "Empate!" : vencedor === partida.eu ? "🏆 Você venceu!" : `P${vencedor + 1} · ${partida.vagas[vencedor]?.nome ?? ""} venceu`}
            </p>
            {meta.fase === "fimRodada" && <p className="mt-1 text-xs text-white/60">A próxima rodada começa pela tela de quem hospeda.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
