import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O app confere public/app/versao.json para se atualizar sozinho: tem que bater com a versão do APK publicado.
const raiz = new URL("../../../", import.meta.url);
const gradle = readFileSync(new URL("android/app/build.gradle", raiz), "utf8");
const versao = JSON.parse(readFileSync(new URL("public/app/versao.json", raiz), "utf8")) as { versionCode: number; versionName: string };

test("versao.json acompanha a versão do app no build.gradle", () => {
  const codigo = Number(/versionCode\s+(\d+)/.exec(gradle)?.[1]);
  const nome = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
  assert.ok(codigo > 0, "versionCode no build.gradle");
  assert.equal(versao.versionCode, codigo, "aumente o versionCode de public/app/versao.json junto com o do app");
  assert.equal(versao.versionName, nome);
});

test("o APK está publicado ao lado do versao.json", () => {
  assert.ok(readFileSync(new URL("public/app/nordtool.apk", raiz)).length > 10_000);
});
