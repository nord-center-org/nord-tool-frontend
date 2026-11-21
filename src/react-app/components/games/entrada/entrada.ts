import type { Direcao } from "@/react-app/utils/games/bombas";

/**
 * Entrada unificada dos jogos: teclado (WASD/setas + Espaço/Enter/Z + X/Shift) e o controle virtual de toque.
 * No mesmo teclado dá para jogar em dois: P1 nas setas (+ Enter/Shift direito) e P2 no WASD (+ Espaço/Q).
 */
export interface EstadoControle { direcao: Direcao | null; a: boolean; b: boolean; pausa: boolean }

const vazio = (): EstadoControle => ({ direcao: null, a: false, b: false, pausa: false });

const TECLAS_P1: Record<string, keyof EstadoControle | Direcao> = {
  ArrowUp: "cima", ArrowDown: "baixo", ArrowLeft: "esquerda", ArrowRight: "direita",
  KeyW: "cima", KeyS: "baixo", KeyA: "esquerda", KeyD: "direita",
  Space: "a", Enter: "a", KeyZ: "a", KeyJ: "a", KeyX: "b", KeyK: "b", ShiftLeft: "b", ShiftRight: "b", Escape: "pausa", KeyP: "pausa",
};

export class Controles {
  private apertadas = new Map<string, number>();
  /** Botões tocados desde a última leitura: um toque rápido (apertar e soltar entre dois passos) não se perde. */
  private tocados = new Set<"a" | "b" | "pausa">();
  /** Direção tocada desde a última leitura (puzzles contam cada toque na seta, mesmo se soltar antes do passo). */
  private direcaoTocada: Direcao | null = null;
  private ordem = 0;
  /** Estado do controle virtual (toque), somado ao teclado. */
  virtual: EstadoControle = vazio();

  private aoApertar = (e: KeyboardEvent) => {
    if (!(e.code in TECLAS_P1)) return;
    if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
    e.preventDefault();
    const acao = TECLAS_P1[e.code];
    if ((acao === "a" || acao === "b" || acao === "pausa") && !e.repeat) this.tocados.add(acao);
    else if (!e.repeat && acao !== "a" && acao !== "b" && acao !== "pausa") this.direcaoTocada = acao as Direcao;
    if (!this.apertadas.has(e.code)) this.apertadas.set(e.code, ++this.ordem);
  };
  private aoSoltar = (e: KeyboardEvent) => this.apertadas.delete(e.code);
  private aoSair = () => this.apertadas.clear();

  /** Toque de botão vindo do controle virtual (não se perde mesmo se soltar antes do próximo passo). */
  tocar(acao: "a" | "b" | "pausa") {
    this.tocados.add(acao);
  }

  /** Toque no direcional do controle virtual. */
  tocarDirecao(d: Direcao) {
    this.direcaoTocada = d;
  }

  ligar() {
    window.addEventListener("keydown", this.aoApertar);
    window.addEventListener("keyup", this.aoSoltar);
    window.addEventListener("blur", this.aoSair);
  }

  desligar() {
    window.removeEventListener("keydown", this.aoApertar);
    window.removeEventListener("keyup", this.aoSoltar);
    window.removeEventListener("blur", this.aoSair);
  }

  /** A última direção apertada vence (permite trocar de direção sem soltar a anterior). */
  ler(): EstadoControle {
    const s = vazio();
    let maisRecente = -1;
    for (const [tecla, ordem] of this.apertadas) {
      const acao = TECLAS_P1[tecla];
      if (acao === "a" || acao === "b" || acao === "pausa") s[acao] = true;
      else if (ordem > maisRecente) {
        s.direcao = acao as Direcao;
        maisRecente = ordem;
      }
    }
    for (const t of this.tocados) s[t] = true;
    this.tocados.clear();
    if (!s.direcao && !this.virtual.direcao && this.direcaoTocada) s.direcao = this.direcaoTocada;
    this.direcaoTocada = null;
    return { direcao: this.virtual.direcao ?? s.direcao, a: s.a || this.virtual.a, b: s.b || this.virtual.b, pausa: s.pausa || this.virtual.pausa };
  }
}

/** Celular ou tablet sem teclado: mostra os controles virtuais. */
export const telaDeToque = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false);

/** Vibração curta quando o aparelho permite. */
export function vibrar(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // sem vibração
  }
}
