import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUNAS_PLANILHA, descendentes, linhasPlanilha, linkWhatsapp, organizarEmFamilias, contarLigadosAbaixo, filtrarPorBusca, opcoesPrincipalEmMassa, papeisDoCortejo, qtNoCortejo, resumoPorGrupo, resumoPorMesa, totaisConvidados,
} from './convidados.ts';

const c = (nmGrupo: string | null, nmMesa: string | null, nmStatus: string, nrAcompanhantes: number) =>
  ({ nmConvidado: 'X', nrTelefone: null, nmRelacao: null, nmGrupo, nmMesa, nmStatus, nrAcompanhantes });

const lista = [
  c('Família', '1', 'CONFIRMADO', 2),
  c('Família', '1', 'CONVIDADO', 0),
  c('Amigos', null, 'CONFIRMADO', 1),
  c(null, '2', 'NAO_IRA', 3),
];

test('totais não somam o número de acompanhantes: cada convidado (inclusive os ligados) é uma pessoa', () => {
  assert.deepEqual(totaisConvidados(lista), { qtConvidados: 4, qtConfirmados: 2, qtPessoas: 4, qtPessoasConfirmadas: 2 });
  assert.deepEqual(totaisConvidados([]), { qtConvidados: 0, qtConfirmados: 0, qtPessoas: 0, qtPessoasConfirmadas: 0 });
});

test('resumo por grupo: ordenado, "Sem grupo" por último', () => {
  assert.deepEqual(resumoPorGrupo(lista), [
    { grupo: 'Amigos', qtConvidados: 1, qtConfirmados: 1, qtPessoas: 1 },
    { grupo: 'Família', qtConvidados: 2, qtConfirmados: 1, qtPessoas: 2 },
    { grupo: 'Sem grupo', qtConvidados: 1, qtConfirmados: 0, qtPessoas: 1 },
  ]);
});

test('resumo por mesa: conta convidados, ordena numericamente e "Sem mesa" por último', () => {
  const mesas = resumoPorMesa([...lista, c('A', '10', 'CONVIDADO', 0)]);
  assert.deepEqual(mesas.map(m => m.mesa), ['1', '2', '10', 'Sem mesa']);
  assert.equal(mesas[0].qtPessoas, 2);
  assert.equal(mesas[3].qtPessoas, 1);
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

test('família: cada ligado aparece logo abaixo de quem acompanha, em cascata', () => {
  const l = (idConvidado: number, idConvidadoPrincipal: number | null) => ({ idConvidado, idConvidadoPrincipal });
  // ordem recebida: Ana(1), Caio(3, de Bia), Bia(2, de Ana), Dora(4)
  const linhas = organizarEmFamilias([l(1, null), l(3, 2), l(2, 1), l(4, null)]);
  assert.deepEqual(linhas.map(x => [x.item.idConvidado, x.nivel]), [[1, 0], [2, 1], [3, 2], [4, 0]]);
  assert.equal(linhas.some(x => x.principalForaDaLista), false);
});

test('família: ligado cujo principal foi filtrado aparece solto e marcado', () => {
  const linhas = organizarEmFamilias([{ idConvidado: 2, idConvidadoPrincipal: 1 }, { idConvidado: 5, idConvidadoPrincipal: null }]);
  assert.deepEqual(linhas.map(x => [x.item.idConvidado, x.nivel, x.principalForaDaLista]), [[2, 0, true], [5, 0, false]]);
});

test('família: irmãos mantêm a ordem recebida e um círculo não faz ninguém sumir', () => {
  const l = (idConvidado: number, idConvidadoPrincipal: number | null) => ({ idConvidado, idConvidadoPrincipal });
  assert.deepEqual(organizarEmFamilias([l(1, null), l(3, 1), l(2, 1)]).map(x => x.item.idConvidado), [1, 3, 2]);
  const circulo = organizarEmFamilias([l(1, 2), l(2, 1)]);
  assert.deepEqual(circulo.map(x => x.item.idConvidado).sort(), [1, 2]);
});

test('família: descendentes de um convidado (para não oferecer como principal dele)', () => {
  const l = (idConvidado: number, idConvidadoPrincipal: number | null) => ({ idConvidado, idConvidadoPrincipal });
  const lista = [l(1, null), l(2, 1), l(3, 2), l(4, null), l(5, 4)];
  assert.deepEqual([...descendentes(lista, 1)].sort(), [2, 3]);
  assert.deepEqual([...descendentes(lista, 3)], []);
  assert.deepEqual([...descendentes(lista, 4)], [5]);
});

test('cortejo: sugestões são os papéis padrão mais os já usados, sem repetir', () => {
  const lista = papeisDoCortejo([{ nmCortejo: 'padrinho' }, { nmCortejo: 'Florista' }, { nmCortejo: ' florista ' }, { nmCortejo: null }, { nmCortejo: 'Pagem de alianças' }]);
  assert.deepEqual(lista, ['Dama de honra', 'Daminha', 'Florista', 'Madrinha', 'Padrinho', 'Pagem de alianças', 'Pajem']);
  assert.deepEqual(papeisDoCortejo([]).length, 5);
});

test('cortejo: conta só quem tem papel preenchido', () => {
  assert.equal(qtNoCortejo([{ nmCortejo: 'Madrinha' }, { nmCortejo: null }, { nmCortejo: '  ' }, { nmCortejo: 'Pajem' }]), 2);
});

const p = (nmConvidado: string, extra: Record<string, string | null> = {}) =>
  ({ nmConvidado, nmGrupo: null, nrTelefone: null, nmRelacao: null, nmMesa: null, nmCortejo: null, nmConvidadoPrincipal: null, ...extra });

test('busca: sem texto devolve tudo; ignora caixa e acento; todas as palavras precisam aparecer', () => {
  const lista = [p('João Antônio', { nmGrupo: 'Família' }), p('Maria Souza', { nmGrupo: 'Amigos' }), p('Ana Souza', { nmGrupo: 'Família' })];
  assert.equal(filtrarPorBusca(lista, '   ').length, 3);
  assert.deepEqual(filtrarPorBusca(lista, 'joao antonio').map(x => x.nmConvidado), ['João Antônio']);
  assert.deepEqual(filtrarPorBusca(lista, 'SOUZA familia').map(x => x.nmConvidado), ['Ana Souza']);
  assert.equal(filtrarPorBusca(lista, 'xyz').length, 0);
});

test('busca: acha por telefone com ou sem formatação, mesa, cortejo, relação e por quem acompanha', () => {
  const lista = [
    p('Bia', { nrTelefone: '(11) 98888-7777', nmMesa: '3', nmCortejo: 'Madrinha', nmRelacao: 'Prima' }),
    p('Caio', { nmConvidadoPrincipal: 'Bia' }),
    p('Dora'),
  ];
  assert.deepEqual(filtrarPorBusca(lista, '988887777').map(x => x.nmConvidado), ['Bia']);
  assert.deepEqual(filtrarPorBusca(lista, '(11) 98888').map(x => x.nmConvidado), ['Bia']);
  assert.deepEqual(filtrarPorBusca(lista, 'madrinha').map(x => x.nmConvidado), ['Bia']);
  assert.deepEqual(filtrarPorBusca(lista, 'prima').map(x => x.nmConvidado), ['Bia']);
  assert.deepEqual(filtrarPorBusca(lista, 'bia').map(x => x.nmConvidado), ['Bia', 'Caio']); // Caio acompanha a Bia
});

test('cascata oculta: conta quantos ligados vêm abaixo de cada principal', () => {
  const a = { id: 1 }, b = { id: 2 }, c2 = { id: 3 }, d = { id: 4 };
  const contagem = contarLigadosAbaixo([{ item: a, nivel: 0 }, { item: b, nivel: 1 }, { item: c2, nivel: 2 }, { item: d, nivel: 0 }]);
  assert.equal(contagem.get(a), 2);
  assert.equal(contagem.get(d), 0);
  assert.equal(contagem.has(b), false);
});

test('ações em massa: o principal não pode ser selecionado nem ligado a um selecionado', () => {
  const l = (idConvidado: number, idConvidadoPrincipal: number | null) => ({ idConvidado, idConvidadoPrincipal });
  // 1 <- 2 <- 3 ; 4 solto ; 5 solto
  const todos = [l(1, null), l(2, 1), l(3, 2), l(4, null), l(5, null)];
  assert.deepEqual(opcoesPrincipalEmMassa(todos, [4]).map(x => x.idConvidado), [1, 2, 3, 5]);
  assert.deepEqual(opcoesPrincipalEmMassa(todos, [1]).map(x => x.idConvidado), [4, 5]); // 2 e 3 descendem do 1
  assert.deepEqual(opcoesPrincipalEmMassa(todos, [2, 5]).map(x => x.idConvidado), [1, 4]);
  assert.deepEqual(opcoesPrincipalEmMassa(todos, []).length, 5);
});
