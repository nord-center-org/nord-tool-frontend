import assert from 'node:assert/strict';
import test from 'node:test';
import type { Colaborador } from '../services/ColaboradorService';
import { podeLiberarChave, podeRetirarChave } from './elegibilidadeColaborador.ts';

const colaborador = (nmPermissao: string): Colaborador => ({
  nmColaborador: 'Colaborador de teste',
  nrCelular: '',
  idEmpresa: 1,
  idCargo: 1,
  idPermissao: 1,
  nmPermissao,
});

test('"Retirar" permite retirar mas não liberar', () => {
  const retirar = colaborador('  RetIrAr  ');
  assert.equal(podeRetirarChave(retirar), true);
  assert.equal(podeLiberarChave(retirar), false);
});

test('"Liberar e retirar" permite ambos, com normalização de caixa e acentos', () => {
  const ambos = colaborador('  LIBERAR E RETIRAR  ');
  assert.equal(podeRetirarChave(ambos), true);
  assert.equal(podeLiberarChave(ambos), true);
});

test('"Liberar" sozinho permite só liberar', () => {
  const liberar = colaborador('Liberar');
  assert.equal(podeRetirarChave(liberar), false);
  assert.equal(podeLiberarChave(liberar), true);
});

test('permissão vazia ou sem relação não permite nada', () => {
  for (const permissao of ['Visualizar', '']) {
    const outro = colaborador(permissao);
    assert.equal(podeRetirarChave(outro), false);
    assert.equal(podeLiberarChave(outro), false);
  }
});
