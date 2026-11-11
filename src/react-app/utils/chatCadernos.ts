/**
 * Chat dos cadernos (Bloco de notas v4): a Lugia responde com base no Bloco de notas da pessoa e, quando ela pede
 * para fazer algo, termina a resposta com um bloco ```nordtool-acoes``` (lista JSON). Aqui: separar o texto das
 * ações, validar cada uma e descrever para o botão "Fazer". Nada é executado sem a pessoa confirmar.
 */
import { normalizarFormula, numeroPtBr, planilhaVazia, type AbaFs, type CelulaComPosicao } from "./planilha.ts";

export type TipoItem = "caderno" | "planilha" | "documento";

export type AcaoCaderno =
  | { acao: "abrir"; tipo: TipoItem; id: number; pagina?: number }
  | { acao: "criar_caderno"; titulo: string; texto?: string }
  | { acao: "anotar"; id: number; texto: string }
  | { acao: "criar_documento"; titulo: string; html: string }
  | { acao: "criar_planilha"; titulo: string; linhas: (string | number | boolean | null)[][] }
  | { acao: "renomear"; tipo: TipoItem; id: number; titulo: string };

const MARCA = "```nordtool-acoes";
const TIPOS: TipoItem[] = ["caderno", "planilha", "documento"];
export const MAX_ACOES = 10;
const MAX_LINHAS = 2000;
const MAX_COLUNAS = 100;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const inteiro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v > 0 ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const tipoItem = (v: unknown): TipoItem | null => (typeof v === "string" && TIPOS.includes(v.toLowerCase() as TipoItem) ? (v.toLowerCase() as TipoItem) : null);

/** Uma ação vinda da IA → ação válida (ou null, que a tela ignora). Corta textos longos e números inválidos. */
export function validarAcao(bruta: unknown): AcaoCaderno | null {
  if (!bruta || typeof bruta !== "object") return null;
  const a = bruta as Record<string, unknown>;
  switch (a.acao) {
    case "abrir": {
      const tipo = tipoItem(a.tipo), id = inteiro(a.id), pagina = inteiro(a.pagina);
      if (!tipo || !id) return null;
      return tipo === "caderno" && pagina ? { acao: "abrir", tipo, id, pagina } : { acao: "abrir", tipo, id };
    }
    case "criar_caderno": {
      const titulo = texto(a.titulo, 200) || "Caderno sem título";
      const t = texto(a.texto, 5000);
      return t ? { acao: "criar_caderno", titulo, texto: t } : { acao: "criar_caderno", titulo };
    }
    case "anotar": {
      const id = inteiro(a.id ?? a.idCaderno), t = texto(a.texto, 5000);
      return id && t ? { acao: "anotar", id, texto: t } : null;
    }
    case "criar_documento": {
      const html = texto(a.html, 500_000);
      return html ? { acao: "criar_documento", titulo: texto(a.titulo, 200) || "Documento sem título", html } : null;
    }
    case "criar_planilha": {
      if (!Array.isArray(a.linhas)) return null;
      const linhas = a.linhas.slice(0, MAX_LINHAS).filter(Array.isArray).map(l => (l as unknown[]).slice(0, MAX_COLUNAS).map(v =>
        typeof v === "number" || typeof v === "boolean" ? v : v == null ? null : String(v).slice(0, 5000)));
      return linhas.length ? { acao: "criar_planilha", titulo: texto(a.titulo, 200) || "Planilha sem título", linhas } : null;
    }
    case "renomear": {
      const tipo = tipoItem(a.tipo), id = inteiro(a.id), titulo = texto(a.titulo, 200);
      return tipo && id && titulo ? { acao: "renomear", tipo, id, titulo } : null;
    }
    default:
      return null;
  }
}

/**
 * Tira os blocos de ações do texto. Enquanto a resposta chega, um bloco ainda aberto some do texto (a pessoa não vê
 * o JSON pela metade) e `pendente` fica true.
 */
export function separarAcoes(resposta: string): { texto: string; acoes: AcaoCaderno[]; pendente: boolean } {
  const acoes: AcaoCaderno[] = [];
  let resto = resposta;
  let pendente = false;
  let saida = "";
  for (;;) {
    const i = resto.indexOf(MARCA);
    if (i < 0) { saida += resto; break; }
    saida += resto.slice(0, i);
    const depois = resto.slice(i + MARCA.length);
    const fim = depois.indexOf("```");
    if (fim < 0) { pendente = true; break; }
    try {
      const lista: unknown = JSON.parse(depois.slice(0, fim));
      for (const item of Array.isArray(lista) ? lista : [lista]) {
        const a = validarAcao(item);
        if (a && acoes.length < MAX_ACOES) acoes.push(a);
      }
    } catch {
      // JSON estragado: o bloco só some.
    }
    resto = depois.slice(fim + 3);
  }
  return { texto: saida.replace(/\n{3,}/g, "\n\n").trim(), acoes, pendente };
}

export interface ItemConhecido { tipo: TipoItem; id: number; titulo: string }

const NOME: Record<TipoItem, string> = { caderno: "o caderno", planilha: "a planilha", documento: "o documento" };

/** Frase do botão: "Abrir o caderno “Obra Jardim”, página 3". */
export function descreverAcao(a: AcaoCaderno, itens: ItemConhecido[]): string {
  const nome = (tipo: TipoItem, id: number) => {
    const item = itens.find(i => i.tipo === tipo && i.id === id);
    return item ? `${NOME[tipo]} “${item.titulo}”` : `${NOME[tipo]} nº ${id}`;
  };
  switch (a.acao) {
    case "abrir": return `Abrir ${nome(a.tipo, a.id)}${a.pagina ? `, página ${a.pagina}` : ""}`;
    case "criar_caderno": return `Criar o caderno “${a.titulo}”${a.texto ? " com o texto" : ""}`;
    case "anotar": return `Anotar numa página nova d${nome("caderno", a.id)}`;
    case "criar_documento": return `Criar o documento “${a.titulo}”`;
    case "criar_planilha": return `Criar a planilha “${a.titulo}” (${a.linhas.length} linha${a.linhas.length === 1 ? "" : "s"})`;
    case "renomear": return `Renomear ${nome(a.tipo, a.id)} para “${a.titulo}”`;
  }
}

/** A ação mexe em algo que não existe na lista da pessoa? (id inventado pela IA). */
export function idDesconhecido(a: AcaoCaderno, itens: ItemConhecido[]): boolean {
  if (a.acao === "abrir" || a.acao === "renomear") return !itens.some(i => i.tipo === a.tipo && i.id === a.id);
  if (a.acao === "anotar") return !itens.some(i => i.tipo === "caderno" && i.id === a.id);
  return false;
}

/**
 * Linhas da IA → abas do editor. Fórmulas em português viram as do editor; "30,5" vira número; o resto é texto.
 * O editor recalcula as fórmulas ao abrir.
 */
export function linhasParaAbas(linhas: (string | number | boolean | null)[][]): AbaFs[] {
  const celldata: CelulaComPosicao[] = [];
  let colunas = 0;
  linhas.forEach((linha, r) => linha.forEach((valor, c) => {
    if (valor === null || valor === "") return;
    colunas = Math.max(colunas, c + 1);
    if (typeof valor === "string" && valor.startsWith("=")) {
      celldata.push({ r, c, v: { f: normalizarFormula(valor), v: null, m: "" } });
      return;
    }
    const numero = typeof valor === "number" ? valor : numeroPtBr(valor);
    if (numero !== null) celldata.push({ r, c, v: { v: numero, m: String(numero).replace(".", ","), ct: { fa: "General", t: "n" } } });
    else if (typeof valor === "boolean") celldata.push({ r, c, v: { v: valor, m: valor ? "VERDADEIRO" : "FALSO", ct: { fa: "General", t: "b" } } });
    else celldata.push({ r, c, v: { v: valor, m: valor, ct: { fa: "General", t: "g" }, ...(r === 0 ? { bl: 1 } : {}) } });
  }));
  const [aba] = planilhaVazia();
  return [{ ...aba, row: Math.max(100, linhas.length + 20), column: Math.max(26, colunas + 5), celldata }];
}

/** HTML da IA só com o básico (o documento passa ainda pelo sanitizador do editor ao abrir). */
export function textoParaHtml(t: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Conteúdo de página com o texto numa caixa de texto no alto (margem de 48 pt), para "anotar" e "criar_caderno". */
export function paginaComTexto(t: string, largura: number, id = `ia-${Date.now().toString(36)}`): { v: 1; itens: [{ t: "tx"; id: string; x: number; y: number; w: number; s: number; c: string; txt: string }] } {
  return { v: 1, itens: [{ t: "tx", id, x: 48, y: 48, w: Math.max(120, largura - 96), s: 16, c: "#0f172a", txt: t.slice(0, 5000) }] };
}
