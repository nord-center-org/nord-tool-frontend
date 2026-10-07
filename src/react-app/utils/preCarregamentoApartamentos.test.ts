import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_PRE_CARREGAMENTO, alternarValor, lerPreCarregamento, montarPreCarregamento, resolverPreCarregamento,
} from './preCarregamentoApartamentos.ts';

const armazem = (itens: Record<string, string>) => ({ getItem: (k: string) => itens[k] ?? null });

test('sem nada salvo mantém o padrão antigo (Agendado e Pendente) e sem ordenação', () => {
  assert.deepEqual(lerPreCarregamento(armazem({})), { filtros: { status: ['Agendado', 'Pendente'] }, ordenacao: null });
});

test('migra o "status padrão" antigo quando a chave nova não existe', () => {
  const lido = lerPreCarregamento(armazem({ '@NordTool:filter_db_status': '["Aprovado"]' }));
  assert.deepEqual(lido, { filtros: { status: ['Aprovado'] }, ordenacao: null });
  assert.deepEqual(lerPreCarregamento(armazem({ '@NordTool:filter_db_status': '[]' })), { filtros: {}, ordenacao: null });
});

test('a chave nova vence a antiga e conteúdo inválido é ignorado', () => {
  const salvo = JSON.stringify({
    filtros: { status: ['Liberado'], coluna_falsa: ['x'], data: ['@hoje', '  '], termo: 'nao-e-lista' },
    ordenacao: { coluna: 'data', direcao: 'desc' },
  });
  const lido = lerPreCarregamento(armazem({ [CHAVE_PRE_CARREGAMENTO]: salvo, '@NordTool:filter_db_status': '["Aprovado"]' }));
  assert.deepEqual(lido, { filtros: { status: ['Liberado'], data: ['@hoje'] }, ordenacao: { coluna: 'data', direcao: 'desc' } });
  assert.deepEqual(lerPreCarregamento(armazem({ [CHAVE_PRE_CARREGAMENTO]: JSON.stringify({ ordenacao: { coluna: 'x', direcao: 'asc' } }) })), { filtros: {}, ordenacao: null });
  // JSON quebrado cai no padrão em vez de lançar erro
  assert.deepEqual(lerPreCarregamento(armazem({ [CHAVE_PRE_CARREGAMENTO]: '{quebrado' })).filtros, { status: ['Agendado', 'Pendente'] });
});

const valores = {
  apartamento: ['N1-01-0101', 'N1-01-0102', 'N2-03-0301'],
  status: ['Agendado', 'Aprovado', 'Aprovado DAT', 'Pendente'],
  data: ['05/10/2026', '06/10/2026', '07/10/2026', '—'],
  horario: ['09:00', '14:00', '—'],
  observacao: ['Chave com o zelador', '—'],
  termo: ['Sem termo', 'Pendente', 'Em andamento', 'Concluído'],
  fotos: ['1 foto', '11 fotos', '—'],
};
const hoje = new Date(2026, 9, 6); // 06/10/2026

test('status casa por "contém" (Aprovado também pega Aprovado DAT), sem diferenciar caixa', () => {
  const r = resolverPreCarregamento({ filtros: { status: ['aprovado', 'Pendente'] }, ordenacao: null }, valores, hoje);
  assert.deepEqual(r.status, ['Aprovado', 'Aprovado DAT', 'Pendente']);
});

test('data aceita hoje, amanhã, data fixa e "sem data"', () => {
  const r = resolverPreCarregamento({ filtros: { data: ['@hoje', '@amanha', '05/10/2026', '—'] }, ordenacao: null }, valores, hoje);
  assert.deepEqual(r.data, ['05/10/2026', '06/10/2026', '07/10/2026', '—']);
  assert.deepEqual(resolverPreCarregamento({ filtros: { data: ['@hoje'] }, ordenacao: null }, valores, hoje).data, ['06/10/2026']);
});

test('fotos e horário são exatos ("1 foto" não pega "11 fotos"); apartamento e observação são por contém', () => {
  assert.deepEqual(resolverPreCarregamento({ filtros: { fotos: ['1 foto'] }, ordenacao: null }, valores, hoje).fotos, ['1 foto']);
  assert.deepEqual(resolverPreCarregamento({ filtros: { horario: ['14:00'] }, ordenacao: null }, valores, hoje).horario, ['14:00']);
  assert.deepEqual(resolverPreCarregamento({ filtros: { apartamento: ['n1-01'] }, ordenacao: null }, valores, hoje).apartamento, ['N1-01-0101', 'N1-01-0102']);
  assert.deepEqual(resolverPreCarregamento({ filtros: { observacao: ['zelador'] }, ordenacao: null }, valores, hoje).observacao, ['Chave com o zelador']);
});

test('coluna sem nenhum valor correspondente fica sem filtro (não abre a tela vazia)', () => {
  const r = resolverPreCarregamento({ filtros: { status: ['Inexistente'], termo: ['Concluído'] }, ordenacao: null }, valores, hoje);
  assert.equal(r.status, undefined);
  assert.deepEqual(r.termo, ['Concluído']);
});

test('alternar valor e montar a preferência (sem colunas vazias nem repetidos)', () => {
  assert.deepEqual(alternarValor(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(alternarValor(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(
    montarPreCarregamento({ status: ['A', 'A', ' '], data: [], termo: ['Pendente'] }, { coluna: 'status', direcao: 'asc' }),
    { filtros: { status: ['A'], termo: ['Pendente'] }, ordenacao: { coluna: 'status', direcao: 'asc' } },
  );
});
