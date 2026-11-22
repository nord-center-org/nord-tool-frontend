import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { META_ONDAS, META_ONDAS_SOLO, type ModoDefesa } from "@/react-app/utils/games/defesa";
import { MAPAS_DEFESA, criarMotorDefesa, type MapaDefesa } from "./motorDefesa";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Defesa de Base: tower defense cooperativo de 1 a 8 engenheiros. */
export default function DefesaBase({ vagas, modo, mapa, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoDefesa; mapa: MapaDefesa }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorDefesa(caixa, vagas, modo, mapa, ganchos), [vagas, modo, mapa]);
  const regra = modo === "cooperativo" ? `aguente ${solo ? META_ONDAS_SOLO : META_ONDAS} ondas, a última com o chefão` : "ondas sem fim, chefão a cada 5";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={104}
      titulo="Defesa de Base" modoRotulo={modo === "cooperativo" ? "Cooperativo" : "Infinito"}
      detalhe={`${MAPAS_DEFESA[mapa].nome} · ${regra} · juntos`}
      botoes={{ a: "Atirar", b: "Construir" }}
      ajudaTeclado="Setas andam · passe nos cristais para juntar ouro · X num ponto de obra ergue ou melhora a torre; fora dele troca a torre (Flecha, Canhão, Gelo) · Espaço/Z atira · Esc pausa"
      textosSolo={{ venceu: "🏰 A base resistiu!", perdeu: "A base caiu…" }} />
  );
}
