import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPorMes, categoriasParaLancamento, competenciaDaData, deslocarMes, descricaoExibida, filtrarPorBusca,
  linhasPlanilha, projecoesDoTipo, resumoParcelamento, rotuloMes, rotuloMesCurto, rotuloParcela, totaisFinanceiro, valorAssinado,
  type ItemFinanceiro,
} from './financeiro.ts';

const item = (extra: Partial<ItemFinanceiro> = {}): ItemFinanceiro => ({
  competencia: '2026-10', dtLancamento: '08/10/2026', cdTipo: 'SAIDA', nmCategoria: 'Fatura', nmPessoa: 'Nick',
  dsLancamento: null, vlLancamento: 100, inRealizado: false, ...extra,
});

test('totais somam em centavos, sem erro de ponto flutuante', () => {
  const t = totaisFinanceiro([
    item({ cdTipo: 'ENTRADA', vlLancamento: 5000, inRealizado: true }),
    item({ vlLancamento: 0.1 }),
    item({ vlLancamento: 0.2, inRealizado: true }),
    item({ vlLancamento: 1500.5 }),
  ]);
  assert.equal(t.entradas, 5000);
  assert.equal(t.saidas, 1500.8);
  assert.equal(t.saldo, 3499.2);
  assert.equal(t.entradasRealizadas, 5000);
  assert.equal(t.saidasRealizadas, 0.2);
  assert.equal(t.qtLancamentos, 4);
  assert.equal(t.qtRealizados, 2);
});

test('totais de lista vazia são zero', () => {
  const t = totaisFinanceiro([]);
  assert.deepEqual([t.entradas, t.saidas, t.saldo, t.qtLancamentos], [0, 0, 0, 0]);
});

test('valor assinado: entrada positiva, saída negativa', () => {
  assert.equal(valorAssinado(item({ cdTipo: 'ENTRADA', vlLancamento: 10 })), 10);
  assert.equal(valorAssinado(item({ cdTipo: 'SAIDA', vlLancamento: 10 })), -10);
});

test('rótulos de mês em português', () => {
  assert.equal(rotuloMes('2026-10'), 'outubro de 2026');
  assert.equal(rotuloMes('2027-03'), 'março de 2027');
  assert.equal(rotuloMes('2026-13'), '');
  assert.equal(rotuloMes('x'), '');
  assert.equal(rotuloMesCurto('2026-10'), 'out/2026');
  assert.equal(rotuloMesCurto('2026-12'), 'dez/2026');
});

test('competência da data e deslocamento de meses', () => {
  assert.equal(competenciaDaData('2026-10-31'), '2026-10');
  assert.equal(competenciaDaData('31/10/2026'), '');
  assert.equal(deslocarMes('2026-10', 1), '2026-11');
  assert.equal(deslocarMes('2026-12', 1), '2027-01');
  assert.equal(deslocarMes('2026-01', -1), '2025-12');
  assert.equal(deslocarMes('2026-10', 14), '2027-12');
  assert.equal(deslocarMes('2026-10', 0), '2026-10');
  assert.equal(deslocarMes('invalido', 1), 'invalido');
});

test('agrupa por mês do mais recente ao mais antigo e mantém a ordem dos itens', () => {
  const grupos = agruparPorMes([
    item({ competencia: '2026-09', dsLancamento: 'a' }),
    item({ competencia: '2026-10', cdTipo: 'ENTRADA', vlLancamento: 300, dsLancamento: 'b' }),
    item({ competencia: '2026-09', vlLancamento: 50, dsLancamento: 'c' }),
    item({ competencia: '2026-10', vlLancamento: 120, dsLancamento: 'd' }),
  ]);
  assert.deepEqual(grupos.map(g => g.competencia), ['2026-10', '2026-09']);
  assert.equal(grupos[0].rotulo, 'outubro de 2026');
  assert.deepEqual(grupos[0].itens.map(i => i.dsLancamento), ['b', 'd']);
  assert.deepEqual(grupos[1].itens.map(i => i.dsLancamento), ['a', 'c']);
  assert.equal(grupos[0].totais.saldo, 180);
  assert.equal(grupos[1].totais.saidas, 150);
});

test('busca ignora caixa e acentos e olha descrição, categoria, pessoa e autor', () => {
  const itens = [
    item({ dsLancamento: 'Conta de luz', nmCategoria: 'Contas', nmPessoa: 'Casal' }),
    item({ dsLancamento: null, nmCategoria: 'Salário', nmPessoa: 'Thaina', nmUsuarioCriacao: 'Nick' }),
  ];
  assert.equal(filtrarPorBusca(itens, 'LUZ').length, 1);
  assert.equal(filtrarPorBusca(itens, 'salario').length, 1);
  assert.equal(filtrarPorBusca(itens, 'thaína').length, 1);
  assert.equal(filtrarPorBusca(itens, 'nick').length, 1);
  assert.equal(filtrarPorBusca(itens, '  ').length, 2);
  assert.equal(filtrarPorBusca(itens, 'nada').length, 0);
});

test('descrição cai na categoria quando vazia; parcela só aparece se parcelado', () => {
  assert.equal(descricaoExibida({ dsLancamento: 'Cartão', nmCategoria: 'Fatura' }), 'Cartão');
  assert.equal(descricaoExibida({ dsLancamento: '  ', nmCategoria: 'Fatura' }), 'Fatura');
  assert.equal(descricaoExibida({ dsLancamento: null, nmCategoria: 'Fatura' }), 'Fatura');
  assert.equal(rotuloParcela({ nrParcela: 2, qtParcela: 10 }), '2/10');
  assert.equal(rotuloParcela({ nrParcela: 1, qtParcela: 1 }), '');
  assert.equal(rotuloParcela({ nrParcela: null, qtParcela: null }), '');
});

test('resumo do parcelamento mostra valor e período', () => {
  const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  assert.equal(resumoParcelamento('2026-10', 3, 100, brl), '3 parcelas de R$ 100,00 (out/2026 a dez/2026)');
  assert.equal(resumoParcelamento('2026-11', 4, 50.5, brl), '4 parcelas de R$ 50,50 (nov/2026 a fev/2027)');
  assert.equal(resumoParcelamento('2026-10', 1, 100, brl), '');
});

test('categorias do formulário: ativas, sem saldo anterior, mais a atual da edição', () => {
  const base = { nmCategoria: 'x', cdTipo: 'SAIDA' };
  const lista = [
    { ...base, idCategoria: 1, cdProjecao: 'MANUAL', inAtivo: true },
    { ...base, idCategoria: 2, cdProjecao: 'MANUAL', inAtivo: false },
    { ...base, idCategoria: 3, cdProjecao: 'SALDO_ANTERIOR', inAtivo: true },
  ];
  assert.deepEqual(categoriasParaLancamento(lista).map(c => c.idCategoria), [1]);
  assert.deepEqual(categoriasParaLancamento(lista, 2).map(c => c.idCategoria), [1, 2]);
});

test('projeções permitidas por tipo', () => {
  assert.ok(projecoesDoTipo('ENTRADA').includes('SALDO_ANTERIOR'));
  assert.ok(!projecoesDoTipo('ENTRADA').includes('RITMO_FATURA'));
  assert.ok(projecoesDoTipo('SAIDA').includes('RITMO_FATURA'));
  assert.ok(!projecoesDoTipo('SAIDA').includes('SALDO_ANTERIOR'));
  assert.ok(projecoesDoTipo('SAIDA').includes('MANUAL'));
});

test('linhas da planilha trazem data ISO e valor com sinal', () => {
  const [linha] = linhasPlanilha([item({ dsLancamento: 'Cartão', nmUsuarioCriacao: 'Nick', vlLancamento: 1500.5 })]);
  assert.equal(linha['Data'], '2026-10-08');
  assert.equal(linha['Valor'], -1500.5);
  assert.equal(linha['Tipo'], 'Saída');
  assert.equal(linha['Situação'], 'Previsto');
  assert.equal(linha['Autor'], 'Nick');
});
