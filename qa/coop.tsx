/** Integração local de controles/arena. BroadcastChannel substitui somente o transporte do servidor neste laboratório. */
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Controles } from "../src/react-app/components/games/entrada/entrada";
import ControleVirtual from "../src/react-app/components/games/entrada/ControleVirtual";
import ModoTela from "../src/react-app/components/games/central/ModoTela";
import BombasTaticas from "../src/react-app/components/games/jogos/bombas/BombasTaticas";
import { avatarDaVaga } from "../src/react-app/components/games/central/sprites";
import { EntradasRemotas, type JogadorSala } from "../src/react-app/utils/games/sala";
import { configPadrao } from "../src/react-app/utils/games/registroJogos";
import type { VagaJogo } from "../src/react-app/components/games/comum/MolduraPartida";
import "../src/react-app/index.css";

export default function LaboratorioCoop() {
  const parametros = new URLSearchParams(location.search);
  const joystick = parametros.get("tela") === "joystick", campanha = parametros.has("campanha");
  const vagasCampanha = useMemo<VagaJogo[]>(() => Array.from({ length: 8 }, (_, i) => ({ nome: i === 0 ? "P1 local" : i === 1 ? "Celular de teste" : "Start para entrar", bot: null, avatar: avatarDaVaga(i, null), ...(i ? { controle: i === 1 ? 1 : 100 + i, reserva: true } : {}) })), []);
  const [conectado, setConectado] = useState(false), [jogando, setJogando] = useState(false);
  const [sinal, setSinal] = useState("Parado"), [cfg, setCfg] = useState(() => configPadrao("bombas"));
  const controles = useMemo(() => new Controles(), []), remotas = useMemo(() => new EntradasRemotas(), []);
  useEffect(() => {
    const canal = new BroadcastChannel("nord-bombas-qa-joystick");
    if (joystick) {
      controles.ligar(); canal.postMessage({ k: "entrar" });
      let ultimo = "", quadro = 0;
      const ler = () => {
        const e = controles.ler(); const d = { x: e.direcao, eixoX: e.eixoX, eixoY: e.eixoY, a: e.a, b: e.b, p: e.pausa };
        const atual = JSON.stringify(d);
        if (atual !== ultimo) { ultimo = atual; canal.postMessage({ k: "entrada", d }); setSinal(`${d.x ?? "Parado"}${d.a ? " · Bomba" : ""}${d.b ? " · Ação" : ""}`); }
        quadro = requestAnimationFrame(ler);
      };
      quadro = requestAnimationFrame(ler);
      const sair = () => canal.postMessage({ k: "sair" });
      window.addEventListener("pagehide", sair);
      return () => { sair(); window.removeEventListener("pagehide", sair); cancelAnimationFrame(quadro); controles.desligar(); canal.close(); };
    }
    canal.onmessage = ev => {
      if (ev.data.k === "entrar") setConectado(true);
      if (ev.data.k === "entrada") remotas.receber(1, ev.data.d);
      if (ev.data.k === "sair") { remotas.soltar(1); setConectado(false); }
    };
    return () => canal.close();
  }, [joystick, controles, remotas]);
  if (joystick) return <main className="flex h-dvh flex-col justify-between bg-slate-950 text-white"><div className="p-5"><h1 className="text-xl font-black">Joystick · Bombas Táticas</h1><p className="mt-2 text-xs text-amber-200">Laboratório local, sem servidor nem conta.</p><p className="mt-4 text-sm" aria-live="polite">Mandando: {sinal}</p></div><button className="m-5 rounded-xl bg-amber-300 p-4 font-black text-slate-950" onClick={() => controles.tocar("pausa")}>START · Entrar</button><ControleVirtual controles={controles} rotuloA="Bomba" rotuloB="Ação" /></main>;
  if (campanha) return <BombasTaticas vagas={vagasCampanha} modo="campanha" bioma="fabrica" vitoriasParaVencer={1} remotas={remotas} onSair={() => { location.href = "/qa/bombas.html"; }} />;
  const vagas: VagaJogo[] = [...(conectado ? [{ nome: "Celular de teste", bot: null, avatar: avatarDaVaga(0, null), controle: 1 }] : []), ...Array.from({ length: cfg.bots }, (_, i) => ({ nome: `Bot ${i + 1}`, bot: cfg.dificuldade, avatar: avatarDaVaga(i + 1, null) }))];
  const jogadores: JogadorSala[] = conectado ? [{ vaga: 1, idUsuario: 1, nome: "Celular de teste", avatar: null, conectado: true }] : [];
  if (jogando) return <BombasTaticas vagas={vagas} modo={cfg.modo as "sobrevivencia" | "times" | "moedas"} bioma={cfg.cenario as "fabrica" | "gelo" | "vulcao"} vitoriasParaVencer={1} remotas={remotas} onSair={() => setJogando(false)} />;
  return <ModoTela jogo="bombas" onJogo={() => undefined} sala={{ codigo: "ABCD", estado: "conectado", jogadores }} erro={null} vagas={vagas} cfg={cfg} mudarCfg={setCfg} euJogo={false} onEuJogo={() => undefined} onComecar={() => setJogando(true)} onSair={() => { location.href = "/qa/bombas.html"; }} />;
}
createRoot(document.getElementById("root")!).render(<LaboratorioCoop />);
