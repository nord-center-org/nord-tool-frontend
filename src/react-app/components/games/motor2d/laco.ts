/**
 * Laço de jogo com passo fixo (60 por segundo) e desenho a cada quadro com interpolação: a simulação é a mesma em
 * qualquer tela (60, 90, 120 Hz) e o desenho continua liso. Pausa sozinho quando a aba fica escondida.
 */
export interface Laco {
  parar(): void;
  pausado: boolean;
}

export function iniciarLaco(atualizar: () => void, desenhar: (alfa: number, dt: number) => void, passosPorSegundo = 60): Laco {
  const passo = 1000 / passosPorSegundo;
  let acumulado = 0;
  let anterior = performance.now();
  let id = 0;
  const estado: Laco = { pausado: false, parar: () => cancelAnimationFrame(id) };
  const quadro = (agora: number) => {
    const dt = Math.min(250, agora - anterior);
    anterior = agora;
    if (!estado.pausado && !document.hidden) {
      acumulado += dt;
      let n = 0;
      while (acumulado >= passo && n++ < 8) {
        atualizar();
        acumulado -= passo;
      }
      if (n >= 8) acumulado = 0;
    }
    desenhar(acumulado / passo, dt / 1000);
    id = requestAnimationFrame(quadro);
  };
  id = requestAnimationFrame(quadro);
  return estado;
}
