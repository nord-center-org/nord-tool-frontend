/** "Juice" do motor 2D: partículas, tremor de câmera, textos flutuantes e curvas de suavização. Tudo desenhado por código. */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const suave = (t: number) => t * t * (3 - 2 * t);
export const saidaElastica = (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
export const saidaVolta = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

export interface Particula {
  x: number; y: number; vx: number; vy: number; vida: number; total: number; tamanho: number; cor: string;
  gravidade: number; atrito: number; forma: "quadrado" | "circulo" | "fumaca" | "faisca"; giro: number; angulo: number;
}

export class Particulas {
  lista: Particula[] = [];
  constructor(private limite = 900) {}

  emitir(n: number, base: Partial<Particula> & { x: number; y: number }, espalhar = 1) {
    for (let i = 0; i < n && this.lista.length < this.limite; i++) {
      const ang = Math.random() * Math.PI * 2;
      const vel = (0.4 + Math.random()) * espalhar;
      const total = (base.total ?? 0.6) * (0.6 + Math.random() * 0.8);
      this.lista.push({
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, tamanho: 0.12, cor: "#fff", gravidade: 0, atrito: 0.9, forma: "quadrado",
        giro: (Math.random() - 0.5) * 8, angulo: Math.random() * 6, ...base, vida: total, total,
      });
    }
  }

  atualizar(dt: number) {
    for (const p of this.lista) {
      p.vida -= dt;
      p.vx *= p.atrito ** (dt * 60);
      p.vy = p.vy * p.atrito ** (dt * 60) + p.gravidade * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angulo += p.giro * dt;
    }
    this.lista = this.lista.filter(p => p.vida > 0);
  }

  /** Desenha com a escala da tela (posições em unidades do jogo, ex.: casas). */
  desenhar(ctx: CanvasRenderingContext2D, escala: number) {
    for (const p of this.lista) {
      const t = Math.max(0, p.vida / p.total);
      ctx.globalAlpha = p.forma === "fumaca" ? t * 0.5 : Math.min(1, t * 1.6);
      ctx.fillStyle = p.cor;
      const s = p.tamanho * escala * (p.forma === "fumaca" ? 1 + (1 - t) * 2 : t * 0.6 + 0.4);
      const x = p.x * escala, y = p.y * escala;
      if (p.forma === "circulo" || p.forma === "fumaca") {
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.forma === "faisca") {
        ctx.strokeStyle = p.cor;
        ctx.lineWidth = Math.max(1, s / 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vx * escala * 0.04, y - p.vy * escala * 0.04);
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angulo);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Tremor de câmera com decaimento (trauma ao quadrado, como nos jogos de ação). */
export class Tremor {
  private trauma = 0;
  adicionar(q: number) {
    this.trauma = Math.min(1, this.trauma + q);
  }
  deslocamento(dt: number, escala: number): [number, number] {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const f = this.trauma * this.trauma;
    return [(Math.random() * 2 - 1) * f * escala * 0.35, (Math.random() * 2 - 1) * f * escala * 0.35];
  }
}

export interface TextoFlutuante { x: number; y: number; texto: string; cor: string; vida: number; total: number }

export class Textos {
  lista: TextoFlutuante[] = [];
  mostrar(x: number, y: number, texto: string, cor = "#fff", total = 1) {
    this.lista.push({ x, y, texto, cor, vida: total, total });
  }
  atualizar(dt: number) {
    for (const t of this.lista) t.vida -= dt;
    this.lista = this.lista.filter(t => t.vida > 0);
  }
  desenhar(ctx: CanvasRenderingContext2D, escala: number) {
    ctx.textAlign = "center";
    for (const t of this.lista) {
      const p = 1 - t.vida / t.total;
      const pulo = saidaVolta(Math.min(1, p * 3));
      ctx.globalAlpha = Math.min(1, t.vida * 2.5);
      ctx.font = `900 ${Math.round(escala * 0.42 * pulo)}px system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, escala * 0.08);
      ctx.strokeStyle = "rgba(0,0,0,.75)";
      const y = (t.y - p * 0.9) * escala;
      ctx.strokeText(t.texto, t.x * escala, y);
      ctx.fillStyle = t.cor;
      ctx.fillText(t.texto, t.x * escala, y);
    }
    ctx.globalAlpha = 1;
  }
}
