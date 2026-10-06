import test from 'node:test';
import assert from 'node:assert/strict';
import { executarOtimista, mensagemDeErro } from './otimista.ts';

test('aplica antes de enviar e mantém a mudança quando o envio dá certo', async () => {
  const chamadas: string[] = [];
  const r = await executarOtimista({
    aplicar: () => chamadas.push('aplicar'),
    desfazer: () => chamadas.push('desfazer'),
    enviar: async () => { chamadas.push('enviar'); return 42; },
  });
  assert.deepEqual(chamadas, ['aplicar', 'enviar']);
  assert.deepEqual(r, { ok: true, valor: 42 });
});

test('desfaz a mudança e devolve a mensagem quando o envio falha', async () => {
  const chamadas: string[] = [];
  const r = await executarOtimista({
    aplicar: () => chamadas.push('aplicar'),
    desfazer: () => chamadas.push('desfazer'),
    enviar: async () => { throw new Error('Anexe ao menos uma foto'); },
  });
  assert.deepEqual(chamadas, ['aplicar', 'desfazer']);
  assert.deepEqual(r, { ok: false, mensagem: 'Anexe ao menos uma foto' });
});

test('funciona sem aplicar/desfazer e com erro sem mensagem', async () => {
  const r = await executarOtimista({ enviar: async () => { throw new Error(''); } });
  assert.equal(r.ok, false);
  assert.equal(mensagemDeErro(new Error('')), 'Não foi possível salvar. Tente novamente.');
  assert.equal(mensagemDeErro('texto solto'), 'Não foi possível salvar. Tente novamente.');
  assert.equal(mensagemDeErro(null, 'padrão'), 'padrão');
});
