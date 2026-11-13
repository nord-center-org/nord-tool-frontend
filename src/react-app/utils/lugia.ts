/** Regras puras da tela da Lugia (chat multi-IA): leitura do SSE, anexos e URL do serviço. */

/**
 * "agente" é o agente Claude que executa pedidos no NordTool (modo Executar). "automatico" é a opção que troca
 * sozinha entre as IAs gratuitas; a resposta fica com o provedor que realmente respondeu.
 */
export type ProvedorIa = "claude" | "openai" | "gemini" | "groq" | "openrouter" | "mistral" | "nvidia" | "ollama" | "automatico" | "agente";

export interface ModeloIa {
  provedor: ProvedorIa;
  id: string;
  nome: string;
}

export type ParteTela =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagem"; nome?: string; mime?: string }
  | { tipo: "pdf"; nome?: string };

export interface MensagemTela {
  papel: "usuario" | "assistente";
  provedor?: ProvedorIa;
  partes: ParteTela[];
  /** Passos do agente (ferramentas usadas), só durante a resposta. */
  passos?: string[];
}

/** Resposta de /lugia/modelos. */
export interface InfoLugia {
  modelos: ModeloIa[];
  nivel: string;
  agenteDisponivel: boolean;
}

export interface EventoSse {
  evento: string;
  dados: string;
}

export const ROTULO_PROVEDOR: Record<ProvedorIa, string> = {
  claude: "Claude", openai: "ChatGPT", gemini: "Gemini", groq: "Groq (gratuito)", openrouter: "OpenRouter (gratuito)",
  mistral: "Mistral (gratuito)", nvidia: "NVIDIA (gratuito)", ollama: "Secretária local (sua máquina)", automatico: "Automático (gratuito)", agente: "Agente Claude",
};

/** Texto da opção no seletor: o id do modelo, ou uma explicação para o Automático. */
export function rotuloModelo(m: ModeloIa): string {
  return m.provedor === "automatico" ? "Troca sozinho entre as IAs gratuitas" : m.id;
}

/** Sites das IAs para abrir em janela ao lado, já com a conta da pessoa (não dá para embutir: eles bloqueiam iframe). */
export const SITES_IA = [
  { id: "claude", nome: "Claude", url: "https://claude.ai/new" },
  { id: "chatgpt", nome: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", nome: "Gemini", url: "https://gemini.google.com/app" },
] as const;

/** Recursos de window.open para uma janela estreita encostada na direita da tela. */
export function recursosJanelaLateral(larguraTela: number, alturaTela: number): string {
  const largura = Math.min(520, Math.max(360, Math.round(larguraTela * 0.35)));
  const altura = Math.max(480, alturaTela - 80);
  return `popup=yes,width=${largura},height=${altura},left=${Math.max(0, larguraTela - largura)},top=0`;
}

export const MIMES_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
export const MAX_ANEXOS = 5;
export const MAX_MB_ANEXO = 10;

/** URL absoluta da Lugia: base relativa (proxy do Vite) vira origem atual + caminho. */
export function urlLugia(base: string, caminho: string, origem: string): string {
  const raiz = /^https?:\/\//.test(base) ? base : `${origem}${base}`;
  return `${raiz}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}

/**
 * Leitor incremental de Server-Sent Events: recebe pedaços de texto do stream e devolve os eventos completos.
 * Guarda o resto (evento ainda incompleto) para o próximo pedaço.
 */
export function criarLeitorSse() {
  let resto = "";
  return (pedaco: string): EventoSse[] => {
    resto += pedaco.replace(/\r\n/g, "\n");
    const eventos: EventoSse[] = [];
    let fim = resto.indexOf("\n\n");
    while (fim >= 0) {
      const bloco = resto.slice(0, fim);
      resto = resto.slice(fim + 2);
      let evento = "message";
      const dados: string[] = [];
      for (const linha of bloco.split("\n")) {
        if (linha.startsWith("event:")) evento = linha.slice(6).trim();
        else if (linha.startsWith("data:")) dados.push(linha.slice(5).replace(/^ /, ""));
      }
      if (dados.length) eventos.push({ evento, dados: dados.join("\n") });
      fim = resto.indexOf("\n\n");
    }
    return eventos;
  };
}

/** Mensagem de erro para um arquivo que não pode ser anexado, ou null se estiver ok. */
export function validarArquivo(arquivo: { name: string; type: string; size: number }, jaAnexados: number): string | null {
  if (jaAnexados >= MAX_ANEXOS) return `No máximo ${MAX_ANEXOS} anexos por mensagem.`;
  if (!MIMES_ACEITOS.includes(arquivo.type)) return `${arquivo.name}: use imagem (PNG, JPEG, WEBP, GIF) ou PDF.`;
  if (arquivo.size > MAX_MB_ANEXO * 1024 * 1024) return `${arquivo.name}: maior que ${MAX_MB_ANEXO} MB.`;
  return null;
}

/** Texto da mensagem (partes de texto juntas), para exibir e copiar. */
export function textoDaMensagem(m: MensagemTela): string {
  return m.partes.filter((p): p is { tipo: "texto"; texto: string } => p.tipo === "texto").map(p => p.texto).join("\n");
}

/** Agrupa os modelos por provedor, na ordem em que chegaram. */
export function agruparModelos(modelos: ModeloIa[]): Array<{ provedor: ProvedorIa; modelos: ModeloIa[] }> {
  const grupos: Array<{ provedor: ProvedorIa; modelos: ModeloIa[] }> = [];
  for (const m of modelos) {
    const grupo = grupos.find(g => g.provedor === m.provedor);
    if (grupo) grupo.modelos.push(m);
    else grupos.push({ provedor: m.provedor, modelos: [m] });
  }
  return grupos;
}

const CHAVE_MODELO = "@NordTool:lugia_modelo";

export function lerModeloPreferido(storage: Pick<Storage, "getItem"> | undefined): string | null {
  try {
    return storage?.getItem(CHAVE_MODELO) ?? null;
  } catch {
    return null;
  }
}

export function salvarModeloPreferido(storage: Pick<Storage, "setItem"> | undefined, modelo: string): void {
  try {
    storage?.setItem(CHAVE_MODELO, modelo);
  } catch {
    // Sem armazenamento: só não lembra o modelo.
  }
}

/** Modelo inicial: o preferido, se ainda existir; senão o primeiro disponível. */
export function modeloInicial(modelos: ModeloIa[], preferido: string | null): string | null {
  if (preferido && modelos.some(m => m.id === preferido)) return preferido;
  return modelos[0]?.id ?? null;
}
