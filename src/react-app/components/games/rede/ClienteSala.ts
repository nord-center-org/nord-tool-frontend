import { API_BASE } from "@/react-app/config/api";
import { salasService, type GameSala } from "@/react-app/services/GamesService";
import { esperaDaTentativa, urlDoSocket } from "@/react-app/utils/games/sala";

export type EstadoConexao = "conectando" | "conectado" | "reconectando" | "fechada";

export interface MensagemSala { t: string; [chave: string]: unknown }

const PING_MS = 20_000;
const MAX_TENTATIVAS = 12;

/**
 * Conexão com uma sala de Games. Se cair (wi-fi, tela apagada), pede um bilhete novo pelo código e volta sozinha
 * para a mesma vaga; só desiste quando a sala fecha ou depois de várias tentativas.
 */
export class ClienteSala {
  private ws: WebSocket | null = null;
  private tentativas = 0;
  private ping: number | undefined;
  private espera: number | undefined;
  private encerrado = false;
  ingresso: GameSala;
  private readonly aoMensagem: (m: MensagemSala) => void;
  private readonly aoEstado: (e: EstadoConexao, motivo?: string) => void;

  constructor(ingresso: GameSala, aoMensagem: (m: MensagemSala) => void, aoEstado: (e: EstadoConexao, motivo?: string) => void) {
    this.ingresso = ingresso;
    this.aoMensagem = aoMensagem;
    this.aoEstado = aoEstado;
    this.abrir();
  }

  private abrir() {
    this.aoEstado(this.tentativas ? "reconectando" : "conectando");
    const ws = new WebSocket(urlDoSocket(API_BASE, window.location.origin, this.ingresso.bilhete));
    this.ws = ws;
    ws.onopen = () => {
      this.tentativas = 0;
      this.aoEstado("conectado");
      window.clearInterval(this.ping);
      this.ping = window.setInterval(() => this.enviar({ t: "ping" }), PING_MS);
    };
    ws.onmessage = ev => {
      let m: MensagemSala | null = null;
      try { m = JSON.parse(String(ev.data)) as MensagemSala; } catch { /* mensagem estragada: ignora */ }
      if (!m || typeof m.t !== "string") return;
      if (m.t === "fechada") {
        this.encerrado = true;
        this.aoEstado("fechada", typeof m.motivo === "string" ? m.motivo : undefined);
      }
      this.aoMensagem(m);
    };
    ws.onclose = ev => {
      window.clearInterval(this.ping);
      if (this.ws !== ws || this.encerrado) return;
      if (ev.reason === "Conectado em outro aparelho" || ev.reason === "Saiu da sala") {
        this.encerrado = true;
        this.aoEstado("fechada", ev.reason);
        return;
      }
      this.reconectar();
    };
  }

  private reconectar() {
    if (this.tentativas >= MAX_TENTATIVAS) {
      this.encerrado = true;
      this.aoEstado("fechada", "Não deu para reconectar");
      return;
    }
    this.aoEstado("reconectando");
    this.espera = window.setTimeout(async () => {
      this.tentativas++;
      try {
        const novo = await salasService.entrar(this.ingresso.codigo);
        if (!novo) throw new Error("sem ingresso");
        this.ingresso = novo;
        if (!this.encerrado) this.abrir();
      } catch (e) {
        // Sala que não existe mais não volta.
        if (String((e as Error)?.message ?? "").includes("não encontrada")) {
          this.encerrado = true;
          this.aoEstado("fechada", "A sala foi encerrada");
        } else if (!this.encerrado) {
          this.reconectar();
        }
      }
    }, esperaDaTentativa(this.tentativas));
  }

  enviar(m: MensagemSala) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  fechar(avisar?: MensagemSala) {
    if (avisar) this.enviar(avisar);
    this.encerrado = true;
    window.clearInterval(this.ping);
    window.clearTimeout(this.espera);
    this.ws?.close();
    this.ws = null;
  }
}
