/// <reference lib="webworker" />
/** Análise da música fora da tela (não trava a página): tom, BPM, batidas, acordes e notas do baixo. */
import { analisar } from "@/react-app/utils/musica/analise";

self.onmessage = (e: MessageEvent<{ sinal: Float32Array; sr: number }>) => {
  try {
    const r = analisar(e.data.sinal, e.data.sr, (p, etapa) => self.postMessage({ tipo: "progresso", p, etapa }));
    self.postMessage({ tipo: "pronto", resultado: r });
  } catch (err) {
    self.postMessage({ tipo: "erro", mensagem: err instanceof Error ? err.message : String(err) });
  }
};
