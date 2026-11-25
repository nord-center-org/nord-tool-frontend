import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Gamepad2, LogOut, Monitor, MonitorOff, Pause, Settings2, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import TelaEspelho from "@/react-app/components/games/rede/TelaEspelho";
import { ReceptorEspelho } from "@/react-app/components/games/rede/Espelho";
import { lerPartida, lerQuadro, type PartidaEspelho, type QuadroEspelho } from "@/react-app/utils/games/espelho";
import { som } from "@/react-app/components/games/audio/sintetizador";
import PainelControles from "@/react-app/components/games/entrada/PainelControles";
import Avatar from "@/react-app/components/avatar/Avatar";
import AvatarCorpo from "@/react-app/components/games/central/AvatarCorpo";
import ControleVirtual from "@/react-app/components/games/entrada/ControleVirtual";
import { Controles, vibrar } from "@/react-app/components/games/entrada/entrada";
import { ClienteSala, type EstadoConexao, type MensagemSala } from "@/react-app/components/games/rede/ClienteSala";
import { CORES_JOGADORES } from "@/react-app/components/games/central/sprites";
import { JOGOS } from "@/react-app/utils/games/catalogo";
import { JOGAVEIS } from "@/react-app/utils/games/registroJogos";
import { lerAvatar } from "@/react-app/utils/avatar";
import { CONTROLE_SOLTO, lerAviso, mesmaEntrada, normalizarCodigo, type EntradaControle, type JogadorSala, type MaoPrivada } from "@/react-app/utils/games/sala";
import MaoNoCelular from "@/react-app/components/games/jogos/cartas/MaoNoCelular";
import { gamesService, salasService, type GameRegistro } from "@/react-app/services/GamesService";

const ENVIO_MS = 33;
const REENVIO_MS = 400;
const FASE: Record<string, string> = { lobby: "Esperando a tela grande começar", contagem: "Prepare-se…", jogando: "Valendo!", fimRodada: "Fim da rodada", fimPartida: "Fim da partida" };

/** Individual → Games → Controle: o celular vira o controle de uma sala aberta na tela grande. */
export default function GamesControlePage() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState(() => normalizarCodigo(params.get("sala") ?? ""));
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [conexao, setConexao] = useState<EstadoConexao | null>(null);
  const [motivo, setMotivo] = useState<string | undefined>();
  const [jogadores, setJogadores] = useState<JogadorSala[]>([]);
  const [minhaVaga, setMinhaVaga] = useState<number | null>(null);
  const [jogo, setJogo] = useState("");
  const [lugar, setLugar] = useState<{ indice: number; cor: string; jogo: string; modo?: string } | null>(null);
  const [fase, setFase] = useState("lobby");
  const [aviso, setAviso] = useState<string | null>(null);
  const [mao, setMao] = useState<MaoPrivada | null>(null);
  /** O que o controle está mandando agora (mostrado na tela, para conferir que o toque chegou). */
  const [sinal, setSinal] = useState<EntradaControle>(CONTROLE_SOLTO);
  const [painel, setPainel] = useState(false);
  // Espelho: o jogo inteiro neste celular.
  const [verJogo, setVerJogo] = useState(() => { try { return localStorage.getItem("nord-games-ver-jogo") !== "0"; } catch { return true; } });
  const [partidaEsp, setPartidaEsp] = useState<PartidaEspelho | null>(null);
  const [caminho, setCaminho] = useState<"direto" | "sala">("sala");
  const [mudo, setMudo] = useState(som.mudo);
  const receptor = useRef<ReceptorEspelho | null>(null);
  const ouvintes = useRef(new Set<(q: QuadroEspelho) => void>());
  const assinar = useCallback((f: (q: QuadroEspelho) => void) => { ouvintes.current.add(f); return () => { ouvintes.current.delete(f); }; }, []);
  const entregarQuadro = useCallback((d: unknown) => { const q = lerQuadro(d); if (q) ouvintes.current.forEach(f => f(q)); }, []);
  const [resultado, setResultado] = useState<{ pontos: number; venceu: boolean; colocacao: number; registro: GameRegistro | null } | null>(null);
  const cliente = useRef<ClienteSala | null>(null);
  const controles = useMemo(() => new Controles(), []);

  const aoMensagem = useCallback((m: MensagemSala) => {
    if (m.t === "sala") {
      setMinhaVaga(Number(m.vaga));
      setJogo(String(m.jogo ?? ""));
      setJogadores((m.jogadores as JogadorSala[]) ?? []);
    } else if (m.t === "jogadores") {
      setJogadores((m.jogadores as JogadorSala[]) ?? []);
    } else if (m.t === "host") {
      const d = (m.d && typeof m.d === "object" ? m.d : {}) as Record<string, unknown>;
      if (d.k === "rtc") { void receptor.current?.receberSinal(d); return; }
      if (d.k === "quadro") { entregarQuadro(d); return; }
      if (d.k === "partida") { const p = lerPartida(d); if (p) { setPartidaEsp(p); if (p.soControle) setVerJogo(false); } return; }
      const a = lerAviso(m.d);
      if (!a) return;
      if (a.k === "lugar") setLugar({ indice: a.indice, cor: a.cor, jogo: a.jogo, modo: a.modo });
      else if (a.k === "fase") {
        setFase(a.fase);
        if (a.fase === "contagem" || a.fase === "lobby") { setResultado(null); setMao(null); }
        if (a.fase === "lobby") setPartidaEsp(null);
      } else if (a.k === "mao") {
        const { k: _k, ...resto } = a;
        void _k;
        setMao(resto);
      } else if (a.k === "vibrar") {
        vibrar(a.ms);
        if (a.texto) {
          setAviso(a.texto);
          window.setTimeout(() => setAviso(null), 2500);
        }
      } else if (a.k === "fim") {
        setResultado({ pontos: a.pontos, venceu: a.venceu, colocacao: a.colocacao, registro: null });
        // Cada um registra a própria partida, na própria conta.
        gamesService.registrarPartida({
          cdJogo: a.jogo, cdModo: a.modo, nrPontos: a.pontos, inVitoria: a.venceu, nrColocacao: a.colocacao,
          nrJogadores: a.jogadores, nrBots: a.bots, cdDificuldade: a.dificuldade, nrDuracaoS: a.duracao,
        }).then(r => setResultado(atual => atual && { ...atual, registro: r ?? null })).catch(() => undefined);
      }
    } else if (m.t === "erro") {
      setErro(String(m.m ?? "Erro na sala"));
    }
  }, [entregarQuadro]);

  const entrar = async (cod: string) => {
    setErro(null);
    setEntrando(true);
    try {
      const ingresso = await salasService.entrar(cod);
      if (!ingresso) throw new Error("Sala não encontrada");
      cliente.current?.fechar();
      receptor.current?.fechar();
      receptor.current = new ReceptorEspelho(msg => cliente.current?.enviar(msg), entregarQuadro, setCaminho);
      cliente.current = new ClienteSala(ingresso, aoMensagem, (e, mot) => { setConexao(e); setMotivo(mot); });
    } catch (e) {
      setErro((e as Error).message || "Não deu para entrar na sala");
    } finally {
      setEntrando(false);
    }
  };

  // Veio pelo QR Code: entra direto.
  useEffect(() => {
    const c = normalizarCodigo(params.get("sala") ?? "");
    if (c.length === 4) void entrar(c);
    return () => { cliente.current?.fechar(); receptor.current?.fechar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lê o controle 60 vezes por segundo e manda assim que muda; repete o estado de tempos em tempos (se uma mensagem
  // se perder numa reconexão, a tela não fica com a direção "presa").
  useEffect(() => {
    controles.ligar();
    let anterior: EntradaControle = CONTROLE_SOLTO;
    let ultimoEnvio = 0;
    let quadro = 0;
    const ler = () => {
      const c = controles.ler();
      const agora: EntradaControle = { x: c.direcao, eixoX: c.eixoX, eixoY: c.eixoY, a: c.a, b: c.b, p: c.pausa };
      const instante = performance.now();
      if (!mesmaEntrada(agora, anterior) || instante - ultimoEnvio > REENVIO_MS) {
        cliente.current?.enviar({ t: "entrada", d: agora });
        anterior = agora;
        ultimoEnvio = instante;
        setSinal(agora);
      }
      quadro = requestAnimationFrame(ler);
    };
    quadro = requestAnimationFrame(ler);
    // Com a aba em segundo plano o requestAnimationFrame para: um intervalo de reserva mantém o envio.
    const reserva = window.setInterval(() => { if (document.hidden) { cancelAnimationFrame(quadro); ler(); } }, ENVIO_MS);
    return () => { cancelAnimationFrame(quadro); window.clearInterval(reserva); controles.desligar(); };
  }, [controles]);

  // Tela acesa enquanto joga (quando o navegador deixa).
  useEffect(() => {
    if (conexao !== "conectado") return;
    let trava: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then(l => { trava = l; }).catch(() => undefined);
    return () => { void trava?.release().catch(() => undefined); };
  }, [conexao]);

  const sair = () => {
    cliente.current?.fechar({ t: "sair" });
    cliente.current = null;
    navegar("/gestao/games");
  };

  const eu = jogadores.find(j => j.vaga === minhaVaga);
  const cor = lugar?.cor ?? CORES_JOGADORES[minhaVaga ?? 0];
  const jogoAtual = lugar?.jogo || jogo;
  const nomeDoJogo = JOGOS.find(j => j.id === jogoAtual)?.nome ?? "Games";
  const def = JOGAVEIS[jogoAtual];
  const botoes = def?.modos.find(m => m.valor === lugar?.modo)?.botoes ?? def?.botoes ?? { a: "A", b: "B" };

  if (!conexao || (conexao === "fechada" && !cliente.current)) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 p-6">
        <div className="text-center">
          <Gamepad2 className="mx-auto h-12 w-12 text-orange-500" />
          <h1 className="mt-2 text-2xl font-black text-slate-800">Controle pelo celular</h1>
          <p className="text-sm text-slate-500">Digite o código que aparece na tela grande, ou leia o QR Code.</p>
        </div>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (codigo.length === 4) void entrar(codigo); }}>
          <label className="block text-xs font-bold text-slate-500">Código da sala
            <input value={codigo} onChange={e => setCodigo(normalizarCodigo(e.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white py-3 text-center font-mono text-3xl font-black tracking-[0.4em] text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
          </label>
          {erro && <p className="text-sm font-semibold text-rose-600" role="alert">{erro}</p>}
          {motivo && <p className="text-sm text-slate-500">{motivo}</p>}
          <button type="submit" disabled={codigo.length !== 4 || entrando} className="w-full rounded-2xl bg-orange-500 py-3 text-lg font-black text-white disabled:opacity-50">
            {entrando ? "Entrando…" : "Entrar na sala"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950 text-white" style={{ touchAction: "none" }} onPointerDown={() => som.destravar()} onTouchStart={() => som.destravar()}>
      <header className="flex items-center gap-3 px-4 py-3" style={{ boxShadow: `inset 0 -3px 0 ${cor}` }}>
        {eu && <AvatarCorpo config={lerAvatar(eu.avatar, eu.idUsuario)} altura={48} acao={resultado?.venceu ? "vitoria" : "parado"} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black" style={{ color: cor }}>{lugar ? `P${lugar.indice + 1}` : `Vaga ${minhaVaga ?? "-"}`} · {eu?.nome.split(" ")[0] ?? ""}</p>
          <p className="truncate text-xs text-white/60">{nomeDoJogo} · sala {cliente.current?.ingresso.codigo}</p>
        </div>
        <span className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${conexao === "conectado" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`} aria-live="polite">
          {conexao === "conectado" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {conexao === "conectado" ? "Conectado" : conexao === "fechada" ? "Sala fechada" : "Reconectando…"}
        </span>
        <button type="button" aria-pressed={verJogo} aria-label={verJogo ? "Ver só o controle" : "Ver o jogo aqui"} title={verJogo ? "Ver só o controle" : "Ver o jogo aqui"}
          onClick={() => { const v = !verJogo; setVerJogo(v); try { localStorage.setItem("nord-games-ver-jogo", v ? "1" : "0"); } catch { /* sem armazenamento */ } }}
          className={`rounded-xl p-2 ${verJogo ? "bg-cyan-500/30" : "bg-white/10"}`}>{verJogo ? <Monitor className="h-5 w-5" /> : <MonitorOff className="h-5 w-5" />}</button>
        <button type="button" onClick={() => { som.definirMudo(!mudo); setMudo(!mudo); }} aria-label={mudo ? "Ligar som" : "Desligar som"} className="rounded-xl bg-white/10 p-2">
          {mudo ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button type="button" onClick={() => setPainel(true)} aria-label="Ajustar o controle" className="rounded-xl bg-white/10 p-2"><Settings2 className="h-5 w-5" /></button>
        <button type="button" onClick={() => { controles.tocar("pausa"); }} aria-label="Pausar" className="rounded-xl bg-white/10 p-2"><Pause className="h-5 w-5" /></button>
        <button type="button" onClick={sair} aria-label="Sair da sala" className="rounded-xl bg-white/10 p-2"><LogOut className="h-5 w-5" /></button>
      </header>

      {partidaEsp?.jogo === "bombas" && partidaEsp.modo === "campanha" && <button type="button" onClick={() => controles.tocar("pausa")} className="mx-4 rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950">START · Entrar na campanha (1 vida extra)</button>}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        {conexao !== "fechada" && !resultado && verJogo && partidaEsp && fase !== "lobby" ? (
          <div className="flex h-full w-full flex-col pt-1">
            <TelaEspelho key={partidaEsp.numero} partida={partidaEsp} assinar={assinar} />
            <p className="shrink-0 pb-1 text-[10px] text-white/40" aria-live="polite">{caminho === "direto" ? "Conexão direta pelo Wi-Fi" : "Pela internet (mais lento) · no mesmo Wi-Fi da tela fica mais fluido"}</p>
          </div>
        ) : conexao === "fechada" ? (
          <>
            <p className="text-2xl font-black">Sala encerrada</p>
            <p className="text-sm text-white/60">{motivo}</p>
            <button type="button" onClick={() => navegar("/gestao/games")} className="rounded-xl bg-white px-5 py-2 font-black text-slate-900">Voltar aos Games</button>
          </>
        ) : resultado ? (
          <>
            <p className="text-xs font-black uppercase tracking-widest text-white/50">Fim da partida</p>
            <p className="text-3xl font-black">{resultado.venceu ? "🏆 Você venceu!" : `${resultado.colocacao}º lugar`}</p>
            <p className="text-lg font-bold">+{resultado.pontos.toLocaleString("pt-BR")} pts{resultado.registro?.inNovoRecorde ? " · Novo recorde!" : ""}</p>
            {resultado.registro?.novas.map(c => <p key={c.cdConquista} className="rounded-xl bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-200">Conquista: {c.nmConquista}</p>)}
          </>
        ) : (
          <>
            {mao && fase === "jogando" ? <MaoNoCelular mao={mao} /> : <p className="text-xl font-black" aria-live="polite">{FASE[fase] ?? ""}</p>}
            {aviso && <p className="rounded-xl bg-white/10 px-3 py-1 text-sm font-bold">{aviso}</p>}
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Jogadores na sala">
              {jogadores.map(j => (
                <li key={j.vaga} className={`flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs ${j.conectado ? "" : "opacity-40"}`}>
                  <Avatar config={lerAvatar(j.avatar, j.idUsuario)} tamanho={20} semFundo />{j.nome.split(" ")[0]}{j.vaga === 0 ? " (tela)" : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {conexao !== "fechada" && (
        <>
          <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/50" aria-label="O que o controle está mandando">
            Mandando:
            {(["cima", "baixo", "esquerda", "direita"] as const).map(d => (
              <span key={d} className={`rounded px-1.5 ${sinal.x === d ? "bg-emerald-400 text-slate-950" : "bg-white/10"}`}>{{ cima: "↑", baixo: "↓", esquerda: "←", direita: "→" }[d]}</span>
            ))}
            <span className={`rounded px-1.5 ${sinal.a ? "bg-emerald-400 text-slate-950" : "bg-white/10"}`}>A</span>
            <span className={`rounded px-1.5 ${sinal.b ? "bg-emerald-400 text-slate-950" : "bg-white/10"}`}>B</span>
          </p>
          <ControleVirtual controles={controles} rotuloA={botoes.a} rotuloB={botoes.b} />
        </>
      )}
      {painel && <PainelControles soToque onFechar={() => setPainel(false)} />}
    </div>
  );
}
