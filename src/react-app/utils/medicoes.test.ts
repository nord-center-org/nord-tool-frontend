import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classeStatus, dataIsoParaBr, filtrarMedicoes, moedaSienge, observacaoSienge, resumirMedicoes, tituloBoletim,
  type ItemMedicao,
} from "./medicoes.ts";

const item = (parcial: Partial<ItemMedicao> = {}): ItemMedicao => ({
  nrMedicao: 11, cdContrato: "34515", nmRazaoSocial: "CLEAN XPRESS LTDA", nrContrato: "CT/4916-209",
  dtMedicao: "2026-08-15", vlMedicao: 14000.05, txMemorial: null, cdStatus: "PENDENTE", ...parcial,
});

test("moedaSienge: sem espaço, milhar com ponto e centavos com vírgula", () => {
  assert.equal(moedaSienge(14000.05), "R$14.000,05");
  assert.equal(moedaSienge(36500), "R$36.500,00");
  assert.equal(moedaSienge(399.63), "R$399,63");
  assert.equal(moedaSienge(1234567.8), "R$1.234.567,80");
});

test("tituloBoletim segue o padrão da planilha", () => {
  assert.equal(tituloBoletim(item()), "Boletim medição 11 - 34515 - CLEAN XPRESS LTDA - CT/4916-209");
});

test("observacaoSienge: valor + memorial, com ponto final garantido", () => {
  assert.equal(
    observacaoSienge(item({ vlMedicao: 36500, txMemorial: "referente à 73 apartamentos recebidos (73*500=36.500)" })),
    "Obra: Medição de R$36.500,00 referente à 73 apartamentos recebidos (73*500=36.500).",
  );
  assert.equal(
    observacaoSienge(item({ vlMedicao: 4000, txMemorial: "referente à fretes concluídos." })),
    "Obra: Medição de R$4.000,00 referente à fretes concluídos.",
  );
  assert.equal(observacaoSienge(item({ vlMedicao: 10, txMemorial: "  " })), "Obra: Medição de R$10,00.");
});

test("dataIsoParaBr converte ISO e preserva texto inesperado", () => {
  assert.equal(dataIsoParaBr("2026-08-05"), "05/08/2026");
  assert.equal(dataIsoParaBr("2026-08-05T10:00:00"), "05/08/2026");
  assert.equal(dataIsoParaBr("lixo"), "lixo");
  assert.equal(dataIsoParaBr(null), "");
});

test("filtrarMedicoes: status e busca sem acento, por todas as palavras", () => {
  const lista = [
    item(),
    item({ nrMedicao: 2, cdContrato: "35125", nmRazaoSocial: "COSTA NASCIMENTO CONSTRUTORA LTDA", nrContrato: "CT/4916-239", cdStatus: "FEITA", txMemorial: "referente ao recebimento de 20 apartamentos" }),
  ];
  assert.equal(filtrarMedicoes(lista, "", "").length, 2);
  assert.equal(filtrarMedicoes(lista, "", "FEITA").length, 1);
  assert.equal(filtrarMedicoes(lista, "costa 239", "").length, 1);
  assert.equal(filtrarMedicoes(lista, "APARTAMENTOS recebimento", "").length, 1);
  assert.equal(filtrarMedicoes(lista, "clean", "FEITA").length, 0);
  assert.equal(filtrarMedicoes(lista, "15/08/2026", "").length, 2);
});

test("resumirMedicoes soma em centavos por status", () => {
  const r = resumirMedicoes([
    item({ vlMedicao: 0.1 }), item({ vlMedicao: 0.2 }), item({ vlMedicao: 100, cdStatus: "FEITA" }),
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.valorTotal, 100.3);
  assert.deepEqual(r.porStatus.PENDENTE, { quantidade: 2, valor: 0.3 });
  assert.deepEqual(r.porStatus.FEITA, { quantidade: 1, valor: 100 });
  assert.deepEqual(resumirMedicoes([]), { total: 0, valorTotal: 0, porStatus: {} });
});

test("classeStatus: pendente, feita e status novos têm cor", () => {
  assert.match(classeStatus("PENDENTE"), /amber/);
  assert.match(classeStatus("FEITA"), /green/);
  assert.match(classeStatus("EM_ANALISE"), /slate/);
});
