/**
 * Repertório v7: junta o aparelho (IndexedDB) e a conta (servidor). O aparelho abre na hora com o que tem; a conta
 * completa a lista (músicas e criações de outros aparelhos), recebe o que só está aqui e guarda cada mudança. Sem
 * internet ou sem conta, tudo continua funcionando só no aparelho.
 */
import { renderizarProjeto } from "@/react-app/components/repertorio/tocadorEstudio";
import { repertorioService as conta } from "@/react-app/services/RepertorioService";
import {
  MAX_AUDIO_CONTA, autorias, maisNova, musicaDaConta, musicaParaConta, planoMusicas, planoProjetos, projetoDaConta, projetoParaConta, type MusicaConta,
} from "@/react-app/utils/musica/repertorioConta";
import {
  AJUSTES_PADRAO, excluirMusica as excluirLocal, excluirProjeto as excluirProjetoLocal, idsComArquivo, lerArquivo, lerProjetoLocal, listarMusicas,
  listarProjetos, salvarArquivo, salvarMusica, salvarProjeto, type Musica,
} from "@/react-app/utils/musica/repertorioDb";
import type { Projeto } from "@/react-app/utils/musica/estudio";
import type { Autoria } from "@/react-app/utils/musica/repertorioConta";
import { nomeDoTom } from "@/react-app/utils/musica/teoria";

/** Mudanças guardadas no aparelho que ainda vão para a conta (juntadas por `guardarNaConta`). */
const esperando = new Map<string, number>();

export type SituacaoConta = "na-conta" | "enviando" | "so-aparelho" | "falhou";

const tomDe = (m: Musica) => (m.analise ? nomeDoTom(m.analise.tom).cifra : null);

/** Envia os dados (e o áudio, se couber e ainda não estiver lá) de uma música do aparelho. */
export async function enviarMusica(m: Musica, comAudio: boolean): Promise<SituacaoConta> {
  await conta.salvarMusica(m.id, musicaParaConta(m, tomDe(m)));
  if (!m.sincronizada) await salvarMusica({ ...m, sincronizada: true }, true).catch(() => undefined);
  if (!comAudio || m.projeto) return "na-conta";
  if (m.tamanho > MAX_AUDIO_CONTA) return "so-aparelho";
  const audio = await lerArquivo(m.id).catch(() => undefined);
  if (!audio) return "na-conta";
  if (audio.size > MAX_AUDIO_CONTA) return "so-aparelho";
  await conta.enviarAudio(m.id, audio, m.nomeArquivo || `${m.titulo}.mp3`);
  return "na-conta";
}

export interface ListaSincronizada {
  musicas: Musica[];
  situacao: Map<string, SituacaoConta>;
  /** Sem conta ou sem internet: só o que está no aparelho. */
  semConta: boolean;
  /** O que ainda vai subir (em segundo plano). */
  pendentes: string[];
  /** v16: quem criou cada música da conta (as que só estão no aparelho são de quem está vendo). */
  autoria: Map<string, Autoria>;
}

/** Lista do aparelho completada com a da conta. Devolve também o que falta subir, para `subirPendentes`. */
export async function sincronizarMusicas(): Promise<ListaSincronizada> {
  const locais = await listarMusicas();
  const situacao = new Map<string, SituacaoConta>();
  let naConta: MusicaConta[];
  try {
    naConta = await conta.listarMusicas();
  } catch {
    return { musicas: locais, situacao, semConta: true, pendentes: [], autoria: new Map() };
  }
  const comArquivo = await idsComArquivo().catch(() => new Set<string>());
  const plano = planoMusicas(locais, naConta, id => comArquivo.has(id));
  for (const c of plano.trazer) await salvarMusica(musicaDaConta(c, AJUSTES_PADRAO), true).catch(() => undefined);
  for (const id of plano.apagar) await excluirLocal(id).catch(() => undefined);
  // v16: a música pode ter sido editada por outra pessoa; o resto (cifra, ajustes) vem ao abrir, pela mais nova
  const porId = new Map(locais.map(m => [m.id, m]));
  for (const c of plano.renomear) {
    const m = porId.get(c.cdChave);
    // com uma mudança daqui ainda a caminho da conta, vale a daqui
    if (m && !esperando.has(m.id)) await salvarMusica({ ...m, titulo: c.nmTitulo, artista: c.nmArtista ?? "" }, true).catch(() => undefined);
  }
  for (const c of naConta) situacao.set(c.cdChave, "na-conta");
  for (const id of plano.soNoAparelho) situacao.set(id, "so-aparelho");
  const pendentes = [...plano.subir, ...plano.subirAudio];
  for (const id of pendentes) situacao.set(id, "enviando");
  return { musicas: await listarMusicas(), situacao, semConta: false, pendentes, autoria: autorias(naConta) };
}

/** Sobe, uma por vez, as músicas que só estão no aparelho (ou cujo áudio falta na conta). */
export async function subirPendentes(ids: string[], aoMudar: (id: string, s: SituacaoConta) => void) {
  const locais = new Map((await listarMusicas()).map(m => [m.id, m]));
  for (const id of ids) {
    const m = locais.get(id);
    if (!m) continue;
    try { aoMudar(id, await enviarMusica(m, true)); } catch { aoMudar(id, "falhou"); }
  }
}

/**
 * Abre a música: a versão mais nova entre o aparelho e a conta e o áudio — do aparelho, baixado da conta ou, se
 * veio do estúdio, refeito a partir da criação.
 */
export async function abrirMusica(m: Musica, semConta: boolean): Promise<{ musica: Musica; arquivo: Blob }> {
  let musica = m;
  let remota: MusicaConta | null = null;
  if (!semConta) {
    remota = await conta.abrirMusica(m.id).catch(() => null);
    if (remota) {
      const daConta = musicaDaConta(remota, AJUSTES_PADRAO);
      const vence = maisNova(m, daConta);
      if (vence === daConta) musica = await salvarMusica({ ...daConta, tamanho: daConta.tamanho || m.tamanho }, true);
      else if (!m.sincronizada) musica = await salvarMusica({ ...m, sincronizada: true }, true);
    }
  }
  let arquivo = await lerArquivo(musica.id).catch(() => undefined);
  if (!arquivo && remota?.idArquivo) {
    arquivo = await conta.baixarAudio(musica.id);
    await salvarArquivo(musica.id, arquivo).catch(() => undefined);
  }
  if (!arquivo && musica.projeto) {
    const p = await abrirProjeto(musica.projeto, semConta);
    if (p) {
      arquivo = await renderizarProjeto(p);
      await salvarArquivo(musica.id, arquivo).catch(() => undefined);
    }
  }
  if (!arquivo) throw new Error("O áudio dessa música não está neste aparelho nem na conta. Exclua e envie de novo.");
  return { musica, arquivo };
}

/** Guarda as mudanças (ajustes, cifra, análise) na conta, juntando as que chegam em sequência. */
export function guardarNaConta(m: Musica) {
  window.clearTimeout(esperando.get(m.id));
  esperando.set(m.id, window.setTimeout(() => {
    esperando.delete(m.id);
    void conta.salvarMusica(m.id, musicaParaConta(m, tomDe(m))).catch(() => undefined);
  }, 1500));
}

export async function excluirMusica(id: string) {
  window.clearTimeout(esperando.get(id));
  esperando.delete(id);
  await excluirLocal(id).catch(() => undefined);
  await conta.excluirMusica(id).catch(() => undefined);
}

// ---------------------------------------------------------------- criações do estúdio

export async function sincronizarProjetos(): Promise<{ projetos: Projeto[]; semConta: boolean; autoria: Map<string, Autoria> }> {
  const locais = await listarProjetos();
  let naConta;
  try { naConta = await conta.listarProjetos(); } catch { return { projetos: locais, semConta: true, autoria: new Map() }; }
  const plano = planoProjetos(locais, naConta);
  for (const chave of plano.trazer) {
    const c = await conta.abrirProjeto(chave).catch(() => null);
    const p = c ? projetoDaConta(c) : null;
    if (p) await salvarProjeto(p, true).catch(() => undefined);
  }
  for (const id of plano.apagar) await excluirProjetoLocal(id).catch(() => undefined);
  for (const id of plano.subir) {
    const p = locais.find(x => x.id === id);
    if (p) await enviarProjeto(p);
  }
  return { projetos: await listarProjetos(), semConta: false, autoria: autorias(naConta) };
}

/** A versão mais nova da criação (aparelho ou conta). */
export async function abrirProjeto(id: string, semConta: boolean): Promise<Projeto | null> {
  const local = await lerProjetoLocal(id).catch(() => null);
  if (semConta) return local;
  const c = await conta.abrirProjeto(id).catch(() => null);
  const remota = c ? projetoDaConta(c) : null;
  if (!remota) return local;
  if (!local || remota.atualizadoEm > local.atualizadoEm) return salvarProjeto(remota, true);
  return local;
}

/** Sobe a criação e marca no aparelho que ela já está na conta. */
async function enviarProjeto(p: Projeto) {
  try {
    await conta.salvarProjeto(p.id, projetoParaConta(p));
    if (!p.sincronizado) await salvarProjeto({ ...p, sincronizado: true }, true);
  } catch { /* fica para a próxima vez */ }
}

const esperandoProjeto = new Map<string, number>();
/** Salva no aparelho na hora e na conta logo depois (junta as mudanças seguidas). */
export async function guardarProjeto(p: Projeto): Promise<Projeto> {
  const salvo = await salvarProjeto(p);
  window.clearTimeout(esperandoProjeto.get(p.id));
  esperandoProjeto.set(p.id, window.setTimeout(() => {
    esperandoProjeto.delete(p.id);
    // excluída nesse meio-tempo: não sobe de novo
    void lerProjetoLocal(salvo.id).then(atual => { if (atual) void enviarProjeto(atual); });
  }, 1500));
  return salvo;
}

export async function excluirProjeto(id: string) {
  window.clearTimeout(esperandoProjeto.get(id));
  esperandoProjeto.delete(id);
  await excluirProjetoLocal(id).catch(() => undefined);
  await conta.excluirProjeto(id).catch(() => undefined);
}

export const usoDaConta = () => conta.uso();
