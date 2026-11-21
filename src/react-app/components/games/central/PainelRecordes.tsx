import { useEffect, useState } from "react";
import { Award, Lock, Medal, Trophy } from "lucide-react";
import Avatar from "@/react-app/components/avatar/Avatar";
import { lerAvatar } from "@/react-app/utils/avatar";
import { gamesService, type GameResumo } from "@/react-app/services/GamesService";

const numero = (n: number) => n.toLocaleString("pt-BR");
const MEDALHA = ["#eab308", "#94a3b8", "#b45309"];
const MODO: Record<string, string> = { sobrevivencia: "Sobrevivência", times: "Times", moedas: "Caça às Moedas", copa: "Copa" };

/** Recordes, ranking da empresa, conquistas e últimas partidas de um jogo (painel de detalhes da Central). */
export default function PainelRecordes({ jogo, versao }: { jogo: string; versao: number }) {
  const [resumo, setResumo] = useState<GameResumo | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    gamesService.resumo(jogo).then(r => { if (vivo) setResumo(r ?? null); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [jogo, versao]);

  if (erro) return <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">Não deu para carregar os recordes agora. Tente de novo em instantes.</p>;
  if (!resumo) return <div className="h-40 animate-pulse rounded-2xl bg-white/10" aria-label="Carregando recordes" />;

  const m = resumo.meus;
  const ganhas = resumo.conquistas.filter(c => c.dhCriacao).length;
  return (
    <div className="space-y-4" data-tutorial="games-recordes">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[["Recorde", m.nrRecorde], ["Vitórias", m.nrVitorias], ["Partidas", m.nrPartidas]].map(([r, v]) => (
          <div key={r} className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-cyan-200/70">{r}</dt>
            <dd className="text-xl font-black tabular-nums text-white">{numero(Number(v))}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Ranking">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-200/70"><Trophy className="h-4 w-4" />Ranking</h3>
        {resumo.ranking.length === 0 ? (
          <p className="rounded-xl bg-white/5 p-3 text-sm text-white/60">Ninguém jogou ainda. Jogue a primeira partida e entre no topo.</p>
        ) : (
          <ol className="space-y-1">
            {resumo.ranking.map((r, i) => (
              <li key={r.idUsuario} className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm odd:bg-white/5">
                <span className="w-5 text-center font-black tabular-nums" style={{ color: MEDALHA[i] ?? "#64748b" }}>{i + 1}</span>
                <Avatar config={lerAvatar(r.dsAvatar, r.idUsuario)} tamanho={26} semFundo />
                <span className="min-w-0 flex-1 truncate font-semibold text-white/90">{r.nmNome}</span>
                <span className="shrink-0 text-xs text-white/60 tabular-nums">{numero(r.nrVitorias)} vit. · {numero(r.nrRecorde)} pts</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Conquistas">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-200/70"><Award className="h-4 w-4" />Conquistas · {ganhas}/{resumo.conquistas.length}</h3>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {resumo.conquistas.map(c => (
            <li key={c.cdConquista} title={c.txDescricao} className={`flex items-center gap-2 rounded-xl p-2 text-xs ${c.dhCriacao ? "bg-amber-400/10 text-amber-200 ring-1 ring-amber-300/40" : "bg-white/5 text-cyan-200/70"}`}>
              {c.dhCriacao ? <Medal className="h-5 w-5 shrink-0 text-amber-500" /> : <Lock className="h-4 w-4 shrink-0" />}
              <span className="min-w-0"><span className="block font-black">{c.nmConquista}</span><span className="block truncate">{c.txDescricao}</span></span>
            </li>
          ))}
        </ul>
      </section>

      {resumo.historico.length > 0 && (
        <section aria-label="Últimas partidas">
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-wider text-cyan-200/70">Últimas partidas</h3>
          <ul className="divide-y divide-white/10 text-sm">
            {resumo.historico.map(p => (
              <li key={p.id} className="flex items-center gap-2 py-1.5">
                <span className={`w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-black ${p.inVitoria ? "bg-lime-400/20 text-lime-300" : "bg-white/10 text-white/60"}`}>{p.inVitoria ? "Vitória" : `${p.nrColocacao}º`}</span>
                <span className="min-w-0 flex-1 truncate text-white/70">{MODO[p.cdModo] ?? p.cdModo} · {p.nrJogadores} jog.{p.idCopa ? " · Copa" : ""}</span>
                <span className="shrink-0 font-bold tabular-nums text-white/90">{numero(p.nrPontos)} pts</span>
                <time className="hidden shrink-0 text-xs text-cyan-200/70 sm:block" dateTime={p.dhCriacao}>{new Date(p.dhCriacao).toLocaleDateString("pt-BR")}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
