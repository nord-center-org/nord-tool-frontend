/** Endereço do APK do app Android, servido pelo próprio frontend (public/app). */
export const ENDERECO_APK = "/app/nordtool.apk";

/** Marca que o app Android acrescenta ao user agent da WebView. */
export const MARCA_APP_ANDROID = "NordToolAndroid";

/** Mostra o botão de baixar o app, exceto dentro do próprio app e no iPhone/iPad (onde o APK não instala). */
export function mostrarBotaoAppAndroid(agente: string | undefined): boolean {
  const texto = agente ?? "";
  if (texto.includes(MARCA_APP_ANDROID)) return false;
  return !/iPhone|iPad|iPod/i.test(texto);
}

/**
 * Ponte com o app Android (versão 2 em diante). O app guarda o token do aparelho no armazenamento privado do
 * celular, renova a sessão sem pedir a senha e lê os avisos em segundo plano.
 */
export interface PonteAndroid {
  /** Guarda o token do aparelho e a URL da API e liga o serviço em segundo plano. */
  registrar(token: string, apiBase: string): void;
  /** Pede uma sessão nova; a resposta chega em window.__nordAndroidSessao(id, json ou ""). */
  pedirSessao(id: string): void;
  temAparelho(): boolean;
  /** Saiu da conta: desconecta o aparelho e para o serviço. */
  sair(): void;
}

type JanelaComPonte = { NordAndroid?: Partial<PonteAndroid>; __nordAndroidSessao?: (id: string, json: string) => void };

/** A ponte do app, se este NordTool está aberto dentro do app Android v2+ (o app v1 só sabia salvar downloads). */
export function ponteAndroid(janela: unknown = typeof window === "undefined" ? undefined : window): PonteAndroid | null {
  const p = (janela as JanelaComPonte | undefined)?.NordAndroid;
  return p && typeof p.pedirSessao === "function" && typeof p.registrar === "function"
    && typeof p.temAparelho === "function" && typeof p.sair === "function" ? (p as PonteAndroid) : null;
}

/** URL absoluta da API (o serviço do app chama a API direto, fora da página). */
export function apiAbsoluta(apiBase: string, paginaAtual: string): string {
  try {
    return new URL(apiBase, paginaAtual).toString().replace(/\/+$/, "");
  } catch {
    return apiBase;
  }
}

let pedidos = 0;

/**
 * Pede ao app uma sessão nova com o token do aparelho. Devolve o JSON da sessão (o mesmo corpo de /auth/login) ou
 * null se o app não tiver aparelho, se o aparelho foi desconectado ou se não respondeu a tempo.
 */
export function pedirSessaoAoApp(esperaMs = 15_000, janela: unknown = typeof window === "undefined" ? undefined : window): Promise<unknown | null> {
  const ponte = ponteAndroid(janela);
  const w = janela as JanelaComPonte | undefined;
  if (!ponte || !w) return Promise.resolve(null);
  let tem = false;
  try { tem = ponte.temAparelho(); } catch { tem = false; }
  if (!tem) return Promise.resolve(null);
  const id = `s${++pedidos}`;
  return new Promise(resolve => {
    const anterior = w.__nordAndroidSessao;
    const terminar = (valor: unknown | null) => {
      clearTimeout(limite);
      if (w.__nordAndroidSessao === receber) w.__nordAndroidSessao = anterior;
      resolve(valor);
    };
    const receber = (idResposta: string, json: string) => {
      if (idResposta !== id) { anterior?.(idResposta, json); return; }
      try { terminar(json ? JSON.parse(json) : null); } catch { terminar(null); }
    };
    const limite = setTimeout(() => terminar(null), esperaMs);
    w.__nordAndroidSessao = receber;
    try { ponte.pedirSessao(id); } catch { terminar(null); }
  });
}
