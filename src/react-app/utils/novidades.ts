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
