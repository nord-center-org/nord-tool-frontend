import { useCallback, useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, Circle, Crop, Loader2, Pencil, RotateCw, Square, Undo2, X } from "lucide-react";

import {
  CORES_MARCACAO, RECORTE_INTEIRO, ajustarRecorte, cabecaSeta, dimensoesGiradas, girarPonto, girarRetangulo, marcacaoValida,
  proximaRotacao, recorteMudou, type Alca, type Ferramenta, type Marcacao, type Ponto, type Retangulo, type Rotacao,
} from "@/react-app/utils/edicaoFoto";

interface EditorFotoProps {
  carregar: () => Promise<Blob>;
  titulo: string;
  /** Sem edição: só mostra a foto ampliada. */
  editavel: boolean;
  onSalvar: (imagem: Blob) => Promise<string | null>;
  onFechar: () => void;
}

type Modo = "ver" | "cortar" | Ferramenta;
const ESPESSURAS = [0.006, 0.012, 0.02];

/** Desenha a imagem girada com as marcações num canvas de largura × altura. */
function pintar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rotacao: Rotacao, largura: number, altura: number, marcacoes: Marcacao[]) {
  ctx.save();
  ctx.clearRect(0, 0, largura, altura);
  ctx.translate(largura / 2, altura / 2);
  ctx.rotate((rotacao * Math.PI) / 180);
  const [w, h] = rotacao === 90 || rotacao === 270 ? [altura, largura] : [largura, altura];
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  const base = Math.min(largura, altura);
  for (const m of marcacoes) {
    const pts = m.pontos.map(p => ({ x: p.x * largura, y: p.y * altura }));
    if (pts.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = m.cor;
    ctx.fillStyle = m.cor;
    ctx.lineWidth = Math.max(2, m.espessura * base);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = ctx.lineWidth * 0.6;
    const a = pts[0], b = pts[pts.length - 1];
    ctx.beginPath();
    if (m.ferramenta === "livre") {
      ctx.moveTo(a.x, a.y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (m.ferramenta === "quadrado") {
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    } else if (m.ferramenta === "circulo") {
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const [ponta, e, d] = cabecaSeta(a, b, ctx.lineWidth);
      const recuo = { x: (e.x + d.x) / 2, y: (e.y + d.y) / 2 };
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(recuo.x, recuo.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ponta.x, ponta.y);
      ctx.lineTo(e.x, e.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Foto ampliada em tela cheia; com edição: girar, cortar, riscar, círculo, quadrado, seta e cor da linha. */
export default function EditorFoto({ carregar, titulo, editavel, onSalvar, onFechar }: EditorFotoProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rotacao, setRotacao] = useState<Rotacao>(0);
  const [recorte, setRecorte] = useState<Retangulo>(RECORTE_INTEIRO);
  const [marcacoes, setMarcacoes] = useState<Marcacao[]>([]);
  const [atual, setAtual] = useState<Marcacao | null>(null);
  const [modo, setModo] = useState<Modo>("ver");
  const [cor, setCor] = useState(CORES_MARCACAO[0]);
  const [espessura, setEspessura] = useState(ESPESSURAS[1]);
  const [salvando, setSalvando] = useState(false);
  const [tela, setTela] = useState({ w: 0, h: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const arrasto = useRef<{ alca: Alca; inicio: Ponto; recorte: Retangulo } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    carregar().then(blob => {
      url = URL.createObjectURL(blob);
      const i = new Image();
      i.onload = () => { if (vivo) setImg(i); };
      i.onerror = () => { if (vivo) setErro("Não foi possível abrir a foto."); };
      i.src = url;
    }).catch(() => { if (vivo) setErro("Não foi possível abrir a foto."); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [carregar]);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [onFechar]);

  // Tamanho de exibição: cabe na tela, deixando espaço para as barras.
  const medir = useCallback(() => {
    if (!img) return;
    const { largura, altura } = dimensoesGiradas(img.naturalWidth, img.naturalHeight, rotacao);
    const maxW = window.innerWidth - 24, maxH = window.innerHeight - (editavel ? 190 : 110);
    const escala = Math.min(maxW / largura, maxH / altura, 4);
    setTela({ w: Math.round(largura * escala), h: Math.round(altura * escala) });
  }, [img, rotacao, editavel]);
  useEffect(() => { medir(); window.addEventListener("resize", medir); return () => window.removeEventListener("resize", medir); }, [medir]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !img || !tela.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(tela.w * dpr);
    c.height = Math.round(tela.h * dpr);
    const ctx = c.getContext("2d");
    if (ctx) pintar(ctx, img, rotacao, c.width, c.height, atual ? [...marcacoes, atual] : marcacoes);
  }, [img, rotacao, tela, marcacoes, atual]);

  const ponto = (e: EventoPonteiro<Element>): Ponto => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const desenhando = modo === "livre" || modo === "circulo" || modo === "quadrado" || modo === "seta";

  const inicioDesenho = (e: EventoPonteiro<HTMLCanvasElement>) => {
    if (!desenhando) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = ponto(e);
    setAtual({ ferramenta: modo, cor, espessura, pontos: [p, p] });
  };
  const moverDesenho = (e: EventoPonteiro<HTMLCanvasElement>) => {
    if (!atual) return;
    const p = ponto(e);
    setAtual(m => m && (m.ferramenta === "livre" ? { ...m, pontos: [...m.pontos, p] } : { ...m, pontos: [m.pontos[0], p] }));
  };
  const fimDesenho = () => {
    if (atual && marcacaoValida(atual)) setMarcacoes(l => [...l, atual]);
    setAtual(null);
  };

  const inicioRecorte = (alca: Alca) => (e: EventoPonteiro<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { alca, inicio: ponto(e), recorte };
  };
  const moverRecorte = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const p = ponto(e);
    setRecorte(ajustarRecorte(a.recorte, a.alca, p.x - a.inicio.x, p.y - a.inicio.y));
  };

  const girar = () => {
    setRotacao(proximaRotacao);
    setMarcacoes(l => l.map(m => ({ ...m, pontos: m.pontos.map(girarPonto) })));
    setRecorte(girarRetangulo);
  };

  const alterado = rotacao !== 0 || marcacoes.length > 0 || recorteMudou(recorte);

  const salvar = async () => {
    if (!img) return;
    setSalvando(true);
    setErro(null);
    const { largura, altura } = dimensoesGiradas(img.naturalWidth, img.naturalHeight, rotacao);
    const inteira = document.createElement("canvas");
    inteira.width = largura;
    inteira.height = altura;
    pintar(inteira.getContext("2d")!, img, rotacao, largura, altura, marcacoes);
    const saida = document.createElement("canvas");
    saida.width = Math.max(1, Math.round(recorte.w * largura));
    saida.height = Math.max(1, Math.round(recorte.h * altura));
    saida.getContext("2d")!.drawImage(inteira, recorte.x * largura, recorte.y * altura, saida.width, saida.height, 0, 0, saida.width, saida.height);
    const blob = await new Promise<Blob | null>(ok => saida.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) { setSalvando(false); setErro("Não foi possível gerar a imagem."); return; }
    const falha = await onSalvar(blob);
    setSalvando(false);
    if (falha) setErro(falha);
  };

  const botao = (ativo: boolean) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${ativo ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`;
  const ferramentas: { id: Ferramenta; rotulo: string; Icone: typeof Pencil }[] = [
    { id: "livre", rotulo: "Riscar à mão livre", Icone: Pencil },
    { id: "circulo", rotulo: "Círculo", Icone: Circle },
    { id: "quadrado", rotulo: "Quadrado", Icone: Square },
    { id: "seta", rotulo: "Seta", Icone: ArrowUpRight },
  ];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Foto: ${titulo}`} className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 animate-aparecer">
      <header className="flex items-center justify-between gap-2 px-3 py-2 text-white">
        <p className="min-w-0 truncate text-sm font-semibold">{titulo}</p>
        <div className="flex shrink-0 gap-2">
          {editavel && alterado && (
            <button type="button" onClick={() => void salvar()} disabled={salvando} aria-label="Salvar alterações" title="Salvar alterações"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60">
              {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            </button>
          )}
          <button type="button" onClick={onFechar} aria-label="Fechar" title="Fechar" className={botao(false)}><X className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        {erro && <p role="alert" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl bg-red-600 px-3 py-1.5 text-sm text-white shadow">{erro}</p>}
        {!img ? (
          !erro && <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Carregando foto" />
        ) : (
          <div className="relative animate-surgir" style={{ width: tela.w, height: tela.h }}>
            <canvas ref={canvas} className={`h-full w-full rounded-lg shadow-2xl ${desenhando ? "cursor-crosshair" : ""}`} style={{ touchAction: desenhando ? "none" : "auto" }}
              onPointerDown={inicioDesenho} onPointerMove={moverDesenho} onPointerUp={fimDesenho} onPointerCancel={fimDesenho}
              role="img" aria-label={titulo} />
            {(modo === "cortar" || recorteMudou(recorte)) && (
              <div className={`absolute inset-0 ${modo === "cortar" ? "" : "pointer-events-none"}`} style={{ touchAction: "none" }}>
                {/* Escurece fora do recorte (camada recortada para a sombra não cobrir as barras). */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg" aria-hidden="true">
                  <div className="absolute shadow-[0_0_0_9999px_rgba(2,6,23,0.6)]"
                    style={{ left: `${recorte.x * 100}%`, top: `${recorte.y * 100}%`, width: `${recorte.w * 100}%`, height: `${recorte.h * 100}%` }} />
                </div>
                <div className="absolute border-2 border-white"
                  style={{ left: `${recorte.x * 100}%`, top: `${recorte.y * 100}%`, width: `${recorte.w * 100}%`, height: `${recorte.h * 100}%` }}
                  onPointerDown={inicioRecorte("mover")} onPointerMove={moverRecorte} onPointerUp={() => { arrasto.current = null; }}>
                  {modo === "cortar" && (
                    <>
                      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden="true">
                        {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/25" />)}
                      </div>
                      {(["no", "ne", "so", "se"] as Alca[]).map(a => (
                        <div key={a} role="presentation" onPointerDown={inicioRecorte(a)} onPointerMove={moverRecorte} onPointerUp={() => { arrasto.current = null; }}
                          className={`absolute h-7 w-7 rounded-full border-[3px] border-white bg-blue-600 shadow ${a[0] === "n" ? "-top-3.5" : "-bottom-3.5"} ${a[1] === "o" ? "-left-3.5" : "-right-3.5"}`} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editavel && img && (
        <footer className="space-y-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          {desenhando && (
            <div className="flex items-center justify-center gap-2" role="group" aria-label="Cor e espessura da linha">
              {CORES_MARCACAO.map(c => (
                <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor === c} title="Cor da linha" onClick={() => setCor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${cor === c ? "scale-110 border-white ring-2 ring-white/50" : "border-white/30"}`} style={{ background: c }} />
              ))}
              <span className="mx-1 h-6 w-px bg-white/20" aria-hidden="true" />
              {ESPESSURAS.map((e, i) => (
                <button key={e} type="button" aria-label={`Espessura ${i + 1}`} aria-pressed={espessura === e} title="Espessura da linha" onClick={() => setEspessura(e)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${espessura === e ? "bg-white/25" : "bg-white/5"}`}>
                  <span className="rounded-full" style={{ width: 6 + i * 5, height: 6 + i * 5, background: cor }} />
                </button>
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-xl items-center justify-center gap-2 overflow-x-auto" role="toolbar" aria-label="Editar foto">
            <button type="button" onClick={girar} aria-label="Girar 90°" title="Girar 90°" className={botao(false)}><RotateCw className="h-5 w-5" /></button>
            <button type="button" onClick={() => setModo(m => (m === "cortar" ? "ver" : "cortar"))} aria-label="Cortar" title="Cortar" aria-pressed={modo === "cortar"} className={botao(modo === "cortar")}><Crop className="h-5 w-5" /></button>
            <span className="h-7 w-px bg-white/20" aria-hidden="true" />
            {ferramentas.map(({ id, rotulo, Icone }) => (
              <button key={id} type="button" onClick={() => setModo(m => (m === id ? "ver" : id))} aria-label={rotulo} title={rotulo} aria-pressed={modo === id} className={botao(modo === id)}>
                <Icone className="h-5 w-5" style={modo === id ? { color: cor === "#ffffff" ? "#111827" : cor } : undefined} />
              </button>
            ))}
            <span className="h-7 w-px bg-white/20" aria-hidden="true" />
            <button type="button" onClick={() => setMarcacoes(l => l.slice(0, -1))} disabled={!marcacoes.length} aria-label="Desfazer marcação" title="Desfazer marcação"
              className={`${botao(false)} disabled:opacity-30`}><Undo2 className="h-5 w-5" /></button>
          </div>
        </footer>
      )}
    </div>,
    document.body,
  );
}
