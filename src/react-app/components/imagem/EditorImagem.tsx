import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as PE, type ReactNode } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Brush, Circle, Copy, Crop, Download, Eraser, Eye, EyeOff, FlipHorizontal, FlipVertical, Hand, ImagePlus, Layers,
  Loader2, Merge, Minus, NotebookPen, PaintBucket, Pipette, Plus, Redo2, RotateCcw, RotateCw, Save, Scaling, SlidersHorizontal, Square, SquareDashed,
  Trash2, Type, Undo2, Upload, WandSparkles, X, ZoomIn, ZoomOut, type LucideIcon, ArrowLeftRight, Scissors,
} from "lucide-react";

import { baixarArquivo, nomeDeArquivo } from "@/react-app/utils/baixarArquivo";
import {
  AJUSTES, Historico, aplicarAjuste, corParaHex, hexParaCor, preencher, redimensionarProporcional, retanguloDe, type TipoAjuste,
} from "@/react-app/utils/editorImagem";
import {
  MODOS_SELECAO, apagarNaMascara, caixaDa, combinar, desenhoDaSelecao, inverter, mascaraDoRetangulo, preencherNaMascara, recortarMascara, restaurarFora,
  suavizar, varinhaMagica, type Mascara, type ModoSelecao,
} from "@/react-app/utils/varinhaMagica";

type Ferramenta = "mao" | "pincel" | "borracha" | "linha" | "retangulo" | "elipse" | "texto" | "balde" | "contagotas" | "selecao" | "varinha";
interface Camada { id: string; nome: string; visivel: boolean; opacidade: number; canvas: HTMLCanvasElement }
interface Foto { id: string; nome: string; visivel: boolean; opacidade: number; dados: ImageData }
interface Estado { largura: number; altura: number; camadas: Foto[]; ativa: string }
type Ponto = { x: number; y: number };
type Ret = { x: number; y: number; w: number; h: number };

const MAX_LADO = 4096;
const CORES_RAPIDAS = ["#000000", "#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#78716c", "#64748b"];
const FERRAMENTAS: { id: Ferramenta; rotulo: string; icone: LucideIcon; tecla: string }[] = [
  { id: "mao", rotulo: "Mão (rolar)", icone: Hand, tecla: "h" },
  { id: "selecao", rotulo: "Seleção retangular", icone: SquareDashed, tecla: "s" },
  { id: "varinha", rotulo: "Varinha mágica", icone: WandSparkles, tecla: "w" },
  { id: "pincel", rotulo: "Pincel", icone: Brush, tecla: "b" },
  { id: "borracha", rotulo: "Borracha", icone: Eraser, tecla: "e" },
  { id: "linha", rotulo: "Linha", icone: Minus, tecla: "l" },
  { id: "retangulo", rotulo: "Retângulo", icone: Square, tecla: "r" },
  { id: "elipse", rotulo: "Elipse", icone: Circle, tecla: "o" },
  { id: "texto", rotulo: "Texto", icone: Type, tecla: "t" },
  { id: "balde", rotulo: "Balde de tinta", icone: PaintBucket, tecla: "f" },
  { id: "contagotas", rotulo: "Conta-gotas", icone: Pipette, tecla: "k" },
];

let seq = 0;
const novoId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;
const criarCanvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const ctxDe = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
const botao = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const icone = (ativo = false) => `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ativo ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;
const paraBlob = (c: HTMLCanvasElement, tipo: string, q?: number) => new Promise<Blob>((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error("Não deu para gerar a imagem."))), tipo, q));

interface Props {
  /** Imagem que chega de outra tela (relatório, placas…). */
  carregar?: () => Promise<Blob>;
  arquivoInicial?: File | null;
  titulo?: string;
  /** Devolve a imagem editada para a tela de origem (null = deu certo; texto = erro). */
  onSalvar?: (imagem: Blob) => Promise<string | null>;
  onFechar: () => void;
  /** Na central do bloco de notas: a imagem pode virar um caderno. */
  onAbrirNoCaderno?: (arquivo: File) => void;
  /** Formato devolvido no onSalvar (PNG mantém a transparência, como nas placas). */
  formatoSalvar?: "png" | "jpg";
  /** Aberto por cima de outra tela: ocupa a tela toda. */
  telaCheia?: boolean;
}

/**
 * Editor de imagens no estilo do Paint.net: camadas, pincel, borracha, formas, texto, balde de tinta, conta-gotas,
 * seleção (cortar, apagar, preencher), girar, espelhar, redimensionar e ajustes (brilho, contraste, saturação, matiz,
 * temperatura, desfoque, nitidez, preto e branco, sépia, inverter), com desfazer. Tudo no aparelho.
 */
export default function EditorImagem({ carregar, arquivoInicial, titulo, onSalvar, onFechar, onAbrirNoCaderno, formatoSalvar = "jpg", telaCheia = false }: Props) {
  const camadas = useRef<Camada[]>([]);
  const [ativa, setAtiva] = useState("");
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null);
  const [, setVersao] = useState(0);
  const redesenhar = () => setVersao(v => v + 1);
  const [nome, setNome] = useState(titulo ?? "imagem");
  const [carregando, setCarregando] = useState<string | null>(carregar || arquivoInicial ? "Abrindo a imagem…" : null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [ferramenta, setFerramenta] = useState<Ferramenta>("pincel");
  const [cor, setCor] = useState("#ef4444");
  const [cor2, setCor2] = useState("#ffffff");
  const [espessura, setEspessura] = useState(8);
  const [cheio, setCheio] = useState(false);
  const [tamanhoTexto, setTamanhoTexto] = useState(48);
  const [tolerancia, setTolerancia] = useState(20);
  const [zoom, setZoom] = useState(1);
  const [selecao, setSelecao] = useState<Ret | null>(null);
  /** Seleção pela varinha mágica (um byte por pixel); null quando a seleção é só o retângulo. */
  const [mascara, setMascara] = useState<Mascara | null>(null);
  const [modoSelecao, setModoSelecao] = useState<ModoSelecao>("nova");
  const [varinhaGlobal, setVarinhaGlobal] = useState(false);
  const [bordaSuave, setBordaSuave] = useState(1);
  const [texto, setTexto] = useState<{ p: Ponto; valor: string } | null>(null);
  const [ajuste, setAjuste] = useState<{ tipo: TipoAjuste; valor: number } | null>(null);
  const [redim, setRedim] = useState<{ largura: number; altura: number; proporcao: boolean } | null>(null);
  const [painel, setPainel] = useState(false);
  const [ajustarZoom, setAjustarZoom] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const historico = useRef(new Historico<Estado>(20));
  const tela = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const arrasto = useRef<{ inicio: Ponto; ultimo: Ponto; antes: ImageData | null } | null>(null);
  const preview = useRef<((ctx: CanvasRenderingContext2D) => void) | null>(null);
  const original = useRef<ImageData | null>(null);

  /** Véu e contorno da seleção da varinha, prontos para desenhar por cima da imagem. */
  const desenhoMascara = useMemo(() => {
    if (!mascara || !tamanho || mascara.length !== tamanho.w * tamanho.h) return null;
    const c = criarCanvas(tamanho.w, tamanho.h);
    ctxDe(c).putImageData(new ImageData(desenhoDaSelecao(mascara, tamanho.w, tamanho.h), tamanho.w, tamanho.h), 0, 0);
    return c;
  }, [mascara, tamanho]);

  const camadaAtiva = () => camadas.current.find(c => c.id === ativa) ?? camadas.current[camadas.current.length - 1];

  // ---------- desenhar a tela ----------
  const compor = useCallback((destino: HTMLCanvasElement, comFundoBranco = false) => {
    const ctx = destino.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, destino.width, destino.height);
    if (comFundoBranco) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, destino.width, destino.height); }
    for (const c of camadas.current) if (c.visivel) { ctx.globalAlpha = c.opacidade; ctx.drawImage(c.canvas, 0, 0); }
    ctx.restore();
  }, []);

  const pintarTela = useCallback(() => {
    const t = tela.current;
    if (!t || !tamanho) return;
    if (t.width !== tamanho.w || t.height !== tamanho.h) { t.width = tamanho.w; t.height = tamanho.h; }
    compor(t);
    const ctx = t.getContext("2d");
    if (!ctx) return;
    preview.current?.(ctx);
    if (desenhoMascara) ctx.drawImage(desenhoMascara, 0, 0);
    else if (selecao && selecao.w > 0 && selecao.h > 0) {
      ctx.save();
      const lw = Math.max(1, 1.5 / zoom);
      ctx.lineWidth = lw;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeStyle = "#000"; ctx.strokeRect(selecao.x, selecao.y, selecao.w, selecao.h);
      ctx.lineDashOffset = 6 / zoom; ctx.strokeStyle = "#fff"; ctx.strokeRect(selecao.x, selecao.y, selecao.w, selecao.h);
      ctx.restore();
    }
  }, [compor, desenhoMascara, selecao, tamanho, zoom]);
  useEffect(() => { pintarTela(); });

  const caberNaTela = useCallback(() => {
    const caixa = area.current;
    if (!caixa || !tamanho) return;
    setZoom(Math.max(0.05, Math.min(4, (caixa.clientWidth - 32) / tamanho.w, (caixa.clientHeight - 32) / tamanho.h)));
  }, [tamanho]);
  useEffect(() => { if (ajustarZoom && tamanho && area.current) { caberNaTela(); setAjustarZoom(false); } }, [ajustarZoom, tamanho, caberNaTela]);

  // ---------- seleção ----------
  function limparSelecao() { setSelecao(null); setMascara(null); }
  /** Troca a seleção pela máscara (vazia = sem seleção); a caixa dela vira o retângulo usado por Recortar. */
  const definirMascara = (m: Mascara | null) => {
    const caixa = m && tamanho ? caixaDa(m, tamanho.w, tamanho.h) : null;
    if (!m || !caixa) { limparSelecao(); return; }
    setMascara(m);
    setSelecao(caixa);
  };
  /** A seleção atual como máscara (o retângulo também vira máscara). */
  const mascaraAtual = (): Mascara | null => {
    if (!tamanho) return null;
    if (mascara) return mascara;
    return selecao && selecao.w > 0 && selecao.h > 0 ? mascaraDoRetangulo(selecao, tamanho.w, tamanho.h) : null;
  };
  const inverterSelecao = () => {
    if (!tamanho) return;
    const m = mascaraAtual();
    definirMascara(m ? inverter(m) : null);
  };
  const selecionarTudo = () => { if (tamanho) { setMascara(null); setSelecao({ x: 0, y: 0, w: tamanho.w, h: tamanho.h }); } };

  // ---------- abrir ----------
  const abrirBitmap = useCallback((bmp: ImageBitmap | HTMLCanvasElement, nomeArquivo?: string) => {
    let w = bmp.width, h = bmp.height;
    let reduziu = false;
    if (Math.max(w, h) > MAX_LADO) { const k = MAX_LADO / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); reduziu = true; }
    const c = criarCanvas(w, h);
    ctxDe(c).drawImage(bmp, 0, 0, w, h);
    camadas.current = [{ id: novoId(), nome: "Fundo", visivel: true, opacidade: 1, canvas: c }];
    setAtiva(camadas.current[0].id);
    setTamanho({ w, h });
    limparSelecao();
    historico.current.limpar();
    if (nomeArquivo) setNome(nomeArquivo.replace(/\.[^.]+$/, ""));
    setAviso(reduziu ? `A imagem era grande e foi reduzida para ${w} × ${h} px para editar com folga.` : null);
    // A área da tela só existe depois que a imagem abre: o zoom de caber na tela é calculado em seguida.
    setAjustarZoom(true);
  }, []);

  const abrirArquivo = useCallback(async (f: Blob, nomeArquivo?: string) => {
    setErro(null);
    setCarregando("Abrindo a imagem…");
    try {
      const bmp = await createImageBitmap(f);
      abrirBitmap(bmp, nomeArquivo);
      bmp.close();
    } catch {
      setErro("Não deu para abrir essa imagem. Use JPG, PNG, WebP, GIF ou BMP.");
    } finally {
      setCarregando(null);
    }
  }, [abrirBitmap]);

  useEffect(() => {
    if (arquivoInicial) void abrirArquivo(arquivoInicial, arquivoInicial.name);
    else if (carregar) carregar().then(b => abrirArquivo(b)).catch(() => { setCarregando(null); setErro("Não deu para carregar a imagem."); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imagemEmBranco = () => {
    const c = criarCanvas(1280, 720);
    const ctx = ctxDe(c); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1280, 720);
    abrirBitmap(c, "imagem");
  };

  // ---------- histórico ----------
  const foto = (): Estado => ({
    largura: tamanho?.w ?? 0, altura: tamanho?.h ?? 0, ativa,
    camadas: camadas.current.map(c => ({ id: c.id, nome: c.nome, visivel: c.visivel, opacidade: c.opacidade, dados: ctxDe(c.canvas).getImageData(0, 0, c.canvas.width, c.canvas.height) })),
  });
  const restaurar = (e: Estado) => {
    camadas.current = e.camadas.map(f => { const c = criarCanvas(e.largura, e.altura); ctxDe(c).putImageData(f.dados, 0, 0); return { id: f.id, nome: f.nome, visivel: f.visivel, opacidade: f.opacidade, canvas: c }; });
    setTamanho({ w: e.largura, h: e.altura });
    setAtiva(e.ativa);
    redesenhar();
  };
  const guardar = () => {
    if (!tamanho) return;
    // Memória: no máximo ~400 MB de histórico.
    const porPasso = tamanho.w * tamanho.h * 4 * Math.max(1, camadas.current.length);
    historico.current.ajustarLimite(Math.max(4, Math.min(30, Math.floor(400_000_000 / porPasso))));
    historico.current.guardar(foto());
  };
  const desfazer = () => { const e = historico.current.desfazer(foto()); if (e) restaurar(e); };
  const refazer = () => { const e = historico.current.refazer(foto()); if (e) restaurar(e); };

  // ---------- coordenadas ----------
  const pontoDe = (e: { clientX: number; clientY: number }): Ponto => {
    const r = tela.current?.getBoundingClientRect();
    if (!r || !tamanho) return { x: 0, y: 0 };
    return { x: ((e.clientX - r.left) / r.width) * tamanho.w, y: ((e.clientY - r.top) / r.height) * tamanho.h };
  };

  const estiloForma = (ctx: CanvasRenderingContext2D) => {
    ctx.lineWidth = espessura; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = cor; ctx.fillStyle = cheio ? cor2 : cor;
  };
  const desenharForma = (ctx: CanvasRenderingContext2D, a: Ponto, b: Ponto) => {
    estiloForma(ctx);
    ctx.beginPath();
    if (ferramenta === "linha") { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); return; }
    if (ferramenta === "retangulo") ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    if (cheio) ctx.fill();
    ctx.stroke();
  };

  /** Pincel e borracha só pintam dentro da seleção, se houver. */
  const recortarSelecao = (ctx: CanvasRenderingContext2D) => {
    if (selecao && selecao.w > 0 && selecao.h > 0) { ctx.beginPath(); ctx.rect(selecao.x, selecao.y, selecao.w, selecao.h); ctx.clip(); }
  };

  // ---------- ponteiro ----------
  const baixar = (e: PE<HTMLCanvasElement>) => {
    if (!tamanho || ferramenta === "mao" || texto) return;
    const c = camadaAtiva();
    if (!c) return;
    const p = pontoDe(e);
    if (ferramenta === "contagotas") {
      const t = criarCanvas(tamanho.w, tamanho.h); compor(t);
      setCor(corParaHex(ctxDe(t).getImageData(Math.min(tamanho.w - 1, Math.floor(p.x)), Math.min(tamanho.h - 1, Math.floor(p.y)), 1, 1).data));
      return;
    }
    if (ferramenta === "balde") {
      guardar();
      const ctx = ctxDe(c.canvas);
      const dados = ctx.getImageData(0, 0, tamanho.w, tamanho.h);
      if (preencher({ data: dados.data, width: tamanho.w, height: tamanho.h }, p.x, p.y, hexParaCor(cor), tolerancia)) { ctx.putImageData(dados, 0, 0); redesenhar(); }
      return;
    }
    if (ferramenta === "texto") { setTexto({ p, valor: "" }); return; }
    if (ferramenta === "varinha") {
      const dados = ctxDe(c.canvas).getImageData(0, 0, tamanho.w, tamanho.h);
      const nova = varinhaMagica({ data: dados.data, width: tamanho.w, height: tamanho.h }, p.x, p.y, tolerancia, varinhaGlobal);
      const modo: ModoSelecao = e.altKey || e.button === 2 ? "tirar" : e.shiftKey ? "somar" : modoSelecao;
      definirMascara(combinar(mascaraAtual(), nova, modo));
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ferramenta === "selecao") { arrasto.current = { inicio: p, ultimo: p, antes: null }; limparSelecao(); return; }
    guardar();
    // Com a seleção da varinha, o traço fica preso à caixa dela e, ao soltar, o que caiu fora volta a ser como era.
    const comMascara = mascara && (ferramenta === "pincel" || ferramenta === "borracha");
    arrasto.current = { inicio: p, ultimo: p, antes: comMascara ? ctxDe(c.canvas).getImageData(0, 0, tamanho.w, tamanho.h) : null };
    if (ferramenta === "pincel" || ferramenta === "borracha") {
      const ctx = ctxDe(c.canvas);
      ctx.save();
      recortarSelecao(ctx);
      ctx.globalCompositeOperation = ferramenta === "borracha" ? "destination-out" : "source-over";
      ctx.fillStyle = cor;
      ctx.beginPath(); ctx.arc(p.x, p.y, espessura / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      redesenhar();
    }
  };

  const mover = (e: PE<HTMLCanvasElement>) => {
    const a = arrasto.current;
    if (!a || !tamanho) return;
    const p = pontoDe(e);
    const c = camadaAtiva();
    if (ferramenta === "pincel" || ferramenta === "borracha") {
      const ctx = ctxDe(c.canvas);
      ctx.save();
      recortarSelecao(ctx);
      ctx.globalCompositeOperation = ferramenta === "borracha" ? "destination-out" : "source-over";
      ctx.strokeStyle = cor; ctx.lineWidth = espessura; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(a.ultimo.x, a.ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.restore();
      a.ultimo = p;
      pintarTela();
      return;
    }
    a.ultimo = p;
    if (ferramenta === "selecao") { setSelecao(retanguloDe(a.inicio, p, tamanho.w, tamanho.h)); return; }
    preview.current = ctx => { ctx.save(); desenharForma(ctx, a.inicio, p); ctx.restore(); };
    pintarTela();
  };

  const soltar = () => {
    const a = arrasto.current;
    arrasto.current = null;
    preview.current = null;
    if (!a) return;
    if (["linha", "retangulo", "elipse"].includes(ferramenta)) {
      const ctx = ctxDe(camadaAtiva().canvas);
      ctx.save(); desenharForma(ctx, a.inicio, a.ultimo); ctx.restore();
    }
    if (a.antes && mascara && tamanho) {
      const ctx = ctxDe(camadaAtiva().canvas);
      const depois = ctx.getImageData(0, 0, tamanho.w, tamanho.h);
      restaurarFora({ data: depois.data, width: tamanho.w, height: tamanho.h }, { data: a.antes.data, width: tamanho.w, height: tamanho.h }, mascara);
      ctx.putImageData(depois, 0, 0);
    }
    if (ferramenta === "selecao" && tamanho) { const s = retanguloDe(a.inicio, a.ultimo, tamanho.w, tamanho.h); setSelecao(s.w > 1 && s.h > 1 ? s : null); }
    redesenhar();
  };

  const confirmarTexto = () => {
    if (!texto) return;
    if (texto.valor.trim()) {
      guardar();
      const ctx = ctxDe(camadaAtiva().canvas);
      ctx.save();
      ctx.font = `bold ${tamanhoTexto}px Inter, Arial, sans-serif`;
      ctx.fillStyle = cor;
      ctx.textBaseline = "top";
      texto.valor.split("\n").forEach((l, i) => ctx.fillText(l, texto.p.x, texto.p.y + i * tamanhoTexto * 1.2));
      ctx.restore();
    }
    setTexto(null);
    redesenhar();
  };

  // ---------- imagem inteira ----------
  /** Aplica uma transformação a todas as camadas (girar, espelhar, redimensionar, recortar). */
  const transformar = (novoW: number, novoH: number, desenhar: (ctx: CanvasRenderingContext2D, origem: HTMLCanvasElement) => void) => {
    guardar();
    camadas.current = camadas.current.map(c => { const n = criarCanvas(novoW, novoH); const ctx = ctxDe(n); ctx.imageSmoothingQuality = "high"; desenhar(ctx, c.canvas); return { ...c, canvas: n }; });
    setTamanho({ w: novoW, h: novoH });
    limparSelecao();
    redesenhar();
  };
  const girar = (graus: 90 | -90 | 180) => {
    if (!tamanho) return;
    const [w, h] = graus === 180 ? [tamanho.w, tamanho.h] : [tamanho.h, tamanho.w];
    transformar(w, h, (ctx, o) => { ctx.translate(w / 2, h / 2); ctx.rotate((graus * Math.PI) / 180); ctx.drawImage(o, -o.width / 2, -o.height / 2); });
  };
  const espelhar = (horizontal: boolean) => {
    if (!tamanho) return;
    transformar(tamanho.w, tamanho.h, (ctx, o) => { ctx.translate(horizontal ? o.width : 0, horizontal ? 0 : o.height); ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1); ctx.drawImage(o, 0, 0); });
  };
  const recortar = () => {
    if (!selecao || !tamanho) return;
    const s = selecao;
    // Na seleção da varinha, o que fica fora dela (dentro da caixa) vira transparente, em todas as camadas.
    const fora = mascara ? inverter(suavizar(recortarMascara(mascara, tamanho.w, s), s.w, s.h, bordaSuave)) : null;
    transformar(s.w, s.h, (ctx, o) => {
      ctx.drawImage(o, -s.x, -s.y);
      if (!fora) return;
      const d = ctx.getImageData(0, 0, s.w, s.h);
      apagarNaMascara({ data: d.data, width: s.w, height: s.h }, fora);
      ctx.putImageData(d, 0, 0);
    });
    setAjustarZoom(true);
  };
  const naSelecao = (acao: "apagar" | "preencher", m: Mascara | null = mascara) => {
    if (!selecao || !tamanho) return;
    guardar();
    const ctx = ctxDe(camadaAtiva().canvas);
    if (m) {
      const d = ctx.getImageData(0, 0, tamanho.w, tamanho.h);
      const px = { data: d.data, width: tamanho.w, height: tamanho.h };
      const suave = suavizar(m, tamanho.w, tamanho.h, bordaSuave);
      if (acao === "apagar") apagarNaMascara(px, suave); else preencherNaMascara(px, suave, hexParaCor(cor));
      ctx.putImageData(d, 0, 0);
    } else if (acao === "apagar") ctx.clearRect(selecao.x, selecao.y, selecao.w, selecao.h);
    else { ctx.fillStyle = cor; ctx.fillRect(selecao.x, selecao.y, selecao.w, selecao.h); }
    redesenhar();
  };
  /** Fica só com o que está selecionado: apaga todo o resto da camada (o jeito de tirar o fundo de um objeto). */
  const apagarResto = () => {
    const m = mascaraAtual();
    if (!m || !tamanho) return;
    const resto = inverter(m);
    naSelecao("apagar", resto);
  };

  // ---------- ajustes ----------
  const abrirAjuste = (tipo: TipoAjuste) => {
    if (!tamanho) return;
    const def = AJUSTES.find(a => a.tipo === tipo);
    if (!def) return;
    const ctx = ctxDe(camadaAtiva().canvas);
    original.current = ctx.getImageData(0, 0, tamanho.w, tamanho.h);
    if (def.semValor) { guardar(); aplicarNaCamada(tipo, 0); original.current = null; return; }
    setAjuste({ tipo, valor: def.padrao });
    aplicarNaCamada(tipo, def.padrao);
  };
  const aplicarNaCamada = (tipo: TipoAjuste, valor: number) => {
    const o = original.current;
    if (!o || !tamanho) return;
    const novo = aplicarAjuste({ data: o.data, width: o.width, height: o.height }, tipo, valor);
    ctxDe(camadaAtiva().canvas).putImageData(new ImageData(novo, o.width, o.height), 0, 0);
    redesenhar();
  };
  useEffect(() => {
    if (!ajuste) return;
    const t = window.setTimeout(() => aplicarNaCamada(ajuste.tipo, ajuste.valor), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajuste?.valor]);
  const fecharAjuste = (aplicar: boolean) => {
    const o = original.current;
    if (o) {
      const c = camadaAtiva();
      if (aplicar) {
        // O histórico guarda o "antes" (o original), não o resultado.
        const depois = ctxDe(c.canvas).getImageData(0, 0, o.width, o.height);
        ctxDe(c.canvas).putImageData(o, 0, 0);
        guardar();
        ctxDe(c.canvas).putImageData(depois, 0, 0);
      } else ctxDe(c.canvas).putImageData(o, 0, 0);
    }
    original.current = null;
    setAjuste(null);
    redesenhar();
  };

  // ---------- camadas ----------
  const novaCamada = (base?: HTMLCanvasElement, nomeCamada?: string) => {
    if (!tamanho) return;
    guardar();
    const c = criarCanvas(tamanho.w, tamanho.h);
    if (base) ctxDe(c).drawImage(base, 0, 0);
    const nova = { id: novoId(), nome: nomeCamada ?? `Camada ${camadas.current.length + 1}`, visivel: true, opacidade: 1, canvas: c };
    const i = camadas.current.findIndex(x => x.id === ativa);
    camadas.current.splice(i + 1, 0, nova);
    setAtiva(nova.id);
    redesenhar();
  };
  const mudarCamada = (id: string, parcial: Partial<Camada>, comHistorico = true) => {
    if (comHistorico) guardar();
    camadas.current = camadas.current.map(c => (c.id === id ? { ...c, ...parcial } : c));
    redesenhar();
  };
  const excluirCamada = (id: string) => {
    if (camadas.current.length <= 1) return;
    guardar();
    const i = camadas.current.findIndex(c => c.id === id);
    camadas.current = camadas.current.filter(c => c.id !== id);
    setAtiva(camadas.current[Math.max(0, i - 1)].id);
    redesenhar();
  };
  const moverCamada = (id: string, d: 1 | -1) => {
    const i = camadas.current.findIndex(c => c.id === id), j = i + d;
    if (j < 0 || j >= camadas.current.length) return;
    guardar();
    const l = [...camadas.current]; [l[i], l[j]] = [l[j], l[i]]; camadas.current = l;
    redesenhar();
  };
  const mesclarAbaixo = (id: string) => {
    const i = camadas.current.findIndex(c => c.id === id);
    if (i <= 0) return;
    guardar();
    const de = camadas.current[i], para = camadas.current[i - 1];
    const ctx = ctxDe(para.canvas);
    ctx.save(); ctx.globalAlpha = de.visivel ? de.opacidade : 0; ctx.drawImage(de.canvas, 0, 0); ctx.restore();
    camadas.current = camadas.current.filter(c => c.id !== id);
    setAtiva(para.id);
    redesenhar();
  };

  // ---------- colar, teclado ----------
  useEffect(() => {
    const colar = async (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (!f) return;
      e.preventDefault();
      if (!tamanho) { void abrirArquivo(f, "colada"); return; }
      const bmp = await createImageBitmap(f);
      const c = criarCanvas(tamanho.w, tamanho.h);
      const k = Math.min(1, tamanho.w / bmp.width, tamanho.h / bmp.height);
      ctxDe(c).drawImage(bmp, 0, 0, bmp.width * k, bmp.height * k);
      bmp.close();
      novaCamada(c, "Colada");
    };
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); return; }
      if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); refazer(); return; }
      if (ctrl && e.key.toLowerCase() === "i") { e.preventDefault(); inverterSelecao(); return; }
      if (ctrl && e.key.toLowerCase() === "a") { e.preventDefault(); selecionarTudo(); return; }
      if (e.key === "Escape") { limparSelecao(); setTexto(null); return; }
      if (e.key === "Delete" && selecao) { naSelecao("apagar"); return; }
      if (ctrl || e.altKey) return;
      const f = FERRAMENTAS.find(x => x.tecla === e.key.toLowerCase());
      if (f) setFerramenta(f.id);
    };
    window.addEventListener("paste", colar);
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("paste", colar); window.removeEventListener("keydown", tecla); };
  });

  // ---------- saída ----------
  const gerar = async (formato: "png" | "jpg") => {
    if (!tamanho) throw new Error("Abra uma imagem primeiro.");
    const c = criarCanvas(tamanho.w, tamanho.h);
    compor(c, formato === "jpg");
    return paraBlob(c, formato === "png" ? "image/png" : "image/jpeg", 0.92);
  };
  const baixarComo = async (formato: "png" | "jpg") => {
    try { baixarArquivo(new File([await gerar(formato)], `${nomeDeArquivo(nome, "imagem")}.${formato}`, { type: formato === "png" ? "image/png" : "image/jpeg" })); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não deu para gerar a imagem."); }
  };
  const salvar = async () => {
    if (!onSalvar) return;
    setSalvando(true);
    try {
      const r = await onSalvar(await gerar(formatoSalvar));
      if (r) setErro(r); else onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const ajusteDef = useMemo(() => AJUSTES.find(a => a.tipo === ajuste?.tipo), [ajuste?.tipo]);
  const desenhando = ferramenta !== "mao";
  const lista = [...camadas.current].reverse();

  // ---------- sem imagem ----------
  if (!tamanho) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" className={botao} onClick={onFechar}><ArrowLeft className="h-4 w-4" />Voltar</button>
          <h1 className="text-xl font-bold text-slate-800">Editar imagem</h1>
        </div>
        <input ref={entrada} type="file" accept="image/*" className="hidden" aria-label="Imagem para editar"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void abrirArquivo(f, f.name); }} />
        {carregando ? <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{carregando}</p> : (
          <>
            <button type="button" onClick={() => entrada.current?.click()}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void abrirArquivo(f, f.name); }}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center hover:bg-slate-50">
              <Upload className="h-10 w-10 text-slate-400" />
              <span className="text-base font-bold text-slate-700">Escolher imagem</span>
              <span className="text-xs text-slate-500">ou arraste para cá, ou cole com Ctrl+V · JPG, PNG, WebP, GIF, BMP</span>
            </button>
            <button type="button" className={`${botao} mt-3`} onClick={imagemEmBranco}><ImagePlus className="h-4 w-4" />Começar com uma imagem em branco</button>
          </>
        )}
        {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      </div>
    );
  }

  const Botao = ({ rotulo, onClick, children, desligado }: { rotulo: string; onClick: () => void; children: ReactNode; desligado?: boolean }) => (
    <button type="button" className={icone()} onClick={onClick} disabled={desligado} aria-label={rotulo} title={rotulo}>{children}</button>
  );

  // ---------- editor ----------
  return (
    <div className={`flex flex-col gap-2 ${telaCheia ? "h-full" : "h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-4rem)]"}`}>
      {/* Barra de cima */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={botao} onClick={onFechar}><ArrowLeft className="h-4 w-4" />{telaCheia ? "Fechar" : "Voltar"}</button>
        <input value={nome} onChange={e => setNome(e.target.value)} aria-label="Nome da imagem" maxLength={80}
          className="order-last w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-bold text-slate-800 hover:border-slate-200 focus:border-blue-500 focus:outline-none sm:order-none sm:w-auto sm:flex-1" />
        <span className="hidden text-xs text-slate-400 sm:inline">{tamanho.w} × {tamanho.h} px</span>
        <Botao rotulo="Desfazer (Ctrl+Z)" onClick={desfazer} desligado={!historico.current.podeDesfazer}><Undo2 className="h-4 w-4" /></Botao>
        <Botao rotulo="Refazer (Ctrl+Y)" onClick={refazer} desligado={!historico.current.podeRefazer}><Redo2 className="h-4 w-4" /></Botao>
        <Botao rotulo="Diminuir zoom" onClick={() => setZoom(z => Math.max(0.05, z / 1.25))}><ZoomOut className="h-4 w-4" /></Botao>
        <button type="button" onClick={caberNaTela} title="Caber na tela" aria-label="Caber na tela" className="w-12 rounded-lg py-1.5 text-center text-xs font-bold text-slate-600 hover:bg-slate-100">{Math.round(zoom * 100)}%</button>
        <Botao rotulo="Aumentar zoom" onClick={() => setZoom(z => Math.min(16, z * 1.25))}><ZoomIn className="h-4 w-4" /></Botao>
        <button type="button" className={botao} onClick={() => void baixarComo("png")}><Download className="h-3.5 w-3.5" />PNG</button>
        <button type="button" className={botao} onClick={() => void baixarComo("jpg")}><Download className="h-3.5 w-3.5" />JPG</button>
        {onAbrirNoCaderno && <button type="button" className={botao} onClick={async () => onAbrirNoCaderno(new File([await gerar("png")], `${nomeDeArquivo(nome, "imagem")}.png`, { type: "image/png" }))}><NotebookPen className="h-3.5 w-3.5" />Num caderno</button>}
        {onSalvar && <button type="button" className={`${botao} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => void salvar()} disabled={salvando}>
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Salvar</button>}
      </div>

      {/* Imagem: girar, espelhar, redimensionar, ajustes */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1" role="toolbar" aria-label="Imagem e ajustes">
        <Botao rotulo="Girar 90° para a esquerda" onClick={() => girar(-90)}><RotateCcw className="h-4 w-4" /></Botao>
        <Botao rotulo="Girar 90° para a direita" onClick={() => girar(90)}><RotateCw className="h-4 w-4" /></Botao>
        <Botao rotulo="Espelhar na horizontal" onClick={() => espelhar(true)}><FlipHorizontal className="h-4 w-4" /></Botao>
        <Botao rotulo="Espelhar na vertical" onClick={() => espelhar(false)}><FlipVertical className="h-4 w-4" /></Botao>
        <Botao rotulo="Redimensionar" onClick={() => setRedim({ largura: tamanho.w, altura: tamanho.h, proporcao: true })}><Scaling className="h-4 w-4" /></Botao>
        <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
        <SlidersHorizontal className="ml-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <select aria-label="Ajuste" value="" onChange={e => { if (e.target.value) abrirAjuste(e.target.value as TipoAjuste); }}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700">
          <option value="">Ajustes e efeitos…</option>
          {AJUSTES.map(a => <option key={a.tipo} value={a.tipo}>{a.rotulo}</option>)}
        </select>
        {selecao && <>
          <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={recortar}><Crop className="h-3.5 w-3.5" />Recortar</button>
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={() => naSelecao("apagar")} title="Apagar a seleção (Delete)"><Trash2 className="h-3.5 w-3.5" />Apagar</button>
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={apagarResto} title="Apaga tudo o que está fora da seleção"><Scissors className="h-3.5 w-3.5" />Apagar o resto</button>
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={inverterSelecao} title="Inverter a seleção (Ctrl+I)"><ArrowLeftRight className="h-3.5 w-3.5" />Inverter</button>
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={() => naSelecao("preencher")}><PaintBucket className="h-3.5 w-3.5" />Preencher</button>
          <button type="button" className={`${botao} shrink-0 whitespace-nowrap`} onClick={limparSelecao}><X className="h-3.5 w-3.5" />Tirar seleção</button>
        </>}
      </div>

      {aviso && <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{aviso}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">{erro}</p>}

      <div className="flex min-h-0 flex-1 gap-2">
        {/* Ferramentas */}
        <div className="flex shrink-0 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1" role="toolbar" aria-label="Ferramentas" aria-orientation="vertical">
          {FERRAMENTAS.map(f => (
            <button key={f.id} type="button" aria-pressed={ferramenta === f.id} onClick={() => setFerramenta(f.id)} className={icone(ferramenta === f.id)}
              aria-label={f.rotulo} title={`${f.rotulo} (${f.tecla.toUpperCase()})`}><f.icone className="h-4 w-4" /></button>
          ))}
        </div>

        {/* Tela */}
        <div ref={area} className="relative min-w-0 flex-1 overflow-auto rounded-xl border border-slate-200"
          style={{ backgroundColor: "#e2e8f0", backgroundImage: "linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0" }}>
          <div className="relative m-4 inline-block" style={{ width: tamanho.w * zoom, height: tamanho.h * zoom }}>
            <canvas ref={tela} aria-label="Imagem em edição" onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
              onContextMenu={e => { if (ferramenta === "varinha") e.preventDefault(); }}
              className="block shadow-lg" style={{ width: tamanho.w * zoom, height: tamanho.h * zoom, touchAction: desenhando ? "none" : "auto", cursor: desenhando ? "crosshair" : "grab", imageRendering: zoom > 2 ? "pixelated" : "auto" }} />
            {texto && (
              <div className="absolute z-10 flex flex-col gap-1" style={{ left: texto.p.x * zoom, top: texto.p.y * zoom }}>
                <textarea autoFocus value={texto.valor} onChange={e => setTexto({ ...texto, valor: e.target.value })} aria-label="Texto para escrever na imagem"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmarTexto(); } if (e.key === "Escape") setTexto(null); }}
                  className="min-w-[10rem] rounded border-2 border-dashed border-blue-500 bg-white/80 p-1 font-bold outline-none"
                  style={{ fontSize: Math.max(12, tamanhoTexto * zoom), color: cor, lineHeight: 1.2 }} rows={1} />
                <div className="flex gap-1"><button type="button" className={botao} onClick={confirmarTexto}>Pronto</button><button type="button" className={botao} onClick={() => setTexto(null)}>Cancelar</button></div>
              </div>
            )}
          </div>
        </div>

        {/* Painel: cores, espessura, camadas */}
        <aside aria-label="Cores e camadas" className={`${painel ? "fixed inset-x-2 bottom-2 z-40 max-h-[60vh]" : "hidden"} w-auto shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl md:static md:flex md:max-h-none md:w-60 md:shadow-none`}>
          <div className="flex items-center justify-between md:hidden"><b className="text-sm">Cores e camadas</b><button type="button" className={icone()} aria-label="Fechar painel" onClick={() => setPainel(false)}><X className="h-4 w-4" /></button></div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Cores</p>
            <div className="flex items-center gap-2">
              <label className="flex flex-col items-center text-[10px] text-slate-500">Cor<input type="color" value={cor} onChange={e => setCor(e.target.value)} aria-label="Cor principal" className="h-9 w-9 cursor-pointer rounded" /></label>
              <label className="flex flex-col items-center text-[10px] text-slate-500">Fundo<input type="color" value={cor2} onChange={e => setCor2(e.target.value)} aria-label="Cor de preenchimento" className="h-9 w-9 cursor-pointer rounded" /></label>
              <button type="button" className={botao} onClick={() => { setCor(cor2); setCor2(cor); }} title="Trocar as cores">⇄</button>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-1">
              {CORES_RAPIDAS.map(c => <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setCor(c)} className={`h-6 rounded border ${cor === c ? "ring-2 ring-blue-500" : "border-slate-200"}`} style={{ background: c }} />)}
            </div>
          </div>
          {["pincel", "borracha", "linha", "retangulo", "elipse"].includes(ferramenta) && (
            <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Espessura: {espessura}px</span>
              <input type="range" min={1} max={120} value={espessura} onChange={e => setEspessura(Number(e.target.value))} aria-label="Espessura" className="w-full" /></label>
          )}
          {(ferramenta === "retangulo" || ferramenta === "elipse") && (
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={cheio} onChange={e => setCheio(e.target.checked)} />Preencher com a cor de fundo</label>
          )}
          {ferramenta === "texto" && (
            <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tamanho do texto: {tamanhoTexto}px</span>
              <input type="range" min={10} max={300} value={tamanhoTexto} onChange={e => setTamanhoTexto(Number(e.target.value))} aria-label="Tamanho do texto" className="w-full" /></label>
          )}
          {ferramenta === "varinha" && (
            <div className="space-y-2">
              <p className="text-[11px] leading-snug text-slate-500">Toque numa cor para selecionar a área parecida. Para tirar o fundo: toque no fundo e use <b>Apagar</b>, ou toque no objeto e use <b>Apagar o resto</b>. Baixe em PNG para manter o fundo transparente.</p>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Modo</p>
                <div className="grid grid-cols-4 gap-1" role="group" aria-label="Modo da seleção">
                  {MODOS_SELECAO.map(m => (
                    <button key={m.id} type="button" aria-pressed={modoSelecao === m.id} title={m.dica} onClick={() => setModoSelecao(m.id)}
                      className={`rounded-lg border px-1 py-1 text-[11px] font-bold ${modoSelecao === m.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{m.rotulo}</button>
                  ))}
                </div>
              </div>
              <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tolerância: {tolerancia}%</span>
                <input type="range" min={0} max={100} value={tolerancia} onChange={e => setTolerancia(Number(e.target.value))} aria-label="Tolerância da varinha" className="w-full" /></label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={varinhaGlobal} onChange={e => setVarinhaGlobal(e.target.checked)} />Pegar a cor na imagem toda</label>
              <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Borda suave: {bordaSuave}px</span>
                <input type="range" min={0} max={10} value={bordaSuave} onChange={e => setBordaSuave(Number(e.target.value))} aria-label="Borda suave" className="w-full" /></label>
            </div>
          )}
          {ferramenta === "balde" && (
            <label className="block"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Tolerância: {tolerancia}%</span>
              <input type="range" min={0} max={100} value={tolerancia} onChange={e => setTolerancia(Number(e.target.value))} aria-label="Tolerância" className="w-full" /></label>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Camadas</p>
              <div className="flex gap-0.5">
                <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Nova camada" title="Nova camada" onClick={() => novaCamada()}><Plus className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Duplicar camada" title="Duplicar camada" onClick={() => { const c = camadaAtiva(); novaCamada(c.canvas, `${c.nome} (cópia)`); }}><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <ul className="space-y-1" aria-label="Lista de camadas">
              {lista.map((c, i) => (
                <li key={c.id} className={`rounded-lg border p-1.5 ${c.id === ativa ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded p-1 text-slate-500 hover:bg-white" aria-label={c.visivel ? `Esconder ${c.nome}` : `Mostrar ${c.nome}`}
                      onClick={() => mudarCamada(c.id, { visivel: !c.visivel })}>{c.visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-xs font-bold text-slate-700" onClick={() => setAtiva(c.id)}
                      onDoubleClick={() => { const n = window.prompt("Nome da camada", c.nome); if (n?.trim()) mudarCamada(c.id, { nome: n.trim().slice(0, 40) }); }}
                      aria-label={`Camada ${c.nome}`} aria-current={c.id === ativa}>{c.nome}</button>
                    <button type="button" className="rounded p-0.5 text-slate-400 hover:bg-white disabled:opacity-30" aria-label={`Subir ${c.nome}`} disabled={i === 0} onClick={() => moverCamada(c.id, 1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="rounded p-0.5 text-slate-400 hover:bg-white disabled:opacity-30" aria-label={`Descer ${c.nome}`} disabled={i === lista.length - 1} onClick={() => moverCamada(c.id, -1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  {c.id === ativa && (
                    <div className="mt-1 flex items-center gap-1">
                      <input type="range" min={0} max={100} value={Math.round(c.opacidade * 100)} aria-label={`Opacidade de ${c.nome}`}
                        onChange={e => mudarCamada(c.id, { opacidade: Number(e.target.value) / 100 }, false)} className="min-w-0 flex-1" />
                      <button type="button" className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30" aria-label={`Mesclar ${c.nome} com a de baixo`} title="Mesclar com a de baixo" disabled={i === lista.length - 1} onClick={() => mesclarAbaixo(c.id)}><Merge className="h-3.5 w-3.5" /></button>
                      <button type="button" className="rounded p-1 text-red-500 hover:bg-white disabled:opacity-30" aria-label={`Excluir ${c.nome}`} disabled={lista.length <= 1} onClick={() => excluirCamada(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <button type="button" className={`${botao} md:hidden`} onClick={() => setPainel(true)}><Layers className="h-4 w-4" />Cores e camadas</button>

      {ajuste && ajusteDef && (
        <div className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" role="dialog" aria-label={ajusteDef.rotulo}>
          <p className="mb-2 text-sm font-bold text-slate-800">{ajusteDef.rotulo}: {ajuste.valor}</p>
          <input type="range" min={ajusteDef.min} max={ajusteDef.max} value={ajuste.valor} aria-label={`Valor de ${ajusteDef.rotulo}`}
            onChange={e => setAjuste({ ...ajuste, valor: Number(e.target.value) })} className="w-full" />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={botao} onClick={() => fecharAjuste(false)}>Cancelar</button>
            <button type="button" className={`${botao} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => fecharAjuste(true)}>Aplicar</button>
          </div>
        </div>
      )}

      {redim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-label="Redimensionar">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <p className="mb-3 text-sm font-bold text-slate-800">Redimensionar imagem</p>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-slate-500">Largura (px)<input type="number" min={1} max={8000} value={redim.largura} aria-label="Nova largura" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={e => { const v = Number(e.target.value); setRedim(r => r && (r.proporcao ? { ...r, ...redimensionarProporcional(tamanho.w, tamanho.h, { largura: v }) } : { ...r, largura: v })); }} /></label>
              <label className="flex-1 text-xs text-slate-500">Altura (px)<input type="number" min={1} max={8000} value={redim.altura} aria-label="Nova altura" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                onChange={e => { const v = Number(e.target.value); setRedim(r => r && (r.proporcao ? { ...r, ...redimensionarProporcional(tamanho.w, tamanho.h, { altura: v }) } : { ...r, altura: v })); }} /></label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={redim.proporcao} onChange={e => setRedim({ ...redim, proporcao: e.target.checked })} />Manter a proporção</label>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className={botao} onClick={() => setRedim(null)}>Cancelar</button>
              <button type="button" className={`${botao} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`} onClick={() => {
                const w = Math.min(8000, Math.max(1, Math.round(redim.largura))), h = Math.min(8000, Math.max(1, Math.round(redim.altura)));
                setRedim(null);
                transformar(w, h, (ctx, o) => ctx.drawImage(o, 0, 0, w, h));
              }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
