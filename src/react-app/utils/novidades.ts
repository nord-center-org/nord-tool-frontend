/**
 * Novidades anunciadas pelo Lugia Nexus, o mascote da tela inicial.
 * Toda entrega publicada acrescenta uma entrada NO TOPO desta lista (a mais recente primeiro), com id único.
 */

export interface Novidade {
  /** Único e estável: data + assunto, ex.: "2026-10-25-lugia-chat". */
  id: string;
  /** Data da publicação (AAAA-MM-DD). */
  data: string;
  titulo: string;
  /** O que mudou, em uma ou duas frases para quem usa o app. */
  texto: string;
  /** Onde ver a novidade no app. */
  onde?: { rotulo: string; caminho: string };
}

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-10-27-escadinha-3d",
    data: "2026-10-27",
    titulo: "Escadinha 3D: o prédio a partir da prancha",
    texto: "Anexe o PDF da planta chave: o NordTool acha o contorno da torre e os pavimentos e monta o prédio em 3D. Gire, use o cubo de vistas e toque num pavimento para ele sair da torre e virar planta 2D, com as atividades do ciclo ao lado.",
    onde: { rotulo: "Menu → Organizacional → Escadinha", caminho: "/organizacional/escadinha" },
  },
  {
    id: "2026-10-27-desfile-obra",
    data: "2026-10-27",
    titulo: "Máquinas passando pela obra",
    texto: "Na cena da obra agora passam, uma de cada vez, a betoneira, a retroescavadeira, a Bobcat e o time de engenharia a pé. E o céu da tela de login ocupa a tela inteira, sem a faixa cortada no topo.",
    onde: { rotulo: "Início → cena da obra", caminho: "/" },
  },
  {
    id: "2026-10-25-lugia-gratuita",
    data: "2026-10-25",
    titulo: "Lugia mais rápida e com opções gratuitas",
    texto: "Novos modelos gratuitos e rápidos (Groq e OpenRouter), o Gemini tenta de novo sozinho quando está sobrecarregado, e os botões no topo abrem Claude, ChatGPT ou Gemini numa janela ao lado, com a sua conta.",
    onde: { rotulo: "Lugia (IA) → topo da tela e seletor de modelo", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-executar",
    data: "2026-10-25",
    titulo: "Lugia no ar: converse e peça mudanças no app",
    texto: "O chat agora roda direto no NordTool. Quem é Admin da Lugia ganha o modo \"Executar no NordTool\": descreva a mudança (com print, se quiser) e o agente Claude altera o código, abre o PR e faz o merge quando o CI passar.",
    onde: { rotulo: "Lugia (IA) → Executar no NordTool", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-print",
    data: "2026-10-25",
    titulo: "Mostre para a Lugia: print de qualquer tela",
    texto: "No chat, toque em \"Print do app\", vá até a tela, marque a área e o recorte volta como anexo, com a conversa do jeito que estava. Em qualquer tela também há o botão de recorte no topo.",
    onde: { rotulo: "Lugia (IA) → Print do app", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-atalho",
    data: "2026-10-25",
    titulo: "Atalho para a Lugia no menu",
    texto: "Ao lado de Configurações, no rodapé do menu, o ícone de brilho abre o chat com a Lugia.",
    onde: { rotulo: "Menu → ícone ao lado de Configurações", caminho: "/lugia" },
  },
  {
    id: "2026-10-25-lugia-chat",
    data: "2026-10-25",
    titulo: "Chegou a Lugia: Claude, ChatGPT e Gemini no NordTool",
    texto: "Converse com as três IAs num lugar só, troque de modelo no meio da conversa e anexe fotos ou PDFs (termos, comprovantes, plantas). O histórico fica salvo.",
    onde: { rotulo: "Menu → Visão Geral → Lugia (IA)", caminho: "/lugia" },
  },
];

const PREFIXO = "@NordTool:novidade_vista:";

export const chaveNovidadeVista = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

/** Novidades que a pessoa ainda não viu: as que vêm antes da última vista (a lista é da mais nova para a mais antiga). */
export function naoVistas(lista: Novidade[], ultimaVista: string | null): Novidade[] {
  if (!ultimaVista) return lista;
  const posicao = lista.findIndex(n => n.id === ultimaVista);
  return posicao < 0 ? lista : lista.slice(0, posicao);
}

export function lerUltimaVista(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): string | null {
  try {
    return storage?.getItem(chaveNovidadeVista(idUsuario)) ?? null;
  } catch {
    return null;
  }
}

export function marcarVista(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string, id: string): void {
  try {
    storage?.setItem(chaveNovidadeVista(idUsuario), id);
  } catch {
    // Sem armazenamento: o mascote só volta a contar a novidade.
  }
}

/** "25 out" a partir de AAAA-MM-DD, sem depender do fuso do aparelho. */
export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-").map(Number);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return mes >= 1 && mes <= 12 && dia ? `${dia} ${meses[mes - 1]}` : iso;
}
