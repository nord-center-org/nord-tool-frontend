/// <reference lib="webworker" />
/**
 * Repertório v11 — identifica a letra fora da tela com o Whisper (reconhecimento de fala) rodando no aparelho.
 * O modelo é baixado uma vez do Hugging Face e fica no cache do navegador; o áudio não sai do aparelho.
 * O motor (onnxruntime-web) vem dos arquivos do próprio app, não de CDN.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import ortMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";

import { SR_FALA, cortesDeJanela, proximoInicio, type TrechoFalado } from "@/react-app/utils/musica/letra";

env.allowLocalModels = false;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
  env.backends.onnx.wasm.numThreads = 1;
}

export type ModeloLetra = "rapido" | "preciso";
const MODELOS: Record<ModeloLetra, string> = { rapido: "onnx-community/whisper-base", preciso: "onnx-community/whisper-small" };

let carregado: { id: string; asr: AutomaticSpeechRecognitionPipeline } | null = null;

interface Pedido { sinal: Float32Array; modelo: ModeloLetra; idioma: string | null }
interface Progresso { status?: string; file?: string; loaded?: number; total?: number }

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const { sinal, modelo, idioma } = e.data;
  try {
    const id = MODELOS[modelo] ?? MODELOS.rapido;
    if (carregado?.id !== id) {
      // baixa (ou lê do cache) os arquivos do modelo, somando o progresso de todos
      const arquivos = new Map<string, { loaded: number; total: number }>();
      const asr = (await pipeline("automatic-speech-recognition", id, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: Progresso) => {
          if (p.status !== "progress" || !p.file) return;
          arquivos.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
          let l = 0, t = 0;
          for (const a of arquivos.values()) { l += a.loaded; t += a.total; }
          if (t > 0) self.postMessage({ tipo: "progresso", etapa: `Baixando o reconhecedor (${Math.round(t / 1e6)} MB, só da primeira vez)`, p: (l / t) * 0.999 });
        },
      })) as AutomaticSpeechRecognitionPipeline;
      carregado = { id, asr };
    }
    const trechos: TrechoFalado[] = [];
    let ini = 0;
    while (sinal.length - ini > SR_FALA * 0.5) {
      self.postMessage({ tipo: "progresso", etapa: "Ouvindo a letra", p: ini / sinal.length });
      // a janela vai até 30 s, cortada no ponto mais silencioso entre 20 e 30 s
      const fim = ini + cortesDeJanela(sinal.subarray(ini), SR_FALA)[1];
      const pedaco = sinal.subarray(ini, fim);
      const r = await carregado.asr(pedaco, {
        ...(idioma ? { language: idioma } : {}),
        task: "transcribe",
        return_timestamps: true,
      });
      const saida = Array.isArray(r) ? r[0] : r;
      const desloc = ini / SR_FALA, durPedaco = (fim - ini) / SR_FALA;
      let ultimoFim: number | null = null;
      for (const c of saida.chunks ?? []) {
        const [a, b] = c.timestamp;
        const fimTrecho = Math.min(b ?? durPedaco, durPedaco);
        trechos.push({ inicio: desloc + Math.min(a ?? 0, durPedaco), fim: desloc + fimTrecho, texto: c.text });
        ultimoFim = fimTrecho;
      }
      if (!saida.chunks?.length && saida.text?.trim()) trechos.push({ inicio: desloc, fim: desloc + durPedaco, texto: saida.text });
      ini = proximoInicio(ini, fim, ultimoFim);
    }
    self.postMessage({ tipo: "pronto", trechos });
  } catch (err) {
    self.postMessage({ tipo: "erro", mensagem: err instanceof Error ? err.message : String(err) });
  }
};
