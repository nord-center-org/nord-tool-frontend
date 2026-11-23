import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { metaCozinha, type ModoCozinha, type TemaCozinha } from "@/react-app/utils/games/cozinha";
import { TEMAS_COZINHA, criarMotorCozinha } from "./motorCozinha";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Cozinha Caótica (3D): pedidos contra o relógio, cortar, cozinhar, lavar e apagar fogo, de 1 a 8. */
export default function CozinhaCaotica({ vagas, modo, tema, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoCozinha; tema: TemaCozinha }) {
  const solo = vagas.length === 1;
  const duelo = !solo && modo === "duelo";
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorCozinha(caixa, vagas, modo, tema, ganchos), [vagas, modo, tema]);
  const regra = duelo ? "vermelho × azul, os mesmos pedidos: mais pontos em 3 min" : `${metaCozinha(vagas.length)} pontos em 3 min para a 1ª estrela`;
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={124}
      titulo="Cozinha Caótica" modoRotulo={solo ? "Desafio Solo" : duelo ? "Duelo de Cozinhas" : "Cooperativo"}
      detalhe={`${TEMAS_COZINHA[tema].nome} · ${regra} · salada, hambúrguer e sopa`}
      botoes={{ a: "Pegar", b: "Usar" }}
      ajudaTeclado="Setas andam · Espaço/Z pega, solta e junta no prato · X usa: segure para cortar na tábua, lavar na pia ou apagar com o extintor · Esc pausa"
      textosSolo={{ venceu: "⭐ Cozinha nota 10!", perdeu: "Faltaram pontos…" }} />
  );
}
