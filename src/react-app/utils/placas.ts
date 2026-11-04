/**
 * Placas de obra (Mapeamentos > Placas): o formato de um modelo, os textos de uma placa e onde cada parte fica na
 * folha A4. Sem React aqui (testável em node).
 */

export type Orientacao = "paisagem" | "retrato";
export type Fonte = "calibri" | "arial" | "serif" | "condensada";
export type Alinhamento = "left" | "center" | "right";

export interface ConfigPlaca {
  orientacao: Orientacao;
  /** Cor do fundo e o quanto ela escurece a foto (marca d'água) por cima: 0 = foto pura, 0,9 = quase só a cor. */
  fundo: { cor: string; escurecer: number };
  logo: { ativo: boolean; altura: number };
  /** Caixa branca no topo com um campo: "OBRA: NEXT GUARULHOS". */
  cabecalho: { ativo: boolean; rotulo: string };
  /** O painel branco arredondado no meio. */
  painel: { cor: string; raio: number };
  /** O quadro com os textos principais. */
  quadro: { borda: boolean; corBorda: string; corTexto: string; fonte: Fonte; negrito: boolean; alinhamento: Alinhamento; tamanho: number };
  rodape: { ativo: boolean; titulo: string; texto: string; cor: string; corTexto: string; tamanho: number };
}

export interface ValoresPlaca {
  /** O que vai no campo do cabeçalho (ex.: o nome da obra). */
  cabecalho: string;
  /** Uma linha de texto por item do quadro. */
  linhas: string[];
  /** Texto do rodapé desta placa (vazio = o do modelo). */
  rodape: string;
}

/** Folha A4 a 96 dpi (o tamanho em que a placa é desenhada; a exportação aumenta a resolução). */
export const FOLHA: Record<Orientacao, { largura: number; altura: number }> = {
  paisagem: { largura: 1123, altura: 794 },
  retrato: { largura: 794, altura: 1123 },
};

export const FONTES: Record<Fonte, { rotulo: string; css: string; largura: number }> = {
  calibri: { rotulo: "Calibri", css: "Calibri, Carlito, 'Segoe UI', Inter, sans-serif", largura: 0.5 },
  arial: { rotulo: "Arial", css: "Arial, Helvetica, 'Liberation Sans', sans-serif", largura: 0.56 },
  serif: { rotulo: "Serifada", css: "Georgia, 'Times New Roman', serif", largura: 0.55 },
  condensada: { rotulo: "Condensada", css: "'Arial Narrow', 'Roboto Condensed', 'Liberation Sans Narrow', sans-serif", largura: 0.44 },
};

export const POLITICA_PADRAO =
  "Buscar a satisfação dos clientes, a proteção do meio ambiente e condições de trabalho seguras e saudáveis, atendendo aos requisitos dos clientes, normativos e legais, com foco na melhoria contínua dos nossos produtos e processos, na prevenção da poluição, na eliminação de perigos e na consulta e participação das pessoas, através de parcerias sólidas, oferecendo desenvolvimento e bem-estar social aos nossos colaboradores.";

/** O formato da placa de aviso de obra (fundo escuro com foto, logo, "OBRA:", quadro com borda e a política no rodapé). */
export const CONFIG_EXEMPLO: ConfigPlaca = {
  orientacao: "paisagem",
  fundo: { cor: "#1f2937", escurecer: 0.62 },
  logo: { ativo: true, altura: 90 },
  cabecalho: { ativo: true, rotulo: "OBRA:" },
  painel: { cor: "#ffffff", raio: 60 },
  quadro: { borda: true, corBorda: "#4b5563", corTexto: "#000000", fonte: "calibri", negrito: true, alinhamento: "center", tamanho: 0 },
  rodape: { ativo: true, titulo: "Política do Sistema de Gestão", texto: POLITICA_PADRAO, cor: "#262626", corTexto: "#ffffff", tamanho: 12 },
};

export const VALORES_EXEMPLO: ValoresPlaca = {
  cabecalho: "NEXT GUARULHOS",
  linhas: ["Viga barrote sem madeira", "Aprumadores de pilar", "Escoramento suporte p/guarda corpo"],
  rodape: "",
};

const COR = /^#[0-9a-fA-F]{6}$/;
const cor = (v: unknown, padrao: string) => (typeof v === "string" && COR.test(v) ? v : padrao);
const num = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const txt = (v: unknown, max: number, padrao = "") => (typeof v === "string" ? v.slice(0, max) : padrao);
const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Lê o formato salvo (do servidor ou de uma versão antiga), completando o que faltar com o exemplo. */
export function lerConfig(bruto: unknown): ConfigPlaca {
  const b = obj(bruto), e = CONFIG_EXEMPLO;
  const f = obj(b.fundo), l = obj(b.logo), c = obj(b.cabecalho), p = obj(b.painel), q = obj(b.quadro), r = obj(b.rodape);
  return {
    orientacao: b.orientacao === "retrato" ? "retrato" : "paisagem",
    fundo: { cor: cor(f.cor, e.fundo.cor), escurecer: num(f.escurecer, 0, 0.95, e.fundo.escurecer) },
    logo: { ativo: bool(l.ativo, e.logo.ativo), altura: num(l.altura, 30, 200, e.logo.altura) },
    cabecalho: { ativo: bool(c.ativo, e.cabecalho.ativo), rotulo: txt(c.rotulo, 40, e.cabecalho.rotulo) },
    painel: { cor: cor(p.cor, e.painel.cor), raio: num(p.raio, 0, 120, e.painel.raio) },
    quadro: {
      borda: bool(q.borda, e.quadro.borda), corBorda: cor(q.corBorda, e.quadro.corBorda), corTexto: cor(q.corTexto, e.quadro.corTexto),
      fonte: typeof q.fonte === "string" && q.fonte in FONTES ? (q.fonte as Fonte) : e.quadro.fonte,
      negrito: bool(q.negrito, e.quadro.negrito),
      alinhamento: q.alinhamento === "left" || q.alinhamento === "right" ? q.alinhamento : "center",
      tamanho: num(q.tamanho, 0, 160, 0),
    },
    rodape: {
      ativo: bool(r.ativo, e.rodape.ativo), titulo: txt(r.titulo, 80, e.rodape.titulo), texto: txt(r.texto, 1500, e.rodape.texto),
      cor: cor(r.cor, e.rodape.cor), corTexto: cor(r.corTexto, e.rodape.corTexto), tamanho: num(r.tamanho, 8, 24, e.rodape.tamanho),
    },
  };
}

/** Lê os textos salvos de uma placa. */
export function lerValores(bruto: unknown): ValoresPlaca {
  const b = obj(bruto);
  const linhas = Array.isArray(b.linhas) ? b.linhas.filter((x): x is string => typeof x === "string").map(x => x.slice(0, 200)).slice(0, 12) : [];
  return { cabecalho: txt(b.cabecalho, 80), linhas, rodape: txt(b.rodape, 1500) };
}

/** Texto do textarea → linhas da placa (linhas vazias saem). */
export const linhasDoTexto = (texto: string) => texto.split("\n").map(l => l.trim()).filter(Boolean).slice(0, 12);

export interface Caixa { x: number; y: number; w: number; h: number }
export interface LayoutPlaca { folha: { largura: number; altura: number }; logo: Caixa | null; cabecalho: Caixa | null; painel: Caixa; quadro: Caixa; rodape: Caixa | null }

/** Onde cada parte fica na folha (px a 96 dpi), conforme a orientação e as partes ligadas. */
export function layoutPlaca(c: ConfigPlaca): LayoutPlaca {
  const folha = FOLHA[c.orientacao];
  const { largura: W, altura: H } = folha;
  const topo = c.logo.ativo || c.cabecalho.ativo;
  if (c.orientacao === "paisagem") {
    const painel: Caixa = topo ? { x: 58, y: 148, w: W - 108, h: H - 188 } : { x: 58, y: 40, w: W - 108, h: H - 80 };
    const rodape: Caixa | null = c.rodape.ativo ? { x: painel.x + 32, y: painel.y + painel.h - 178, w: painel.w - 64, h: 140 } : null;
    const baixo = rodape ? rodape.y - 20 : painel.y + painel.h - 60;
    const altoQuadro = Math.min(265, baixo - (painel.y + 60));
    const quadro: Caixa = rodape
      ? { x: painel.x + 82, y: baixo - altoQuadro, w: painel.w - 164, h: altoQuadro }
      : { x: painel.x + 82, y: painel.y + 70, w: painel.w - 164, h: painel.h - 140 };
    return {
      folha,
      logo: c.logo.ativo ? { x: 55, y: Math.max(8, 70 - c.logo.altura / 2), w: 330, h: c.logo.altura } : null,
      cabecalho: c.cabecalho.ativo ? { x: c.logo.ativo ? 402 : 58, y: 30, w: c.logo.ativo ? 590 : W - 108, h: 78 } : null,
      painel, quadro, rodape,
    };
  }
  // retrato: logo no alto, cabeçalho logo abaixo, painel até embaixo
  const yCab = c.logo.ativo ? 40 + c.logo.altura + 16 : 40;
  const cabecalho: Caixa | null = c.cabecalho.ativo ? { x: 50, y: yCab, w: W - 100, h: 78 } : null;
  const yPainel = cabecalho ? cabecalho.y + cabecalho.h + 30 : topo ? yCab + 10 : 40;
  const painel: Caixa = { x: 40, y: yPainel, w: W - 80, h: H - yPainel - 40 };
  const rodape: Caixa | null = c.rodape.ativo ? { x: painel.x + 28, y: painel.y + painel.h - 210, w: painel.w - 56, h: 180 } : null;
  const fim = rodape ? rodape.y - 30 : painel.y + painel.h - 50;
  const quadro: Caixa = { x: painel.x + 50, y: painel.y + 60, w: painel.w - 100, h: fim - (painel.y + 60) };
  return { folha, logo: c.logo.ativo ? { x: 50, y: 40, w: W - 100, h: c.logo.altura } : null, cabecalho, painel, quadro, rodape };
}

/**
 * Tamanho da letra do quadro: o fixo do modelo ou, no automático, o maior que cabe (a linha mais comprida na largura e
 * todas as linhas na altura), entre 14 e 110 px.
 */
export function tamanhoDoTexto(c: ConfigPlaca, linhas: string[], quadro: Caixa): number {
  if (c.quadro.tamanho > 0) return c.quadro.tamanho;
  const n = Math.max(1, linhas.length);
  const maior = Math.max(8, ...linhas.map(l => l.length));
  const porLargura = (quadro.w * 0.9) / (maior * FONTES[c.quadro.fonte].largura * (c.quadro.negrito ? 1.08 : 1));
  const porAltura = (quadro.h * 0.86) / (n * 1.45);
  return Math.round(Math.max(14, Math.min(110, porLargura, porAltura)));
}

/** Nome do arquivo baixado: placa-viga-barrote-sem-madeira.png. */
export function nomeArquivoPlaca(titulo: string, extensao: "png" | "pdf"): string {
  const base = titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "placa";
  return `placa-${base}.${extensao}`;
}
