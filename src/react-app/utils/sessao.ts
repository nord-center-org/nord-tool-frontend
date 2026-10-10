/**
 * Regras puras da sessão no navegador: níveis de permissão, módulo de cada rota, momento da renovação e
 * destino seguro após o login. A autorização de verdade é do backend; aqui só decidimos o que mostrar.
 */

export type Acao = "NENHUM" | "LEITURA" | "ESCRITA" | "ADMIN";

export type Modulo =
  | "VISTORIA"
  | "TERMO_REPROVA"
  | "CRONOGRAMA"
  | "CONTROLE_CHAVES"
  | "CAIXINHA"
  | "FINANCEIRO"
  | "CASAMENTO"
  | "CADASTROS"
  | "ADMINISTRACAO";

export interface Permissao {
  cdModulo: string;
  cdAcao: string;
}

export interface UsuarioSessao {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  permissoes: Permissao[];
}

/** Corpo de /auth/login, /auth/refresh e /auth/alterar-senha. */
export interface Sessao {
  token: string;
  /** Expiração do token (ISO-8601). */
  expiraEm: string;
  /** Duração do token em minutos; também é o tempo de inatividade tolerado. */
  inatividadeMinutos: number;
  /** Fim absoluto da sessão (ISO-8601): depois disso só com novo login. */
  sessaoExpiraEm: string;
  usuario: UsuarioSessao;
}

const NIVEL: Record<Acao, number> = { NENHUM: 0, LEITURA: 1, ESCRITA: 2, ADMIN: 3 };

function nivel(acao: string | undefined): number {
  return acao && acao in NIVEL ? NIVEL[acao as Acao] : 0;
}

/** O backend já devolve as permissões efetivas por módulo (sem curinga). */
export function podeAcessar(permissoes: Permissao[] | undefined, modulo: Modulo, acao: Acao = "LEITURA"): boolean {
  const linha = (permissoes ?? []).find(p => p.cdModulo === modulo);
  return nivel(linha?.cdAcao) >= NIVEL[acao];
}

/** Módulo exigido por cada área do menu; rotas sem módulo só exigem login. */
const MODULO_POR_ROTA: Array<[string, Modulo]> = [
  ["/entregas", "VISTORIA"],
  ["/apartamentos", "VISTORIA"],
  ["/dashboard", "VISTORIA"],
  ["/organizacional/controle-chaves", "CONTROLE_CHAVES"],
  ["/organizacional/cronograma", "CRONOGRAMA"],
  ["/gestao/financeiro", "FINANCEIRO"],
  ["/gestao/casamento", "CASAMENTO"],
  ["/gestao/caixinha", "CAIXINHA"],
];

export function moduloDaRota(caminho: string): Modulo | null {
  const achado = MODULO_POR_ROTA.find(([prefixo]) => caminho === prefixo || caminho.startsWith(prefixo + "/"));
  return achado ? achado[1] : null;
}

export function podeAbrirRota(permissoes: Permissao[] | undefined, caminho: string): boolean {
  const modulo = moduloDaRota(caminho);
  return modulo === null || podeAcessar(permissoes, modulo);
}

/** Renova 2 minutos antes de expirar (nunca antes de 5 s nem depois do fim da sessão). */
export function msAteRenovar(sessao: Pick<Sessao, "expiraEm" | "sessaoExpiraEm">, agora: number): number | null {
  const expira = Date.parse(sessao.expiraEm);
  const fim = Date.parse(sessao.sessaoExpiraEm);
  if (!Number.isFinite(expira) || !Number.isFinite(fim) || expira <= agora) return null;
  if (expira >= fim) return null; // o token já vai até o fim da sessão: não há o que renovar
  return Math.max(5_000, expira - agora - 120_000);
}

export function sessaoValida(sessao: Sessao | null, agora: number): sessao is Sessao {
  if (!sessao || !sessao.token) return false;
  const expira = Date.parse(sessao.expiraEm);
  return Number.isFinite(expira) && expira > agora;
}

/** Só caminhos internos: evita redirecionar para outro site depois do login. */
export function destinoSeguro(voltar: string | null | undefined): string {
  if (!voltar || !voltar.startsWith("/") || voltar.startsWith("//") || voltar.startsWith("/\\") || voltar.startsWith("/login")) {
    return "/";
  }
  return voltar;
}

export const CHAVE_SESSAO = "@NordTool:sessao";

interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export function lerSessao(armazenamento: Armazenamento | undefined): Sessao | null {
  try {
    const texto = armazenamento?.getItem(CHAVE_SESSAO);
    if (!texto) return null;
    const sessao = JSON.parse(texto) as Sessao;
    return sessao && typeof sessao.token === "string" ? sessao : null;
  } catch {
    return null;
  }
}

export function gravarSessao(armazenamento: Armazenamento | undefined, sessao: Sessao | null): void {
  try {
    if (sessao) armazenamento?.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    else armazenamento?.removeItem(CHAVE_SESSAO);
  } catch {
    // Armazenamento indisponível (modo privado): a sessão vale só enquanto a página estiver aberta.
  }
}
