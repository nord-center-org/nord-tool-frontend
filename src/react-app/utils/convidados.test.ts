import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_PLANILHA, linhasPlanilha, linkWhatsapp, resumoPorGrupo, resumoPorMesa, totaisConvidados,
} from './convidados.ts';

const c = (nmGrupo: string | null, nmMesa: string | null, nmStatus: string, nrAcompanhantes: number) =>
  ({ nmConvidado: 'X', nrTelefone: null, nmRelacao: null, nmGrupo, nmMesa, nmStatus, nrAcompanhantes });

const lista = [
  c('Família', '1', 'CONFIRMADO', 2),
  c('Família', '1', 'CONVIDADO', 0),
  c('Amigos', null, 'CONFIRMADO', 1),
  c(null, '2', 'NAO_IRA', 3),
];

test('totais contam pessoas com acompanhantes e só somam confirmados em pessoasConfirmadas', () => {
  assert.deepEqual(totaisConvidados(lista), { qtConvidados: 4, qtConfirmados: 2, qtPessoas: 10, qtPessoasConfirmadas: 5 });
  assert.deepEqual(totaisConvidados([]), { qtConvidados: 0, qtConfirmados: 0, qtPessoas: 0, qtPessoasConfirmadas: 0 });
});

test('resumo por grupo: ordenado, "Sem grupo" por último', () => {
  assert.deepEqual(resumoPorGrupo(lista), [
    { grupo: 'Amigos', qtConvidados: 1, qtConfirmados: 1, qtPessoas: 2 },
    { grupo: 'Família', qtConvidados: 2, qtConfirmados: 1, qtPessoas: 4 },
    { grupo: 'Sem grupo', qtConvidados: 1, qtConfirmados: 0, qtPessoas: 4 },
  ]);
});

test('resumo por mesa: soma pessoas, ordena numericamente e "Sem mesa" por último', () => {
  const mesas = resumoPorMesa([...lista, c('A', '10', 'CONVIDADO', 0)]);
  assert.deepEqual(mesas.map(m => m.mesa), ['1', '2', '10', 'Sem mesa']);
  assert.equal(mesas[0].qtPessoas, 4);
  assert.equal(mesas[3].qtPessoas, 2);
});

test('link do WhatsApp normaliza o telefone brasileiro', () => {
  assert.equal(linkWhatsapp('(11) 98888-7777'), 'https://wa.me/5511988887777');
  assert.equal(linkWhatsapp('+55 11 98888-7777'), 'https://wa.me/5511988887777');
  assert.equal(linkWhatsapp('1234'), null);
  assert.equal(linkWhatsapp(null), null);
});

test('linhas da planilha seguem o cabeçalho do importador e trocam o código pelo rótulo', () => {
  const [linha] = linhasPlanilha([{ ...c('Família', '1', 'NAO_IRA', 2), nmConvidado: 'Ana', nrTelefone: '119', nmRelacao: 'Prima' }]);
  assert.deepEqual(Object.keys(linha), [...COLUNAS_PLANILHA]);
  assert.equal(linha.Status, 'Não irá');
  assert.equal(linha.Acompanhantes, 2);
  assert.equal(linha['Relação'], 'Prima');
});
