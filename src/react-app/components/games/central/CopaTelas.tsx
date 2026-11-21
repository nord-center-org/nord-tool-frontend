import { Trophy } from "lucide-react";
import AvatarCorpo from "./AvatarCorpo";
import type { AvatarConfig } from "@/react-app/utils/avatar";
import { CORES_JOGADORES } from "./sprites";
import { classificacao, pontosDaColocacao, type Copa } from "@/react-app/utils/games/copa";

/** Tabela da Copa (no cartão do fim de cada partida): pontos somados e o que a última partida deu. */
export function TabelaCopa({ copa }: { copa: Copa }) {
  const ultima = copa.partidas[copa.partidas.length - 1];
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-left" aria-label="Tabela da Copa">
      <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Copa · partida {copa.partidas.length} de {copa.rodadas}</p>
      <ol className="space-y-0.5 text-sm">
        {classificacao(copa).map(l => (
          <li key={l.vaga} className="flex items-center gap-2">
            <span className="w-4 text-right font-black tabular-nums text-slate-400">{l.posicao}</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES_JOGADORES[l.vaga] }} />
            <span className="min-w-0 flex-1 truncate font-semibold">{l.nome}</span>
            {ultima && <span className="text-xs font-bold text-emerald-600">+{pontosDaColocacao(ultima[l.vaga])}</span>}
            <span className="w-8 text-right font-black tabular-nums">{l.pontos}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ALTURA = ["h-28", "h-20", "h-14"];
const ORDEM_PODIO = [1, 0, 2];

/** Pódio do fim da Copa: 2º, 1º e 3º lado a lado, e a tabela completa embaixo. */
export function PodioCopa({ copa, avatares, salvo, onSair, onDeNovo }: {
  copa: Copa; avatares: AvatarConfig[]; salvo: "salvando" | "salvo" | "erro" | "fora"; onSair: () => void; onDeNovo: () => void;
}) {
  const tabela = classificacao(copa);
  const podio = ORDEM_PODIO.map(i => tabela[i]).filter(Boolean);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 p-4 text-white" role="dialog" aria-modal="true" aria-label="Pódio da Copa">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">Copa de {copa.rodadas} partidas</p>
        <h2 className="mt-1 flex items-center justify-center gap-2 text-3xl font-black sm:text-4xl"><Trophy className="h-8 w-8 text-amber-400" />{tabela[0].nome} é campeão!</h2>
      </div>
      <ol className="flex items-end justify-center gap-2 sm:gap-4" aria-label="Pódio">
        {podio.map(l => (
          <li key={l.vaga} className="flex w-24 flex-col items-center sm:w-32">
            <div className="flex items-end justify-center rounded-2xl px-2 pt-1" style={{ boxShadow: `0 0 30px ${CORES_JOGADORES[l.vaga]}88`, background: `${CORES_JOGADORES[l.vaga]}22` }}>
              <AvatarCorpo config={avatares[l.vaga]} altura={l.posicao === 1 ? 120 : 92} acao={l.posicao === 1 ? "vitoria" : "parado"} atraso={l.posicao * 0.3} />
            </div>
            <p className="mt-1 w-full truncate text-center text-sm font-black">{l.nome}</p>
            <p className="text-xs tabular-nums text-white/70">{l.pontos} pts</p>
            <div className={`mt-1 flex w-full items-start justify-center rounded-t-xl pt-2 text-2xl font-black ${ALTURA[l.posicao - 1]} ${l.posicao === 1 ? "bg-amber-400 text-amber-950" : l.posicao === 2 ? "bg-slate-300 text-slate-800" : "bg-orange-700 text-orange-50"}`}>{l.posicao}º</div>
          </li>
        ))}
      </ol>
      <ol className="w-full max-w-sm space-y-1 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
        {tabela.map(l => (
          <li key={l.vaga} className="flex items-center gap-2">
            <span className="w-5 text-right font-black tabular-nums text-white/50">{l.posicao}º</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES_JOGADORES[l.vaga] }} />
            <span className="min-w-0 flex-1 truncate">{l.nome}</span>
            <span className="text-xs text-white/50">{l.primeiros}× 1º</span>
            <span className="w-10 text-right font-black tabular-nums">{l.pontos}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-white/60" aria-live="polite">{salvo === "salvando" ? "Salvando a Copa na sua conta…" : salvo === "salvo" ? "Copa salva no seu histórico." : salvo === "fora" ? "A tela só hospedou: cada partida já foi para a conta de quem jogou." : "Não deu para salvar a Copa agora; o resultado vale só nesta tela."}</p>
      <div className="flex gap-2">
        <button type="button" autoFocus onClick={onDeNovo} className="rounded-xl bg-orange-500 px-5 py-2.5 font-black text-white hover:bg-orange-600">Nova Copa</button>
        <button type="button" onClick={onSair} className="rounded-xl bg-white/15 px-5 py-2.5 font-bold hover:bg-white/25">Central</button>
      </div>
    </div>
  );
}
