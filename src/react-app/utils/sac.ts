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

/** Nome do arquivo de cada print no ZIP: imagens/chamado-12-1.png. */
export const nomeImagemExportada = (idChamado: number, ordem: number, mime: string) =>
  `imagens/chamado-${idChamado}-${ordem}.${/png/.test(mime) ? "png" : "jpg"}`;

/**
 * O texto dos chamados exportados (Markdown): um bloco por chamado com status, quem abriu, tela, data, descrição,
 * resposta e os prints (com o caminho dentro do ZIP), pronto para mandar para quem vai fazer as mudanças.
 */
export function textoExportacao(chamados: ChamadoExportado[], imagens: Map<number, string[]>, geradoEm: string): string {
  const linhas = [`# Chamados do SAC — NordTool`, ``, `${chamados.length} chamado(s) · exportado em ${data(geradoEm)}`, ``];
  for (const c of chamados) {
    linhas.push(`## #${c.id} — ${c.nmTitulo}`, ``);
    linhas.push(`- **Status:** ${rotuloStatus(c.cdStatus)}`);
    linhas.push(`- **Aberto por:** ${c.nmUsuario} em ${data(c.dhCriacao)}`);
    if (c.txTela) linhas.push(`- **Tela:** ${c.txTela}`);
    linhas.push(``, `### O que precisa mudar`, ``, c.txDescricao.trim(), ``);
    if (c.txResposta) linhas.push(`### Resposta${c.nmUsuarioResposta ? ` (${c.nmUsuarioResposta})` : ""}`, ``, c.txResposta.trim(), ``);
    const arquivos = imagens.get(c.id) ?? [];
    if (arquivos.length) {
      linhas.push(`### Prints`, ``);
      arquivos.forEach((a, i) => linhas.push(`![Print ${i + 1} do chamado #${c.id}](${a})`));
      linhas.push(``);
    }
  }
  return linhas.join("\n");
}

/** Nome do ZIP: chamados-sac-2026-11-04.zip. */
export const nomeZipChamados = (hoje: string) => `chamados-sac-${hoje}.zip`;
