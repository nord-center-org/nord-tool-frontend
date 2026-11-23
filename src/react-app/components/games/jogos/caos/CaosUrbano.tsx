import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { ENTREGAS_SOLO, POSTOS, type CidadeCaos, type ModoCaos } from "@/react-app/utils/games/caos";
import { CIDADES_CAOS, criarMotorCaos } from "./motorCaos";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const ROTULO: Record<ModoCaos, string> = { fuga: "Fuga Policial", entregas: "Entrega Expressa", derby: "Derby de Demolição", corrida: "Corrida de Rua" };

/** Caos Urbano (3D): fuga da polícia, entregas, derby e corrida de rua numa cidade em grade, de 1 a 8. */
export default function CaosUrbano({ vagas, modo, cidade, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoCaos; cidade: CidadeCaos }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorCaos(caixa, vagas, modo, cidade, ganchos), [vagas, modo, cidade]);
  const regra = modo === "fuga" ? (solo ? "fique livre por 2 minutos" : "fuja da polícia; pontos por tempo livre")
    : modo === "entregas" ? (solo ? `${ENTREGAS_SOLO} entregas em 3 minutos` : "mais pontos em entregas em 3 minutos")
    : modo === "derby" ? (solo ? "destrua as 6 sucatas" : "fica o último carro inteiro")
    : solo ? `${POSTOS} postos contra o relógio` : `${POSTOS} postos; quem completar primeiro`;
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={128}
      titulo="Caos Urbano" modoRotulo={ROTULO[modo]}
      detalhe={`${CIDADES_CAOS[cidade].nome} · ${regra}`}
      botoes={{ a: "Nitro", b: "Freio de mão" }}
      ajudaTeclado="Acelera sozinho · ←/→ vira · ↓ freia e dá ré · segure Espaço/Z para o nitro · X é o freio de mão (derrapa) · Esc pausa"
      textosSolo={{ venceu: modo === "fuga" ? "🚓 Escapou!" : modo === "derby" ? "💥 Ferro-velho completo!" : "🏁 Missão cumprida!", perdeu: modo === "fuga" ? "Preso…" : "Não deu desta vez…" }} />
  );
}
