/**
 * Repertório v7: as músicas e as criações também ficam na conta, para abrir em qualquer aparelho. O aparelho
 * continua com a cópia local (abre rápido e funciona sem internet); aqui fica a parte pura: como a música vira os
 * dados da conta e volta, e o que subir ou baixar quando as duas listas se encontram. A comparação usa sempre o
 * relógio do aparelho que mexeu por último (`atualizadaEm` vai dentro dos dados), nunca o do servidor.
 */
import type { Musica } from "./repertorioDb.ts";
import { lerProjeto, type Projeto } from "./estudio.ts";
import { lerEscrita } from "./escritaCifra.ts";

/** Áudio até 15 MB vai para a conta (o mesmo limite do servidor); acima disso fica só no aparelho. */
export const MAX_AUDIO_CONTA = 15 * 1024 * 1024;

/** Resumo de uma música como a conta devolve na lista. */
export interface MusicaConta {
  cdChave: string;
  nmTitulo: string;
  nmArtista: string;
  nmArquivo: string;
  nrTamanhoBytes: number;
  nrDuracao: number;
  nmTom?: string | null;
  nrBpm?: number | null;
  cdProjeto?: string | null;
  idArquivo?: number | null;
  dhAlteracao?: string;
  txDados?: string;
}

export interface ProjetoConta { cdChave: string; nmTitulo: string; dhAlteracao?: string; txDados?: string }

/** Corpo do PUT da música: os campos de lista e, em JSON, o resto. */
export function musicaParaConta(m: Musica, nomeTom: string | null) {
  return {
    nmTitulo: m.titulo,
    nmArtista: m.artista,
    nmArquivo: m.nomeArquivo,
    nrDuracao: Math.max(0, Math.round(m.duracao * 100) / 100),
    nmTom: nomeTom,
    nrBpm: m.analise ? Math.round(Math.min(400, Math.max(0, m.analise.bpm)) * 100) / 100 : null,
    cdProjeto: m.projeto ?? null,
    txDados: JSON.stringify({ analise: m.analise, cifra: m.cifra, tempos: m.tempos, ajustes: m.ajustes, criadaEm: m.criadaEm, atualizadaEm: m.atualizadaEm, tamanho: m.tamanho, ...(m.escrita ? { escrita: m.escrita } : {}) }),
  };
}

/** Música da conta (com ou sem os dados) como o aparelho guarda. `base` são os ajustes padrão. */
export function musicaDaConta(c: MusicaConta, base: Musica["ajustes"]): Musica {
  let d: Record<string, unknown> = {};
  try { const v: unknown = c.txDados ? JSON.parse(c.txDados) : {}; if (v && typeof v === "object" && !Array.isArray(v)) d = v as Record<string, unknown>; } catch { /* dados quebrados: fica só o resumo */ }
  const agora = new Date(0).toISOString();
  const texto = (v: unknown, p: string) => (typeof v === "string" ? v : p);
  return {
    id: c.cdChave,
    titulo: c.nmTitulo,
    artista: c.nmArtista ?? "",
    criadaEm: texto(d.criadaEm, agora),
    // sem os dados, a data é a mais antiga possível: qualquer cópia local com dados vence
    atualizadaEm: texto(d.atualizadaEm, agora),
    nomeArquivo: c.nmArquivo ?? "",
    tamanho: typeof d.tamanho === "number" ? d.tamanho : c.nrTamanhoBytes ?? 0,
    duracao: Number(c.nrDuracao) || 0,
    analise: (d.analise as Musica["analise"]) ?? null,
    cifra: texto(d.cifra, ""),
    tempos: Array.isArray(d.tempos) ? (d.tempos as Musica["tempos"]) : null,
    ajustes: { ...base, ...(d.ajustes && typeof d.ajustes === "object" ? (d.ajustes as Partial<Musica["ajustes"]>) : {}) },
    projeto: c.cdProjeto ?? undefined,
    sincronizada: true,
    ...(d.escrita ? { escrita: lerEscrita(d.escrita) } : {}),
  };
}

/** A marca `sincronizado` é só do aparelho: não vai para a conta. */
export function projetoParaConta(p: Projeto) {
  const resto: Partial<Projeto> = { ...p };
  delete resto.sincronizado;
  return { nmTitulo: p.titulo, txDados: JSON.stringify(resto) };
}

export function projetoDaConta(c: ProjetoConta): Projeto | null {
  try { return c.txDados ? lerProjeto({ ...JSON.parse(c.txDados), id: c.cdChave, sincronizado: true }) : null; } catch { return null; }
}

export interface PlanoMusicas {
  /** Só no aparelho: subir dados (e áudio, se couber). */
  subir: string[];
  /** Só na conta: trazer para a lista do aparelho (os dados vêm ao abrir). */
  trazer: MusicaConta[];
  /** Nos dois lugares: o áudio está no aparelho mas não na conta (subir só o áudio). */
  subirAudio: string[];
  /** Ficam só no aparelho porque o áudio passa do limite. */
  soNoAparelho: string[];
  /** Já estiveram na conta e sumiram de lá: foram excluídas em outro aparelho. */
  apagar: string[];
}

/**
 * O que fazer quando a lista do aparelho encontra a da conta. Músicas geradas no estúdio (com `projeto`) não sobem
 * o áudio: ele é refeito a partir da criação.
 */
export function planoMusicas(locais: Musica[], conta: MusicaConta[], audioLocal: (id: string) => boolean): PlanoMusicas {
  const naConta = new Map(conta.map(c => [c.cdChave, c]));
  const noAparelho = new Set(locais.map(m => m.id));
  const plano: PlanoMusicas = { subir: [], trazer: conta.filter(c => !noAparelho.has(c.cdChave)), subirAudio: [], soNoAparelho: [], apagar: [] };
  for (const m of locais) {
    const c = naConta.get(m.id);
    if (!c && m.sincronizada) { plano.apagar.push(m.id); continue; }
    const grande = !m.projeto && m.tamanho > MAX_AUDIO_CONTA;
    if (grande) plano.soNoAparelho.push(m.id);
    if (!c) { if (!grande) plano.subir.push(m.id); continue; }
    if (!m.projeto && !grande && !c.idArquivo && audioLocal(m.id)) plano.subirAudio.push(m.id);
  }
  return plano;
}

/** Qual versão vale quando a música está nos dois lugares: a que foi mexida por último. */
export const maisNova = <T extends { atualizadaEm: string }>(local: T, conta: T) => (conta.atualizadaEm > local.atualizadaEm ? conta : local);

export interface PlanoProjetos { subir: string[]; trazer: string[]; apagar: string[] }

/** Criações: só no aparelho sobem; só na conta descem (nos dois lugares, vale a mais nova ao abrir). */
export function planoProjetos(locais: Projeto[], conta: ProjetoConta[]): PlanoProjetos {
  const naConta = new Set(conta.map(c => c.cdChave));
  const noAparelho = new Set(locais.map(p => p.id));
  return {
    subir: locais.filter(p => !naConta.has(p.id) && !p.sincronizado).map(p => p.id),
    apagar: locais.filter(p => !naConta.has(p.id) && p.sincronizado).map(p => p.id),
    trazer: conta.filter(c => !noAparelho.has(c.cdChave)).map(c => c.cdChave),
  };
}

/** "45 MB de 300 MB". */
export function textoDoUso(usados: number, cota: number): string {
  const mb = (b: number) => (b >= 1024 * 1024 * 10 ? Math.round(b / (1024 * 1024)) : Math.round((b / (1024 * 1024)) * 10) / 10);
  return `${mb(usados).toLocaleString("pt-BR")} MB de ${mb(cota).toLocaleString("pt-BR")} MB`;
}
