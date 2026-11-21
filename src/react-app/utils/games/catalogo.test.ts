import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FILTROS_CENTRAL, JOGOS, filtrarJogos } from "./catalogo.ts";

test("21 jogos, ids únicos, 1 a 8 jogadores", () => {
  assert.equal(JOGOS.length, 21);
  assert.equal(new Set(JOGOS.map(j => j.id)).size, 21);
  for (const j of JOGOS) {
    // Pedido do Nick: todos os jogos, sem exceção, de 1 (sozinho, com bots) a 8 jogadores.
    assert.equal(j.minJogadores, 1, j.id);
    assert.equal(j.maxJogadores, 8, j.id);
    assert.ok(j.regras.length > 0 && j.modos.length > 0, j.id);
  }
});

test("nenhum nome de jogo comercial nos títulos", () => {
  const proibidos = /krunker|gta|overcooked|uno\b|bomberman|mario|tetris|fall guys|battleship/i;
  for (const j of JOGOS) assert.ok(!proibidos.test(`${j.nome} ${j.resumo}`), j.nome);
});

test("filtros da Central: busca sem acento, jogadores, 2D/3D, favoritos e disponíveis primeiro", () => {
  assert.deepEqual(filtrarJogos(JOGOS, { ...FILTROS_CENTRAL, busca: "sumo" }, new Set()).map(j => j.id), ["hexagonos"]);
  assert.ok(filtrarJogos(JOGOS, { ...FILTROS_CENTRAL, dimensao: "3D" }, new Set()).every(j => j.dimensao === "3D"));
  assert.ok(filtrarJogos(JOGOS, { ...FILTROS_CENTRAL, jogadores: 8 }, new Set()).every(j => j.maxJogadores >= 8));
  assert.deepEqual(filtrarJogos(JOGOS, { ...FILTROS_CENTRAL, soFavoritos: true }, new Set(["cartas"])).map(j => j.id), ["cartas"]);
  assert.equal(filtrarJogos(JOGOS, FILTROS_CENTRAL, new Set())[0].disponivel, true);
});

test("nada de arquivo de imagem ou som nos jogos: tudo é gerado por código", () => {
  const raizes = [new URL("../../components/games", import.meta.url).pathname, new URL(".", import.meta.url).pathname];
  const proibido = /\.(png|jpe?g|gif|webp|svg|bmp|ico|mp3|wav|ogg|m4a|aac|flac|mp4|webm|glb|gltf|obj|fbx|ttf|woff2?)$/i;
  const achados: string[] = [];
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else if (proibido.test(nome)) achados.push(p);
    }
  };
  raizes.forEach(andar);
  assert.deepEqual(achados, []);
});
