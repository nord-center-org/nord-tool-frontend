import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE_SESSAO, destinoSeguro, gravarSessao, lerSessao, moduloDaRota, msAteRenovar, podeAbrirRota, podeAcessar, sessaoValida,
  type Sessao,
} from './sessao.ts';

const permissoes = [
  { cdModulo: 'FINANCEIRO', cdAcao: 'LEITURA' },
  { cdModulo: 'CASAMENTO', cdAcao: 'ADMIN' },
];

test('nível maior atende os menores e módulo ausente nega', () => {
  assert.equal(podeAcessar(permissoes, 'FINANCEIRO'), true);
  assert.equal(podeAcessar(permissoes, 'FINANCEIRO', 'ESCRITA'), false);
  assert.equal(podeAcessar(permissoes, 'CASAMENTO', 'ESCRITA'), true);
  assert.equal(podeAcessar(permissoes, 'CAIXINHA'), false);
  assert.equal(podeAcessar([{ cdModulo: 'CAIXINHA', cdAcao: 'DESCONHECIDA' }], 'CAIXINHA'), false);
  assert.equal(podeAcessar(undefined, 'VISTORIA'), false);
});

test('rotas do menu exigem o módulo e as demais só o login', () => {
  assert.equal(moduloDaRota('/gestao/financeiro'), 'FINANCEIRO');
  assert.equal(moduloDaRota('/apartamentos'), 'VISTORIA');
  assert.equal(moduloDaRota('/apartamentosx'), null);
  assert.equal(moduloDaRota('/configuracoes'), null);
  assert.equal(podeAbrirRota(permissoes, '/gestao/casamento'), true);
  assert.equal(podeAbrirRota(permissoes, '/gestao/caixinha'), false);
  assert.equal(podeAbrirRota(permissoes, '/'), true);
});

test('renova dois minutos antes de expirar, sem passar do fim da sessão', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const sessao = { expiraEm: '2026-10-08T12:15:00Z', sessaoExpiraEm: '2026-10-08T20:00:00Z' };
  assert.equal(msAteRenovar(sessao, agora), 13 * 60_000);
  assert.equal(msAteRenovar({ ...sessao, expiraEm: '2026-10-08T12:01:00Z' }, agora), 5_000);
  assert.equal(msAteRenovar({ ...sessao, sessaoExpiraEm: '2026-10-08T12:15:00Z' }, agora), null);
  assert.equal(msAteRenovar({ ...sessao, expiraEm: '2026-10-08T11:59:00Z' }, agora), null);
});

test('sessão vale só com token e antes da expiração', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const base = { token: 't', expiraEm: '2026-10-08T12:15:00Z' } as Sessao;
  assert.equal(sessaoValida(base, agora), true);
  assert.equal(sessaoValida({ ...base, expiraEm: '2026-10-08T11:00:00Z' }, agora), false);
  assert.equal(sessaoValida({ ...base, token: '' }, agora), false);
  assert.equal(sessaoValida(null, agora), false);
});

test('destino após login só aceita caminho interno', () => {
  assert.equal(destinoSeguro('/gestao/financeiro?mes=2026-10'), '/gestao/financeiro?mes=2026-10');
  assert.equal(destinoSeguro('https://evil.example'), '/');
  assert.equal(destinoSeguro('//evil.example'), '/');
  assert.equal(destinoSeguro('/\\evil.example'), '/');
  assert.equal(destinoSeguro('/login'), '/');
  assert.equal(destinoSeguro(null), '/');
});

test('grava, lê e limpa a sessão tolerando conteúdo inválido', () => {
  const dados = new Map<string, string>();
  const armazenamento = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
  };
  const sessao = { token: 'abc', expiraEm: 'x', inatividadeMinutos: 15, sessaoExpiraEm: 'y',
    usuario: { id: 1, nome: 'A', email: 'a@b.com', perfil: 'ADMIN', permissoes: [] } };
  gravarSessao(armazenamento, sessao);
  assert.deepEqual(lerSessao(armazenamento), sessao);
  gravarSessao(armazenamento, null);
  assert.equal(lerSessao(armazenamento), null);
  dados.set(CHAVE_SESSAO, '{quebrado');
  assert.equal(lerSessao(armazenamento), null);
  assert.equal(lerSessao(undefined), null);
});
