import { useEffect, useMemo, useState } from "react";
import { Gamepad2, Heart, Lock, Play, Search, Users, X } from "lucide-react";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import CapaJogo from "@/react-app/components/games/central/CapaJogo";
import { CORES_JOGADORES, avatarDaVaga } from "@/react-app/components/games/central/sprites";
import BombasTaticas, { type VagaBombas } from "@/react-app/components/games/jogos/bombas/BombasTaticas";
import { BIOMAS } from "@/react-app/components/games/jogos/bombas/desenho";
import { som } from "@/react-app/components/games/audio/sintetizador";
import Avatar from "@/react-app/components/avatar/Avatar";
import { useAuth } from "@/react-app/hooks/useAuth";
import { avatarService } from "@/react-app/services/AvatarService";
import { CATEGORIAS, FILTROS_CENTRAL, JOGOS, filtrarJogos, type FiltrosCentral, type Jogo } from "@/react-app/utils/games/catalogo";
import type { Bioma, Dificuldade, Modo } from "@/react-app/utils/games/bombas";

const CHAVE_FAVORITOS = "@NordTool:games:favoritos";

function lerFavoritos(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_FAVORITOS) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

const DIFICULDADES: { valor: Dificuldade; rotulo: string }[] = [
  { valor: "facil", rotulo: "Fácil" }, { valor: "medio", rotulo: "Médio" }, { valor: "dificil", rotulo: "Difícil" },
];

interface Partida { vagas: VagaBombas[]; modo: Modo; bioma: Bioma; vitorias: number }

/** Individual → Games: a Central de Jogos (estilo launcher) e as partidas. */
export default function GamesPage() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState<FiltrosCentral>(FILTROS_CENTRAL);
  const [favoritos, setFavoritos] = useState<Set<string>>(lerFavoritos);
  const [aberto, setAberto] = useState<Jogo | null>(null);
  const [meuAvatar, setMeuAvatar] = useState<{ dsConfig: string | null; idUsuario: number } | null>(null);
  const [partida, setPartida] = useState<Partida | null>(null);
  // Preparação da partida (Bombas Táticas).
  const [modo, setModo] = useState<Modo>("sobrevivencia");
  const [bioma, setBioma] = useState<Bioma>("fabrica");
  const [qtd, setQtd] = useState(4);
  const [dificuldade, setDificuldade] = useState<Dificuldade>("medio");
  const [vitorias, setVitorias] = useState(2);

  useEffect(() => {
    avatarService.meu().then(a => a && setMeuAvatar({ dsConfig: a.dsConfig, idUsuario: a.idUsuario })).catch(() => {
      if (usuario) setMeuAvatar({ dsConfig: null, idUsuario: usuario.id });
    });
  }, [usuario]);

  const lista = useMemo(() => filtrarJogos(JOGOS, filtros, favoritos), [filtros, favoritos]);

  const alternarFavorito = (id: string) => {
    const novo = new Set(favoritos);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setFavoritos(novo);
    try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify([...novo])); } catch { /* sem armazenamento */ }
  };

  const vagas: VagaBombas[] = useMemo(() => Array.from({ length: qtd }, (_, i) => ({
    nome: i === 0 ? (usuario?.nome?.split(" ")[0] ?? "Você") : `Bot ${i}`,
    bot: i === 0 ? null : dificuldade,
    avatar: avatarDaVaga(i, meuAvatar),
  })), [qtd, dificuldade, meuAvatar, usuario]);

  const jogar = () => {
    som.destravar();
    setPartida({ vagas, modo: modo === "times" && qtd % 2 ? "sobrevivencia" : modo, bioma, vitorias });
  };

  if (partida) {
    return <BombasTaticas vagas={partida.vagas} modo={partida.modo} bioma={partida.bioma} vitoriasParaVencer={partida.vitorias} onSair={() => setPartida(null)} />;
  }

  const filtroBotao = (ativo: boolean, rotulo: string, aoClicar: () => void) => (
    <button type="button" aria-pressed={ativo} onClick={aoClicar}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${ativo ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
      {rotulo}
    </button>
  );

  return (
    <div className="space-y-5 p-3 sm:p-6">
      <CabecalhoPagina icone={Gamepad2} titulo="Games" subtitulo="Central de jogos: sozinho contra bots, no celular ou com a turma (até 8)" />

      <section data-tutorial="games-filtros" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar jogo, modo ou categoria" aria-label="Buscar jogo"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </div>
          {filtroBotao(filtros.soDisponiveis, "Disponíveis", () => setFiltros({ ...filtros, soDisponiveis: !filtros.soDisponiveis }))}
          {filtroBotao(filtros.soFavoritos, "♥ Favoritos", () => setFiltros({ ...filtros, soFavoritos: !filtros.soFavoritos }))}
          {filtroBotao(filtros.dimensao === "2D", "2D", () => setFiltros({ ...filtros, dimensao: filtros.dimensao === "2D" ? "" : "2D" }))}
          {filtroBotao(filtros.dimensao === "3D", "3D", () => setFiltros({ ...filtros, dimensao: filtros.dimensao === "3D" ? "" : "3D" }))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Categoria" value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
          <span className="ml-2 flex items-center gap-1 text-xs font-bold text-slate-500"><Users className="h-4 w-4" />Jogadores:</span>
          {[null, 1, 2, 4, 8].map(n => <span key={String(n)}>{filtroBotao(filtros.jogadores === n, n === null ? "Todos" : `${n}P`, () => setFiltros({ ...filtros, jogadores: n }))}</span>)}
        </div>
      </section>

      <ul data-tutorial="games-grade" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label="Jogos">
        {lista.map(j => (
          <li key={j.id} className="group relative">
            <button type="button" onClick={() => setAberto(j)} aria-label={`${j.nome}${j.disponivel ? "" : " (em breve)"}`}
              className="block w-full overflow-hidden rounded-2xl text-left shadow-md ring-1 ring-black/10 transition hover:-translate-y-1 hover:shadow-xl focus-visible:ring-4 focus-visible:ring-blue-400">
              <CapaJogo jogo={j} className={j.disponivel ? "" : "opacity-70 grayscale-[35%]"} />
              <span className="absolute left-2 top-2 flex gap-1">
                <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white">{j.dimensao}</span>
                <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white">{j.minJogadores === j.maxJogadores ? `${j.maxJogadores}P` : `${j.minJogadores}–${j.maxJogadores}P`}</span>
              </span>
              {!j.disponivel && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white"><Lock className="h-3 w-3" />Fase {j.fase}</span>}
            </button>
            <button type="button" onClick={() => alternarFavorito(j.id)} aria-label={favoritos.has(j.id) ? `Tirar ${j.nome} dos favoritos` : `Favoritar ${j.nome}`} aria-pressed={favoritos.has(j.id)}
              className={`absolute bottom-2 right-2 rounded-full p-1.5 shadow ${favoritos.has(j.id) ? "bg-rose-500 text-white" : "bg-white/85 text-slate-500 opacity-0 group-hover:opacity-100 focus:opacity-100"}`}>
              <Heart className="h-4 w-4" fill={favoritos.has(j.id) ? "currentColor" : "none"} />
            </button>
          </li>
        ))}
        {lista.length === 0 && <li className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum jogo com esses filtros.</li>}
      </ul>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setAberto(null); }}>
          <div role="dialog" aria-modal="true" aria-label={aberto.nome} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
              <div className="w-full shrink-0 sm:w-56"><CapaJogo jogo={aberto} /></div>
              <div className="min-w-0 flex-1 space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">{aberto.nome}</h2>
                    <p className="text-sm text-slate-500">{aberto.categoria} · {aberto.dimensao} · {aberto.minJogadores}–{aberto.maxJogadores} jogadores</p>
                  </div>
                  <button type="button" onClick={() => setAberto(null)} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-slate-700">{aberto.resumo}</p>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Regras</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{aberto.regras.map(r => <li key={r}>{r}</li>)}</ul>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Controles</h3>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-600">{aberto.controles.map(c => <li key={c}>{c}</li>)}</ul>
                </div>
                {aberto.id === "bombas" ? (
                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4" data-tutorial="games-preparar">
                    <h3 className="text-sm font-black text-slate-800">Jogo rápido</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold text-slate-500">Modo
                        <select value={modo} onChange={e => setModo(e.target.value as Modo)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          <option value="sobrevivencia">Sobrevivência</option><option value="times">Times</option><option value="moedas">Caça às Moedas</option>
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-500">Bioma
                        <select value={bioma} onChange={e => setBioma(e.target.value as Bioma)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {(Object.keys(BIOMAS) as Bioma[]).map(b => <option key={b} value={b}>{BIOMAS[b].nome}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-500">Jogadores (você + bots)
                        <select value={qtd} onChange={e => setQtd(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} jogadores</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-bold text-slate-500">Vitórias para vencer
                        <select value={vitorias} onChange={e => setVitorias(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                          {[1, 2, 3, 5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    </div>
                    <div role="radiogroup" aria-label="Dificuldade dos bots" className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
                      {DIFICULDADES.map(d => (
                        <button key={d.valor} type="button" role="radio" aria-checked={dificuldade === d.valor} onClick={() => setDificuldade(d.valor)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-black ${dificuldade === d.valor ? "bg-slate-900 text-white" : "text-slate-500"}`}>Bots {d.rotulo}</button>
                      ))}
                    </div>
                    {modo === "times" && qtd % 2 === 1 && <p className="text-xs font-semibold text-amber-700">Times precisa de número par de jogadores: com {qtd}, a partida vira Sobrevivência.</p>}
                    <ul className="flex flex-wrap gap-1.5" aria-label="Vagas">
                      {vagas.map((v, i) => (
                        <li key={i} className="flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 text-xs font-bold ring-2" style={{ ["--tw-ring-color" as string]: CORES_JOGADORES[i] }}>
                          <Avatar config={v.avatar} tamanho={22} semFundo /> P{i + 1}{v.bot ? "" : " (você)"}
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={jogar} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-base font-black text-white shadow hover:bg-orange-600">
                      <Play className="h-5 w-5" />Jogar
                    </button>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600"><Lock className="mr-1 inline h-4 w-4" />Chega na fase {aberto.fase} do plano. Modos: {aberto.modos.join(", ")}.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
