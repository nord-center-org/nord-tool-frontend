import assert from "node:assert/strict";
import { test } from "node:test";

import { novoProjeto } from "./estudio.ts";
import { MAX_AUDIO_CONTA, maisNova, musicaDaConta, musicaParaConta, planoMusicas, planoProjetos, projetoDaConta, projetoParaConta, textoDoUso, type MusicaConta } from "./repertorioConta.ts";
import { AJUSTES_PADRAO, type Musica } from "./repertorioDb.ts";

const musica = (id: string, extra: Partial<Musica> = {}): Musica => ({
  id, titulo: "Canção", artista: "Banda", criadaEm: "2026-11-01T00:00:00Z", atualizadaEm: "2026-11-02T00:00:00Z", nomeArquivo: "c.mp3",
  tamanho: 5_000_000, duracao: 180.456, analise: null, cifra: "G D", tempos: [0, null], ajustes: { ...AJUSTES_PADRAO, semitons: 2 }, ...extra,
});
const conta = (chave: string, extra: Partial<MusicaConta> = {}): MusicaConta => ({ cdChave: chave, nmTitulo: "Canção", nmArtista: "", nmArquivo: "c.mp3", nrTamanhoBytes: 0, nrDuracao: 0, ...extra });

test("v7: música vai para a conta e volta igual", () => {
  const m = musica("m1", { projeto: "p1" });
  const corpo = musicaParaConta(m, "G");
  assert.equal(corpo.nrDuracao, 180.46);
  assert.equal(corpo.nmTom, "G");
  assert.equal(corpo.nrBpm, null);
  assert.equal(corpo.cdProjeto, "p1");
  const volta = musicaDaConta({ ...conta("m1"), nmTitulo: m.titulo, nmArtista: m.artista, nrDuracao: 180.46, cdProjeto: "p1", txDados: corpo.txDados }, AJUSTES_PADRAO);
  assert.equal(volta.cifra, "G D");
  assert.deepEqual(volta.tempos, [0, null]);
  assert.equal(volta.ajustes.semitons, 2);
  assert.equal(volta.atualizadaEm, m.atualizadaEm);
  assert.equal(volta.tamanho, 5_000_000);
  assert.equal(volta.projeto, "p1");
  assert.equal(volta.sincronizada, true);
});

test("v7: resumo sem dados ou com dados quebrados vira música sem análise e mais antiga", () => {
  const r = musicaDaConta(conta("m9", { txDados: "{quebrado", nrDuracao: 12 }), AJUSTES_PADRAO);
  assert.equal(r.analise, null);
  assert.equal(r.duracao, 12);
  assert.equal(r.atualizadaEm, new Date(0).toISOString());
  assert.deepEqual(r.ajustes, AJUSTES_PADRAO);
  assert.equal(r.projeto, undefined);
  assert.equal(musicaDaConta(conta("m8", { txDados: "[1]" }), AJUSTES_PADRAO).cifra, "");
});

test("v7: plano de sincronização das músicas", () => {
  const locais = [musica("a"), musica("b"), musica("c", { tamanho: MAX_AUDIO_CONTA + 1 }), musica("d", { projeto: "p", tamanho: 50_000_000 }), musica("e")];
  const naConta = [conta("b", { idArquivo: null }), conta("e", { idArquivo: 3 }), conta("z")];
  const p = planoMusicas(locais, naConta, id => id !== "x");
  assert.deepEqual(p.subir, ["a", "d"], "só no aparelho sobem (a do estúdio também, sem áudio)");
  assert.deepEqual(p.trazer.map(c => c.cdChave), ["z"]);
  assert.deepEqual(p.subirAudio, ["b"], "na conta sem áudio, e o aparelho tem");
  assert.deepEqual(p.soNoAparelho, ["c"]);
  assert.deepEqual(planoMusicas([musica("b")], [conta("b")], () => false).subirAudio, [], "sem áudio no aparelho não há o que subir");
  const excluida = planoMusicas([musica("f", { sincronizada: true }), musica("g")], [], () => true);
  assert.deepEqual(excluida.apagar, ["f"], "já esteve na conta e sumiu: excluída em outro aparelho");
  assert.deepEqual(excluida.subir, ["g"]);
});

test("v7: vale a versão mexida por último", () => {
  const a = { atualizadaEm: "2026-11-02T00:00:00Z", v: "aparelho" }, b = { atualizadaEm: "2026-11-03T00:00:00Z", v: "conta" };
  assert.equal(maisNova(a, b).v, "conta");
  assert.equal(maisNova(b, a).v, "conta");
  assert.equal(maisNova(a, { ...a, v: "igual" }).v, "aparelho", "empate fica com o do aparelho");
});

test("v7: criações vão e voltam", () => {
  const p = { ...novoProjeto("Samba", "2026-11-01T00:00:00Z"), id: "p1", bpm: 90 };
  const corpo = projetoParaConta(p);
  assert.equal(corpo.nmTitulo, "Samba");
  const volta = projetoDaConta({ cdChave: "p1", nmTitulo: "Samba", txDados: corpo.txDados });
  assert.equal(volta?.bpm, 90);
  assert.equal(volta?.id, "p1");
  assert.equal(projetoDaConta({ cdChave: "p2", nmTitulo: "x" }), null);
  assert.equal(projetoDaConta({ cdChave: "p2", nmTitulo: "x", txDados: "{" }), null);
  const plano = planoProjetos([p, { ...p, id: "p3" }], [{ cdChave: "p1", nmTitulo: "" }, { cdChave: "p9", nmTitulo: "" }]);
  assert.deepEqual(plano, { subir: ["p3"], trazer: ["p9"], apagar: [] });
  assert.equal(volta?.sincronizado, true);
  assert.equal(JSON.parse(projetoParaConta({ ...p, sincronizado: true }).txDados).sincronizado, undefined, "a marca é só do aparelho");
  assert.deepEqual(planoProjetos([{ ...p, id: "p4", sincronizado: true }], []), { subir: [], trazer: [], apagar: ["p4"] }, "sumiu da conta: foi excluída em outro aparelho");
});

test("v7: texto do espaço usado", () => {
  assert.equal(textoDoUso(0, 300 * 1024 * 1024), "0 MB de 300 MB");
  assert.equal(textoDoUso(1.5 * 1024 * 1024, 300 * 1024 * 1024), "1,5 MB de 300 MB");
  assert.equal(textoDoUso(45.4 * 1024 * 1024, 300 * 1024 * 1024), "45 MB de 300 MB");
});
