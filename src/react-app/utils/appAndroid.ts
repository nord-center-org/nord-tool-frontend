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

/** O que o app instalado conta sobre si (app 5.0 em diante) para a seção "App Android" das Configurações. */
export interface InfoDoApp {
  /** versionCode instalado; null nos apps antigos, que não sabem dizer. */
  versao: number | null;
  nomeVersao: string | null;
  /** Pede ao app para conferir agora (baixa e pede a autorização se houver versão nova); null nos apps antigos. */
  verificar: (() => void) | null;
}

type PonteVersao = { versaoApp?: () => number; nomeVersaoApp?: () => string; verificarAtualizacao?: () => void };

/** Null fora do app; dentro dele, a versão instalada e como pedir a verificação. */
export function infoDoApp(agente: string | undefined, janela: unknown = typeof window === "undefined" ? undefined : window): InfoDoApp | null {
  const p = (janela as { NordAndroid?: PonteVersao } | undefined)?.NordAndroid;
  if (!(agente ?? "").includes(MARCA_APP_ANDROID) && !p) return null;
  const ler = <T,>(f: (() => T) | undefined): T | null => {
    try { return typeof f === "function" ? f.call(p) : null; } catch { return null; }
  };
  const versao = ler(p?.versaoApp);
  return {
    versao: typeof versao === "number" && versao > 0 ? versao : null,
    nomeVersao: ler(p?.nomeVersaoApp),
    verificar: typeof p?.verificarAtualizacao === "function" ? () => p.verificarAtualizacao?.() : null,
  };
}

/** Situação comparando o instalado com o publicado em /app/versao.json. */
export function situacaoDoApp(instalada: number | null, publicada: number | null): "atualizado" | "desatualizado" | "antigo" | "desconhecido" {
  if (instalada === null) return "antigo";
  if (publicada === null) return "desconhecido";
  return instalada >= publicada ? "atualizado" : "desatualizado";
}
