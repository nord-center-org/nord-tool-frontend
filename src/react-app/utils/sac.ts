/** Regras puras do SAC (sem React, testáveis em node). */

export type StatusChamado = "ABERTO" | "EM_ANDAMENTO" | "RESOLVIDO" | "RECUSADO";

export const STATUS_CHAMADO: { status: StatusChamado; rotulo: string; classe: string }[] = [
  { status: "ABERTO", rotulo: "Aberto", classe: "bg-blue-100 text-blue-700" },
  { status: "EM_ANDAMENTO", rotulo: "Em andamento", classe: "bg-amber-100 text-amber-800" },
  { status: "RESOLVIDO", rotulo: "Resolvido", classe: "bg-emerald-100 text-emerald-700" },
  { status: "RECUSADO", rotulo: "Recusado", classe: "bg-slate-200 text-slate-700" },
];

export const rotuloStatus = (s: string) => STATUS_CHAMADO.find(x => x.status === s)?.rotulo ?? s;
export const classeStatus = (s: string) => STATUS_CHAMADO.find(x => x.status === s)?.classe ?? "bg-slate-100 text-slate-600";

export const MAX_TITULO = 120;
export const MAX_DESCRICAO = 4000;
export const MAX_PRINTS = 6;
/** O servidor aceita até 5 MB por imagem; acima disso a imagem é reduzida antes de enviar. */
export const MAX_BYTES_PRINT = 4.8 * 1024 * 1024;

export interface RascunhoChamado { titulo: string; descricao: string }

/** O que falta para enviar (null = pode enviar). */
export function problemaDoRascunho(r: RascunhoChamado, prints: number): string | null {
  if (!r.titulo.trim()) return "Dê um título para o chamado.";
  if (r.titulo.trim().length > MAX_TITULO) return `O título deve ter no máximo ${MAX_TITULO} caracteres.`;
  if (!r.descricao.trim()) return "Descreva o que precisa mudar.";
  if (r.descricao.trim().length > MAX_DESCRICAO) return `A descrição deve ter no máximo ${MAX_DESCRICAO} caracteres.`;
  if (prints > MAX_PRINTS) return `No máximo ${MAX_PRINTS} imagens por chamado.`;
  return null;
}

export interface ChamadoResumo { cdStatus: string; dhCriacao: string }

/** Chamados em aberto primeiro (aberto, em andamento), depois os fechados; dentro de cada grupo, os mais novos. */
export function ordenarChamados<T extends ChamadoResumo>(lista: T[]): T[] {
  const peso = (s: string) => (s === "ABERTO" ? 0 : s === "EM_ANDAMENTO" ? 1 : 2);
  return [...lista].sort((a, b) => peso(a.cdStatus) - peso(b.cdStatus) || b.dhCriacao.localeCompare(a.dhCriacao));
}

/** Quantos chamados ainda esperam os administradores (aberto ou em andamento). */
export const pendentes = (lista: ChamadoResumo[]) => lista.filter(c => c.cdStatus === "ABERTO" || c.cdStatus === "EM_ANDAMENTO").length;

// ---------------------------------------------------------------- exportação

export interface ChamadoExportado {
  id: number; nmTitulo: string; txDescricao: string; txTela: string | null; cdStatus: string; txResposta: string | null;
  nmUsuario: string; nmUsuarioResposta: string | null; dhCriacao: string; imagens: number[];
}

const data = (iso: string) => {
  const [d, h] = iso.split("T");
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}${h ? ` ${h.slice(0, 5)}` : ""}`;
};

// ---------------------------------------------------------------- v4: exportação em PDF

/** Nome do PDF: chamados-sac-2026-11-04.pdf. */
export const nomePdfChamados = (hoje: string) => `chamados-sac-${hoje}.pdf`;

/** Data e hora como no app ("04/11/2026 15:30"). */
export const dataChamado = data;

/** Caracteres extras do Windows-1252 (o que a fonte padrão do PDF sabe escrever além do Latin-1). */
const CP1252 = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Deixa o texto escrevível pela fonte padrão do PDF: emojis e símbolos de fora viram "?", tabs viram espaços. */
export function paraFontePdf(texto: string): string {
  let r = "";
  for (const ch of texto.replace(/\r\n?/g, "\n").replace(/\t/g, "  ")) {
    const c = ch.codePointAt(0)!;
    if (ch === "\n" || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || CP1252.includes(ch)) r += ch;
    else if (c >= 0x300 && c <= 0x36f) continue; // acento solto (já veio junto da letra no normalize)
    else r += "?";
  }
  return r;
}

/**
 * Quebra o texto em linhas que cabem em `largura` (medida por `medir`), respeitando as quebras de linha dele e
 * partindo palavras que sozinhas não cabem.
 */
export function quebrarTexto(texto: string, largura: number, medir: (t: string) => number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.normalize("NFC").split("\n")) {
    if (!paragrafo.trim()) { linhas.push(""); continue; }
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/).filter(Boolean)) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tentativa) <= largura) { atual = tentativa; continue; }
      if (atual) linhas.push(atual);
      // palavra maior que a linha: parte em pedaços
      let resto = palavra;
      while (medir(resto) > largura && resto.length > 1) {
        let n = resto.length - 1;
        while (n > 1 && medir(resto.slice(0, n)) > largura) n--;
        linhas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      atual = resto;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Tamanho da imagem para caber em maxL × maxA sem distorcer (nunca aumenta). */
export function encaixar(l: number, a: number, maxL: number, maxA: number): { l: number; a: number } {
  if (l <= 0 || a <= 0) return { l: 0, a: 0 };
  const f = Math.min(1, maxL / l, maxA / a);
  return { l: l * f, a: a * f };
}


// ---------------------------------------------------------------- botão do SAC (v3)

/** Primeiro nome, para a saudação ("Ana Maria Souza" → "Ana"). */
export const primeiroNome = (nome: string | null | undefined) => (nome ?? "").trim().split(/\s+/)[0]?.slice(0, 20) ?? "";

/** "Bom dia, Ana!" / "Boa tarde!" pela hora (0–23). */
export function saudacaoSac(nome: string | null | undefined, hora: number): string {
  const periodo = hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite";
  const n = primeiroNome(nome);
  return n ? `${periodo}, ${n}!` : `${periodo}!`;
}

/**
 * Onde o botão do SAC fica: escondido no próprio SAC; no Início, um pouco acima, para não cobrir o mascote das
 * novidades (que fica no canto); nas outras telas, no canto inferior direito.
 */
export function posicaoBotaoSac(caminho: string): "escondido" | "acima-do-mascote" | "canto" {
  if (caminho === "/sac" || caminho.startsWith("/sac/")) return "escondido";
  if (caminho === "/") return "acima-do-mascote";
  return "canto";
}
