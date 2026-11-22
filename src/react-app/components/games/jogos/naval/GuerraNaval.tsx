import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { LIMITE_CACADA, type ModoNaval } from "@/react-app/utils/games/naval";
import { TEMAS_NAVAL, criarMotorNaval, type TemaNaval } from "./motorNaval";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

const ROTULOS: Record<ModoNaval, string> = { classico: "Clássico", salva: "Salva", especiais: "Especiais", cacada: "Caçada" };

/** Guerra Naval: batalha naval por turnos, de 1 a 8 frotas; sozinho é a Caçada. */
export default function GuerraNaval({ vagas, modo, tema, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoNaval; tema: TemaNaval }) {
  const efetivo: ModoNaval = vagas.length === 1 ? "cacada" : modo === "cacada" ? "classico" : modo;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorNaval(caixa, vagas, efetivo, tema, ganchos), [vagas, efetivo, tema]);
  const regra = efetivo === "cacada" ? `afunde a frota em até ${LIMITE_CACADA} tiros`
    : efetivo === "salva" ? "um tiro por navio de pé" : efetivo === "especiais" ? "sonar e bombardeio em cruz (1 de cada)" : "um tiro por vez";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={84}
      titulo="Guerra Naval" modoRotulo={ROTULOS[efetivo]}
      detalhe={`${TEMAS_NAVAL[tema].nome} · ${regra}`}
      botoes={{ a: "Atirar", b: "Trocar" }}
      ajudaTeclado="Setas miram (passam para a próxima frota na borda) · Espaço/Z atira · X troca arma ou frota · Esc pausa"
      textosSolo={{ venceu: "⚓ Frota inimiga no fundo do mar!", perdeu: "A munição acabou…" }} />
  );
}
