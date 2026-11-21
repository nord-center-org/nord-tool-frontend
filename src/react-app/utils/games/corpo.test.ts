import { test } from "node:test";
import assert from "node:assert/strict";
import { ALTURA_CORPO, LARGURA_CORPO, QUADROS, montarCorpo } from "./corpo.ts";
import { avatarAleatorio, type AvatarConfig } from "../avatar.ts";

const avatar = (extra: Partial<AvatarConfig> = {}): AvatarConfig => ({ ...avatarAleatorio(() => 0.42), ...extra });
const pintados = (g: (string | null)[][], y0: number, y1: number) => g.slice(y0, y1).reduce((s, l) => s + l.filter(Boolean).length, 0);
const igual = (a: (string | null)[][], b: (string | null)[][]) => JSON.stringify(a) === JSON.stringify(b);

test("quadro de 32×48 com cabeça, tronco e pernas", () => {
  const g = montarCorpo(avatar(), { direcao: "baixo", acao: "parado", quadro: 0 });
  assert.equal(g.length, ALTURA_CORPO);
  assert.ok(g.every(l => l.length === LARGURA_CORPO));
  assert.ok(pintados(g, 0, 24) > 200, "cabeça");
  assert.ok(pintados(g, 25, 37) > 120, "tronco e braços");
  assert.ok(pintados(g, 37, 48) > 60, "pernas e botas");
});

test("a cabeça é a do avatar da pessoa", () => {
  const a = montarCorpo(avatar({ corCabelo: "azul", capacete: false }), { direcao: "baixo", acao: "parado", quadro: 0 });
  assert.ok(a.flat().includes("#3b82f6"), "cabelo azul aparece");
});

test("andar mexe pernas e braços; parado respira", () => {
  const c = avatar();
  const andar = [0, 1, 2, 3].map(q => montarCorpo(c, { direcao: "baixo", acao: "andando", quadro: q }));
  assert.ok(!igual(andar[1], andar[3]), "passo da esquerda ≠ passo da direita");
  assert.ok(!igual(andar[0], andar[1]));
  assert.ok(!igual(montarCorpo(c, { direcao: "baixo", acao: "parado", quadro: 0 }), montarCorpo(c, { direcao: "baixo", acao: "parado", quadro: 1 })));
  assert.ok(igual(montarCorpo(c, { direcao: "lado", acao: "andando", quadro: 5 }), montarCorpo(c, { direcao: "lado", acao: "andando", quadro: 1 })), "quadros dão a volta");
  assert.deepEqual(QUADROS, { parado: 2, andando: 4, vitoria: 2 });
});

test("de costas não mostra o rosto", () => {
  const c = avatar({ capacete: false });
  const cores = (g: (string | null)[][]) => new Set(g.slice(12, 22).flat().filter(Boolean)).size;
  const frente = montarCorpo(c, { direcao: "baixo", acao: "parado", quadro: 0 });
  const costas = montarCorpo(c, { direcao: "cima", acao: "parado", quadro: 0 });
  assert.ok(cores(frente) >= 8, "rosto tem olhos, boca e pele");
  assert.ok(cores(costas) <= 4, "nuca: cabelo, sombra e contorno");
});

test("vitória ergue os braços acima dos ombros", () => {
  const c = avatar();
  const parado = montarCorpo(c, { direcao: "baixo", acao: "parado", quadro: 0 });
  const vitoria = montarCorpo(c, { direcao: "baixo", acao: "vitoria", quadro: 0 });
  const ladoCabeca = (g: (string | null)[][]) => g.slice(14, 24).reduce((s, l) => s + (l[4] || l[5] ? 1 : 0), 0);
  assert.ok(ladoCabeca(vitoria) > ladoCabeca(parado));
});
