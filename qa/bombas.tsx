/** Entrada exclusiva do servidor de desenvolvimento, sem conta, API ou gravação de partidas. */
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import BombasTaticas from "../src/react-app/components/games/jogos/bombas/BombasTaticas";
import MolduraPartida, { type ResultadoPartida, type VagaJogo } from "../src/react-app/components/games/comum/MolduraPartida";
import { criarMotorBombas } from "../src/react-app/components/games/jogos/bombas/motorBombas";
import { avatarDaVaga } from "../src/react-app/components/games/central/sprites";
import { novaPartida } from "../src/react-app/utils/games/bombas";
import type { Bioma, Modo } from "../src/react-app/utils/games/bombas";
import { serializar } from "../src/react-app/utils/games/espelho";
import "../src/react-app/index.css";

export default function Laboratorio() {
  const [n, setN] = useState(4), [bioma, setBioma] = useState<Bioma>("fabrica"), [modo, setModo] = useState<Modo>("sobrevivencia");
  const [jogando, setJogando] = useState(false), [resultado, setResultado] = useState<ResultadoPartida | null>(null);
  const fixture = new URLSearchParams(location.search).get("fixture");
  const total = fixture ? 1 : n;
  const [vagas, setVagas] = useState<VagaJogo[]>([]);
  const criarMotor = useCallback<Parameters<typeof MolduraPartida>[0]["criarMotor"]>((caixa, ganchos) => {
    const motor = criarMotorBombas(caixa, vagas, modo, bioma, ganchos);
    const iniciar = motor.iniciarRodada.bind(motor);
    motor.iniciarRodada = () => {
      iniciar();
      const e = novaPartida({ modo, bioma, semente: 42, jogadores: [{ nome: "Teste solo", bot: null }] });
      if (fixture === "solo-vitoria") e.grade = e.grade.map(c => c === "caixa" ? "chao" : c);
      if (fixture === "solo-derrota") e.jogadores[0].vivo = false;
      motor.aplicar?.(serializar(e), []);
    };
    return motor;
  }, [vagas, modo, bioma, fixture]);
  const sair = () => setJogando(false);
  if (jogando) return fixture
    ? <MolduraPartida titulo="Bombas Táticas" modoRotulo="Teste de resultado solo" detalhe="3 vitórias configuradas; uma basta no solo" vagas={vagas} criarMotor={criarMotor} vitoriasParaVencer={3} botoes={{ a: "Bomba", b: "Ação" }} ajudaTeclado="Teste local" onFim={setResultado} onSair={sair} avisoFim={<p data-testid="resultado-solo">Vencedor registrado: {String(resultado?.vencedor)}</p>} />
    : <BombasTaticas vagas={vagas} modo={modo} bioma={bioma} vitoriasParaVencer={3} onSair={sair} onFim={setResultado} />;
  return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-3xl font-black">Laboratório · Bombas Táticas</h1><p className="my-4 text-slate-300">Prévia local sem login e sem enviar resultados para a conta.</p>
    <form className="flex max-w-md flex-col gap-4" onSubmit={e => { e.preventDefault(); setResultado(null); setVagas(Array.from({ length: total }, (_, i) => ({ nome: `Jogador ${i + 1}`, bot: i ? "medio" : null, avatar: avatarDaVaga(i, null) }))); setJogando(true); }}>
      <label>Jogadores<select aria-label="Jogadores" className="ml-3 rounded bg-slate-700 p-2" value={n} onChange={e => setN(Number(e.target.value))}>{[1, 2, 4, 8].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Bioma<select aria-label="Bioma" className="ml-3 rounded bg-slate-700 p-2" value={bioma} onChange={e => setBioma(e.target.value as Bioma)}><option value="fabrica">Fábrica</option><option value="gelo">Gelo</option><option value="vulcao">Vulcão</option></select></label>
      <label>Modo<select aria-label="Modo" className="ml-3 rounded bg-slate-700 p-2" value={modo} onChange={e => setModo(e.target.value as Modo)}><option value="sobrevivencia">Sobrevivência</option><option value="times">Times</option><option value="moedas">Caça às Moedas</option></select></label>
      <button type="submit" className="rounded-xl bg-amber-300 p-3 font-black text-slate-950">Iniciar teste</button>
    </form></main>;
}
createRoot(document.getElementById("root")!).render(<Laboratorio />);
