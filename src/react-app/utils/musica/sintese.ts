/**
 * Repertório v5: o que o sintetizador toca e quando. Puro (sem Web Audio), testável em node; o som em si fica em
 * `components/repertorio/sintetizador.ts`.
 */
import type { EventoQueda, Instrumento } from "./instrumentos.ts";

/** Frequência (Hz) da nota MIDI (A4 = 69 = 440 Hz). */
export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Altura MIDI do evento: no braço, a corda solta + a casa; no teclado, a própria nota. */
export const alturaDoEvento = (ins: Instrumento, e: EventoQueda) => (e.midi ?? (ins.cordas[e.corda ?? 0] ?? 0) + (e.casa ?? 0));

/** Quanto à frente (em segundos da música) o sintetizador agenda as notas. */
export const ANTECEDENCIA = 0.25;

export interface Agenda {
  /** Até onde (tempo da música) já foi agendado. */
  ate: number;
  /** Tempo da música no último quadro (para perceber pulos e pausas). */
  ultimo: number;
}

export interface PassoAgenda {
  /** Pulo para trás/frente ou recomeço: cortar as notas soando e agendar a partir de agora. */
  reiniciar: boolean;
  /** Eventos que começam neste passo, com quanto falta (em segundos reais) para cada um soar e quanto dura. */
  notas: Array<{ evento: EventoQueda; daqui: number; dura: number }>;
  agenda: Agenda;
}

/**
 * Um quadro do agendador: com a música em `t` (s da música) e o `andamento` (1 = normal), devolve as notas que
 * começam entre o que já foi agendado e `t + ANTECEDENCIA`. Um pulo (para trás, ou para a frente mais que 1 s) ou a
 * música parada recomeçam a agenda em `t`, sem tocar o que ficou para trás.
 */
export function passoDaAgenda(eventos: EventoQueda[], agenda: Agenda | null, t: number, andamento: number, tocando: boolean): PassoAgenda {
  const vel = Math.max(0.1, andamento);
  if (!tocando) return { reiniciar: agenda !== null, notas: [], agenda: { ate: t, ultimo: t } };
  const pulou = !agenda || t < agenda.ultimo - 0.05 || t > agenda.ultimo + 1;
  const de = pulou ? t - 0.02 : agenda!.ate;
  const ate = t + ANTECEDENCIA;
  const notas: PassoAgenda["notas"] = [];
  for (const e of eventos) {
    if (e.inicio > ate) break;
    if (e.inicio <= de) continue;
    notas.push({ evento: e, daqui: Math.max(0, (e.inicio - t) / vel), dura: Math.max(0.05, (e.fim - e.inicio) / vel) });
  }
  return { reiniciar: pulou && agenda !== null, notas, agenda: { ate: Math.max(ate, de), ultimo: t } };
}
