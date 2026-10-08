import assert from "node:assert/strict";
import { test } from "node:test";

import { lerCotas, normalizarTicker, proximosProventos, sinalResultado, textoCotacao, textoPercentual } from "./investimentos.ts";

const prov = (idProvento: number, dtPagamento: string, vlTotal: number, recebido = false) => ({ idProvento, dtPagamento, vlTotal, recebido });

test("próximos proventos: só os não recebidos, em ordem de pagamento", () => {
  const lista = proximosProventos([
    { idAtivo: 1, cdTicker: "HGLG11", nmPessoa: "Nick", proventos: [prov(1, "15/11/2026", 11), prov(2, "15/09/2026", 9, true), prov(3, "15/10/2026", 5)] },
    { idAtivo: 2, cdTicker: "XPML11", nmPessoa: "Thaina", proventos: [prov(4, "20/10/2026", 7), prov(5, "01/10/2026", 0)] },
  ]);
  assert.deepEqual(lista.map(l => l.provento.idProvento), [3, 4, 1]);
  assert.equal(lista[1].ativo.cdTicker, "XPML11");
});

test("próximos proventos: ordena por ano antes de dia", () => {
  const lista = proximosProventos([{ idAtivo: 1, cdTicker: "HGLG11", nmPessoa: "Nick", proventos: [prov(1, "05/01/2027", 1), prov(2, "20/12/2026", 1)] }]);
  assert.deepEqual(lista.map(l => l.provento.idProvento), [2, 1]);
});

test("sinal do resultado ignora centavos de arredondamento", () => {
  assert.equal(sinalResultado(100), "alta");
  assert.equal(sinalResultado(-0.5), "baixa");
  assert.equal(sinalResultado(0), "estavel");
  assert.equal(sinalResultado(0.001), "estavel");
});

test("texto do percentual", () => {
  assert.equal(textoPercentual(6.67), "+6,67%");
  assert.equal(textoPercentual(-2.1), "-2,10%");
  assert.equal(textoPercentual(0), "0,00%");
});

test("texto da cotação diz a origem", () => {
  assert.equal(textoCotacao("08/10/2026 11:30", true), "Cotação de 11:30");
  assert.equal(textoCotacao("08/10/2026 11:30", false), "Última cotação conhecida (08/10/2026 11:30)");
  assert.equal(textoCotacao(null, false), "Sem cotação: patrimônio pelo valor investido");
});

test("ticker normalizado", () => {
  assert.equal(normalizarTicker(" hglg11 "), "HGLG11");
  assert.equal(normalizarTicker("HGLG-11"), "HGLG11");
  assert.equal(normalizarTicker("petr4"), "PETR4");
  assert.equal(normalizarTicker("abc"), "");
  assert.equal(normalizarTicker("HGLG1111"), "");
});

test("cotas inteiras positivas", () => {
  assert.equal(lerCotas("10"), 10);
  assert.equal(lerCotas(" 3 "), 3);
  assert.equal(lerCotas("0"), null);
  assert.equal(lerCotas("1,5"), null);
  assert.equal(lerCotas(""), null);
});
