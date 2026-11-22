import type { Direcao } from "@/react-app/utils/games/bombas";
import { aoMudarConfig, carregarConfig, lerPad, mapaDeTeclas, type AcaoControle, type ConfigControles, type LeituraGamepad } from "@/react-app/utils/games/configControles";

/**
 * Entrada unificada dos jogos: teclado (teclas remapeáveis nas preferências), o controle virtual de toque e o controle
 * de videogame (gamepad). Tudo se soma no mesmo estado.
 */
export interface EstadoControle { direcao: Direcao | null; a: boolean; b: boolean; pausa: boolean }

const vazio = (): EstadoControle => ({ direcao: null, a: false, b: false, pausa: false });

/** Gamepads conectados agora (índice e nome), na ordem do navegador. */
export function gamepadsConectados(): { indice: number; nome: string }[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? [])
      .filter((p): p is Gamepad => !!p && p.connected)
      .map(p => ({ indice: p.index, nome: p.id.replace(/\s*\(.*\)\s*$/, "").slice(0, 40) || `Controle ${p.index + 1}` }));
  } catch {
    return [];
  }
}

/** Lê um gamepad pelo índice (null se não estiver conectado). */
export function lerGamepad(indice: number, cfg: ConfigControles = carregarConfig()): LeituraGamepad | null {
  try {
    const p = navigator.getGamepads?.()[indice];
    return p && p.connected ? lerPad(p, cfg) : null;
  } catch {
    return null;
  }
}

export class Controles {
  private apertadas = new Map<string, number>();
  /** Botões tocados desde a última leitura: um toque rápido (apertar e soltar entre dois passos) não se perde. */
  private tocados = new Set<"a" | "b" | "pausa">();
  /** Direção tocada desde a última leitura (puzzles contam cada toque na seta, mesmo se soltar antes do passo). */
  private direcaoTocada: Direcao | null = null;
  private ordem = 0;
  private cfg: ConfigControles = carregarConfig();
  private teclas = mapaDeTeclas(this.cfg);
  private pararDeOuvir: (() => void) | null = null;
  /** Último estado do gamepad (para o toque rápido nos botões dele também contar). */
  private padAntes: LeituraGamepad | null = null;
  /** Estado do controle virtual (toque), somado ao teclado. */
  virtual: EstadoControle = vazio();
  /**
   * Qual gamepad também comanda este controle: "auto" = o primeiro conectado que não for de outro jogador;
   * um número = aquele; null = nenhum.
   */
  gamepad: number | "auto" | null = "auto";
  /** Gamepads que já são de outros jogadores (não usar no "auto"). */
  gamepadsDeOutros: number[] = [];

  private aoApertar = (e: KeyboardEvent) => {
    const acao = this.teclas.get(e.code);
    if (!acao) return;
    if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [data-sem-atalho]")) return;
    e.preventDefault();
    if ((acao === "a" || acao === "b" || acao === "pausa") && !e.repeat) this.tocados.add(acao);
    else if (!e.repeat && acao !== "a" && acao !== "b" && acao !== "pausa") this.direcaoTocada = acao;
    if (!this.apertadas.has(e.code)) this.apertadas.set(e.code, ++this.ordem);
  };
  private aoSoltar = (e: KeyboardEvent) => this.apertadas.delete(e.code);
  private aoSair = () => this.apertadas.clear();

  get config(): ConfigControles { return this.cfg; }

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
    this.pararDeOuvir = aoMudarConfig(c => { this.cfg = c; this.teclas = mapaDeTeclas(c); this.apertadas.clear(); });
  }

  desligar() {
    window.removeEventListener("keydown", this.aoApertar);
    window.removeEventListener("keyup", this.aoSoltar);
    window.removeEventListener("blur", this.aoSair);
    this.pararDeOuvir?.();
    this.pararDeOuvir = null;
  }

  private indiceDoGamepad(): number | null {
    if (this.gamepad === null) return null;
    if (typeof this.gamepad === "number") return this.gamepad;
    return gamepadsConectados().map(g => g.indice).find(i => !this.gamepadsDeOutros.includes(i)) ?? null;
  }

  /** A última direção apertada vence (permite trocar de direção sem soltar a anterior). */
  ler(): EstadoControle {
    const s = vazio();
    let maisRecente = -1;
    for (const [tecla, ordem] of this.apertadas) {
      const acao = this.teclas.get(tecla) as AcaoControle | undefined;
      if (!acao) continue;
      if (acao === "a" || acao === "b" || acao === "pausa") s[acao] = true;
      else if (ordem > maisRecente) {
        s.direcao = acao;
        maisRecente = ordem;
      }
    }
    for (const t of this.tocados) s[t] = true;
    this.tocados.clear();
    if (!s.direcao && !this.virtual.direcao && this.direcaoTocada) s.direcao = this.direcaoTocada;
    this.direcaoTocada = null;
    const indice = this.indiceDoGamepad();
    const pad = indice === null ? null : lerGamepad(indice, this.cfg);
    // Pausa do gamepad conta só na borda (apertou agora), para não pausar e despausar sem parar.
    const pausaPad = !!pad?.pausa && !this.padAntes?.pausa;
    this.padAntes = pad;
    return {
      direcao: this.virtual.direcao ?? s.direcao ?? pad?.direcao ?? null,
      a: s.a || this.virtual.a || !!pad?.a,
      b: s.b || this.virtual.b || !!pad?.b,
      pausa: s.pausa || this.virtual.pausa || pausaPad,
    };
  }
}

/**
 * Leitor de um gamepad que é de um jogador próprio (2º, 3º… controle na mesma tela). A pausa conta só na borda.
 */
export class LeitorGamepad {
  private antes: LeituraGamepad | null = null;
  constructor(readonly indice: number) {}
  ler(): EstadoControle {
    const p = lerGamepad(this.indice);
    const pausa = !!p?.pausa && !this.antes?.pausa;
    this.antes = p;
    return { direcao: p?.direcao ?? null, a: !!p?.a, b: !!p?.b, pausa };
  }
}

/** Celular ou tablet sem teclado: mostra os controles virtuais. */
export const telaDeToque = () => typeof window !== "undefined" && (
  (window.matchMedia?.("(pointer: coarse)").matches ?? false) || ((navigator.maxTouchPoints ?? 0) > 0 && !(window.matchMedia?.("(pointer: fine)").matches ?? false))
);

/** Mostra o controle na tela? Segue a preferência (automático = só em tela de toque). */
export const mostrarControleNaTela = (cfg: ConfigControles = carregarConfig()) =>
  cfg.naTela === "sempre" || (cfg.naTela === "auto" && telaDeToque());

/** Vibração curta quando o aparelho permite (e a preferência deixa). */
export function vibrar(ms: number | number[]) {
  try {
    if (!carregarConfigCache().vibrar) return;
    navigator.vibrate?.(ms);
  } catch {
    // sem vibração
  }
}

let cache: ConfigControles | null = null;
aoMudarConfig(c => { cache = c; });
function carregarConfigCache(): ConfigControles {
  if (!cache) cache = carregarConfig();
  return cache;
}

/** O mínimo de uma vaga para saber de onde vem a entrada dela. */
export interface OrigemVaga { bot: unknown; controle?: number; gamepad?: number }
interface RemotasLeitura { ler(vaga: number): { x: Direcao | null; a: boolean; b: boolean; p: boolean } }

/**
 * Lê a entrada de todas as vagas num passo: quem joga na tela (teclado, toque e o 1º gamepad livre), quem tem um
 * gamepad próprio, os celulares da sala e os bots (vazio). Também diz se alguém apertou pausa.
 */
export class LeitorDaPartida {
  private pads = new Map<number, LeitorGamepad>();
  constructor(private vagas: OrigemVaga[], private controles: Controles, private local: number) {
    vagas.forEach((v, i) => { if (v.gamepad !== undefined && !v.bot) this.pads.set(i, new LeitorGamepad(v.gamepad)); });
    controles.gamepadsDeOutros = vagas.filter(v => v.gamepad !== undefined).map(v => v.gamepad!);
  }

  ler(remotas?: RemotasLeitura): { entradas: { direcao: Direcao | null; a: boolean; b: boolean }[]; pausa: boolean } {
    const c = this.controles.ler();
    let pausa = c.pausa;
    const entradas = this.vagas.map((v, i) => {
      if (v.bot) return { direcao: null, a: false, b: false };
      if (v.controle !== undefined) {
        const r = remotas?.ler(v.controle);
        if (!r) return { direcao: null, a: false, b: false };
        pausa ||= r.p;
        return { direcao: r.x, a: r.a, b: r.b };
      }
      const pad = this.pads.get(i);
      if (pad) {
        const p = pad.ler();
        pausa ||= p.pausa;
        return { direcao: p.direcao, a: p.a, b: p.b };
      }
      return i === this.local ? { direcao: c.direcao, a: c.a, b: c.b } : { direcao: null, a: false, b: false };
    });
    return { entradas, pausa };
  }
}
