import test from 'node:test';
import assert from 'node:assert/strict';
import { abasExportacao } from './exportarCasamento.ts';

test('exporta as quatro abas com rótulos legíveis e valores vazios como texto vazio', () => {
  const abas = abasExportacao({
    configuracao: { casal: 'Ana & Beto', dataCasamento: '2027-10-12' },
    fornecedores: [{ nmFornecedor: 'Buffet', nmCategoria: 'Comida', nmStatus: 'ORCAMENTO', vlValor: 1500.5, txContato: null, txObservacao: null, qtAnexos: 2 }],
    convidados: [{ nmConvidado: 'Caio', nmGrupo: null, nrTelefone: null, nmRelacao: null, nmStatus: 'NAO_IRA', nrAcompanhantes: 1, nmMesa: '3' }],
    marcos: [{ nmTitulo: 'Fechar buffet', dtPrazo: '01/01/2027', inConcluido: true, txObservacao: null }],
  });
  assert.deepEqual(abas.map(a => a.nome), ['Configuração', 'Fornecedores', 'Convidados', 'Marcos']);
  assert.deepEqual(abas[0].linhas[0], { Casal: 'Ana & Beto', 'Data do casamento': '2027-10-12' });
  assert.deepEqual(abas[1].linhas[0], { Fornecedor: 'Buffet', Categoria: 'Comida', Status: 'Orçamento', Valor: 1500.5, Contato: '', 'Observações': '', Anexos: 2 });
  assert.equal(abas[2].linhas[0].Status, 'Não irá');
  assert.equal(abas[2].linhas[0].Grupo, '');
  assert.equal(abas[3].linhas[0]['Concluído'], 'Sim');
});

test('sem dados as abas saem vazias (e a configuração ainda tem uma linha)', () => {
  const abas = abasExportacao({ configuracao: { casal: null, dataCasamento: null }, fornecedores: [], convidados: [], marcos: [] });
  assert.equal(abas[0].linhas.length, 1);
  assert.deepEqual(abas.slice(1).map(a => a.linhas.length), [0, 0, 0]);
});
