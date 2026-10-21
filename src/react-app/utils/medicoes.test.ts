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

test("contratosConhecidos: um por contrato, próxima medição e dados da mais recente", async () => {
  const { contratosConhecidos, acharContrato } = await import("./medicoes.ts");
  const lista = [
    item({ nrContrato: "CT/4916-239", nrMedicao: 2, cdContrato: "35125", nmRazaoSocial: "COSTA ANTIGA", dtMedicao: "2026-08-01" }),
    item({ nrContrato: "CT/4916-239", nrMedicao: 3, cdContrato: "35125", nmRazaoSocial: "COSTA NASCIMENTO", dtMedicao: "2026-09-01" }),
    item({ nrContrato: "CT/4916-209", nrMedicao: 12, cdContrato: "34515" }),
  ];
  const contratos = contratosConhecidos(lista);
  assert.deepEqual(contratos.map(c => c.nrContrato), ["CT/4916-209", "CT/4916-239"]);
  assert.equal(contratos[1].proximaMedicao, 4);
  assert.equal(contratos[1].nmRazaoSocial, "COSTA NASCIMENTO");
  assert.equal(acharContrato(contratos, " ct/4916-209 ")?.proximaMedicao, 13);
  assert.equal(acharContrato(contratos, "CT/0000"), null);
  assert.equal(acharContrato(contratos, "  "), null);
});

test("calcularExpressao: precedência, parênteses, x, vírgula e milhar", async () => {
  const { calcularExpressao } = await import("./medicoes.ts");
  assert.equal(calcularExpressao("73*500"), 36500);
  assert.equal(calcularExpressao("2+3*4"), 14);
  assert.equal(calcularExpressao("(2+3)*4"), 20);
  assert.equal(calcularExpressao("13 x 300"), 3900);
  assert.equal(calcularExpressao("7000/30*7"), 1633.33);
  assert.equal(calcularExpressao("1.500,50*2"), 3001);
  assert.equal(calcularExpressao("-5+10"), 5);
  assert.equal(calcularExpressao("10/0"), null);
  assert.equal(calcularExpressao("2+"), null);
  assert.equal(calcularExpressao("2 abc"), null);
  assert.equal(calcularExpressao(""), null);
  assert.equal(calcularExpressao("(2+3"), null);
});

test("analisarMemorial: pega a última conta entre parênteses e o valor informado", async () => {
  const { analisarMemorial } = await import("./medicoes.ts");
  assert.deepEqual(analisarMemorial("referente a 73 apartamentos recebidos (73*500=36.500)"), { conta: 36500, informado: 36500 });
  assert.deepEqual(analisarMemorial("referente a 7 dias trabalhados entre julho e agosto (7000/30*7=1634)."), { conta: 1633.33, informado: 1634 });
  assert.deepEqual(analisarMemorial("(4 apartamentos) (4*500)"), { conta: 2000, informado: null });
  assert.deepEqual(analisarMemorial("referente à 2ª Vistoria da proposta PEO 001-26."), { conta: null, informado: null });
  assert.deepEqual(analisarMemorial("(20 apartamentos)"), { conta: null, informado: null });
  assert.deepEqual(analisarMemorial(null), { conta: null, informado: null });
});
