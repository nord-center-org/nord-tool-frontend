import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroCurto, partesDoVideo, problemaDoVideo, redeDoEstado, totaisDoPainel } from "./marketing.ts";

test("rede pela volta do login (state)", () => {
  assert.equal(redeDoEstado("7.INSTAGRAM.1700.abc.sig"), "INSTAGRAM");
  assert.equal(redeDoEstado("7.TIKTOK.1"), "TIKTOK");
  assert.equal(redeDoEstado("7.ORKUT.1"), null);
  assert.equal(redeDoEstado(""), null);
  assert.equal(redeDoEstado(null), null);
});

test("partes do envio do vídeo", () => {
  assert.deepEqual(partesDoVideo(10, 4), [[0, 4], [4, 8], [8, 10]]);
  assert.deepEqual(partesDoVideo(8, 4), [[0, 4], [4, 8]]);
  assert.deepEqual(partesDoVideo(0, 4), []);
  assert.deepEqual(partesDoVideo(5, 0), []);
});

test("números curtos", () => {
  assert.equal(numeroCurto(950), "950");
  assert.equal(numeroCurto(12_300), "12,3 mil");
  assert.equal(numeroCurto(1_000), "1 mil");
  assert.equal(numeroCurto(250_000), "250 mil");
  assert.equal(numeroCurto(4_560_000), "4,6 mi");
  assert.equal(numeroCurto(2_000_000_000), "2 bi");
  assert.equal(numeroCurto(null), "—");
  assert.equal(numeroCurto(undefined), "—");
});

test("totais do painel ignoram o que a rede não informou", () => {
  assert.deepEqual(totaisDoPainel([{ nrSeguidores: 10, nrViewsTotais: 100 }, { nrSeguidores: null, nrViewsTotais: 5 }]), { seguidores: 10, views: 105 });
  assert.deepEqual(totaisDoPainel([]), { seguidores: 0, views: 0 });
});

test("vídeo aceito: tipo, tamanho e WebM fora do Instagram", () => {
  assert.equal(problemaDoVideo({ type: "video/mp4", size: 10 }, ["INSTAGRAM"]), null);
  assert.match(problemaDoVideo({ type: "image/png", size: 10 }, [])!, /MP4/);
  assert.match(problemaDoVideo({ type: "video/mp4", size: 0 }, [])!, /vazio/);
  assert.match(problemaDoVideo({ type: "video/mp4", size: 600 * 1024 * 1024 }, [])!, /500 MB/);
  assert.match(problemaDoVideo({ type: "video/webm", size: 10 }, ["INSTAGRAM"])!, /WebM/);
  assert.equal(problemaDoVideo({ type: "video/webm", size: 10 }, ["YOUTUBE"]), null);
});
