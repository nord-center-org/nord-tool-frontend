import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_FAVORITOS, alternarFavorito, itensFavoritos, lerFavoritosLocais, limparFavoritos, salvarFavoritosLocais } from "./menuFavoritos.ts";

test("marca no fim e desmarca", () => {
  assert.deepEqual(alternarFavorito([], "/sac"), ["/sac"]);
  assert.deepEqual(alternarFavorito(["/sac"], "/entregas"), ["/sac", "/entregas"]);
  assert.deepEqual(alternarFavorito(["/sac", "/entregas"], "/sac"), ["/entregas"]);
  const cheio = Array.from({ length: MAX_FAVORITOS }, (_, i) => `/t${i}`);
  assert.equal(alternarFavorito(cheio, "/outra").length, MAX_FAVORITOS);
});

test("lista limpa: só caminhos válidos, sem repetir", () => {
  assert.deepEqual(limparFavoritos(["/sac", "/sac", "javascript:x", 3, "/Maiuscula", "/mapeamentos/bloco-notas"]), ["/sac", "/mapeamentos/bloco-notas"]);
  assert.deepEqual(limparFavoritos("x"), []);
});

test("cópia no aparelho, por usuário, tolerante", () => {
  const mapa = new Map<string, string>();
  const storage = { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => { mapa.set(k, v); } };
  salvarFavoritosLocais(storage, 1, ["/sac"]);
  assert.deepEqual(lerFavoritosLocais(storage, 1), ["/sac"]);
  assert.deepEqual(lerFavoritosLocais(storage, 2), []);
  mapa.set("@NordTool:menu_favoritos:3", "{quebrado");
  assert.deepEqual(lerFavoritosLocais(storage, 3), []);
  assert.deepEqual(lerFavoritosLocais(undefined, 1), []);
  salvarFavoritosLocais({ setItem: () => { throw new Error("cheio"); } }, 1, ["/sac"]);
});

test("itens na ordem marcada, só os que a pessoa vê", () => {
  const grupos = [{ items: [{ path: "/", label: "Início" }, { path: "/sac", label: "SAC" }] }, { items: [{ path: "/entregas", label: "Agenda" }] }];
  assert.deepEqual(itensFavoritos(["/entregas", "/admin", "/sac"], grupos).map(i => i.label), ["Agenda", "SAC"]);
});
