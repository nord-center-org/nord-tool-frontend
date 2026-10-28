import assert from "node:assert/strict";
import { test } from "node:test";

import {
  avatarAleatorio, avatarPadrao, corDoCapacete, dataComemorativa, domingoDePascoa, funcaoDoCargo, lerAvatar, mistura, salvarAvatar, temaDoAvatar, tom,
} from "./avatar.ts";

test("padrão é estável por pessoa e a função vem do cargo", () => {
  assert.deepEqual(avatarPadrao(42, "Engenheiro Civil"), avatarPadrao(42, "Engenheiro Civil"));
  assert.equal(avatarPadrao(42, "Engenheiro Civil").funcao, "engenheiro");
  assert.equal(funcaoDoCargo("Estagiária de Engenharia"), "estagiario");
  assert.equal(funcaoDoCargo("Mestre de obras"), "mestre");
  assert.equal(funcaoDoCargo("Técnico de Segurança"), "seguranca");
  assert.equal(funcaoDoCargo("Servente"), "pedreiro");
  assert.equal(funcaoDoCargo("Operador de grua"), "operador");
  assert.equal(funcaoDoCargo(null), "administrativo");
});

test("leitura tolera JSON inválido e valores desconhecidos", () => {
  const base = avatarPadrao(5);
  assert.deepEqual(lerAvatar("{quebrado", 5), base);
  assert.deepEqual(lerAvatar("[1]", 5), base);
  const lido = lerAvatar(JSON.stringify({ pele: "p6", cabelo: "xxx", capacete: false, datas: "sim" }), 5);
  assert.equal(lido.pele, "p6");
  assert.equal(lido.cabelo, base.cabelo);
  assert.equal(lido.capacete, false);
  assert.equal(lido.datas, base.datas);
  const c = avatarAleatorio(() => 0.5);
  assert.deepEqual(lerAvatar(salvarAvatar(c), 1), c);
});

test("Páscoa e Carnaval calculados", () => {
  assert.deepEqual(domingoDePascoa(2026), { mes: 4, dia: 5 });
  assert.deepEqual(domingoDePascoa(2027), { mes: 3, dia: 28 });
  assert.equal(dataComemorativa("2026-04-05"), "pascoa");
  assert.equal(dataComemorativa("2026-03-29"), "pascoa");
  assert.equal(dataComemorativa("2026-02-17"), "carnaval"); // terça de Carnaval 2026
  assert.equal(dataComemorativa("2026-02-10"), null);
});

test("datas fixas", () => {
  assert.equal(dataComemorativa("2026-12-24"), "natal");
  assert.equal(dataComemorativa("2026-12-31"), "anoNovo");
  assert.equal(dataComemorativa("2027-01-02"), "anoNovo");
  assert.equal(dataComemorativa("2026-06-24"), "junina");
  assert.equal(dataComemorativa("2026-10-31"), "halloween");
  assert.equal(dataComemorativa("2026-10-22"), null);
  assert.equal(dataComemorativa("lixo"), null);
});

test("tema respeita a preferência e a prévia forçada", () => {
  const c = { ...avatarPadrao(1), datas: false };
  assert.equal(temaDoAvatar(c, "2026-12-24"), null);
  assert.equal(temaDoAvatar({ ...c, datas: true }, "2026-12-24"), "natal");
  assert.equal(temaDoAvatar(c, "2026-12-24", "pascoa"), "pascoa");
  assert.equal(temaDoAvatar({ ...c, datas: true }, "2026-12-24", "nenhuma"), null);
});

test("avatares antigos: óculos viram acessório e opções novas ganham padrão", () => {
  const antigo = lerAvatar(JSON.stringify({ pele: "p2", olhos: "oculos", cabelo: "curto" }), 8);
  assert.equal(antigo.olhos, "normal");
  assert.equal(antigo.acessorio, "oculos");
  assert.equal(antigo.corCapacete, "funcao");
  const novo = lerAvatar(JSON.stringify({ olhos: "sereno", acessorio: "mascara", corCapacete: "azul", cabelo: "trancas", funcao: "topografo" }), 8);
  assert.deepEqual([novo.olhos, novo.acessorio, novo.corCapacete, novo.cabelo, novo.funcao], ["sereno", "mascara", "azul", "trancas", "topografo"]);
  assert.equal(corDoCapacete({ ...novo, corCapacete: "funcao" }), "#f8fafc");
  assert.equal(corDoCapacete(novo), "#2563eb");
  assert.ok(salvarAvatar(avatarAleatorio()).length < 2000);
});

test("novas funções a partir do cargo e mistura de cores", () => {
  assert.equal(funcaoDoCargo("Arquiteta"), "arquiteto");
  assert.equal(funcaoDoCargo("Encanador"), "encanador");
  assert.equal(funcaoDoCargo("Carpinteiro"), "carpinteiro");
  assert.equal(funcaoDoCargo("Topógrafo"), "topografo");
  assert.equal(funcaoDoCargo("Técnico de Edificações"), "tecnico");
  assert.equal(tom("#808080", -0.5), "#404040");
  assert.equal(mistura("#000000", "#ffffff", 0.5), "#808080");
});

test("formato dos olhos: lido do JSON e com padrão para avatares antigos", () => {
  assert.equal(lerAvatar(JSON.stringify({ formatoOlhos: "puxado" }), 3).formatoOlhos, "puxado");
  assert.equal(lerAvatar(JSON.stringify({ formatoOlhos: "xxx" }), 3).formatoOlhos, avatarPadrao(3).formatoOlhos);
});
