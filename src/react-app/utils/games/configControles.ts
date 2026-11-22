/**
 * Preferências de controle dos Games, guardadas neste aparelho: teclas do teclado (remapeáveis), controle na tela
 * (quando aparece, estilo, lado, tamanho), vibração e o controle de videogame (gamepad).
 */
import type { Direcao } from "./bombas.ts";

export type AcaoControle = Direcao | "a" | "b" | "pausa";
export const ACOES: AcaoControle[] = ["cima", "baixo", "esquerda", "direita", "a", "b", "pausa"];
export const NOME_ACAO: Record<AcaoControle, string> = {
  cima: "Cima", baixo: "Baixo", esquerda: "Esquerda", direita: "Direita", a: "Botão A", b: "Botão B", pausa: "Pausa",
};

export interface ConfigControles {
  /** Teclas de cada ação (códigos do teclado, ex.: "ArrowUp", "KeyW"). */
  teclas: Record<AcaoControle, string[]>;
  /** Controle na tela: automático (só em tela de toque), sempre ou nunca. */
  naTela: "auto" | "sempre" | "nunca";
  /** Analógico (arrasta o polegar, o pino segue o dedo) ou setas fixas (toca em cada seta). */
  estilo: "analogico" | "setas";
  /** Canhoto: direcional à direita e botões à esquerda. */
  canhoto: boolean;
  tamanho: "p" | "m" | "g";
  vibrar: boolean;
  /** Gamepad: troca A e B (para controles com o layout invertido). */
  gamepadTrocarAB: boolean;
  /** Zona morta do analógico do gamepad (0,2 a 0,8). */
  zonaMorta: number;
}

export const TECLAS_PADRAO: Record<AcaoControle, string[]> = {
  cima: ["ArrowUp", "KeyW"],
  baixo: ["ArrowDown", "KeyS"],
  esquerda: ["ArrowLeft", "KeyA"],
  direita: ["ArrowRight", "KeyD"],
  a: ["Space", "Enter", "KeyZ", "KeyJ"],
  b: ["KeyX", "KeyK", "ShiftLeft", "ShiftRight"],
  pausa: ["Escape", "KeyP"],
};

export const CONFIG_PADRAO: ConfigControles = {
  teclas: TECLAS_PADRAO, naTela: "auto", estilo: "analogico", canhoto: false, tamanho: "m", vibrar: true, gamepadTrocarAB: false, zonaMorta: 0.45,
};

const CHAVE = "nord-games-controles";
const CODIGO_VALIDO = /^[A-Za-z0-9]{2,24}$/;

/** Confere e completa o que veio do armazenamento (nada estranho entra). */
export function validarConfig(bruto: unknown): ConfigControles {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<Record<keyof ConfigControles, unknown>>;
  const teclas = { ...TECLAS_PADRAO };
  if (o.teclas && typeof o.teclas === "object") {
    for (const a of ACOES) {
      const lista = (o.teclas as Record<string, unknown>)[a];
      if (Array.isArray(lista)) {
        const ok = lista.filter((t): t is string => typeof t === "string" && CODIGO_VALIDO.test(t)).slice(0, 4);
        if (ok.length) teclas[a] = ok;
      }
    }
  }
  const um = <T extends string>(v: unknown, opcoes: readonly T[], padrao: T): T => (opcoes.includes(v as T) ? (v as T) : padrao);
  const zona = typeof o.zonaMorta === "number" && Number.isFinite(o.zonaMorta) ? Math.min(0.8, Math.max(0.2, o.zonaMorta)) : CONFIG_PADRAO.zonaMorta;
  return {
    teclas,
    naTela: um(o.naTela, ["auto", "sempre", "nunca"] as const, CONFIG_PADRAO.naTela),
    estilo: um(o.estilo, ["analogico", "setas"] as const, CONFIG_PADRAO.estilo),
    canhoto: o.canhoto === true,
    tamanho: um(o.tamanho, ["p", "m", "g"] as const, CONFIG_PADRAO.tamanho),
    vibrar: o.vibrar !== false,
    gamepadTrocarAB: o.gamepadTrocarAB === true,
    zonaMorta: zona,
  };
}

export function carregarConfig(): ConfigControles {
  try {
    const t = globalThis.localStorage?.getItem(CHAVE);
    return validarConfig(t ? JSON.parse(t) : null);
  } catch {
    return validarConfig(null);
  }
}

const ouvintes = new Set<(c: ConfigControles) => void>();

export function salvarConfig(c: ConfigControles) {
  const valida = validarConfig(c);
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(valida));
  } catch {
    // Sem armazenamento (aba anônima): vale só até fechar.
  }
  ouvintes.forEach(f => f(valida));
}

/** Avisa quando a configuração muda (para o controle já em uso atualizar na hora). */
export function aoMudarConfig(f: (c: ConfigControles) => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Tecla → ação. Se a mesma tecla estiver em duas ações, vale a primeira da lista de ações. */
export function mapaDeTeclas(c: ConfigControles): Map<string, AcaoControle> {
  const m = new Map<string, AcaoControle>();
  for (const a of ACOES) for (const t of c.teclas[a]) if (!m.has(t)) m.set(t, a);
  return m;
}

/** Troca a tecla de uma ação: a nova vira a principal e sai de qualquer outra ação. */
export function trocarTecla(c: ConfigControles, acao: AcaoControle, codigo: string): ConfigControles {
  if (!CODIGO_VALIDO.test(codigo)) return c;
  const teclas = Object.fromEntries(ACOES.map(a => [a, c.teclas[a].filter(t => t !== codigo)])) as Record<AcaoControle, string[]>;
  teclas[acao] = [codigo, ...teclas[acao]].slice(0, 4);
  for (const a of ACOES) if (!teclas[a].length) teclas[a] = TECLAS_PADRAO[a].filter(t => t !== codigo).slice(0, 1);
  return { ...c, teclas };
}

const NOMES_TECLA: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Espaço", Enter: "Enter", Escape: "Esc",
  ShiftLeft: "Shift esq.", ShiftRight: "Shift dir.", ControlLeft: "Ctrl esq.", ControlRight: "Ctrl dir.", AltLeft: "Alt", Tab: "Tab",
  Backspace: "Apagar",
};

export function nomeDaTecla(codigo: string): string {
  if (NOMES_TECLA[codigo]) return NOMES_TECLA[codigo];
  if (/^Key[A-Z]$/.test(codigo)) return codigo.slice(3);
  if (/^Digit\d$/.test(codigo)) return codigo.slice(5);
  if (/^Numpad\d$/.test(codigo)) return `Num ${codigo.slice(6)}`;
  return codigo;
}

/** O estado de um gamepad no formato do jogo (mapeamento padrão: cruz 12–15, analógico 0/1, A 0, B 1, Start 9). */
export interface LeituraGamepad { direcao: Direcao | null; a: boolean; b: boolean; pausa: boolean }

export function lerPad(p: { buttons: readonly { pressed: boolean }[]; axes: readonly number[] }, c: Pick<ConfigControles, "gamepadTrocarAB" | "zonaMorta">): LeituraGamepad {
  const b = (i: number) => !!p.buttons[i]?.pressed;
  const [x = 0, y = 0] = p.axes;
  let direcao: Direcao | null = null;
  if (b(12)) direcao = "cima";
  else if (b(13)) direcao = "baixo";
  else if (b(14)) direcao = "esquerda";
  else if (b(15)) direcao = "direita";
  else if (Math.hypot(x, y) >= c.zonaMorta) direcao = Math.abs(x) > Math.abs(y) ? (x > 0 ? "direita" : "esquerda") : (y > 0 ? "baixo" : "cima");
  // Botões de baixo e da esquerda (A/X) fazem A; os de cima e da direita (B/Y) fazem B.
  const a = b(0) || b(2), bb = b(1) || b(3);
  return { direcao, a: c.gamepadTrocarAB ? bb : a, b: c.gamepadTrocarAB ? a : bb, pausa: b(9) };
}
