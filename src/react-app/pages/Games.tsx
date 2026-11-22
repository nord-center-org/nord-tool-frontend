import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Gamepad2, Heart, Joystick, Lock, Medal, Monitor, Play, Search, Smartphone, Sparkles, Users, X } from "lucide-react";
import PainelControles from "@/react-app/components/games/entrada/PainelControles";
import { gamepadsConectados } from "@/react-app/components/games/entrada/entrada";
import CapaJogo from "@/react-app/components/games/central/CapaJogo";
import { CORES_JOGADORES, avatarDaVaga } from "@/react-app/components/games/central/sprites";
import PainelRecordes from "@/react-app/components/games/central/PainelRecordes";
import { PodioCopa, TabelaCopa } from "@/react-app/components/games/central/CopaTelas";
import SalaPainel from "@/react-app/components/games/central/SalaPainel";
import ModoTela from "@/react-app/components/games/central/ModoTela";
import FundoGamer from "@/react-app/components/games/central/FundoGamer";
import AvatarCorpo from "@/react-app/components/games/central/AvatarCorpo";
import ConfigPartida, { Pilulas } from "@/react-app/components/games/central/ConfigPartida";
import { configPadrao, ehJogavel, modoEfetivo, type ConfigJogo } from "@/react-app/utils/games/registroJogos";
import { ClienteSala, type EstadoConexao } from "@/react-app/components/games/rede/ClienteSala";
import BombasTaticas, { type FaseBombas, type ResultadoBombas, type VagaBombas } from "@/react-app/components/games/jogos/bombas/BombasTaticas";
import { som } from "@/react-app/components/games/audio/sintetizador";
import { useAuth } from "@/react-app/hooks/useAuth";
import { avatarService } from "@/react-app/services/AvatarService";
import { gamesService, salasService, type GameRegistro } from "@/react-app/services/GamesService";
import { EntradasRemotas, type JogadorSala, type MaoPrivada } from "@/react-app/utils/games/sala";
import type { MetaEspelho } from "@/react-app/utils/games/espelho";
import { TransmissorEspelho } from "@/react-app/components/games/rede/Espelho";
import { lerAvatar } from "@/react-app/utils/avatar";
import { classificacao, colocacoes, novaCopa, registrarPartida, resumoDaCopa, terminou, type Copa } from "@/react-app/utils/games/copa";
import { pontosBombas } from "@/react-app/utils/games/pontuacao";
import { CATEGORIAS, FILTROS_CENTRAL, JOGOS, filtrarJogos, type FiltrosCentral, type Jogo } from "@/react-app/utils/games/catalogo";
import type { Bioma, Dificuldade, Modo } from "@/react-app/utils/games/bombas";
import type { ModoHex } from "@/react-app/utils/games/hexagonos";
import type { CenarioHex } from "@/react-app/components/games/jogos/hexagonos/motorHexagonos";
import type { TemaEncaixe } from "@/react-app/components/games/jogos/encaixe/motorEncaixe";
import type { ModoEncaixe } from "@/react-app/utils/games/encaixe";
import type { ModoDuelo } from "@/react-app/utils/games/duelo";
import type { CenarioDuelo } from "@/react-app/components/games/jogos/duelo/motorDuelo";
import type { ModoNaval } from "@/react-app/utils/games/naval";
import type { ModoHorda } from "@/react-app/utils/games/horda";
import type { ModoMasmorra } from "@/react-app/utils/games/masmorra";
import type { Arena as ArenaCoroa, ModoCoroa } from "@/react-app/utils/games/coroa";
import type { ModoEspacial, Setor } from "@/react-app/utils/games/espacial";
import type { ModoTorres, Paisagem } from "@/react-app/utils/games/torres";
import type { ModoDefesa } from "@/react-app/utils/games/defesa";
import type { MapaDefesa } from "@/react-app/components/games/jogos/defesa/motorDefesa";
import type { TemaMasmorra } from "@/react-app/components/games/jogos/masmorra/motorMasmorra";
import type { CenarioHorda } from "@/react-app/components/games/jogos/horda/motorHorda";
import type { ModoCartas } from "@/react-app/utils/games/cartas";
import type { MesaCartas } from "@/react-app/components/games/jogos/cartas/motorCartas";
import type { TemaNaval } from "@/react-app/components/games/jogos/naval/motorNaval";

// O 3D (three.js) só carrega quando alguém abre um jogo 3D.
const SumoHexagonos = lazy(() => import("@/react-app/components/games/jogos/hexagonos/SumoHexagonos"));
const EncaixeVersus = lazy(() => import("@/react-app/components/games/jogos/encaixe/EncaixeVersus"));
const DueloMeioDia = lazy(() => import("@/react-app/components/games/jogos/duelo/DueloMeioDia"));
const CartasDaVirada = lazy(() => import("@/react-app/components/games/jogos/cartas/CartasDaVirada"));
const TorresColapso = lazy(() => import("@/react-app/components/games/jogos/torres/TorresColapso"));
const DefesaBase = lazy(() => import("@/react-app/components/games/jogos/defesa/DefesaBase"));
const CorridaEspacial = lazy(() => import("@/react-app/components/games/jogos/espacial/CorridaEspacial"));
const CoroaMaldita = lazy(() => import("@/react-app/components/games/jogos/coroa/CoroaMaldita"));
const FugaMasmorra = lazy(() => import("@/react-app/components/games/jogos/masmorra/FugaMasmorra"));
const HordaZumbi = lazy(() => import("@/react-app/components/games/jogos/horda/HordaZumbi"));
const GuerraNaval = lazy(() => import("@/react-app/components/games/jogos/naval/GuerraNaval"));

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

interface Partida { jogo: string; vagas: VagaBombas[]; modo: string; cenario: string; vitorias: number; dificuldade: Dificuldade; inicio: number; numero: number }

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

/** Individual → Games: a Central de Jogos (estilo launcher de console) e as partidas. */
export default function GamesPage() {
  const { usuario } = useAuth();
  const [filtros, setFiltros] = useState<FiltrosCentral>(FILTROS_CENTRAL);
  const [favoritos, setFavoritos] = useState<Set<string>>(lerFavoritos);
  const [aberto, setAberto] = useState<Jogo | null>(null);
  const [meuAvatar, setMeuAvatar] = useState<{ dsConfig: string | null; idUsuario: number } | null>(null);
  const [partida, setPartida] = useState<Partida | null>(null);
  // Jogo em preparação e a preparação de cada jogo (cada um guarda a sua).
  const [jogoAtual, setJogoAtual] = useState("bombas");
  const [cfgs, setCfgs] = useState<Record<string, ConfigJogo>>({});
  const cfg = cfgs[jogoAtual] ?? configPadrao(jogoAtual);
  const setCfg = (c: ConfigJogo) => setCfgs(x => ({ ...x, [jogoAtual]: c }));
  const jogoDaCopa = useRef("bombas");
  const [copa, setCopa] = useState<Copa | null>(null);
  const [podio, setPodio] = useState<{ copa: Copa; salvo: "salvando" | "salvo" | "erro" | "fora" } | null>(null);
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [versaoRecordes, setVersaoRecordes] = useState(0);
  const favoritosDaConta = useRef(false);
  // Multiplayer: sala aberta nesta tela e os celulares como controle.
  const [ondeJogar, setOndeJogar] = useState<"tela" | "celulares">("tela");
  const [modoTela, setModoTela] = useState(false);
  const [sala, setSala] = useState<{ codigo: string; estado: EstadoConexao; jogadores: JogadorSala[] } | null>(null);
  const [erroSala, setErroSala] = useState<string | null>(null);
  const [euJogo, setEuJogo] = useState(true);
  const [painelControles, setPainelControles] = useState(false);
  // Controles de videogame conectados nesta tela e quais entram como jogadores próprios (o 1º livre joga com você).
  const [pads, setPads] = useState(gamepadsConectados);
  const [padsJogando, setPadsJogando] = useState<number[]>([]);
  useEffect(() => {
    const atualizar = () => {
      const agora = gamepadsConectados();
      setPads(p => (p.map(x => x.indice).join() === agora.map(x => x.indice).join() ? p : agora));
      setPadsJogando(j => j.filter(i => agora.some(x => x.indice === i)));
    };
    window.addEventListener("gamepadconnected", atualizar);
    window.addEventListener("gamepaddisconnected", atualizar);
    const t = window.setInterval(atualizar, 1500);
    return () => { window.removeEventListener("gamepadconnected", atualizar); window.removeEventListener("gamepaddisconnected", atualizar); window.clearInterval(t); };
  }, []);
  const clienteSala = useRef<ClienteSala | null>(null);
  // Espelho: o jogo inteiro em cada celular (conexão direta pelo Wi-Fi ou, na falta dela, pela sala).
  const transmissor = useRef<TransmissorEspelho | null>(null);
  const conectadosEspelho = useRef(new Set<number>());
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
  // Em destaque: o jogo jogável mais novo.
  const destaque = JOGOS.filter(j => j.disponivel).sort((a, b) => b.fase - a.fase)[0] ?? JOGOS[0];

  const alternarFavorito = (id: string) => {
    const novo = new Set(favoritos);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setFavoritos(novo);
    guardarFavoritos(novo);
    if (favoritosDaConta.current) gamesService.salvarFavoritos([...novo]).catch(() => undefined);
  };

  const comSala = (ondeJogar === "celulares" || modoTela) && !!sala;
  const euNaArena = !comSala || euJogo;
  // Vagas: quem está na tela (se joga), os celulares conectados e os bots escolhidos (0 a 7: sozinho também vale).
  const vagas: VagaBombas[] = useMemo(() => {
    const lista: VagaBombas[] = [];
    if (euNaArena) lista.push({ nome: usuario?.nome?.split(" ")[0] ?? "Você", bot: null, avatar: avatarDaVaga(0, meuAvatar) });
    padsJogando.slice(0, 8 - lista.length).forEach(i => lista.push({ nome: `Controle ${i + 1}`, bot: null, avatar: avatarDaVaga(lista.length, null), gamepad: i }));
    if (comSala && sala) {
      sala.jogadores.filter(j => j.vaga > 0 && j.conectado).slice(0, 8 - lista.length)
        .forEach(j => lista.push({ nome: j.nome.split(" ")[0], bot: null, avatar: lerAvatar(j.avatar, j.idUsuario), controle: j.vaga }));
    }
    const bots = Math.min(cfg.bots, 8 - lista.length);
    for (let n = 1; n <= bots; n++) lista.push({ nome: `Bot ${n}`, bot: cfg.dificuldade, avatar: avatarDaVaga(lista.length, null) });
    return lista;
  }, [cfg.bots, cfg.dificuldade, meuAvatar, usuario, comSala, sala, euNaArena, padsJogando]);
  const humanos = vagas.filter(v => !v.bot).length;

  // Avisos para os celulares (a tela é quem manda).
  const paraTodos = (d: unknown) => clienteSala.current?.enviar({ t: "todos", d });
  const paraVaga = (vaga: number, d: unknown) => clienteSala.current?.enviar({ t: "para", vaga, d });

  const abrirSala = async () => {
    setErroSala(null);
    try {
      const ingresso = await salasService.criar(jogoAtual);
      if (!ingresso) throw new Error("Não deu para abrir a sala");
      clienteSala.current?.fechar();
      transmissor.current?.fechar();
      conectadosEspelho.current.clear();
      transmissor.current = new TransmissorEspelho(msg => clienteSala.current?.enviar(msg));
      setSala({ codigo: ingresso.codigo, estado: "conectando", jogadores: [] });
      clienteSala.current = new ClienteSala(ingresso, m => {
        if (m.t === "entrada") remotas.receber(Number(m.vaga), m.d);
        else if (m.t === "sinal") void transmissor.current?.receberSinal(Number(m.vaga), m.d);
        else if (m.t === "sala" || m.t === "jogadores") {
          const lista = (m.jogadores as JogadorSala[]) ?? [];
          lista.filter(j => !j.conectado).forEach(j => remotas.soltar(j.vaga));
          // Conexão direta com cada celular que entrou (ou voltou); fecha a de quem saiu.
          const agora = new Set(lista.filter(j => j.vaga > 0 && j.conectado).map(j => j.vaga));
          agora.forEach(v => { if (!conectadosEspelho.current.has(v)) void transmissor.current?.conectar(v); });
          conectadosEspelho.current.forEach(v => { if (!agora.has(v)) transmissor.current?.desconectar(v); });
          conectadosEspelho.current = agora;
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
    transmissor.current?.fechar();
    transmissor.current = null;
    conectadosEspelho.current.clear();
    clienteSala.current?.fechar({ t: "fechar" });
    clienteSala.current = null;
    setSala(null);
  };

  useEffect(() => () => clienteSala.current?.fechar({ t: "fechar" }), []);

  // Modo Tela: esta tela vira o servidor; por padrão ninguém joga nela (todos pelos celulares).
  const entrarModoTela = () => {
    som.destravar();
    setAberto(null);
    setModoTela(true);
    setEuJogo(false);
    if (!sala) void abrirSala();
  };
  const sairModoTela = () => {
    setModoTela(false);
    setEuJogo(true);
    fecharSala();
  };

  const comecar = (numero: number) => {
    som.destravar();
    setRegistro(null);
    const daPartida = numero === 1 || !copa ? vagas : vagasDaCopa.current;
    if (numero === 1) vagasDaCopa.current = vagas;
    if (numero === 1) jogoDaCopa.current = jogoAtual;
    const jogo = numero === 1 || !copa ? jogoAtual : jogoDaCopa.current;
    daPartida.forEach((v, i) => { if (v.controle !== undefined) paraVaga(v.controle, { k: "lugar", indice: i, cor: CORES_JOGADORES[i], jogo }); });
    const n = daPartida.length;
    const modo = modoEfetivo(jogo, cfg.modo, n);
    const vitorias = n === 1 ? 1 : cfg.vitorias;
    // Cada celular recebe o que precisa para desenhar o mesmo jogo (nome, avatar e se é bot; nada da conta).
    const vagasEspelho = daPartida.map(v => ({ nome: v.nome, bot: v.bot, avatar: v.avatar }));
    daPartida.forEach((v, i) => {
      if (v.controle !== undefined) transmissor.current?.partida(v.controle, { jogo, modo, cenario: cfg.cenario, vagas: vagasEspelho, eu: i, vitoriasParaVencer: vitorias, numero });
    });
    // Sozinho: cada tentativa é uma partida; Times só com número par.
    setPartida({ jogo, vagas: daPartida, modo, cenario: cfg.cenario, vitorias, dificuldade: cfg.dificuldade, inicio: Date.now(), numero });
  };

  const jogar = () => {
    setCopa(cfg.formato === "unica" ? null : novaCopa(cfg.formato, vagas.map((v, i) => `P${i + 1} · ${v.nome}`)));
    comecar(1);
  };

  const sair = () => {
    setPartida(null);
    setCopa(null);
    paraTodos({ k: "fase", fase: "lobby" });
  };

  // Fim de uma partida: guarda na conta (recorde, conquistas) e, na Copa, soma a colocação na tabela.
  const aoTerminar = useCallback((r: ResultadoBombas & { pontos?: number[] }) => {
    if (!partida) return;
    const lugares = colocacoes(r.vitorias, r.vencedor);
    const nrBots = partida.vagas.filter(v => v.bot).length;
    const duracao = Math.min(86_400, Math.round((Date.now() - partida.inicio) / 1000));
    const resultadoDe = (i: number) => {
      const venceu = r.vencedor === i || (partida.modo === "times" && r.vencedor !== null && r.vencedor % 2 === i % 2);
      // Sem bots, os pontos não ganham peso de dificuldade.
      // Jogo com placar próprio (ex.: Encaixe) manda os pontos; os outros pontuam pelas rodadas vencidas.
      const pontos = r.pontos ? Math.max(0, Math.round(r.pontos[i] ?? 0)) : pontosBombas({ vitoriasRodada: r.vitorias[i], venceu, jogadores: partida.vagas.length, dificuldade: nrBots ? partida.dificuldade : null });
      return { venceu, pontos, colocacao: venceu ? 1 : Math.min(partida.vagas.length, Math.max(2, lugares[i])) };
    };
    if (copa) setCopa(registrarPartida(copa, lugares));
    // Cada celular registra a própria partida na própria conta.
    partida.vagas.forEach((v, i) => {
      if (v.controle === undefined) return;
      const res = resultadoDe(i);
      paraVaga(v.controle, { k: "fim", jogo: partida.jogo, modo: partida.modo, ...res, jogadores: partida.vagas.length, bots: nrBots, dificuldade: nrBots ? partida.dificuldade : null, duracao });
    });
    const eu = partida.vagas.findIndex(v => !v.bot && v.controle === undefined);
    if (eu < 0) return;
    const { venceu, pontos, colocacao } = resultadoDe(eu);
    setRegistro({ estado: "salvando" });
    gamesService.registrarPartida({
      cdJogo: partida.jogo, cdModo: partida.modo, nrPontos: pontos, inVitoria: venceu, nrColocacao: colocacao,
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
    gamesService.registrarCopa(final.rodadas, minha, resumoDaCopa(final, jogoDaCopa.current))
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
    // O que todo jogo recebe: fim, celulares, Copa e o aviso de recorde/conquistas.
    const comuns = {
      vitoriasParaVencer: partida.vitorias,
      onSair: sair,
      onFim: aoTerminar,
      remotas: sala ? remotas : undefined,
      onFase: (f: FaseBombas) => paraTodos({ k: "fase", fase: f }),
      onQuadros: sala ? (q: { n: number; eventos: unknown[]; meta: MetaEspelho; quadro: (i: number) => unknown }) => {
        partida.vagas.forEach((v, i) => { if (v.controle !== undefined) transmissor.current?.quadro(v.controle, { n: q.n, s: q.quadro(i), ev: q.eventos, m: q.meta }); });
      } : undefined,
      onPrivado: (i: number, d: MaoPrivada) => { const v = partida.vagas[i]; if (v?.controle !== undefined) paraVaga(v.controle, { k: "mao", ...d }); },
      onMorte: (i: number) => { const v = partida.vagas[i]; if (v?.controle !== undefined) paraVaga(v.controle, { k: "vibrar", ms: 300, texto: "Você caiu!" }); },
      subtitulo: copa ? `Copa · partida ${Math.min(copa.rodadas, partida.numero)} de ${copa.rodadas}` : undefined,
      avisoFim: <><AvisoRegistro registro={registro} />{copa && copa.partidas.length > 0 && <TabelaCopa copa={copa} />}</>,
      acaoFim: copa ? (copaAcabou
        ? { rotulo: "Ver o pódio", aoClicar: () => encerrarCopa(copa) }
        : { rotulo: `Próxima partida (${copa.partidas.length + 1}/${copa.rodadas})`, aoClicar: () => comecar(partida.numero + 1) }) : undefined,
    };
    return (
      partida.jogo === "hexagonos" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando a arena 3D…</div>}>
          <SumoHexagonos key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoHex} cenario={partida.cenario as CenarioHex} {...comuns} />
        </Suspense>
      ) : partida.jogo === "encaixe" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <EncaixeVersus key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoEncaixe} tema={partida.cenario as TemaEncaixe} {...comuns} />
        </Suspense>
      ) : partida.jogo === "duelo" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <DueloMeioDia key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoDuelo} cenario={partida.cenario as CenarioDuelo} {...comuns} />
        </Suspense>
      ) : partida.jogo === "cartas" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <CartasDaVirada key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoCartas} mesa={partida.cenario as MesaCartas} {...comuns} />
        </Suspense>
      ) : partida.jogo === "defesa" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <DefesaBase key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoDefesa} mapa={partida.cenario as MapaDefesa} {...comuns} />
        </Suspense>
      ) : partida.jogo === "torres" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <TorresColapso key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoTorres} paisagem={partida.cenario as Paisagem} {...comuns} />
        </Suspense>
      ) : partida.jogo === "espacial" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <CorridaEspacial key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoEspacial} setor={partida.cenario as Setor} {...comuns} />
        </Suspense>
      ) : partida.jogo === "coroa" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <CoroaMaldita key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoCoroa} arena={partida.cenario as ArenaCoroa} {...comuns} />
        </Suspense>
      ) : partida.jogo === "masmorra" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <FugaMasmorra key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoMasmorra} tema={partida.cenario as TemaMasmorra} {...comuns} />
        </Suspense>
      ) : partida.jogo === "horda" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <HordaZumbi key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoHorda} cenario={partida.cenario as CenarioHorda} {...comuns} />
        </Suspense>
      ) : partida.jogo === "naval" ? (
        <Suspense fallback={<div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white/70">Carregando…</div>}>
          <GuerraNaval key={partida.numero} vagas={partida.vagas} modo={partida.modo as ModoNaval} tema={partida.cenario as TemaNaval} {...comuns} />
        </Suspense>
      ) : (
        <BombasTaticas key={partida.numero} vagas={partida.vagas} modo={partida.modo as Modo} bioma={partida.cenario as Bioma} {...comuns} />
      )
    );
  }

  if (modoTela) {
    return <ModoTela jogo={jogoAtual} onJogo={setJogoAtual} sala={sala} erro={erroSala} vagas={vagas} cfg={cfg} mudarCfg={setCfg} euJogo={euJogo} onEuJogo={setEuJogo} onComecar={jogar} onSair={sairModoTela} />;
  }

  const chip = (ativo: boolean, rotulo: string, aoClicar: () => void) => (
    <button type="button" aria-pressed={ativo} onClick={aoClicar}
      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${ativo ? "bg-cyan-400 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,.6)]" : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"}`}>
      {rotulo}
    </button>
  );

  return (
    <div className="relative isolate min-h-screen overflow-hidden text-white">
      <FundoGamer />
      <div className="relative space-y-6 p-3 sm:p-6">
        <header className="flex flex-wrap items-center gap-4">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 shadow-[0_0_30px_rgba(217,70,239,.6)]"><Gamepad2 className="h-7 w-7" /></span>
            <div className="min-w-0">
              <h1 className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300 bg-clip-text text-3xl font-black uppercase italic tracking-tight text-transparent sm:text-4xl">Nord Games</h1>
              <p className="text-sm text-white/60">Sozinho, contra bots ou com a turma pelo celular · 1 a 8 jogadores</p>
            </div>
          </div>
          <button type="button" onClick={entrarModoTela} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-black uppercase tracking-wide shadow-[0_0_24px_rgba(34,211,238,.45)] hover:brightness-110" data-tutorial="games-modo-tela">
            <Monitor className="h-5 w-5" />Modo Tela
          </button>
          <button type="button" onClick={() => setPainelControles(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black uppercase tracking-wide ring-1 ring-white/15 hover:bg-white/20">
            <Joystick className="h-5 w-5" />Controles{pads.length ? ` · 🎮${pads.length}` : ""}
          </button>
          <Link to="/gestao/games/controle" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-black uppercase tracking-wide ring-1 ring-white/15 hover:bg-white/20">
            <Smartphone className="h-5 w-5" />Controle
          </Link>
          {meuAvatar && (
            <span className="flex items-end gap-2 rounded-2xl bg-white/5 px-3 pt-1 ring-1 ring-white/10">
              <AvatarCorpo config={avatarDaVaga(0, meuAvatar)} altura={48} />
              <span className="pb-2 text-sm font-black">{usuario?.nome?.split(" ")[0]}</span>
            </span>
          )}
        </header>

        <section aria-label="Em destaque" className="grid overflow-hidden rounded-3xl bg-slate-950/70 ring-1 ring-fuchsia-400/30 backdrop-blur md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="relative h-52 overflow-hidden sm:h-64 md:h-auto">
            <CapaJogo jogo={destaque} className="w-full md:h-full" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-slate-950/90" />
          </div>
          <div className="flex flex-col justify-center gap-3 p-5 sm:p-8">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime-400/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-lime-300 ring-1 ring-lime-300/40"><Sparkles className="h-3.5 w-3.5" />Em destaque</p>
            <h2 className="text-4xl font-black uppercase italic leading-none tracking-tight drop-shadow-[0_0_18px_rgba(236,72,153,.5)] sm:text-5xl">{destaque.nome}</h2>
            <p className="max-w-xl text-white/75">{destaque.resumo}</p>
            <ul className="flex flex-wrap gap-1.5">
              {destaque.modos.map(m => <li key={m} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-bold text-white/80">{m}</li>)}
              <li className="flex items-center gap-1 rounded-lg bg-cyan-400/15 px-2 py-1 text-xs font-bold text-cyan-200"><Users className="h-3.5 w-3.5" />1–8 jogadores</li>
            </ul>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setOndeJogar("tela"); setJogoAtual(destaque.id); setAberto(destaque); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-6 py-3 text-lg font-black uppercase italic tracking-wider shadow-[0_0_30px_rgba(236,72,153,.55)] transition hover:scale-[1.03]">
                <Play className="h-6 w-6" fill="currentColor" />Jogar
              </button>
              <button type="button" onClick={() => { setOndeJogar("celulares"); setJogoAtual(destaque.id); setAberto(destaque); if (!sala) void abrirSala(); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 font-black uppercase tracking-wide ring-1 ring-white/20 hover:bg-white/20">
                <Smartphone className="h-5 w-5" />Com celulares
              </button>
            </div>
          </div>
        </section>

        <section data-tutorial="games-filtros" className="space-y-3 rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10 backdrop-blur" aria-label="Filtros">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
              <input value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="Buscar jogo, modo ou categoria" aria-label="Buscar jogo"
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30" />
            </div>
            {chip(filtros.soDisponiveis, "Disponíveis", () => setFiltros({ ...filtros, soDisponiveis: !filtros.soDisponiveis }))}
            {chip(filtros.soFavoritos, "♥ Favoritos", () => setFiltros({ ...filtros, soFavoritos: !filtros.soFavoritos }))}
            {chip(filtros.dimensao === "2D", "2D", () => setFiltros({ ...filtros, dimensao: filtros.dimensao === "2D" ? "" : "2D" }))}
            {chip(filtros.dimensao === "3D", "3D", () => setFiltros({ ...filtros, dimensao: filtros.dimensao === "3D" ? "" : "3D" }))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Categoria" value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}
              className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-1.5 text-sm font-bold text-white">
              <option value="">Todas as categorias</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="ml-2 flex items-center gap-1 text-xs font-black uppercase tracking-wide text-white/60"><Users className="h-4 w-4" />Jogadores:</span>
            {[null, 1, 2, 4, 8].map(n => <span key={String(n)}>{chip(filtros.jogadores === n, n === null ? "Todos" : `${n}P`, () => setFiltros({ ...filtros, jogadores: n }))}</span>)}
          </div>
        </section>

        <ul data-tutorial="games-grade" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label="Jogos">
          {lista.map(j => (
            <li key={j.id} className="group relative">
              <button type="button" onClick={() => { setOndeJogar("tela"); if (ehJogavel(j.id)) setJogoAtual(j.id); setAberto(j); }} aria-label={`${j.nome}${j.disponivel ? "" : " (em breve)"}`}
                className="block w-full overflow-hidden rounded-2xl text-left ring-1 ring-white/10 transition duration-200 hover:-translate-y-1.5 hover:ring-2 hover:ring-cyan-300 hover:shadow-[0_0_34px_rgba(34,211,238,.45)] focus-visible:ring-4 focus-visible:ring-cyan-300">
                <CapaJogo jogo={j} className={j.disponivel ? "" : "opacity-60 grayscale-[45%]"} />
                <span className="absolute left-2 top-2 flex gap-1">
                  <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-cyan-200">{j.dimensao}</span>
                  <span className="rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white">1–8P</span>
                </span>
                {!j.disponivel && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-black text-fuchsia-200"><Lock className="h-3 w-3" />Fase {j.fase}</span>}
                {j.disponivel && <span className="absolute right-2 top-2 rounded-md bg-lime-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950 shadow-[0_0_14px_rgba(163,230,53,.8)]">Jogar</span>}
              </button>
              <button type="button" onClick={() => alternarFavorito(j.id)} aria-label={favoritos.has(j.id) ? `Tirar ${j.nome} dos favoritos` : `Favoritar ${j.nome}`} aria-pressed={favoritos.has(j.id)}
                className={`absolute bottom-2 right-2 rounded-full p-1.5 shadow ${favoritos.has(j.id) ? "bg-pink-500 text-white shadow-[0_0_14px_rgba(236,72,153,.8)]" : "bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 focus:opacity-100"}`}>
                <Heart className="h-4 w-4" fill={favoritos.has(j.id) ? "currentColor" : "none"} />
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="col-span-full rounded-2xl border border-dashed border-white/20 p-8 text-center text-sm text-white/60">Nenhum jogo com esses filtros.</li>}
        </ul>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setAberto(null); }}>
          <div role="dialog" aria-modal="true" aria-label={aberto.nome} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-slate-950/95 text-white shadow-[0_0_60px_rgba(124,58,237,.45)] ring-1 ring-fuchsia-400/30 sm:rounded-3xl">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
              <div className="w-full shrink-0 sm:w-60"><CapaJogo jogo={aberto} /></div>
              <div className="min-w-0 flex-1 space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tight">{aberto.nome}</h2>
                    <p className="text-sm text-cyan-200/80">{aberto.categoria} · {aberto.dimensao} · 1 a 8 jogadores</p>
                  </div>
                  <button type="button" onClick={() => setAberto(null)} aria-label="Fechar" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-white/80">{aberto.resumo}</p>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Regras</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-white/80 marker:text-fuchsia-400">{aberto.regras.map(r => <li key={r}>{r}</li>)}</ul>
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-300">Controles</h3>
                  <ul className="mt-1 space-y-0.5 text-sm text-white/70">{aberto.controles.map(c => <li key={c}>{c}</li>)}</ul>
                </div>
                {ehJogavel(aberto.id) ? (
                  <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10" data-tutorial="games-preparar">
                    <h3 className="text-sm font-black uppercase tracking-widest text-cyan-200">Preparar partida</h3>
                    <Pilulas rotulo="Onde jogar" valor={ondeJogar} aoMudar={v => { setOndeJogar(v); if (v === "celulares" && !sala) void abrirSala(); }}
                      opcoes={[{ valor: "tela", rotulo: <><Monitor className="h-3.5 w-3.5" />Nesta tela</> }, { valor: "celulares", rotulo: <><Smartphone className="h-3.5 w-3.5" />Com celulares</> }]} />
                    {ondeJogar === "celulares" && (sala ? (
                      <SalaPainel codigo={sala.codigo} estado={sala.estado} jogadores={sala.jogadores} euJogo={euJogo} onEuJogo={setEuJogo} onFechar={() => { fecharSala(); setOndeJogar("tela"); }} />
                    ) : (
                      <p className="rounded-xl bg-white/5 p-3 text-xs text-white/70" role={erroSala ? "alert" : undefined}>{erroSala ?? "Abrindo a sala…"}</p>
                    ))}
                    {pads.length > 0 && (
                      <div className="space-y-1.5 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                        <p className="text-xs font-bold text-white/70">🎮 Controles de videogame nesta tela · o 1º livre joga junto com você; os outros podem entrar como jogadores</p>
                        <ul className="flex flex-wrap gap-1.5" aria-label="Controles de videogame">
                          {pads.map(p => {
                            const entra = padsJogando.includes(p.indice);
                            return (
                              <li key={p.indice}>
                                <button type="button" aria-pressed={entra} onClick={() => setPadsJogando(j => (entra ? j.filter(x => x !== p.indice) : [...j, p.indice]))}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-black ${entra ? "bg-cyan-400 text-slate-950" : "bg-white/10 hover:bg-white/20"}`}>
                                  Controle {p.indice + 1} · {entra ? "jogando" : "entrar"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <ConfigPartida jogo={aberto.id} cfg={cfg} mudar={setCfg} humanos={humanos} />
                    <ul className="flex flex-wrap gap-1.5" aria-label="Vagas">
                      {vagas.map((v, i) => (
                        <li key={i} className="flex items-end gap-1 rounded-xl bg-black/40 px-1.5 pt-0.5 text-xs font-bold ring-2" style={{ ["--tw-ring-color" as string]: CORES_JOGADORES[i] }}>
                          <AvatarCorpo config={v.avatar} altura={36} atraso={i * 0.2} /><span className="pb-1">P{i + 1}{v.bot ? "" : v.controle !== undefined ? ` · ${v.nome} 📱` : v.gamepad !== undefined ? ` · 🎮${v.gamepad + 1}` : " (você)"}</span>
                        </li>
                      ))}
                    </ul>
                    <button type="button" onClick={jogar} disabled={vagas.length === 0}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-400 px-5 py-3.5 text-lg font-black uppercase italic tracking-wider shadow-[0_0_30px_rgba(236,72,153,.5)] transition hover:scale-[1.01] disabled:opacity-40">
                      <Play className="h-6 w-6" fill="currentColor" />{cfg.formato === "unica" ? (vagas.length === 1 ? "Jogar sozinho" : "Jogar") : `Começar a Copa (${cfg.formato})`}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-white/5 p-4 text-sm font-semibold text-white/70 ring-1 ring-white/10"><Lock className="mr-1 inline h-4 w-4 text-fuchsia-300" />Chega na fase {aberto.fase} do plano. Modos: {aberto.modos.join(", ")}. Sozinho contra bots ou até 8 jogadores.</p>
                )}
                {aberto.disponivel && <PainelRecordes jogo={aberto.id} versao={versaoRecordes} />}
              </div>
            </div>
          </div>
        </div>
      )}
      {painelControles && <PainelControles onFechar={() => setPainelControles(false)} />}
    </div>
  );
}
