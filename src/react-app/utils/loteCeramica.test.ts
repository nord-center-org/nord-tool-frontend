import { test } from "node:test";
import assert from "node:assert/strict";
import { alertasDeMistura, exemplos, filtrar, FILTROS_VAZIOS, indicadores, mapaDeCalor, saldo, saldoBaixo, saldoPorLote, validar, LOTE_VAZIO } from "./loteCeramica.ts";

test("exemplos: 15 registros fictícios em 3 torres", () => {
  const e = exemplos();
  assert.equal(e.length, 15);
  assert.deepEqual([...new Set(e.map(l => l.torre))].sort(), ["Torre A", "Torre B", "Torre C"]);
  assert.ok(e.every(l => /fictício/.test(l.fornecedor)), "fornecedores marcados como fictícios");
});

test("alerta de mistura: lote, tonalidade e calibre diferentes no mesmo pavimento ou ambiente", () => {
  const a = alertasDeMistura(exemplos());
  const locais = a.map(x => x.local);
  assert.ok(locais.includes("Torre A · 3º pavimento") && a.find(x => x.local === "Torre A · 3º pavimento")!.motivos.includes("lote"));
  assert.ok(a.find(x => x.local === "Torre B · 3º pavimento")!.motivos.includes("tonalidade"));
  assert.ok(a.find(x => x.local === "Torre C · 2º pavimento")!.motivos.includes("calibre"));
  assert.equal(a.length, 3);
  // estoque e reprovado não contam: o 5º da Torre A (estoque) não gera alerta
  assert.ok(!locais.some(l => l.startsWith("Torre A · 5º")));
});

test("indicadores e saldo", () => {
  const i = indicadores(exemplos());
  assert.equal(i.alertas, 3);
  assert.ok(i.recebido > i.aplicado && i.saldo === Math.round((i.recebido - i.aplicado) * 100) / 100);
  assert.equal(saldo({ qtdRecebida: 100, qtdAplicada: 96 }), 4);
  assert.equal(saldoBaixo(100, 96), true);
  assert.equal(saldoBaixo(100, 50), false);
  assert.equal(saldoBaixo(0, 0), false);
  const s = saldoPorLote(exemplos());
  assert.ok(s.every(x => x.saldo === Math.round((x.recebido - x.aplicado) * 100) / 100));
  assert.ok(!s.some(x => x.lote === "LT-3002" && x.recebido === 150), "reprovado fica fora do saldo");
});

test("mapa de calor marca os pavimentos com mistura", () => {
  const m = mapaDeCalor(exemplos());
  assert.deepEqual(m.torres, ["Torre A", "Torre B", "Torre C"]);
  assert.equal(m.celulas.find(c => c.torre === "Torre A" && c.pavimento === "3º pavimento")!.misturado, true);
  assert.equal(m.celulas.find(c => c.torre === "Torre A" && c.pavimento === "1º pavimento")!.misturado, false);
});

test("filtros e validação", () => {
  assert.equal(filtrar(exemplos(), { ...FILTROS_VAZIOS, torre: "Torre B" }).length, 5);
  assert.equal(filtrar(exemplos(), { ...FILTROS_VAZIOS, busca: "lt-1007" }).length, 2);
  assert.equal(filtrar(exemplos(), { ...FILTROS_VAZIOS, status: "Reprovado" }).length, 1);
  assert.equal(validar(LOTE_VAZIO), "Informe a torre.");
  const ok = { ...LOTE_VAZIO, torre: "T", pavimento: "P", fornecedor: "F", lote: "L", qtdRecebida: 10, qtdAplicada: 5 };
  assert.equal(validar(ok), null);
  assert.match(validar({ ...ok, qtdAplicada: 11 }) ?? "", /não pode passar/);
});
