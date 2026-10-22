/** Regras puras das telas públicas de cadastro e senha. */

export const SENHA_MIN = 10;
export const SENHA_MAX_BYTES = 72;

/** Mesmo critério do backend: 10+ caracteres e até 72 bytes (acentos contam 2). */
export function problemaNaSenha(senha: string, confirmacao?: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha deve ter ao menos ${SENHA_MIN} caracteres.`;
  if (new TextEncoder().encode(senha).length > SENHA_MAX_BYTES) return `A senha deve ter no máximo ${SENHA_MAX_BYTES} bytes (acentos contam 2).`;
  if (confirmacao !== undefined && senha !== confirmacao) return "As senhas não conferem.";
  return null;
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Força simples só para orientar quem digita (0 a 3). */
export function forcaSenha(senha: string): 0 | 1 | 2 | 3 {
  if (senha.length < SENHA_MIN) return 0;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(senha)).length;
  if (senha.length >= 14 && tipos >= 3) return 3;
  return tipos >= 2 ? 2 : 1;
}
