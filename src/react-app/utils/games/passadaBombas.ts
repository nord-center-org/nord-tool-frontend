/** Ciclo da passada ligado à distância renderizada, inclusive em espelhos remotos. */
export class PassadaBombas {
  private anterior: { x: number; z: number } | null = null;
  fase = 0;
  intensidade = 0;
  atualizar(x: number, z: number, dt: number, vivo: boolean) {
    const distancia = this.anterior ? Math.hypot(x - this.anterior.x, z - this.anterior.z) : 0;
    this.anterior = { x, z };
    if (dt <= 0) return;
    // Reaparecer ou receber uma correção grande da rede não é um passo.
    const andando = vivo && distancia > 0.0001 && distancia < 0.6;
    if (andando) this.fase = (this.fase + distancia * Math.PI * 2 / 0.85) % (Math.PI * 2);
    const alvo = andando ? 1 : 0;
    this.intensidade += (alvo - this.intensidade) * (1 - Math.exp(-dt * 20));
  }
}
