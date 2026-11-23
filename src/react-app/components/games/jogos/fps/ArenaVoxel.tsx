import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { ABATES_META, CAPTURAS_META, COLINA_META, type MapaFps, type ModoFps } from "@/react-app/utils/games/fps";
import { MAPAS_FPS, criarMotorFps } from "./motorFps";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const ROTULOS: Record<ModoFps, string> = { matamata: "Mata-Mata", bandeira: "Captura de Bandeira", colina: "Rei da Colina", bots: "Contra Bots" };

/** Arena Voxel (3D): tiro em primeira pessoa com pulo encadeado, deslize e quatro armas, de 1 a 8. */
export default function ArenaVoxel({ vagas, modo, mapa, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoFps; mapa: MapaFps }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorFps(caixa, vagas, modo, mapa, ganchos), [vagas, modo, mapa]);
  const regra = solo || modo === "bots" ? `${ABATES_META} abates contra os bots em 3 min`
    : modo === "bandeira" ? `vermelho × azul: ${CAPTURAS_META} capturas`
    : modo === "colina" ? `fique sozinho no topo do meio: ${COLINA_META} pontos`
    : `${ABATES_META} abates ou 3 min`;
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={140}
      titulo="Arena Voxel" modoRotulo={solo ? "Contra Bots" : ROTULOS[modo]}
      detalhe={`${MAPAS_FPS[mapa].nome} · ${regra} · rifle, escopeta e sniper nos pedestais`}
      botoes={{ a: "Atirar", b: "Pular" }}
      ajudaTeclado="↑/↓ anda · ←/→ gira a visão · Espaço/Z atira (mira assistida, recarga sozinha) · X pula (pule de novo ao cair para acelerar; segure ao cair para deslizar) · Esc pausa"
      textosSolo={{ venceu: "💀 Arena limpa!", perdeu: "O tempo acabou…" }} />
  );
}
