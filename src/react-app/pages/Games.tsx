import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Heart, Lock, Medal, Monitor, Play, Search, Smartphone, Trophy, Users, X } from "lucide-react";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import CapaJogo from "@/react-app/components/games/central/CapaJogo";
import { CORES_JOGADORES, avatarDaVaga } from "@/react-app/components/games/central/sprites";
import PainelRecordes from "@/react-app/components/games/central/PainelRecordes";
import { PodioCopa, TabelaCopa } from "@/react-app/components/games/central/CopaTelas";
import SalaPainel from "@/react-app/components/games/central/SalaPainel";
import { ClienteSala, type EstadoConexao } from "@/react-app/components/games/rede/ClienteSala";
import BombasTaticas, { type FaseBombas, type ResultadoBombas, type VagaBombas } from "@/react-app/components/games/jogos/bombas/BombasTaticas";
import { BIOMAS } from "@/react-app/components/games/jogos/bombas/desenho";
import { som } from "@/react-app/components/games/audio/sintetizador";
import Avatar from "@/react-app/components/avatar/Avatar";
import { useAuth } from "@/react-app/hooks/useAuth";
import { avatarService } from "@/react-app/services/AvatarService";
import { gamesService, salasService, type GameRegistro } from "@/react-app/services/GamesService";
import { EntradasRemotas, type JogadorSala } from "@/react-app/utils/games/sala";
import { lerAvatar } from "@/react-app/utils/avatar";
import { RODADAS_COPA, classificacao, colocacoes, novaCopa, registrarPartida, resumoDaCopa, terminou, type Copa, type RodadasCopa } from "@/react-app/utils/games/copa";
import { pontosBombas } from "@/react-app/utils/games/pontuacao";
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

function guardarFavoritos(f: Set<string>) {
  try { localStorage.setItem(CHAVE_FAVORITOS, JSON.stringify([...f])); } catch { /* sem armazenamento */ }
}

const DIFICULDADES: { valor: Dificuldade; rotulo: string }[] = [
  { valor: "facil", rotulo: "Fácil" }, { valor: "medio", rotulo: "Médio" }, { valor: "dificil", rotulo: "Difícil" },
];

interface Partida { vagas: VagaBombas[]; modo: Modo; bioma: Bioma; vitorias: number; dificuldade: Dificuldade; inicio: number; numero: number }

/** Partida única ou Copa de 3, 5 ou 7 partidas. */
type Formato = "unica" | RodadasCopa;

type Registro = { estado: "salvando" } | { estado: "salvo"; pontos: number; r: GameRegistro } | { estado: "erro" };

/** O que aparece no fim da partida: pontos, recorde e conquistas novas. */
function AvisoRegistro({ registro }: { registro: Registro | null }) {
  if (!registro) return null;
  if (registro.estado === "salvando") return <p className="mt-3 text-xs text-slate-400" aria-live="polite">Salvando o resultado…</p>;
  if (registro.estado === "erro") return <p className="mt-3 text-xs text-amber-700" aria-live="polite">Não deu para salvar o resultado agora.</p>;
  const { pontos, r } = registro;
  return (
    <div className="mt-3 space-y-1.5" aria-live="polite">
      <p className="text-sm font-black text-slate-700">+{pontos.toLocaleString("pt-BR")} pts{r.inNovoRecorde ? <span className="ml-2 rounded-md bg-amber-400 px-1.5 py-0.5 text-xs text-amber-950">Novo recorde!</span> : null}</p>
      {r.novas.map(c => (
        <p key={c.cdConquista} className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
          <Medal className="h-4 w-4 text-amber-500" />Conquista: {c.nmConquista}
        </p>
      ))}
    </div>
  );
}

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
  const [formato, setFormato] = useState<Formato>("unica");
  const [copa, setCopa] = useState<Copa | null>(null);
  const [podio, setPodio] = useState<{ copa: Copa; salvo: "salvando" | "salvo" | "erro" | "fora" } | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [versaoRecordes, setVersaoRecordes] = useState(0);
  const favoritosDaConta = useRef(false);
  // Multiplayer: sala aberta nesta tela e os celulares como controle.
  const [ondeJogar, setOndeJogar] = useState<"tela" | "celulares">("tela");
  const [sala, setSala] = useState<{ codigo: string; estado: EstadoConexao; jogadores: JogadorSala[] } | null>(null);
  const [erroSala, setErroSala] = useState<string | null>(null);
  const [euJogo, setEuJogo] = useState(true);
  const clienteSala = useRef<ClienteSala | null>(null);
  const remotas = useMemo(() => new EntradasRemotas(), []);
  const vagasDaCopa = useRef<VagaBombas[]>([]);

  useEffect(() => {
    avatarService.meu().then(a => a && setMeuAvatar({ dsConfig: a.dsConfig, idUsuario: a.idUsuario })).catch(() => {
      if (usuario) setMeuAvatar({ dsConfig: null, idUsuario: usuario.id });
    });
  }, [usuario]);

  // Favoritos na conta (qualquer aparelho); o navegador guarda uma cópia para abrir rápido e sem rede.
  useEffect(() => {
    gamesService.favoritos().then(daConta => {
      favoritosDaConta.current = true;
      const locais = lerFavoritos();
      if (daConta.length === 0 && locais.size > 0) {
        gamesService.salvarFavoritos([...locais]).catch(() => undefined);
        return;
      }
      const f = new Set(daConta);
      setFavoritos(f);
      guardarFavoritos(f);
    }).catch(() => undefined);
  }, []);

  const lista = useMemo(() => filtrarJogos(JOGOS, filtros, favoritos), [filtros, favoritos]);

  const alternarFavorito = (id: string) => {
    const novo = new Set(favoritos);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setFavoritos(novo);
    guardarFavoritos(novo);
    if (favoritosDaConta.current) gamesService.salvarFavoritos([...novo]).catch(() => undefined);
  };

  // Vagas da partida: quem está na tela, os celulares conectados e bots completando até a quantidade escolhida.
  const vagas: VagaBombas[] = useMemo(() => {
    const lista: VagaBombas[] = [];
    const comSala = ondeJogar === "celulares" && sala;
    if (!comSala || euJogo) lista.push({ nome: usuario?.nome?.split(" ")[0] ?? "Você", bot: null, avatar: avatarDaVaga(0, meuAvatar) });
    if (comSala) {
      sala.jogadores.filter(j => j.vaga > 0 && j.conectado).slice(0, 8 - lista.length)
        .forEach(j => lista.push({ nome: j.nome.split(" ")[0], bot: null, avatar: lerAvatar(j.avatar, j.idUsuario), controle: j.vaga }));
    }
    let n = 1;
    while (lista.length < Math.max(qtd, 2) && lista.length < 8) lista.push({ nome: `Bot ${n++}`, bot: dificuldade, avatar: avatarDaVaga(lista.length, null) });
    return lista;
  }, [qtd, dificuldade, meuAvatar, usuario, ondeJogar, sala, euJogo]);

  // Avisos para os celulares (a tela é quem manda).
  const paraTodos = (d: unknown) => clienteSala.current?.enviar({ t: "todos", d });
  const paraVaga = (vaga: number, d: unknown) => clienteSala.current?.enviar({ t: "para", vaga, d });

  const abrirSala = async () => {
    setErroSala(null);
    try {
      const ingresso = await salasService.criar("bombas");
      if (!ingresso) throw new Error("Não deu para abrir a sala");
      clienteSala.current?.fechar();
      setSala({ codigo: ingresso.codigo, estado: "conectando", jogadores: [] });
      clienteSala.current = new ClienteSala(ingresso, m => {
        if (m.t === "entrada") remotas.receber(Number(m.vaga), m.d);
        else if (m.t === "sala" || m.t === "jogadores") {
          const lista = (m.jogadores as JogadorSala[]) ?? [];
          lista.filter(j => !j.conectado).forEach(j => remotas.soltar(j.vaga));
          setSala(atual => atual && { ...atual, jogadores: lista });
        }
      }, (estado, motivo) => {
        setSala(atual => atual && { ...atual, estado });
        if (estado === "fechada") setErroSala(motivo ?? "A sala foi fechada");
      });
    } catch (e) {
      setErroSala((e as Error).message || "Não deu para abrir a sala");
    }
  };

  const fecharSala = () => {
    clienteSala.current?.fechar({ t: "fechar" });
    clienteSala.current = null;
    setSala(null);
  };

  useEffect(() => () => clienteSala.current?.fechar({ t: "fechar" }), []);

  const comecar = (numero: number) => {
    som.destravar();
    setRegistro(null);
    const daPartida = numero === 1 || !copa ? vagas : vagasDaCopa.current;
    if (numero === 1) vagasDaCopa.current = vagas;
    daPartida.forEach((v, i) => { if (v.controle !== undefined) paraVaga(v.controle, { k: "lugar", indice: i, cor: CORES_JOGADORES[i], jogo: "bombas" }); });
    setPartida({ vagas: daPartida, modo: modo === "times" && daPartida.length % 2 ? "sobrevivencia" : modo, bioma, vitorias, dificuldade, inicio: Date.now(), numero });
  };

  const jogar = () => {
    setCopa(formato === "unica" ? null : novaCopa(formato, vagas.map((v, i) => `P${i + 1} · ${v.nome}`)));
    comecar(1);
  };

  const sair = () => {
    setPartida(null);
    setCopa(null);
    paraTodos({ k: "fase", fase: "lobby" });
  };

  // Fim de uma partida: guarda na conta (recorde, conquistas) e, na Copa, soma a colocação na tabela.
  const aoTerminar = useCallback((r: ResultadoBombas) => {
    if (!partida) return;
    const lugares = colocacoes(r.vitorias, r.vencedor);
    const nrBots = partida.vagas.filter(v => v.bot).length;
    const duracao = Math.min(86_400, Math.round((Date.now() - partida.inicio) / 1000));
    const resultadoDe = (i: number) => {
      const venceu = r.vencedor === i || (partida.modo === "times" && r.vencedor !== null && r.vencedor % 2 === i % 2);
      // Sem bots, os pontos não ganham peso de dificuldade.
      const pontos = pontosBombas({ vitoriasRodada: r.vitorias[i], venceu, jogadores: partida.vagas.length, dificuldade: nrBots ? partida.dificuldade : null });
      return { venceu, pontos, colocacao: venceu ? 1 : Math.max(2, lugares[i]) };
    };
    if (copa) setCopa(registrarPartida(copa, lugares));
    // Cada celular registra a própria partida na própria conta.
    partida.vagas.forEach((v, i) => {
      if (v.controle === undefined) return;
      const res = resultadoDe(i);
      paraVaga(v.controle, { k: "fim", jogo: "bombas", modo: partida.modo, ...res, jogadores: partida.vagas.length, bots: nrBots, dificuldade: nrBots ? partida.dificuldade : null, duracao });
    });
    const eu = partida.vagas.findIndex(v => !v.bot && v.controle === undefined);
    if (eu < 0) return;
    const { venceu, pontos, colocacao } = resultadoDe(eu);
    setRegistro({ estado: "salvando" });
    gamesService.registrarPartida({
      cdJogo: "bombas", cdModo: partida.modo, nrPontos: pontos, inVitoria: venceu, nrColocacao: colocacao,
      nrJogadores: partida.vagas.length, nrBots, cdDificuldade: nrBots ? partida.dificuldade : null, nrDuracaoS: duracao,
    }).then(res => {
      setRegistro(res ? { estado: "salvo", pontos, r: res } : { estado: "erro" });
      setVersaoRecordes(v => v + 1);
    }).catch(() => setRegistro({ estado: "erro" }));
  }, [partida, copa]);

  const encerrarCopa = (final: Copa) => {
    setPartida(null);
    const eu = vagasDaCopa.current.findIndex(v => !v.bot && v.controle === undefined);
    if (eu < 0) {
      setPodio({ copa: final, salvo: "fora" });
      return;
    }
    setPodio({ copa: final, salvo: "salvando" });
    const minha = classificacao(final).find(l => l.vaga === eu)?.posicao ?? 1;
    gamesService.registrarCopa(final.rodadas, minha, resumoDaCopa(final, "bombas"))
      .then(() => { setPodio(p => p && { ...p, salvo: "salvo" }); setVersaoRecordes(v => v + 1); })
      .catch(() => setPodio(p => p && { ...p, salvo: "erro" }));
  };

  if (podio) {
    return (
      <PodioCopa copa={podio.copa} avatares={vagasDaCopa.current.map(v => v.avatar)} salvo={podio.salvo}
        onSair={() => { setPodio(null); setCopa(null); paraTodos({ k: "fase", fase: "lobby" }); }}
        onDeNovo={() => { setPodio(null); setCopa(novaCopa(podio.copa.rodadas, podio.copa.nomes)); comecar(1); }} />
    );
  }

  if (partida) {
    const copaAcabou = copa ? terminou(copa) : false;
    return (
      <BombasTaticas key={partida.numero} vagas={partida.vagas} modo={partida.modo} bioma={partida.bioma} vitoriasParaVencer={partida.vitorias}
        onSair={sair} onFim={aoTerminar} remotas={sala ? remotas : undefined}
        onFase={(f: FaseBombas) => paraTodos({ k: "fase", fase: f })}
        onMorte={i => { const v = partida.vagas[i]; if (v?.controle !== undefined) paraVaga(v.controle, { k: "vibrar", ms: 300, texto: "Você caiu!" }); }}
        subtitulo={copa ? `Copa · partida ${Math.min(copa.rodadas, partida.numero)} de ${copa.rodadas}` : undefined}
        avisoFim={<><AvisoRegistro registro={registro} />{copa && copa.partidas.length > 0 && <TabelaCopa copa={copa} />}</>}
        acaoFim={copa ? (copaAcabou
          ? { rotulo: "Ver o pódio", aoClicar: () => encerrarCopa(copa) }
          : { rotulo: `Próxima partida (${copa.partidas.length + 1}/${copa.rodadas})`, aoClicar: () => comecar(partida.numero + 1) }) : undefined} />
    );
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
                      <label className="text-xs font-bold text-slate-500">{ondeJogar === "celulares" ? "Jogadores (bots completam)" : "Jogadores (você + bots)"}
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
                    <div role="radiogroup" aria-label="Onde jogar" className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
                      {([["tela", "Nesta tela", Monitor], ["celulares", "Com celulares", Smartphone]] as const).map(([valor, rotulo, Icone]) => (
                        <button key={valor} type="button" role="radio" aria-checked={ondeJogar === valor} onClick={() => setOndeJogar(valor)}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-black ${ondeJogar === valor ? "bg-emerald-600 text-white" : "text-slate-500"}`}>
                          <Icone className="h-3.5 w-3.5" />{rotulo}
                        </button>
                      ))}
                    </div>
                    {ondeJogar === "celulares" && (sala ? (
                      <SalaPainel codigo={sala.codigo} estado={sala.estado} jogadores={sala.jogadores} euJogo={euJogo} onEuJogo={setEuJogo} onFechar={fecharSala} />
                    ) : (
                      <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 text-xs text-emerald-900 ring-1 ring-emerald-100">
                        <p>Abra uma sala nesta tela: cada pessoa entra pelo celular (QR Code ou código) e o celular vira o controle. Os bots completam as vagas que sobrarem.</p>
                        <button type="button" onClick={() => void abrirSala()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700">Abrir sala</button>
                        {erroSala && <p className="font-semibold text-rose-700" role="alert">{erroSala}</p>}
                      </div>
                    ))}
                    <div role="radiogroup" aria-label="Formato" className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200" data-tutorial="games-copa">
                      {(["unica", ...RODADAS_COPA] as Formato[]).map(f => (
                        <button key={String(f)} type="button" role="radio" aria-checked={formato === f} onClick={() => setFormato(f)}
                          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-black ${formato === f ? "bg-indigo-600 text-white" : "text-slate-500"}`}>
                          {f === "unica" ? <><span className="sm:hidden">Única</span><span className="hidden sm:inline">Partida única</span></> : <><Trophy className="h-3.5 w-3.5" />Copa {f}</>}
                        </button>
                      ))}
                    </div>
                    {formato !== "unica" && <p className="text-xs text-slate-500">Copa: {formato} partidas seguidas; cada colocação vale pontos (1º 10, 2º 7, 3º 5, 4º 3…). Quem somar mais fica com a taça.</p>}
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
                          <Avatar config={v.avatar} tamanho={22} semFundo /> P{i + 1}{v.bot ? "" : v.controle !== undefined ? ` · ${v.nome} 📱` : " (você)"}
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={jogar} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-base font-black text-white shadow hover:bg-orange-600">
                      <Play className="h-5 w-5" />{formato === "unica" ? "Jogar" : `Começar a Copa (${formato})`}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600"><Lock className="mr-1 inline h-4 w-4" />Chega na fase {aberto.fase} do plano. Modos: {aberto.modos.join(", ")}.</p>
                )}
                {aberto.disponivel && <PainelRecordes jogo={aberto.id} versao={versaoRecordes} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
