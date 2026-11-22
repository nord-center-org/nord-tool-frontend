import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { MEDIA_TREINO_MS, TIROS_TREINO, type ModoDuelo } from "@/react-app/utils/games/duelo";
import { CENARIOS_DUELO, criarMotorDuelo, type CenarioDuelo } from "./motorDuelo";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Duelo ao Meio-Dia: saque rápido; Duelo (todos), Torneio (1 × 1) e treino sozinho. */
export default function DueloMeioDia({ vagas, modo, cenario, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoDuelo; cenario: CenarioDuelo }) {
  const efetivo: ModoDuelo = vagas.length === 1 ? "treino" : modo === "treino" ? "duelo" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorDuelo(caixa, vagas, efetivo, cenario, ganchos), [vagas, efetivo, cenario]);
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={96}
      titulo="Duelo ao Meio-Dia" modoRotulo={efetivo === "duelo" ? "Duelo" : efetivo === "torneio" ? "Torneio" : "Treino de reflexo"}
      detalhe={`${CENARIOS_DUELO[cenario].nome} · ${efetivo === "treino" ? `${TIROS_TREINO} sinais, média abaixo de ${MEDIA_TREINO_MS} ms` : "espere o FOGO!; atirar antes queima"}`}
      botoes={{ a: "Atirar", b: "—" }}
      ajudaTeclado="Espaço/Z atira · com vento, segure ←/→ contra o vento · Esc pausa"
      textosSolo={{ venceu: "🏆 Mão mais rápida do Oeste!", perdeu: "Treine mais um pouco!" }} />
  );
}
