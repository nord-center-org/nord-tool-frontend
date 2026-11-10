import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Layers, RotateCw, Trash2, Brush } from "lucide-react";

import {
  girar, moverComGuias, mudarOrdem, novoIdImagem, redimensionar, type Alca, type Guia, type ImagemPlaca,
} from "@/react-app/utils/placas";

interface Props {
  /** Tamanho da folha (px da placa) e a escala em que ela aparece na tela. */
  folha: { largura: number; altura: number };
  escala: number;
  imagens: ImagemPlaca[];
  onMudar: (lista: ImagemPlaca[]) => void;
  /** Abre a imagem selecionada no editor de imagens. */
  onEditar?: (imagem: ImagemPlaca) => void;
}

const ALCAS: Array<{ id: Alca; cursor: string; x: number; y: number }> = [
  { id: "nw", cursor: "nwse-resize", x: 0, y: 0 }, { id: "n", cursor: "ns-resize", x: 0.5, y: 0 }, { id: "ne", cursor: "nesw-resize", x: 1, y: 0 },
  { id: "e", cursor: "ew-resize", x: 1, y: 0.5 }, { id: "se", cursor: "nwse-resize", x: 1, y: 1 }, { id: "s", cursor: "ns-resize", x: 0.5, y: 1 },
  { id: "sw", cursor: "nesw-resize", x: 0, y: 1 }, { id: "w", cursor: "ew-resize", x: 0, y: 0.5 },
];

type Gesto =
  | { tipo: "mover"; id: string; inicio: ImagemPlaca; px: number; py: number }
  | { tipo: "alca"; id: string; alca: Alca; inicio: ImagemPlaca; px: number; py: number }
  | { tipo: "girar"; id: string };

/**
 * Camada de edição por cima da prévia da placa, no estilo do Canva: clique seleciona; arrastar move (com linhas-guia
 * no centro e nas bordas da folha); os cantos redimensionam mantendo a proporção (Shift solta), os lados esticam e a
 * bolinha de baixo gira. A barra em cima da prévia (para não cobrir a imagem) muda a ordem, a camada (atrás do painel ou na frente), duplica e
 * apaga. Setas movem 1 px (Shift: 10 px) e Delete apaga.
 */
export default function ImagensNaFolha({ folha, escala, imagens, onMudar, onEditar }: Props) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [guias, setGuias] = useState<Guia[]>([]);
  const gesto = useRef<Gesto | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const atual = imagens.find(i => i.id === selecionada) ?? null;

  const trocar = (nova: ImagemPlaca) => onMudar(imagens.map(i => (i.id === nova.id ? nova : i)));

  // Teclado na imagem selecionada (fora de campos de texto).
  useEffect(() => {
    if (!atual) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      const passo = e.shiftKey ? 10 : 1;
      const setas: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] };
      if (setas[e.key]) { e.preventDefault(); trocar({ ...atual, x: atual.x + setas[e.key][0], y: atual.y + setas[e.key][1] }); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onMudar(imagens.filter(i => i.id !== atual.id)); setSelecionada(null); }
      else if (e.key === "Escape") setSelecionada(null);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  /** Ponto do ponteiro em px da folha. */
  const naFolha = (e: { clientX: number; clientY: number }) => {
    const r = caixaRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
  };

  const comecar = (e: PE, g: Gesto) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gesto.current = g;
    setSelecionada(g.id);
  };

  const mover = (e: PE) => {
    const g = gesto.current;
    if (!g) return;
    const inicio = imagens.find(i => i.id === g.id);
    if (!inicio) return;
    const p = naFolha(e);
    if (g.tipo === "mover") {
      // Ímã de ~6 px da tela, em px da folha.
      const r = moverComGuias(g.inicio, g.inicio.x + (p.x - g.px), g.inicio.y + (p.y - g.py), folha, 6 / Math.max(0.2, escala));
      setGuias(r.guias);
      trocar({ ...inicio, x: r.x, y: r.y });
    } else if (g.tipo === "alca") {
      trocar(redimensionar(g.inicio, g.alca, p.x - g.px, p.y - g.py, e.shiftKey));
    } else {
      trocar(girar(inicio, p.x, p.y));
    }
  };

  const soltar = () => { gesto.current = null; setGuias([]); };

  const acao = (o: "frente" | "tras" | "subir" | "descer" | "camada" | "duplicar" | "apagar") => {
    if (!atual) return;
    if (o === "apagar") { onMudar(imagens.filter(i => i.id !== atual.id)); setSelecionada(null); }
    else if (o === "duplicar") { const copia = { ...atual, id: novoIdImagem(), x: atual.x + 20, y: atual.y + 20 }; onMudar([...imagens, copia]); setSelecionada(copia.id); }
    else if (o === "camada") trocar({ ...atual, camada: atual.camada === "frente" ? "atras" : "frente" });
    else onMudar(mudarOrdem(imagens, atual.id, o));
  };

  const botao = "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold text-white hover:bg-white/15";

  return (
    <div ref={caixaRef} className="absolute inset-0" onPointerDown={() => setSelecionada(null)}>
      {guias.map((g, n) => (
        <div key={n} aria-hidden="true" className="pointer-events-none absolute bg-fuchsia-500"
          style={g.tipo === "v" ? { left: g.pos * escala, top: 0, width: 1, height: folha.altura * escala } : { top: g.pos * escala, left: 0, height: 1, width: folha.largura * escala }} />
      ))}
      {imagens.map(i => {
        const sel = i.id === selecionada;
        return (
          <div key={i.id} role="button" tabIndex={0} aria-label="Imagem na placa" aria-pressed={sel}
            onPointerDown={e => comecar(e, { tipo: "mover", id: i.id, inicio: i, ...((p) => ({ px: p.x, py: p.y }))(naFolha(e)) })}
            onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
            onFocus={() => setSelecionada(i.id)}
            className={`absolute cursor-move outline-none ${sel ? "ring-2 ring-violet-500" : "hover:ring-2 hover:ring-violet-300"}`}
            style={{ left: i.x * escala, top: i.y * escala, width: i.w * escala, height: i.h * escala, transform: i.rot ? `rotate(${i.rot}deg)` : undefined, touchAction: "none" }}>
            {sel && (
              <>
                {ALCAS.map(a => (
                  <span key={a.id} aria-label={`Redimensionar (${a.id})`} role="slider" aria-valuenow={Math.round(i.w)}
                    onPointerDown={e => comecar(e, { tipo: "alca", id: i.id, alca: a.id, inicio: i, ...((p) => ({ px: p.x, py: p.y }))(naFolha(e)) })}
                    onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
                    className={`absolute z-10 border-2 border-violet-600 bg-white shadow ${a.id.length === 2 ? "h-3.5 w-3.5 rounded-full" : "h-3 w-5 rounded-full"} ${a.id === "e" || a.id === "w" ? "!h-5 !w-3" : ""}`}
                    style={{ left: `calc(${a.x * 100}% - ${a.id === "e" || a.id === "w" ? 6 : a.id.length === 2 ? 7 : 10}px)`, top: `calc(${a.y * 100}% - ${a.id === "e" || a.id === "w" ? 10 : a.id.length === 2 ? 7 : 6}px)`, cursor: a.cursor, touchAction: "none" }} />
                ))}
                {/* Bolinha de girar embaixo da imagem (em cima fica a barra de ações). */}
                <span aria-hidden="true" className="absolute left-1/2 top-full h-5 w-px bg-violet-600" />
                <span role="slider" aria-label="Girar" aria-valuenow={i.rot} title="Girar (encaixa a cada 90°)"
                  onPointerDown={e => comecar(e, { tipo: "girar", id: i.id })} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
                  className="absolute left-1/2 top-full z-10 mt-4 flex h-6 w-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-violet-600 bg-white text-violet-700 shadow"
                  style={{ touchAction: "none" }}>
                  <RotateCw className="h-3.5 w-3.5" />
                </span>
              </>
            )}
          </div>
        );
      })}
      {atual && (
        <div role="toolbar" aria-label="Imagem selecionada" onPointerDown={e => e.stopPropagation()}
          className="absolute -top-11 left-0 z-20 flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-900/95 p-1 shadow-xl">
          <button type="button" className={botao} onClick={() => acao("frente")} title="Trazer para a frente" aria-label="Trazer para a frente"><ArrowUpToLine className="h-4 w-4" /></button>
          <button type="button" className={botao} onClick={() => acao("subir")} title="Subir uma" aria-label="Subir uma"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" className={botao} onClick={() => acao("descer")} title="Descer uma" aria-label="Descer uma"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" className={botao} onClick={() => acao("tras")} title="Enviar para trás" aria-label="Enviar para trás"><ArrowDownToLine className="h-4 w-4" /></button>
          <button type="button" className={botao} onClick={() => acao("camada")} title="Atrás do painel ou na frente de tudo">
            <Layers className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">{atual.camada === "frente" ? "Na frente" : "Atrás do painel"}</span>
          </button>
          {onEditar && <button type="button" className={botao} onClick={() => onEditar(atual)} title="Editar a imagem (recortar, cores, desenhar…)" aria-label="Editar imagem"><Brush className="h-4 w-4" /></button>}
          <button type="button" className={botao} onClick={() => acao("duplicar")} title="Duplicar" aria-label="Duplicar imagem"><Copy className="h-4 w-4" /></button>
          <button type="button" className={`${botao} text-red-300`} onClick={() => acao("apagar")} title="Apagar" aria-label="Apagar imagem"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
