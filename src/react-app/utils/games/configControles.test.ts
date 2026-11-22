import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG_PADRAO, TECLAS_PADRAO, lerPad, mapaDeTeclas, nomeDaTecla, trocarTecla, validarConfig } from "./configControles.ts";

test("config inválida volta ao padrão; valores fora do lugar são ignorados", () => {
  assert.deepEqual(validarConfig(null), CONFIG_PADRAO);
  const c = validarConfig({ naTela: "talvez", estilo: "setas", canhoto: true, tamanho: "xg", vibrar: false, zonaMorta: 9, teclas: { cima: ["KeyI", "<script>", 3], a: [] } });
  assert.equal(c.naTela, "auto");
  assert.equal(c.estilo, "setas");
  assert.equal(c.canhoto, true);
  assert.equal(c.tamanho, "m");
  assert.equal(c.vibrar, false);
  assert.equal(c.zonaMorta, 0.8);
  assert.deepEqual(c.teclas.cima, ["KeyI"]);
  assert.deepEqual(c.teclas.a, TECLAS_PADRAO.a, "lista vazia mantém o padrão");
});

test("trocar tecla: vira a principal e sai da outra ação; nenhuma ação fica sem tecla", () => {
  let c = trocarTecla(CONFIG_PADRAO, "a", "KeyW");
  assert.equal(c.teclas.a[0], "KeyW");
  assert.ok(!c.teclas.cima.includes("KeyW"));
  assert.equal(mapaDeTeclas(c).get("KeyW"), "a");
  c = trocarTecla(c, "pausa", "ArrowUp");
  c = trocarTecla(c, "pausa", "KeyS");
  assert.ok(c.teclas.cima.length >= 1 && c.teclas.baixo.length >= 1);
  assert.equal(trocarTecla(c, "a", "não é tecla"), c);
  assert.equal(nomeDaTecla("KeyQ"), "Q");
  assert.equal(nomeDaTecla("ArrowLeft"), "←");
  assert.equal(nomeDaTecla("Digit7"), "7");
});

test("gamepad: cruz e analógico viram direção; A/X e B/Y; troca A/B; zona morta", () => {
  const pad = (aperta: number[], axes: number[] = [0, 0]) => ({ buttons: Array.from({ length: 17 }, (_v, i) => ({ pressed: aperta.includes(i) })), axes });
  const cfg = { gamepadTrocarAB: false, zonaMorta: 0.45 };
  assert.equal(lerPad(pad([12]), cfg).direcao, "cima");
  assert.equal(lerPad(pad([15]), cfg).direcao, "direita");
  assert.equal(lerPad(pad([], [-0.9, 0.1]), cfg).direcao, "esquerda");
  assert.equal(lerPad(pad([], [0.2, 0.3]), cfg).direcao, null, "dentro da zona morta");
  assert.equal(lerPad(pad([], [0.1, 0.8]), cfg).direcao, "baixo");
  assert.deepEqual([lerPad(pad([0]), cfg).a, lerPad(pad([2]), cfg).a, lerPad(pad([1]), cfg).b, lerPad(pad([3]), cfg).b], [true, true, true, true]);
  const trocado = lerPad(pad([0]), { ...cfg, gamepadTrocarAB: true });
  assert.deepEqual([trocado.a, trocado.b], [false, true]);
  assert.equal(lerPad(pad([9]), cfg).pausa, true);
});
