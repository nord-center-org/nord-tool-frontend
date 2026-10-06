/** Atualização otimista com rollback (o Lugia não desfazia a alteração local quando o salvamento falhava). */

export interface OpcoesOtimista<T> {
  /** Aplica a mudança na tela imediatamente. */
  aplicar?: () => void;
  /** Desfaz a mudança local se o envio falhar. */
  desfazer?: () => void;
  /** Envia ao servidor. */
  enviar: () => Promise<T>;
}

export type ResultadoOtimista<T> = { ok: true; valor: T } | { ok: false; mensagem: string };

export function mensagemDeErro(erro: unknown, padrao = "Não foi possível salvar. Tente novamente."): string {
  return erro instanceof Error && erro.message ? erro.message : padrao;
}

export async function executarOtimista<T>(opcoes: OpcoesOtimista<T>): Promise<ResultadoOtimista<T>> {
  opcoes.aplicar?.();
  try {
    return { ok: true, valor: await opcoes.enviar() };
  } catch (erro) {
    opcoes.desfazer?.();
    return { ok: false, mensagem: mensagemDeErro(erro) };
  }
}
