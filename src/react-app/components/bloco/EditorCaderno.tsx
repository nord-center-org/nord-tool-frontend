import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Circle, Copy, Eraser, FileDown, FileUp, Hand, Highlighter, ImagePlus, Lasso, Loader2, Minus,
  MoveUpRight, PenLine, PenTool, Plus, Redo2, Square, Trash2, Type, Undo2, X, ZoomIn, ZoomOut, Layers, CheckCircle2, SquarePen, GripHorizontal, Download, PanelTop, PanelLeft, PanelRight, Move, AlertTriangle,
  RotateCw, RotateCcw, FileText, Columns2, NotebookPen,
} from "lucide-react";
import DocumentoCaderno, { type ExibicaoDocumento } from "@/react-app/components/bloco/DocumentoCaderno";
import { useGestosToque } from "@/react-app/components/bloco/useGestosToque";
import EditorImagemTelaCheia from "@/react-app/components/imagem/EditorImagemTelaCheia";
import { baixarArquivo } from "@/react-app/utils/baixarArquivo";


import PaginaVista, { type ConfigFerramenta, type Ferramenta } from "@/react-app/components/bloco/PaginaVista";
import { guardarImagem } from "@/react-app/components/bloco/imagensBloco";
import { ACEITA_ARQUIVOS, importarArquivo } from "@/react-app/components/bloco/arquivosBloco";
import { exportarPdf, imagemDaPagina, itensSalvos } from "@/react-app/components/bloco/pdfBloco";
import { ApiError } from "@/react-app/services/apiClient";
import { blocoNotasService as servico, type Caderno, type PaginaBloco } from "@/react-app/services/BlocoNotasService";
import {
  CORES, CORES_MARCA, ESPESSURAS, ROTULO_FUNDO, compactar, girarItens, tipoDoArquivo, lerConteudo, nomeArquivoCaderno, nomeArquivoPaginas, novoId, proximoGiro, registrar,
  type Fundo, type Item, type Passo, type TipoForma,
  correcaoDaRolagem, deslocamentoLateral, limitarZoom, zoomDaRoda,
} from "@/react-app/utils/blocoNotas";
import { prepararFoto } from "@/react-app/utils/imagem";

interface EstadoPagina { itens: Item[] | null; nrVersao: number; sujo: boolean; salvando: boolean }

const CHAVE_CONFIG = "@NordTool:bloco-notas";
const CONFIG_PADRAO: ConfigFerramenta = {
  ferramenta: "caneta", cor: "#111827", espessura: 3, corMarca: "#facc15", espessuraMarca: 16,
  borracha: "traco", raioBorracha: 10, forma: "linha", tamanhoTexto: 20, soCaneta: false,
};

function lerConfig(): ConfigFerramenta {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CONFIG) ?? "{}");
    return { ...CONFIG_PADRAO, ...(salvo && typeof salvo === "object" ? salvo : {}) };
  } catch {
    return CONFIG_PADRAO;
  }
}

function lerPreferencia<T extends string>(chave: string, padrao: T): T {
  try { return (localStorage.getItem(`${CHAVE_CONFIG}:${chave}`) as T | null) ?? padrao; } catch { return padrao; }
}
function gravarPreferencia(chave: string, valor: string) {
  try { localStorage.setItem(`${CHAVE_CONFIG}:${chave}`, valor); } catch { /* sem armazenamento */ }
}

const mensagem = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao);

const FERRAMENTAS: Array<{ id: Ferramenta; rotulo: string; Icone: typeof PenLine }> = [
  { id: "caneta", rotulo: "Caneta", Icone: PenLine },
  { id: "marca", rotulo: "Marca-texto", Icone: Highlighter },
  { id: "borracha", rotulo: "Borracha", Icone: Eraser },
  { id: "forma", rotulo: "Formas", Icone: Square },
  { id: "texto", rotulo: "Texto", Icone: Type },
  { id: "laco", rotulo: "Laço (selecionar)", Icone: Lasso },
  { id: "mao", rotulo: "Mão (rolar)", Icone: Hand },
];
/** v7: onde fica a barra de ferramentas do desenho. */
type PosicaoBarra = "cima" | "esquerda" | "direita" | "flutuante";
const POSICOES_BARRA: Array<{ id: PosicaoBarra; rotulo: string; Icone: typeof Minus }> = [
  { id: "cima", rotulo: "em cima", Icone: PanelTop },
  { id: "esquerda", rotulo: "na lateral esquerda", Icone: PanelLeft },
  { id: "direita", rotulo: "na lateral direita", Icone: PanelRight },
  { id: "flutuante", rotulo: "flutuante (arraste para onde quiser)", Icone: Move },
];
const CHAVE_BARRA = "@NordTool:caderno-barra";
function lerBarra(): { pos: PosicaoBarra; x: number; y: number } {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_BARRA) ?? "null") as { pos?: string; x?: number; y?: number } | null;
    const pos = POSICOES_BARRA.some(p => p.id === v?.pos) ? (v!.pos as PosicaoBarra) : "cima";
    return { pos, x: Number.isFinite(v?.x) ? v!.x! : 16, y: Number.isFinite(v?.y) ? v!.y! : 16 };
  } catch {
    return { pos: "cima", x: 16, y: 16 };
  }
}
function classesDaBarra(pos: PosicaoBarra) {
  if (pos === "esquerda" || pos === "direita") {
    return {
      fora: `flex w-16 shrink-0 flex-col overflow-y-auto overscroll-contain bg-white ${pos === "esquerda" ? "border-r" : "border-l"} border-slate-200`,
      ferramentas: "flex flex-col items-center gap-1 p-1.5",
      opcoes: "flex flex-col items-center gap-1.5 border-t border-slate-100 px-1 py-2",
    };
  }
  if (pos === "flutuante") {
    return {
      fora: "absolute z-30 w-max max-w-[calc(100%-1rem)] rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur",
      ferramentas: "flex flex-wrap items-center gap-1 px-2 pb-1",
      opcoes: "flex flex-wrap items-center gap-2 px-3 pb-2",
    };
  }
  return {
    fora: "border-b border-slate-200 bg-white",
    ferramentas: "flex items-center gap-1 overflow-x-auto px-2 py-1.5",
    opcoes: "flex items-center gap-2 overflow-x-auto px-3 pb-2",
  };
}

const FORMAS: Array<{ id: TipoForma; rotulo: string; Icone: typeof Minus }> = [
  { id: "linha", rotulo: "Linha", Icone: Minus },
  { id: "seta", rotulo: "Seta", Icone: MoveUpRight },
  { id: "ret", rotulo: "Retângulo", Icone: Square },
  { id: "elipse", rotulo: "Elipse", Icone: Circle },
];

interface Props {
  id: number;
  onVoltar: () => void;
  onAlterado: (c: Caderno) => void;
  /** v4: abre já nesta página (1…), quando o chat dos cadernos manda abrir. */
  paginaInicial?: number;
  /** v4: muda quando o chat cria uma página neste caderno; recarrega a lista sem perder o que não foi salvo. */
  recarregarEm?: number;
  /** v4: botão extra na barra de cima (o chat dos cadernos). */
  extra?: ReactNode;
}

/** O caderno aberto: páginas em rolagem, ferramentas de desenho, salvar automático e PDF. */
export default function EditorCaderno({ id, onVoltar, onAlterado, paginaInicial, recarregarEm, extra }: Props) {
  const [caderno, setCaderno] = useState<Caderno | null>(null);
  const [estado, setEstado] = useState<Record<number, EstadoPagina>>({});
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const [config, setConfig] = useState<ConfigFerramenta>(lerConfig);
  const [desfazer, setDesfazer] = useState<Passo[]>([]);
  const [refazer, setRefazer] = useState<Passo[]>([]);
  const [selecao, setSelecao] = useState<{ pagina: number; ids: Set<string> } | null>(null);
  const [fator, setFator] = useState(1);
  // v7: posição da barra de ferramentas (em cima, laterais ou flutuante), guardada no aparelho
  const [barra, setBarra] = useState(lerBarra);
  const posBarra = barra.pos, posFlutuante = barra;
  const areaRef = useRef<HTMLDivElement>(null);
  const guardarBarra = (b: typeof barra) => { setBarra(b); try { localStorage.setItem(CHAVE_BARRA, JSON.stringify(b)); } catch { /* fica só nesta visita */ } };
  const mudarPosBarra = (pos: PosicaoBarra) => guardarBarra({ ...barra, pos });
  /** Arrastar a barra flutuante pela alça (sem sair da área do caderno). */
  const arrastarBarra = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const area = areaRef.current, caixa = e.currentTarget.parentElement;
    if (!area || !caixa) return;
    const x0 = e.clientX - barra.x, y0 = e.clientY - barra.y;
    let atual = barra;
    const mover = (ev: PointerEvent) => {
      const maxX = Math.max(0, area.clientWidth - caixa.offsetWidth), maxY = Math.max(0, area.clientHeight - caixa.offsetHeight);
      atual = { ...barra, x: Math.max(0, Math.min(maxX, ev.clientX - x0)), y: Math.max(0, Math.min(maxY, ev.clientY - y0)) };
      setBarra(atual);
    };
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); guardarBarra(atual); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  /** Correção: quanto a folha (mais estreita que a tela) anda para o lado, para o zoom ficar no ponto do mouse. */
  const [desloc, setDesloc] = useState(0);
  // correção: o texto tem o zoom dele (1 = a folha cabe na largura); no modo Texto os botões de zoom mexem nele
  const [zoomTexto, setZoomTexto] = useState(1);
  const mudarZoomTexto = useCallback((z: number) => setZoomTexto(Math.max(0.5, Math.min(4, z))), []);
  const [ajuste, setAjuste] = useState(1);
  const [atual, setAtual] = useState<number | null>(null);
  const [painel, setPainel] = useState(false);
  // v2: o que aparece — o desenho, o documento de texto ou os dois lado a lado (lembrado no aparelho).
  const [modo, setModo] = useState<"desenho" | "texto" | "lado">(() => lerPreferencia("modo", "desenho"));
  const [exibicao, setExibicao] = useState<ExibicaoDocumento>(() => lerPreferencia("exibicao", "paginas"));
  useEffect(() => { gravarPreferencia("modo", modo); gravarPreferencia("exibicao", exibicao); }, [modo, exibicao]);
  const documentoHtml = useRef("");
  const guardarHtml = useCallback((h: string) => { documentoHtml.current = h; }, []);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [conflito, setConflito] = useState<number | null>(null);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const visiveis = useRef(new Map<number, number>());
  const arquivoPdf = useRef<HTMLInputElement>(null);
  const arquivoImagem = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config)); } catch { /* sem armazenamento */ } }, [config]);
  const mudar = (m: Partial<ConfigFerramenta>) => setConfig(c => ({ ...c, ...m }));

  const carregar = useCallback(async () => {
    try {
      const c = await servico.abrir(id);
      setCaderno(c);
      setEstado(e => {
        const novo: Record<number, EstadoPagina> = {};
        for (const p of c.paginas ?? []) novo[p.id] = e[p.id] ?? { itens: null, nrVersao: p.nrVersao, sujo: false, salvando: false };
        return novo;
      });
      setAtual(a => a ?? c.paginas?.[0]?.id ?? null);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível abrir o caderno."));
    }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar, recarregarEm]);

  const paginas = useMemo(() => caderno?.paginas ?? [], [caderno]);
  const larguraMax = Math.max(1, ...paginas.map(p => p.nrLargura));

  // Zoom "caber na largura": recalculado quando a tela muda de tamanho.
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const medir = () => setAjuste(Math.max(0.2, Math.min(2, (el.clientWidth - 24) / larguraMax)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [larguraMax, caderno, modo]);
  const zoom = limitarZoom(ajuste * fator);

  /**
   * v6: zoom ancorado. Antes de mudar o zoom guarda o ponto da folha que está embaixo do cursor (ou do meio da tela,
   * nos botões); depois que a tela redesenha no zoom novo, rola para ele continuar no mesmo lugar — como no CAD.
   */
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const ajusteRef = useRef(ajuste);
  ajusteRef.current = ajuste;
  const alvoZoom = useRef<number | null>(null);
  const ancora = useRef<{ pagina: string; x: number; y: number; cx: number; cy: number } | null>(null);
  const zoomPara = useCallback((novo: number, cx?: number, cy?: number) => {
    const el = rolagemRef.current;
    const z = limitarZoom(novo);
    if (el) {
      const v = el.getBoundingClientRect();
      const ax = cx ?? v.left + el.clientWidth / 2, ay = cy ?? v.top + el.clientHeight / 2;
      let melhor: { pg: HTMLElement; r: DOMRect } | null = null, dist = Infinity;
      el.querySelectorAll<HTMLElement>("[data-pagina]").forEach(pg => {
        const r = pg.getBoundingClientRect();
        const d = ay < r.top ? r.top - ay : ay > r.bottom ? ay - r.bottom : 0;
        if (d < dist) { dist = d; melhor = { pg, r }; }
      });
      const m = melhor as { pg: HTMLElement; r: DOMRect } | null;
      if (m) ancora.current = { pagina: m.pg.dataset.pagina ?? "", x: (ax - m.r.left) / zoomRef.current, y: (ay - m.r.top) / zoomRef.current, cx: ax, cy: ay };
    }
    alvoZoom.current = z;
    setFator(z / ajusteRef.current);
  }, []);
  useLayoutEffect(() => {
    const a = ancora.current, el = rolagemRef.current;
    ancora.current = null;
    alvoZoom.current = null;
    if (!a || !el) return;
    const pg = el.querySelector(`[data-pagina="${a.pagina}"]`);
    if (!pg) return;
    const r = pg.getBoundingClientRect();
    const { dx, dy } = correcaoDaRolagem(r, a, zoom, { x: a.cx, y: a.cy });
    const antes = el.scrollLeft;
    el.scrollLeft += dx;
    el.scrollTop += dy;
    // folha mais estreita que a tela: o que a rolagem não deu conta, a folha anda para o lado
    const falta = dx - (el.scrollLeft - antes);
    if (Math.abs(falta) > 0.5) setDesloc(d => deslocamentoLateral(d, falta, (el.clientWidth - larguraMax * zoom - 24) / 2));
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregando = useRef(new Set<number>());
  const carregarPagina = useCallback(async (idPagina: number) => {
    const atualP = estadoRef.current[idPagina];
    if (!atualP || atualP.itens !== null || carregando.current.has(idPagina)) return;
    carregando.current.add(idPagina);
    try {
      const p = await servico.pagina(idPagina);
      setEstado(e => ({ ...e, [idPagina]: { itens: lerConteudo(p.conteudo).itens, nrVersao: p.nrVersao, sujo: false, salvando: false } }));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível abrir a página."));
    } finally {
      carregando.current.delete(idPagina);
    }
  }, []);

  // ---------- salvar automático ----------

  const salvarPagina = useCallback(async (idPagina: number) => {
    const p = estadoRef.current[idPagina];
    const meta = caderno?.paginas?.find(x => x.id === idPagina);
    if (!p || !p.itens || !p.sujo || p.salvando || !meta) return;
    const enviados = p.itens;
    setEstado(e => ({ ...e, [idPagina]: { ...e[idPagina], salvando: true } }));
    try {
      const r = await servico.salvar(idPagina, compactar(enviados), meta.cdFundo, p.nrVersao, meta.nrRotacao ?? 0);
      setEstado(e => ({ ...e, [idPagina]: { ...e[idPagina], nrVersao: r.nrVersao, salvando: false, sujo: e[idPagina].itens !== enviados } }));
    } catch (e) {
      setEstado(est => ({ ...est, [idPagina]: { ...est[idPagina], salvando: false } }));
      if (e instanceof ApiError && e.status === 409) setConflito(idPagina);
      else setErro(mensagem(e, "Não foi possível salvar a página. Vou tentar de novo."));
    }
  }, [caderno]);

  const pendentes = Object.entries(estado).filter(([, p]) => p.sujo).map(([k]) => Number(k));
  const salvando = Object.values(estado).some(p => p.salvando);
  useEffect(() => {
    if (!pendentes.length || conflito) return;
    const t = setTimeout(() => pendentes.forEach(p => void salvarPagina(p)), 900);
    return () => clearTimeout(t);
  }, [estado, pendentes, salvarPagina, conflito]);

  // Avisa antes de fechar a aba com desenho ainda não salvo.
  useEffect(() => {
    const antes = (e: BeforeUnloadEvent) => { if (Object.values(estadoRef.current).some(p => p.sujo || p.salvando)) e.preventDefault(); };
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, []);

  const voltar = async () => {
    await Promise.all(Object.keys(estadoRef.current).map(k => salvarPagina(Number(k))));
    onVoltar();
  };

  // ---------- desenho e histórico ----------

  const aplicar = useCallback((idPagina: number, novos: Item[], guardar = true) => {
    const antes = estadoRef.current[idPagina]?.itens;
    if (!antes) return;
    if (guardar) {
      setDesfazer(d => registrar(d, { pagina: idPagina, antes, depois: novos }));
      setRefazer([]);
    }
    setEstado(e => ({ ...e, [idPagina]: { ...e[idPagina], itens: novos, sujo: true } }));
  }, []);

  const voltarPasso = useCallback((de: "desfazer" | "refazer") => {
    const pilha = de === "desfazer" ? desfazer : refazer;
    const passo = pilha[pilha.length - 1];
    if (!passo) return;
    (de === "desfazer" ? setDesfazer : setRefazer)(pilha.slice(0, -1));
    (de === "desfazer" ? setRefazer : setDesfazer)(o => [...o, passo]);
    setSelecao(null);
    aplicar(passo.pagina, de === "desfazer" ? passo.antes : passo.depois, false);
  }, [desfazer, refazer, aplicar]);

  // Atalhos: Ctrl+Z, Ctrl+Y (ou Ctrl+Shift+Z) e Delete na seleção.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      // v6: digitando (caixa de texto, documento, campos), as teclas são do texto, não do desenho.
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT" || alvo.tagName === "SELECT" || alvo.isContentEditable)) return;
      if (modo === "texto") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); voltarPasso(e.shiftKey ? "refazer" : "desfazer"); }
      else if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); voltarPasso("refazer"); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selecao?.ids.size) {
        const itens = estadoRef.current[selecao.pagina]?.itens;
        if (itens) { e.preventDefault(); aplicar(selecao.pagina, itens.filter(i => !selecao.ids.has(i.id))); setSelecao(null); }
      } else if (e.key === "Escape") {
        // Esc: primeiro solta a seleção; depois, o lápis.
        if (selecao) setSelecao(null);
        else setConfig(c => ({ ...c, ferramenta: "nenhuma" }));
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [voltarPasso, selecao, aplicar, modo]);

  // v6: a rodinha do mouse dá zoom no ponto do cursor (como no CAD); Shift + rodinha rola para os lados. Com a opção
  // "rodinha rola" desligada, só Ctrl + rodinha (ou a pinça do touchpad) dá zoom.
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (e.shiftKey && !e.ctrlKey) return; // Shift + rodinha rola para os lados
      e.preventDefault();
      zoomPara(zoomDaRoda(alvoZoom.current ?? zoomRef.current, e.deltaY, e.deltaMode), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [caderno, modo, zoomPara]);

  // correção: no tablet, pinça dá zoom no ponto entre os dedos e dois dedos arrastam (como no Xodo); um dedo arrasta
  // quando não está desenhando (Mão, nenhuma ferramenta, "Só caneta") ou fora da folha
  useGestosToque(rolagemRef, {
    podeArrastar: alvo => {
      const f = config.ferramenta;
      if (f === "mao" || f === "nenhuma" || config.soCaneta) return true;
      return !(alvo instanceof Element && alvo.closest("canvas[aria-label^='Desenhar']"));
    },
    zoomAtual: () => alvoZoom.current ?? zoomRef.current,
    aoZoom: (z, cx, cy) => zoomPara(z, cx, cy),
  }, modo !== "texto" && !!caderno);

  const aoVisivel = useCallback((idPagina: number, fracao: number) => {
    visiveis.current.set(idPagina, fracao);
    let melhor: number | null = null, maior = 0;
    visiveis.current.forEach((f, k) => { if (f > maior) { maior = f; melhor = k; } });
    if (melhor !== null) setAtual(melhor);
  }, []);

  // ---------- páginas ----------

  const posicaoDe = (idPagina: number | null) => (idPagina === null ? paginas.length : paginas.findIndex(p => p.id === idPagina) + 1);

  const irPara = (idPagina: number) => {
    rolagemRef.current?.querySelector(`[data-pagina="${idPagina}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // v4: o chat mandou abrir numa página (ou criou uma): rola até ela quando a lista chega.
  const paginaPedida = paginaInicial ? caderno?.paginas?.[Math.min(paginaInicial, caderno.paginas.length) - 1]?.id : undefined;
  useEffect(() => {
    if (!paginaPedida) return;
    setAtual(paginaPedida);
    const t = window.setTimeout(() => rolagemRef.current?.querySelector(`[data-pagina="${paginaPedida}"]`)?.scrollIntoView({ block: "start" }), 250);
    return () => window.clearTimeout(t);
  }, [paginaPedida, recarregarEm]);

  const comCaderno = (c: Caderno) => {
    setCaderno(c);
    onAlterado(c);
    setEstado(e => {
      const novo: Record<number, EstadoPagina> = {};
      for (const p of c.paginas ?? []) novo[p.id] = e[p.id] ?? { itens: null, nrVersao: p.nrVersao, sujo: false, salvando: false };
      return novo;
    });
  };

  const novaPagina = async (fundo: Fundo | null, copiarDe?: number, depoisDe = atual) => {
    setOcupado("pagina");
    try {
      const base = paginas.find(p => p.id === depoisDe);
      const p = await servico.novaPagina(id, copiarDe
        ? { idCopiarDe: copiarDe, nrPosicao: posicaoDe(depoisDe) + 1 }
        : { cdFundo: fundo ?? (base && base.cdFundo !== "PDF" ? base.cdFundo : "PAUTADO"), nrPosicao: posicaoDe(depoisDe) + 1 });
      await carregar();
      setTimeout(() => irPara(p.id), 150);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível criar a página."));
    } finally {
      setOcupado(null);
    }
  };

  const excluirPagina = async (idPagina: number) => {
    if (!window.confirm("Excluir esta página? O desenho dela some.")) return;
    try {
      comCaderno(await servico.excluirPagina(idPagina));
      setDesfazer(d => d.filter(p => p.pagina !== idPagina));
      setRefazer(d => d.filter(p => p.pagina !== idPagina));
    } catch (e) {
      setErro(mensagem(e, "Não foi possível excluir a página."));
    }
  };

  // ---------- v7: editar a página no editor de imagens ----------

  const [editandoPagina, setEditandoPagina] = useState<{ id: number; numero: number; imagem: Blob } | null>(null);
  /** A página (papel ou PDF, com o desenho) vira uma imagem e abre no editor de imagens. */
  const editarPagina = async (idPagina: number | null) => {
    if (idPagina === null) return;
    const meta = paginas.find(p => p.id === idPagina);
    if (!meta) return;
    setOcupado("editar");
    setAviso("Preparando a página para editar…");
    try {
      const itens = estadoRef.current[idPagina]?.itens ?? await itensSalvos(idPagina);
      setEditandoPagina({ id: idPagina, numero: posicaoDe(idPagina), imagem: await imagemDaPagina(meta, itens) });
      setAviso(null);
    } catch (e) {
      setAviso(null);
      setErro(mensagem(e, "Não foi possível abrir a página no editor de imagens."));
    } finally {
      setOcupado(null);
    }
  };
  /** Salvar no editor: a imagem editada entra no lugar da página (o desenho já vai dentro dela). */
  const salvarPaginaEditada = async (imagem: Blob): Promise<string | null> => {
    const ed = editandoPagina;
    const meta = ed && paginas.find(p => p.id === ed.id);
    if (!ed || !meta) return "A página não está mais no caderno.";
    try {
      const bmp = await createImageBitmap(imagem);
      const largura = meta.nrLargura, altura = Math.max(1, Math.round((largura * bmp.height) / Math.max(1, bmp.width)));
      bmp.close();
      const nova = await servico.paginaDePdf(id, imagem, largura, altura, posicaoDe(ed.id));
      await servico.excluirPagina(ed.id);
      setEstado(e => { const n = { ...e }; delete n[ed.id]; return n; });
      setDesfazer(d => d.filter(p => p.pagina !== ed.id));
      setRefazer(d => d.filter(p => p.pagina !== ed.id));
      await carregar();
      setEditandoPagina(null);
      setAviso(`Página ${ed.numero} editada.`);
      setTimeout(() => irPara(nova.id), 200);
      return null;
    } catch (e) {
      return mensagem(e, "Não foi possível guardar a página editada.");
    }
  };

  const moverPagina = async (idPagina: number, delta: number) => {
    const ids = paginas.map(p => p.id);
    const de = ids.indexOf(idPagina), para = de + delta;
    if (para < 0 || para >= ids.length) return;
    [ids[de], ids[para]] = [ids[para], ids[de]];
    try { comCaderno(await servico.reordenar(id, ids)); } catch (e) { setErro(mensagem(e, "Não foi possível mudar a ordem.")); }
  };

  /** v2: gira a página 90° (o desenho gira junto; o fundo de PDF também). Os passos de desfazer dela ficam para trás. */
  const girarPagina = async (idPagina: number | null, antihorario = false) => {
    if (idPagina === null || !caderno) return;
    const meta = paginas.find(p => p.id === idPagina);
    const itens = estadoRef.current[idPagina]?.itens;
    if (!meta || !itens) { setAviso("Espere a página abrir para girar."); return; }
    const novos = girarItens(itens, meta.nrLargura, meta.nrAltura, antihorario);
    const giro = proximoGiro(meta.nrRotacao ?? 0, antihorario);
    setCaderno(c => c && { ...c, paginas: (c.paginas ?? []).map(p => (p.id === idPagina ? { ...p, nrRotacao: giro, nrLargura: p.nrAltura, nrAltura: p.nrLargura } : p)) });
    setEstado(e => ({ ...e, [idPagina]: { ...e[idPagina], itens: novos, sujo: true } }));
    setDesfazer(d => d.filter(x => x.pagina !== idPagina));
    setRefazer(d => d.filter(x => x.pagina !== idPagina));
    setSelecao(null);
  };

  const trocarFundo = (idPagina: number, fundo: Fundo) => {
    if (!caderno) return;
    setCaderno({ ...caderno, paginas: paginas.map(p => (p.id === idPagina ? { ...p, cdFundo: fundo } : p)) });
    setEstado(e => ({ ...e, [idPagina]: { ...e[idPagina], sujo: true } }));
  };

  // ---------- PDF e imagens ----------

  /** Insere o arquivo (PDF, imagem, Word, planilha ou texto) depois da página atual. */
  const inserirPdf = async (arquivo: File) => {
    setOcupado("pdf");
    setAviso(`Lendo ${arquivo.name}…`);
    try {
      const criadas = await importarArquivo(id, arquivo, posicaoDe(atual) + 1, (feitas, total) => setAviso(`Importando página ${feitas} de ${total}…`));
      await carregar();
      const semOriginal = tipoDoArquivo(arquivo.name, arquivo.type) === "pdf" && !criadas[0]?.idPdf;
      setAviso(`${criadas.length} página(s) de ${arquivo.name} entraram no caderno.${semOriginal ? " O PDF tem mais de 15 MB: as páginas entraram como imagem em alta resolução (o zoom muito grande perde nitidez)." : ""}`);
      if (criadas[0]) setTimeout(() => irPara(criadas[0].id), 200);
    } catch (e) {
      setAviso(null);
      setErro(mensagem(e, "Não foi possível inserir o arquivo."));
    } finally {
      setOcupado(null);
    }
  };

  // ---------- v7: baixar só as páginas marcadas, em PDF, JPEG ou PNG ----------

  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set());
  const [formatoBaixar, setFormatoBaixar] = useState<"pdf" | "jpg" | "png">("pdf");
  const baixarMarcadas = async () => {
    if (!caderno) return;
    const escolhidas = paginas.filter(p => marcadas.has(p.id));
    if (!escolhidas.length) return;
    const numeros = escolhidas.map(p => posicaoDe(p.id));
    const itensDe = async (p: PaginaBloco) => estadoRef.current[p.id]?.itens ?? itensSalvos(p.id);
    setOcupado("baixar");
    try {
      await Promise.all(pendentes.map(p => salvarPagina(p)));
      if (formatoBaixar === "pdf") {
        const bytes = await exportarPdf(escolhidas, itensDe, (feitas, total) => setAviso(`Gerando o PDF: página ${feitas} de ${total}…`));
        baixarArquivo(new File([bytes as BlobPart], nomeArquivoPaginas(caderno.nmTitulo, numeros, "pdf"), { type: "application/pdf" }));
      } else {
        const tipo = formatoBaixar === "png" ? "image/png" : "image/jpeg";
        const imagens: Blob[] = [];
        for (const [k, p] of escolhidas.entries()) {
          setAviso(`Gerando a imagem: página ${k + 1} de ${escolhidas.length}…`);
          imagens.push(await imagemDaPagina(p, await itensDe(p), formatoBaixar));
        }
        if (imagens.length === 1) baixarArquivo(new File([imagens[0]], nomeArquivoPaginas(caderno.nmTitulo, numeros, formatoBaixar), { type: tipo }));
        else {
          // várias imagens: um .zip, uma por página
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();
          imagens.forEach((img, k) => zip.file(nomeArquivoPaginas(caderno.nmTitulo, [numeros[k]], formatoBaixar), img));
          baixarArquivo(new File([await zip.generateAsync({ type: "blob" })], nomeArquivoPaginas(caderno.nmTitulo, numeros, "zip"), { type: "application/zip" }));
        }
      }
      setAviso(escolhidas.length === 1 ? "Página baixada." : `${escolhidas.length} páginas baixadas.`);
    } catch (e) {
      setAviso(null);
      setErro(mensagem(e, "Não foi possível baixar as páginas."));
    } finally {
      setOcupado(null);
    }
  };

  const exportar = async () => {
    if (!caderno) return;
    setOcupado("exportar");
    try {
      await Promise.all(pendentes.map(p => salvarPagina(p)));
      const bytes = await exportarPdf(paginas,
        async p => estadoRef.current[p.id]?.itens ?? itensSalvos(p.id),
        (feitas, total) => setAviso(`Gerando o PDF: página ${feitas} de ${total}…`),
        documentoHtml.current || (await servico.documento(id)).html);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoCaderno(caderno.nmTitulo);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setAviso("PDF baixado.");
    } catch (e) {
      setErro(mensagem(e, "Não foi possível gerar o PDF."));
    } finally {
      setOcupado(null);
    }
  };

  const inserirImagem = async (arquivo: File) => {
    const alvo = atual ?? paginas[0]?.id;
    const meta = paginas.find(p => p.id === alvo);
    const itens = alvo ? estadoRef.current[alvo]?.itens : null;
    if (!alvo || !meta || !itens) return;
    setOcupado("imagem");
    try {
      const foto = await prepararFoto(arquivo);
      const idImagem = await servico.enviarImagem(id, foto.imagem, foto.nome);
      const bmp = await createImageBitmap(foto.imagem);
      guardarImagem(idImagem, bmp);
      const w = Math.min(meta.nrLargura * 0.6, bmp.width), h = w * (bmp.height / bmp.width);
      aplicar(alvo, [...itens, { t: "im", id: novoId(), img: idImagem, x: (meta.nrLargura - w) / 2, y: Math.max(40, (meta.nrAltura - h) / 3), w, h }]);
      mudar({ ferramenta: "laco" });
    } catch (e) {
      setErro(mensagem(e, "Não foi possível colar a imagem."));
    } finally {
      setOcupado(null);
    }
  };

  // ---------- tela ----------

  if (!caderno) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-sm text-slate-500">
        {erro ? <><p role="alert" className="text-red-700">{erro}</p><button type="button" onClick={onVoltar} className="font-semibold text-blue-600">Voltar</button></>
          : <Loader2 className="h-8 w-8 animate-spin text-blue-500" aria-label="Carregando" />}
      </div>
    );
  }

  const f = config.ferramenta;
  const botaoFerramenta = (ativo: boolean) =>
    `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${ativo ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`;
  const numeroAtual = Math.max(1, posicaoDe(atual));

  // v7: a barra de ferramentas em cima, numa das laterais ou flutuante (arrastável); a escolha fica no aparelho
  const vertical = posBarra === "esquerda" || posBarra === "direita";
  const classeBarra = classesDaBarra(posBarra);
  const barraFerramentas = (orient: PosicaoBarra) => (
      <div className={classeBarra.fora} style={orient === "flutuante" ? { left: posFlutuante.x, top: posFlutuante.y } : undefined} aria-label="Barra de ferramentas">
        {orient === "flutuante" && (
          <button type="button" onPointerDown={arrastarBarra} aria-label="Arrastar a barra" title="Arraste para mudar a barra de lugar" className="flex w-full cursor-grab items-center justify-center rounded-t-2xl py-0.5 text-slate-400 hover:bg-slate-50 active:cursor-grabbing" style={{ touchAction: "none" }}><GripHorizontal className="h-4 w-4" /></button>
        )}
        <div className={classeBarra.ferramentas} role="toolbar" aria-label="Ferramentas" aria-orientation={orient === "esquerda" || orient === "direita" ? "vertical" : "horizontal"}>
          {FERRAMENTAS.map(({ id: fid, rotulo, Icone }) => (
            <button key={fid} type="button" onClick={() => { mudar({ ferramenta: f === fid ? "nenhuma" : fid }); if (fid !== "laco") setSelecao(null); }} aria-pressed={f === fid} title={f === fid ? `${rotulo} (toque de novo para soltar)` : rotulo} aria-label={rotulo} className={botaoFerramenta(f === fid)}>
              <Icone className="h-5 w-5" />
            </button>
          ))}
          <button type="button" onClick={() => arquivoImagem.current?.click()} disabled={ocupado !== null} title="Inserir imagem" aria-label="Inserir imagem" className={botaoFerramenta(false)}>
            {ocupado === "imagem" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          </button>
          {/* v6: PDF (ou outro arquivo) direto da barra, sem abrir o painel de páginas; entra depois da página atual. */}
          <button type="button" onClick={() => arquivoPdf.current?.click()} disabled={ocupado !== null} title="Inserir PDF ou arquivo depois da página atual" aria-label="Inserir PDF" className={botaoFerramenta(false)}>
            {ocupado === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
          </button>
          <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
          <button type="button" onClick={() => mudar({ soCaneta: !config.soCaneta })} aria-pressed={config.soCaneta}
            title="Só a caneta (stylus) desenha; o dedo rola a página" className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold ${config.soCaneta ? "bg-violet-100 text-violet-700" : "text-slate-600 hover:bg-slate-100"}`}>
            <PenTool className="h-4 w-4" /> <span className={vertical ? "sr-only" : ""}>Só caneta</span>
          </button>
          <span className={vertical ? "my-1 h-px w-6 shrink-0 bg-slate-200" : "mx-1 h-6 w-px shrink-0 bg-slate-200"} />
          <div className={vertical ? "flex flex-col gap-0.5" : "flex gap-0.5"} role="radiogroup" aria-label="Posição da barra">
            {POSICOES_BARRA.map(({ id: pos, rotulo, Icone }) => (
              <button key={pos} type="button" role="radio" aria-checked={posBarra === pos} onClick={() => mudarPosBarra(pos)} title={`Barra ${rotulo}`} aria-label={`Barra ${rotulo}`}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${posBarra === pos ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}>
                <Icone className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
        <div className={classeBarra.opcoes} aria-label="Opções da ferramenta">
          {(f === "caneta" || f === "forma" || f === "texto") && CORES.map(c => (
            <button key={c} type="button" onClick={() => mudar({ cor: c })} aria-label={`Cor ${c}`} aria-pressed={config.cor === c}
              className={`h-7 w-7 shrink-0 rounded-full border ${config.cor === c ? "ring-2 ring-blue-500 ring-offset-2" : "border-slate-300"}`} style={{ background: c }} />
          ))}
          {f === "marca" && CORES_MARCA.map(c => (
            <button key={c} type="button" onClick={() => mudar({ corMarca: c })} aria-label={`Cor ${c}`} aria-pressed={config.corMarca === c}
              className={`h-7 w-7 shrink-0 rounded-full border ${config.corMarca === c ? "ring-2 ring-blue-500 ring-offset-2" : "border-slate-300"}`} style={{ background: c }} />
          ))}
          {(f === "caneta" || f === "forma") && (
            <>
              <span className={vertical ? "my-1 h-px w-6 shrink-0 bg-slate-200" : "mx-1 h-6 w-px shrink-0 bg-slate-200"} />
              {ESPESSURAS.map(w => (
                <button key={w} type="button" onClick={() => mudar({ espessura: w })} aria-label={`Espessura ${w}`} aria-pressed={config.espessura === w}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.espessura === w ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-slate-100"}`}>
                  <span className="rounded-full bg-slate-800" style={{ width: Math.min(18, w + 2), height: Math.min(18, w + 2) }} />
                </button>
              ))}
            </>
          )}
          {f === "marca" && (
            <select aria-label="Largura do marca-texto" value={config.espessuraMarca} onChange={e => mudar({ espessuraMarca: Number(e.target.value) })} className={`rounded-lg border border-slate-200 py-1 text-xs ${vertical ? "w-12 px-0.5 text-[10px]" : "px-2"}`}>
              {[10, 16, 24, 32].map(w => <option key={w} value={w}>{w}px</option>)}
            </select>
          )}
          {f === "forma" && (
            <>
              <span className={vertical ? "my-1 h-px w-6 shrink-0 bg-slate-200" : "mx-1 h-6 w-px shrink-0 bg-slate-200"} />
              {FORMAS.map(({ id: fo, rotulo, Icone }) => (
                <button key={fo} type="button" onClick={() => mudar({ forma: fo })} aria-pressed={config.forma === fo} title={rotulo} aria-label={rotulo}
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.forma === fo ? "bg-blue-50 text-blue-700 ring-1 ring-blue-300" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icone className="h-4 w-4" />
                </button>
              ))}
              {!vertical && <span className="shrink-0 text-[11px] text-slate-400">Shift: reto</span>}
            </>
          )}
          {f === "borracha" && (
            <>
              {(["traco", "parcial"] as const).map(m => (
                <button key={m} type="button" onClick={() => mudar({ borracha: m })} aria-pressed={config.borracha === m}
                  title={m === "traco" ? (vertical ? "Traço" : "Apagar traço inteiro") : (vertical ? "Parte" : "Apagar parte")} className={`shrink-0 rounded-lg py-1.5 text-xs font-bold ${vertical ? "w-12 px-0.5 text-[10px] leading-tight" : "px-2.5"} ${config.borracha === m ? "bg-blue-50 text-blue-700 ring-1 ring-blue-300" : "text-slate-600 hover:bg-slate-100"}`}>
                  {m === "traco" ? (vertical ? "Traço" : "Apagar traço inteiro") : (vertical ? "Parte" : "Apagar parte")}
                </button>
              ))}
              <select aria-label="Tamanho da borracha" value={config.raioBorracha} onChange={e => mudar({ raioBorracha: Number(e.target.value) })} className={`rounded-lg border border-slate-200 py-1 text-xs ${vertical ? "w-12 px-0.5 text-[10px]" : "px-2"}`}>
                {[5, 10, 20, 40].map(r => <option key={r} value={r}>{r * 2}px</option>)}
              </select>
            </>
          )}
          {f === "texto" && (
            <select aria-label="Tamanho do texto" value={config.tamanhoTexto} onChange={e => mudar({ tamanhoTexto: Number(e.target.value) })} className={`rounded-lg border border-slate-200 py-1 text-xs ${vertical ? "w-12 px-0.5 text-[10px]" : "px-2"}`}>
              {[14, 18, 20, 24, 32, 48].map(s => <option key={s} value={s}>{s}px</option>)}
            </select>
          )}
          {f === "laco" && !vertical && <span className="shrink-0 text-xs text-slate-500">Circule para selecionar; arraste para mover e puxe a bolinha para redimensionar.</span>}
          {f === "mao" && !vertical && <span className="shrink-0 text-xs text-slate-500">Arraste para rolar (ou arraste com a rodinha apertada, em qualquer ferramenta).</span>}
          {f === "nenhuma" && !vertical && <span className="shrink-0 text-xs text-slate-500">Lápis solto: nada é desenhado. Toque numa ferramenta para voltar a escrever.</span>}
        </div>
      </div>

  );

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[calc(100dvh-4rem)]">
      {/* Barra de cima: voltar, desfazer, zoom, páginas e PDF. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/95 px-2 py-2 backdrop-blur">
        <button type="button" onClick={() => void voltar()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4" /> Cadernos
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800" title={caderno.nmTitulo}>
          <span className="mr-1.5 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: caderno.cdCor }} aria-hidden="true" />{caderno.nmTitulo}
        </h2>
        <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex" role="status">
          {salvando ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</> : pendentes.length ? "Alterações não salvas" : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Salvo</>}
        </span>
        {extra}
        <div role="radiogroup" aria-label="Ver" className="flex rounded-lg border border-slate-200 p-0.5">
          {([["desenho", "Desenho", NotebookPen], ["texto", "Texto", FileText], ["lado", "Lado a lado", Columns2]] as const).map(([m, rotulo, Icone]) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)} title={rotulo}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${modo === m ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icone className="h-3.5 w-3.5" /><span className="hidden sm:inline">{rotulo}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => voltarPasso("desfazer")} disabled={!desfazer.length} title="Desfazer (Ctrl+Z)" aria-label="Desfazer" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => voltarPasso("refazer")} disabled={!refazer.length} title="Refazer (Ctrl+Y)" aria-label="Refazer" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Redo2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => (modo === "texto" ? mudarZoomTexto(zoomTexto / 1.25) : zoomPara(zoom / 1.25))} title="Diminuir" aria-label="Diminuir zoom" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ZoomOut className="h-4 w-4" /></button>
          <button type="button" onClick={() => { if (modo === "texto") setZoomTexto(1); else { setFator(1); setDesloc(0); } }} title="Caber na largura" className="w-12 rounded-lg py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">{Math.round((modo === "texto" ? zoomTexto : zoom) * 100)}%</button>
          <button type="button" onClick={() => (modo === "texto" ? mudarZoomTexto(zoomTexto * 1.25) : zoomPara(zoom * 1.25))} title="Aumentar" aria-label="Aumentar zoom" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" onClick={() => void girarPagina(atual)} disabled={modo === "texto"} title="Girar a página atual 90°" aria-label="Girar página" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"><RotateCw className="h-4 w-4" /></button>
          <button type="button" onClick={() => void editarPagina(atual)} disabled={modo === "texto" || ocupado !== null} title="Editar a página atual no editor de imagens" aria-label="Editar página" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30">
            {ocupado === "editar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SquarePen className="h-4 w-4" />}</button>
          <button type="button" onClick={() => setPainel(p => !p)} aria-expanded={painel} title="Páginas" className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
            <Layers className="h-4 w-4" /> {numeroAtual}/{paginas.length}
          </button>
          <button type="button" onClick={() => void exportar()} disabled={ocupado !== null} title="Baixar o caderno em PDF" aria-label="Exportar PDF" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            {ocupado === "exportar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {modo !== "texto" && posBarra === "cima" && barraFerramentas("cima")}

      {(erro || aviso || conflito) && (
        <div className="space-y-1 px-3 pt-2">
          {erro && <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{erro}</span><button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button></p>}
          {conflito && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta página foi alterada em outro aparelho.
              <button type="button" className="font-bold underline" onClick={() => { setEstado(e => ({ ...e, [conflito]: { ...e[conflito], itens: null, sujo: false } })); setConflito(null); }}>Ver a versão mais nova</button>
            </p>
          )}
          {aviso && !erro && <p role="status" className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800"><span className="flex-1">{aviso}</span>{!ocupado && <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>}</p>}
        </div>
      )}

      <div ref={areaRef} className="relative flex min-h-0 flex-1">
      {modo !== "texto" && posBarra === "esquerda" && barraFerramentas("esquerda")}
      <div className={`relative flex min-h-0 min-w-0 flex-1 ${modo === "lado" ? "flex-col md:flex-row" : ""}`}>
        {modo !== "desenho" && (
          <div className={`min-h-0 min-w-0 flex-1 ${modo === "lado" ? "border-b border-slate-300 md:border-b-0 md:border-r" : ""}`}>
            <DocumentoCaderno idCaderno={id} exibicao={exibicao} onExibicao={setExibicao} onHtml={guardarHtml} zoom={zoomTexto} onZoom={mudarZoomTexto} />
          </div>
        )}
        {modo !== "texto" && (
        <div ref={rolagemRef} data-rolagem className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-100 py-4" style={{ touchAction: "none" }}
          onMouseDown={e => { if (e.button === 1) e.preventDefault(); /* sem a rolagem automática do botão do meio */ }}
          onPointerDown={e => {
            if (e.target === e.currentTarget) setSelecao(null);
            // Mão com mouse, ou a rodinha apertada com qualquer ferramenta (v6): arrastar rola. No toque o navegador já rola.
            if (((f === "mao" && e.button === 0) || e.button === 1) && e.pointerType === "mouse" && rolagemRef.current) {
              e.preventDefault();
              const el = rolagemRef.current, x0 = e.clientX, y0 = e.clientY, l0 = el.scrollLeft, t0 = el.scrollTop;
              const mover = (ev: PointerEvent) => { el.scrollLeft = l0 - (ev.clientX - x0); el.scrollTop = t0 - (ev.clientY - y0); };
              const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); };
              window.addEventListener("pointermove", mover);
              window.addEventListener("pointerup", soltar);
            }
          }}>
          <div className="flex w-max min-w-full flex-col items-center gap-4 px-3"
            style={desloc ? { transform: `translateX(${deslocamentoLateral(desloc, 0, ((rolagemRef.current?.clientWidth ?? 0) - larguraMax * zoom - 24) / 2)}px)` } : undefined}>
            {paginas.map((p, n) => (
              <PaginaVista key={p.id} pagina={p} numero={n + 1} itens={estado[p.id]?.itens ?? null} zoom={zoom} config={config}
                selecao={selecao?.pagina === p.id ? selecao.ids : VAZIA}
                onItens={novos => aplicar(p.id, novos)}
                onSelecao={ids => setSelecao(ids.size ? { pagina: p.id, ids } : null)}
                onCarregar={() => void carregarPagina(p.id)}
                onVisivel={fr => aoVisivel(p.id, fr)} />
            ))}
            {/* Na largura da página: mais largo, empurraria a página para o lado no celular. */}
            <div className="flex flex-wrap justify-center gap-2 pb-10" style={{ width: Math.max(240, larguraMax * zoom) }}>
              {(["PAUTADO", "QUADRICULADO", "PONTILHADO", "BRANCO"] as const).map(fu => (
                <button key={fu} type="button" disabled={ocupado !== null} onClick={() => void novaPagina(fu, undefined, paginas[paginas.length - 1]?.id ?? null)}
                  className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" /> {ROTULO_FUNDO[fu]}
                </button>
              ))}
            </div>
          </div>
        </div>
        )}

        {painel && (
          <aside className="absolute inset-y-0 right-0 z-20 flex w-72 max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-xl animate-entrada" aria-label="Páginas do caderno">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <p className="text-sm font-bold text-slate-800">Páginas</p>
              <button type="button" onClick={() => setPainel(false)} aria-label="Fechar páginas" className="rounded-lg p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
              <button type="button" disabled={ocupado !== null} onClick={() => void novaPagina(null)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" /> Página depois da atual
              </button>
              <button type="button" disabled={ocupado !== null} onClick={() => arquivoPdf.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {ocupado === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />} Inserir arquivo
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2" role="group" aria-label="Baixar páginas">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={paginas.length > 0 && marcadas.size === paginas.length}
                  onChange={e => setMarcadas(e.target.checked ? new Set(paginas.map(p => p.id)) : new Set())} aria-label="Marcar todas as páginas" />
                Todas
              </label>
              <select aria-label="Formato para baixar" value={formatoBaixar} onChange={e => setFormatoBaixar(e.target.value as "pdf" | "jpg" | "png")}
                className="ml-auto rounded-lg border border-slate-200 px-1.5 py-1 text-xs font-bold text-slate-700">
                <option value="pdf">PDF</option>
                <option value="jpg">JPEG</option>
                <option value="png">PNG</option>
              </select>
              <button type="button" onClick={() => void baixarMarcadas()} disabled={!marcadas.size || ocupado !== null}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-40">
                {ocupado === "baixar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Baixar{marcadas.size ? ` (${marcadas.size})` : ""}
              </button>
            </div>
            <ol className="flex-1 space-y-1 overflow-y-auto p-2">
              {paginas.map((p, n) => (
                <li key={p.id} className={`rounded-xl border p-2 ${p.id === atual ? "border-blue-300 bg-blue-50/60" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-blue-600" checked={marcadas.has(p.id)} aria-label={`Marcar a página ${n + 1} para baixar`}
                      onChange={e => setMarcadas(m => { const novo = new Set(m); if (e.target.checked) novo.add(p.id); else novo.delete(p.id); return novo; })} />
                    <button type="button" onClick={() => irPara(p.id)} className="min-w-[5rem] flex-1 whitespace-nowrap text-left text-sm font-bold text-slate-700">Página {n + 1}</button>
                    <button type="button" onClick={() => void moverPagina(p.id, -1)} disabled={n === 0} aria-label={`Subir a página ${n + 1}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void moverPagina(p.id, 1)} disabled={n === paginas.length - 1} aria-label={`Descer a página ${n + 1}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void girarPagina(p.id, true)} aria-label={`Girar a página ${n + 1} para a esquerda`} title="Girar para a esquerda" className="rounded p-1 text-slate-500 hover:bg-slate-100"><RotateCcw className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void girarPagina(p.id)} aria-label={`Girar a página ${n + 1} para a direita`} title="Girar para a direita" className="rounded p-1 text-slate-500 hover:bg-slate-100"><RotateCw className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void editarPagina(p.id)} disabled={ocupado !== null} aria-label={`Editar a página ${n + 1} no editor de imagens`} title="Editar no editor de imagens" className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><SquarePen className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void novaPagina(null, p.id, p.id)} aria-label={`Duplicar a página ${n + 1}`} title="Duplicar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void excluirPagina(p.id)} disabled={paginas.length <= 1} aria-label={`Excluir a página ${n + 1}`} title="Excluir" className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {p.cdFundo === "PDF" ? <p className="mt-1 text-[11px] text-slate-500">Página de PDF</p> : (
                    <select aria-label={`Papel da página ${n + 1}`} value={p.cdFundo} onChange={e => trocarFundo(p.id, e.target.value as Fundo)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600">
                      {(Object.keys(ROTULO_FUNDO) as Array<keyof typeof ROTULO_FUNDO>).map(fu => <option key={fu} value={fu}>{ROTULO_FUNDO[fu]}</option>)}
                    </select>
                  )}
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
      {modo !== "texto" && posBarra === "direita" && barraFerramentas("direita")}
      {modo !== "texto" && posBarra === "flutuante" && barraFerramentas("flutuante")}
      </div>

      {editandoPagina && (
        <EditorImagemTelaCheia titulo={`Página ${editandoPagina.numero}`} formatoSalvar="jpg" carregar={() => Promise.resolve(editandoPagina.imagem)}
          onSalvar={salvarPaginaEditada} onFechar={() => setEditandoPagina(null)} />
      )}
      <input ref={arquivoPdf} type="file" accept={ACEITA_ARQUIVOS} className="hidden" onChange={e => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void inserirPdf(a); }} />
      <input ref={arquivoImagem} type="file" accept="image/*" className="hidden" onChange={e => { const a = e.target.files?.[0]; e.target.value = ""; if (a) void inserirImagem(a); }} />
    </div>
  );
}

const VAZIA = new Set<string>();
export type { PaginaBloco };
