import { exemplos, type LoteCeramica, type LoteCeramicaForm } from "../utils/loteCeramica";

/**
 * Lotes de cerâmica guardados no navegador (localStorage). Camada isolada com a mesma forma de um serviço de API
 * (assíncrona, por id): para ir ao banco depois, basta trocar a implementação por chamadas ao backend.
 */
const CHAVE = "@NordTool:lotes-ceramica:v1";

function ler(): LoteCeramica[] | null {
  try {
    const texto = localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as LoteCeramica[]) : null;
  } catch {
    return null;
  }
}

function gravar(lista: LoteCeramica[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Armazenamento indisponível (modo privado): os dados valem enquanto a tela estiver aberta.
  }
}

let memoria: LoteCeramica[] | null = null;

function todos(): LoteCeramica[] {
  if (!memoria) {
    memoria = ler() ?? exemplos();
    gravar(memoria);
  }
  return memoria;
}

function salvarTodos(lista: LoteCeramica[]): LoteCeramica[] {
  memoria = lista;
  gravar(lista);
  return lista;
}

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `lote-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const loteCeramicaService = {
  async listar(): Promise<LoteCeramica[]> {
    return [...todos()];
  },
  async criar(form: LoteCeramicaForm): Promise<LoteCeramica> {
    const novo = { ...form, id: novoId() };
    salvarTodos([novo, ...todos()]);
    return novo;
  },
  async salvar(id: string, form: LoteCeramicaForm): Promise<LoteCeramica> {
    const atualizado = { ...form, id };
    salvarTodos(todos().map(l => (l.id === id ? atualizado : l)));
    return atualizado;
  },
  async excluir(id: string): Promise<void> {
    salvarTodos(todos().filter(l => l.id !== id));
  },
  /** Volta para os registros de exemplo (útil para demonstrar de novo). */
  async restaurarExemplos(): Promise<LoteCeramica[]> {
    return [...salvarTodos(exemplos())];
  },
};
