/// <reference lib="webworker" />
/** Separação das faixas fora da tela; devolve um WAV por faixa. */
import { FAIXAS, separar, wav16 } from "@/react-app/utils/musica/separacao";

self.onmessage = (e: MessageEvent<{ L: Float32Array; R: Float32Array; sr: number }>) => {
  try {
    const { faixas, sr } = separar(e.data.L, e.data.R, e.data.sr, p => self.postMessage({ tipo: "progresso", p }));
    const wavs = FAIXAS.map(f => wav16(faixas[f], sr));
    (self as unknown as Worker).postMessage({ tipo: "pronto", wavs }, wavs);
  } catch (err) {
    self.postMessage({ tipo: "erro", mensagem: err instanceof Error ? err.message : String(err) });
  }
};
