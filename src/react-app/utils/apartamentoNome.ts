/** Interpreta o código do apartamento do NordTool (ex.: "EN-02-1307") para cabeçalhos de documentos. */

export interface ApartamentoInterpretado {
  empreendimento: string;
  torre: string;
  unidade: string;
  /** Texto original. */
  codigo: string;
}

const EMPREENDIMENTOS: Record<string, string> = {
  N1: 'Nord 1',
  N2: 'Nord 2',
  EN: 'Energy',
};

export function interpretarApartamento(codigo: string): ApartamentoInterpretado {
  const limpo = (codigo ?? '').trim();
  const partes = limpo.split('-').map(p => p.trim()).filter(Boolean);
  if (partes.length >= 3) {
    const prefixo = partes[0].toUpperCase();
    return {
      empreendimento: EMPREENDIMENTOS[prefixo] ?? partes[0],
      torre: partes[1],
      unidade: partes.slice(2).join('-'),
      codigo: limpo,
    };
  }
  return { empreendimento: '', torre: '', unidade: limpo, codigo: limpo };
}

const PROIBIDOS = ['<', '>', ':', '"', '/', String.fromCharCode(92), '|', '?', '*'];

/** Nome de arquivo seguro (sem caracteres proibidos no Windows). */
export function nomeArquivoSeguro(nome: string): string {
  let seguro = '';
  for (const caractere of nome) {
    const proibido = PROIBIDOS.includes(caractere) || caractere.charCodeAt(0) < 32;
    seguro += proibido ? '-' : caractere;
  }
  return seguro.trim();
}
