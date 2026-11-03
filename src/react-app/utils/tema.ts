/**
 * Tema claro/escuro: um geral (claro, escuro ou igual ao do aparelho) e, se a pessoa quiser,
 * um tema próprio para cada tela. Fica guardado neste aparelho.
 */

export type Tema = "claro" | "escuro";
export type TemaGeral = Tema | "sistema";

export interface PreferenciaTema {
  geral: TemaGeral;
  /** Telas com tema próprio (caminho → tema); as outras seguem o geral. */
  telas: Record<string, Tema>;
  /** Animações: seguir o "reduzir movimento" do aparelho, sempre ligadas ou desligadas. */
  animacoes: Animacoes;
}

export type Animacoes = "aparelho" | "sempre" | "desligadas";
const ehAnimacoes = (v: unknown): v is Animacoes => v === "aparelho" || v === "sempre" || v === "desligadas";

export const PREFERENCIA_PADRAO: PreferenciaTema = { geral: "claro", telas: {}, animacoes: "aparelho" };
export const CHAVE_TEMA = "@NordTool:tema";

const ehTema = (v: unknown): v is Tema => v === "claro" || v === "escuro";
const ehGeral = (v: unknown): v is TemaGeral => ehTema(v) || v === "sistema";

/** "/gestao/caixinha/" e "/gestao/caixinha" são a mesma tela. */
export const chaveDaTela = (caminho: string) => (caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho) || "/";

export function lerPreferencia(storage: Pick<Storage, "getItem"> | undefined): PreferenciaTema {
  try {
    const bruto = storage?.getItem(CHAVE_TEMA);
    if (!bruto) return PREFERENCIA_PADRAO;
    const v = JSON.parse(bruto) as Partial<PreferenciaTema>;
    const telas: Record<string, Tema> = {};
    if (v && typeof v.telas === "object" && v.telas) {
      for (const [k, t] of Object.entries(v.telas)) if (typeof k === "string" && k.startsWith("/") && ehTema(t)) telas[chaveDaTela(k)] = t;
    }
    return { geral: ehGeral(v?.geral) ? v.geral : PREFERENCIA_PADRAO.geral, telas, animacoes: ehAnimacoes(v?.animacoes) ? v.animacoes : "aparelho" };
  } catch {
    return PREFERENCIA_PADRAO;
  }
}

export function salvarPreferencia(storage: Pick<Storage, "setItem"> | undefined, p: PreferenciaTema): void {
  try {
    storage?.setItem(CHAVE_TEMA, JSON.stringify(p));
  } catch {
    // modo privado: o tema vale só até fechar
  }
}

export const temaGeralEfetivo = (geral: TemaGeral, sistemaEscuro: boolean): Tema =>
  geral === "sistema" ? (sistemaEscuro ? "escuro" : "claro") : geral;

/** O tema que a tela mostra: o dela, se tiver; senão o geral. */
export const temaDaTela = (p: PreferenciaTema, caminho: string, sistemaEscuro: boolean): Tema =>
  p.telas[chaveDaTela(caminho)] ?? temaGeralEfetivo(p.geral, sistemaEscuro);

export const comGeral = (p: PreferenciaTema, geral: TemaGeral): PreferenciaTema => ({ ...p, geral });

/** Define (ou tira, com null) o tema próprio de uma tela. */
export function comTemaDaTela(p: PreferenciaTema, caminho: string, tema: Tema | null): PreferenciaTema {
  const telas = { ...p.telas };
  const chave = chaveDaTela(caminho);
  if (tema === null) delete telas[chave];
  else telas[chave] = tema;
  return { ...p, telas };
}

export const comAnimacoes = (p: PreferenciaTema, animacoes: Animacoes): PreferenciaTema => ({ ...p, animacoes });

/** Menos movimento de fato: "sempre" liga as animações mesmo com o aparelho pedindo menos (economia de bateria). */
export const menosMovimentoEfetivo = (animacoes: Animacoes, aparelhoPedeMenos: boolean): boolean =>
  animacoes === "desligadas" || (animacoes === "aparelho" && aparelhoPedeMenos);

export const ROTULO_ANIMACOES: Record<Animacoes, string> = { aparelho: "Seguir o aparelho", sempre: "Sempre ligadas", desligadas: "Desligadas" };

export const ROTULO_TEMA: Record<TemaGeral, string> = { claro: "Claro", escuro: "Escuro", sistema: "Igual ao aparelho" };
