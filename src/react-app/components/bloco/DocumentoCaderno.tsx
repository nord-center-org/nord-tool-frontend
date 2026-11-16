import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckCircle2, Highlighter, IndentDecrease, IndentIncrease, Italic, List, ListOrdered,
  Loader2, Minus, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2,
} from "lucide-react";

import { ESTILO_DOCUMENTO, sanitizarHtml } from "@/react-app/components/bloco/documento";
import { useGestosToque } from "@/react-app/components/bloco/useGestosToque";
import { ApiError } from "@/react-app/services/apiClient";
import { blocoNotasService as servico } from "@/react-app/services/BlocoNotasService";
import { CORES, CORES_MARCA, PAGINA_DOCUMENTO, zoomDaRoda } from "@/react-app/utils/blocoNotas";

export type ExibicaoDocumento = "paginas" | "continuo";

/** De onde vem e para onde vai o documento: o do caderno ou um documento avulso (v3). */
export interface FonteDocumento {
  carregar: () => Promise<{ html: string; nrVersao: number }>;
  salvar: (html: string, nrVersao: number) => Promise<{ nrVersao: number }>;
}

interface Props {
  /** Documento do caderno (v2). */
  idCaderno?: number;
  /** v3: outra origem (documento avulso). */
  fonte?: FonteDocumento;
  exibicao: ExibicaoDocumento;
  onExibicao: (e: ExibicaoDocumento) => void;
  /** Para o PDF do caderno: o HTML atual do documento. */
  onHtml?: (html: string) => void;
  /** Correção: zoom do texto (1 = a folha cabe na largura), com os botões de zoom do caderno. */
  zoom?: number;
  /** Ctrl + rodinha (ou a pinça) no texto muda o zoom. */
  onZoom?: (z: number) => void;
}

const ESTILOS_BLOCO = [
  { valor: "P", rotulo: "Texto normal" }, { valor: "H1", rotulo: "Título 1" }, { valor: "H2", rotulo: "Título 2" },
  { valor: "H3", rotulo: "Título 3" }, { valor: "BLOCKQUOTE", rotulo: "Citação" },
];
const TAMANHOS = [{ v: "2", r: "Pequeno" }, { v: "3", r: "Normal" }, { v: "4", r: "Médio" }, { v: "5", r: "Grande" }, { v: "6", r: "Maior" }, { v: "7", r: "Enorme" }];

/**
 * Documento de texto do caderno (v2), no estilo do Word: estilos de parágrafo, negrito, itálico, sublinhado, riscado,
 * cor, marca-texto, tamanho, alinhamento, listas, recuo e linha. Em "páginas" o texto aparece em folhas A4 (com as
 * quebras marcadas); em "contínuo", numa coluna só. Salva sozinho, com controle de versão.
 */
export default function DocumentoCaderno({ idCaderno, fonte, exibicao, onExibicao, onHtml, zoom = 1, onZoom }: Props) {
  const origem = useMemo<FonteDocumento>(() => fonte ?? {
    carregar: () => servico.documento(idCaderno ?? 0),
    salvar: (html, v) => servico.salvarDocumento(idCaderno ?? 0, html, v),
  }, [fonte, idCaderno]);
  const editor = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const versao = useRef(1);
  const [carregado, setCarregado] = useState(false);
  const [estado, setEstado] = useState<"salvo" | "sujo" | "salvando" | "conflito" | "erro">("salvo");
  const [largura, setLargura] = useState<number>(PAGINA_DOCUMENTO.largura);
  const [paginas, setPaginas] = useState(1);
  const timer = useRef<number | null>(null);
  // Guardado em ref: um onHtml novo a cada render não pode recarregar o documento (apagaria o que acabou de ser escrito).
  const avisarHtml = useRef(onHtml);
  avisarHtml.current = onHtml;

  const carregar = useCallback(async () => {
    const d = await origem.carregar();
    versao.current = d.nrVersao;
    if (editor.current) editor.current.innerHTML = sanitizarHtml(d.html);
    avisarHtml.current?.(editor.current?.innerHTML ?? "");
    setCarregado(true);
    setEstado("salvo");
  }, [origem]);
  useEffect(() => { void carregar().catch(() => setEstado("erro")); }, [carregar]);

  // Largura: a folha A4 cabe na tela (no celular ela encolhe junto com o texto).
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.min(PAGINA_DOCUMENTO.largura, el.clientWidth - 24));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  // A folha é sempre A4 (794 px) e encolhe (ou cresce, com o zoom) inteira com CSS zoom, como o zoom do Word.
  const escala = (largura / PAGINA_DOCUMENTO.largura) * zoom;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** O ponto da folha embaixo do mouse (em fração da folha) e onde o mouse estava: depois do zoom ele volta para lá. */
  const ancora = useRef<{ fx: number; fy: number; mx: number; my: number } | null>(null);
  const folha = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caixa.current;
    if (!el || !onZoom) return;
    const roda = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = folha.current?.getBoundingClientRect();
      if (r && r.width && r.height) ancora.current = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, mx: e.clientX, my: e.clientY };
      onZoom(zoomDaRoda(zoomRef.current, e.deltaY, e.deltaMode));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [onZoom]);
  // correção: no tablet, pinça dá zoom no ponto entre os dedos; um ou dois dedos arrastam (como no Xodo)
  useGestosToque(caixa, {
    podeArrastar: () => true,
    zoomAtual: () => zoomRef.current,
    aoZoom: (z, cx, cy) => {
      const r = folha.current?.getBoundingClientRect();
      if (r && r.width && r.height) ancora.current = { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height, mx: cx, my: cy };
      onZoom?.(z);
    },
  }, !!onZoom);
  useLayoutEffect(() => {
    const a = ancora.current, el = caixa.current, r = folha.current?.getBoundingClientRect();
    ancora.current = null;
    if (!a || !el || !r) return;
    el.scrollLeft += r.left + a.fx * r.width - a.mx;
    el.scrollTop += r.top + a.fy * r.height - a.my;
  }, [zoom]);
  const alturaPagina: number = PAGINA_DOCUMENTO.altura;

  const salvar = useCallback(async () => {
    const el = editor.current;
    if (!el) return;
    const html = sanitizarHtml(el.innerHTML);
    setEstado("salvando");
    try {
      const r = await origem.salvar(html, versao.current);
      versao.current = r.nrVersao;
      setEstado(s => (s === "salvando" ? "salvo" : s));
    } catch (e) {
      setEstado(e instanceof ApiError && e.status === 409 ? "conflito" : "erro");
    }
  }, [origem]);

  const mudou = () => {
    setEstado("sujo");
    onHtml?.(editor.current?.innerHTML ?? "");
    if (editor.current) setPaginas(Math.max(1, Math.ceil(editor.current.scrollHeight / alturaPagina)));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvar(), 1200);
  };
  // Salva o que faltar ao sair.
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); void salvar(); } }, [salvar]);
  useEffect(() => { if (editor.current) setPaginas(Math.max(1, Math.ceil(editor.current.scrollHeight / alturaPagina))); }, [alturaPagina, carregado, exibicao]);

  const cmd = (nome: string, valor?: string) => {
    editor.current?.focus();
    document.execCommand(nome, false, valor);
    mudou();
  };
  const botao = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100";
  const semFoco = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="toolbar" aria-label="Formatar documento" onMouseDown={semFoco}
        className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1">
        <button type="button" className={botao} onClick={() => cmd("undo")} title="Desfazer (Ctrl+Z)" aria-label="Desfazer no documento"><Undo2 className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("redo")} title="Refazer (Ctrl+Y)" aria-label="Refazer no documento"><Redo2 className="h-4 w-4" /></button>
        <select aria-label="Estilo do parágrafo" defaultValue="" onMouseDown={e => e.stopPropagation()} onChange={e => { if (e.target.value) cmd("formatBlock", e.target.value); e.target.value = ""; }}
          className="h-8 shrink-0 rounded-lg border border-slate-200 px-1 text-xs font-bold text-slate-700">
          <option value="">Estilo</option>
          {ESTILOS_BLOCO.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
        <select aria-label="Tamanho da letra" defaultValue="" onMouseDown={e => e.stopPropagation()} onChange={e => { if (e.target.value) cmd("fontSize", e.target.value); e.target.value = ""; }}
          className="h-8 shrink-0 rounded-lg border border-slate-200 px-1 text-xs font-bold text-slate-700">
          <option value="">Tamanho</option>
          {TAMANHOS.map(t => <option key={t.v} value={t.v}>{t.r}</option>)}
        </select>
        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
        <button type="button" className={botao} onClick={() => cmd("bold")} title="Negrito (Ctrl+B)" aria-label="Negrito no documento"><Bold className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("italic")} title="Itálico (Ctrl+I)" aria-label="Itálico no documento"><Italic className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("underline")} title="Sublinhado (Ctrl+U)" aria-label="Sublinhado no documento"><Underline className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("strikeThrough")} title="Riscado" aria-label="Riscado"><Strikethrough className="h-4 w-4" /></button>
        {CORES.slice(0, 6).map(c => (
          <button key={c} type="button" onClick={() => cmd("foreColor", c)} aria-label={`Cor do texto ${c}`} title="Cor do texto"
            className="mx-0.5 h-5 w-5 shrink-0 rounded-full border border-slate-300" style={{ background: c }} />
        ))}
        <span className="ml-1 shrink-0 text-slate-400"><Highlighter className="h-4 w-4" /></span>
        {CORES_MARCA.slice(0, 3).map(c => (
          <button key={c} type="button" onClick={() => cmd("hiliteColor", c)} aria-label={`Marca-texto ${c}`} title="Marca-texto"
            className="mx-0.5 h-5 w-5 shrink-0 rounded border border-slate-300" style={{ background: c }} />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
        <button type="button" className={botao} onClick={() => cmd("justifyLeft")} title="À esquerda" aria-label="Documento à esquerda"><AlignLeft className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("justifyCenter")} title="Centralizar" aria-label="Documento centralizado"><AlignCenter className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("justifyRight")} title="À direita" aria-label="Documento à direita"><AlignRight className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("justifyFull")} title="Justificar" aria-label="Justificar"><AlignJustify className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("insertUnorderedList")} title="Lista" aria-label="Lista com marcadores"><List className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("insertOrderedList")} title="Lista numerada" aria-label="Lista numerada"><ListOrdered className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("outdent")} title="Diminuir recuo" aria-label="Diminuir recuo"><IndentDecrease className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("indent")} title="Aumentar recuo" aria-label="Aumentar recuo"><IndentIncrease className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("insertHorizontalRule")} title="Linha" aria-label="Inserir linha"><Minus className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={() => cmd("removeFormat")} title="Limpar formatação" aria-label="Limpar formatação"><RemoveFormatting className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />
        <div role="radiogroup" aria-label="Exibição do documento" className="flex shrink-0 rounded-lg border border-slate-200 p-0.5">
          {(["paginas", "continuo"] as const).map(x => (
            <button key={x} type="button" role="radio" aria-checked={exibicao === x} onClick={() => onExibicao(x)}
              className={`rounded-md px-2 py-1 text-xs font-bold ${exibicao === x ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {x === "paginas" ? "Páginas" : "Contínuo"}
            </button>
          ))}
        </div>
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-slate-500" role="status">
          {estado === "salvando" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
            : estado === "sujo" ? "Alterado"
              : estado === "conflito" ? <button type="button" className="font-bold text-amber-700 underline" onClick={() => void carregar()}>Mudou em outro aparelho: recarregar</button>
                : estado === "erro" ? <button type="button" className="font-bold text-red-600 underline" onClick={() => void salvar()}>Não salvou: tentar de novo</button>
                  : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Salvo</>}
        </span>
      </div>

      <div ref={caixa} className="min-h-0 flex-1 overflow-auto bg-slate-100 py-4" style={onZoom ? { touchAction: "none" } : undefined}>
        {!carregado && <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando documento" /></div>}
        <div ref={folha} className={exibicao === "paginas" ? "relative mx-auto" : "mx-auto max-w-4xl"}
          style={exibicao === "paginas" ? { width: PAGINA_DOCUMENTO.largura, zoom: escala } : zoom !== 1 ? { zoom } : undefined}>
          {exibicao === "paginas" && (
            // Folha A4 contínua com a quebra de cada página marcada (no PDF, cada página sai separada).
            <div aria-hidden="true" className="absolute inset-0 bg-white shadow-md ring-1 ring-slate-200" style={{ minHeight: paginas * alturaPagina }}>
              {Array.from({ length: paginas - 1 }, (_, n) => (
                <div key={n} className="absolute left-0 w-full border-t-2 border-dashed border-slate-300" style={{ top: (n + 1) * alturaPagina }}>
                  <span className="absolute right-2 -top-5 text-[10px] font-bold text-slate-400">fim da página {n + 1}</span>
                </div>
              ))}
            </div>
          )}
          <div ref={editor} contentEditable={carregado} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Documento do caderno"
            onInput={mudou} onBlur={() => { if (estado === "sujo") void salvar(); }}
            className={`relative outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:text-xl [&_h3]:font-bold [&_hr]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 ${exibicao === "continuo" ? "min-h-[60vh] rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10" : ""}`}
            style={exibicao === "paginas"
              ? { ...cssDe(ESTILO_DOCUMENTO), minHeight: paginas * alturaPagina, padding: PAGINA_DOCUMENTO.margem }
              : cssDe(ESTILO_DOCUMENTO)} />
        </div>
      </div>
    </div>
  );
}

/** "a:b;c:d" → objeto de estilo do React. */
function cssDe(texto: string): React.CSSProperties {
  const r: Record<string, string> = {};
  for (const d of texto.split(";")) {
    const k = d.indexOf(":");
    if (k > 0) r[d.slice(0, k).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = d.slice(k + 1).trim();
  }
  return r as React.CSSProperties;
}
