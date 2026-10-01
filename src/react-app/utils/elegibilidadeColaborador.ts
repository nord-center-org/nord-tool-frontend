import type { Colaborador } from '../services/ColaboradorService';

const normalizarPermissao = (valor?: string): string =>
  (valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');

export const podeRetirarChave = (colaborador: Colaborador): boolean =>
  normalizarPermissao(colaborador.nmPermissao).includes('retirar');

export const podeLiberarChave = (colaborador: Colaborador): boolean =>
  normalizarPermissao(colaborador.nmPermissao).includes('liberar');
