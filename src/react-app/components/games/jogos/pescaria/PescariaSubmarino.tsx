import { useCallback, type ComponentProps } from "react";
import MolduraPartida, { type VagaJogo } from "../../comum/MolduraPartida";
import { META_SOLO, type ModoPescaria } from "@/react-app/utils/games/pescaria";
import { MARES, criarMotorPescaria, type MarPescaria } from "./motorPescaria";

type Comum = Omit<ComponentProps<typeof MolduraPartida>, "titulo" | "modoRotulo" | "detalhe" | "botoes" | "ajudaTeclado" | "criarMotor" | "vagas" | "textosSolo" | "bpm">;

/** Pescaria & Submarino: pescaria com linha e tensão ou mergulho com oxigênio, arpão e tesouros, de 1 a 8. */
export default function PescariaSubmarino({ vagas, modo, mar, ...resto }: Comum & { vagas: VagaJogo[]; modo: ModoPescaria; mar: MarPescaria }) {
  const solo = vagas.length === 1;
  const criarMotor = useCallback<ComponentProps<typeof MolduraPartida>["criarMotor"]>(
    (caixa, ganchos) => criarMotorPescaria(caixa, vagas, modo, mar, ganchos), [vagas, modo, mar]);
  const pesca = modo === "pescaria";
  const regra = solo ? `faça ${META_SOLO[modo]} pontos em 3 minutos` : "3 minutos; vence quem fizer mais pontos";
  return (
    <MolduraPartida {...resto} vagas={vagas} criarMotor={criarMotor} bpm={88}
      titulo="Pescaria & Submarino" modoRotulo={pesca ? "Pescaria" : "Mergulho"}
      detalhe={`${MARES[mar].nome} · ${regra}`}
      botoes={pesca ? { a: "Puxar", b: "Soltar" } : { a: "Arpão", b: "Impulso" }}
      ajudaTeclado={pesca
        ? "←/→ move o barco · ↑/↓ sobe e desce o anzol · peixe fisgado: segure Espaço/Z para puxar quando ele descansa, X solta a linha · tensão no vermelho arrebenta · Esc pausa"
        : "Setas nadam · Espaço/Z atira o arpão · X dá um impulso (gasta ar) · suba para respirar e entregar a carga · Esc pausa"}
      textosSolo={{ venceu: pesca ? "🎣 Que pescaria!" : "🤿 Tesouro garantido!", perdeu: "Não deu a meta desta vez…" }} />
  );
}
