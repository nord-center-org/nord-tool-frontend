import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as PE } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, Underline } from "lucide-react";

import { FONTE_TEXTO } from "@/react-app/components/bloco/desenho";
import { CORES, htmlParaTrechos, trechosDe, trechosParaHtml, type Alinhamento, type NoTexto, type Texto, type Trecho } from "@/react-app/utils/blocoNotas";

export interface EditorCaixaTextoApi {
  /** Fecha a edição devolvendo o texto como está. */
  terminar: () => void;
}

interface Props {
  texto: Texto;
  zoom: number;
  /** Largura máxima (até a borda da página). */
  larguraMaxima: number;
  onFechar: (final: Texto) => void;
}

const TAMANHOS = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];

/** Só com formatação de verdade os trechos ficam guardados; texto simples continua só em txt. */
function semFormatacao(r: Trecho[], base: Texto): boolean {
  return r.every(x => !x.b && !x.i && !x.u && (!x.c || x.c === base.c) && (!x.s || x.s === base.s));
}

/**
 * Caixa de texto em edição (v2): texto com formatação por trecho (negrito, itálico, sublinhado, tamanho e cor do que
 * estiver selecionado), alinhamento da caixa e largura ajustável pela alça da direita. Usa contentEditable; ao fechar,
 * o HTML vira trechos (o canvas desenha os trechos, igual na tela e no PDF).
 */
const EditorCaixaTexto = forwardRef<EditorCaixaTextoApi, Props>(function EditorCaixaTexto({ texto, zoom, larguraMaxima, onFechar }, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(texto.w);
  const [al, setAl] = useState<Alinhamento | undefined>(texto.al);
  const fechado = useRef(false);
  const barra = useRef<HTMLDivElement>(null);
  const [desvio, setDesvio] = useState(0);

  // A barra começa na caixa, mas não pode sair da tela (no celular a caixa costuma estar perto da borda).
  useLayoutEffect(() => {
    const el = barra.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const esquerda = r.left - desvio;
    const limite = window.innerWidth - 8;
    setDesvio(Math.max(8 - esquerda, Math.min(0, limite - (esquerda + r.width))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, texto.x, zoom]);

  // Conteúdo inicial só uma vez (depois o navegador cuida da edição).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.innerHTML = trechosParaHtml(trechosDe(texto), zoom);
    el.focus();
    const sel = window.getSelection();
    if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
    try { document.execCommand("styleWithCSS", false, "false"); } catch { /* navegador sem execCommand */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const terminar = () => {
    if (fechado.current || !area.current) return;
    fechado.current = true;
    const r = htmlParaTrechos(area.current as unknown as NoTexto);
    const txt = r.map(x => x.t).join("").slice(0, 5000);
    const final: Texto = { ...texto, w: largura, txt, al: al === "left" ? undefined : al };
    if (!semFormatacao(r, texto)) final.r = r;
    else delete final.r;
    onFechar(final);
  };
  useImperativeHandle(ref, () => ({ terminar }));

  /** Comando no que está selecionado, sem tirar o foco do texto. */
  const comando = (nome: string, valor?: string) => {
    area.current?.focus();
    document.execCommand(nome, false, valor);
  };

  /** Tamanho do trecho selecionado: o navegador marca com <font size=7>, que vira span com data-s. */
  const tamanho = (s: number) => {
    const el = area.current;
    if (!el) return;
    comando("fontSize", "7");
    el.querySelectorAll('font[size="7"]').forEach(f => {
      const span = document.createElement("span");
      span.setAttribute("data-s", String(s));
      span.style.fontSize = `${s * zoom}px`;
      const cor = f.getAttribute("color");
      if (cor) span.style.color = cor;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
  };

  // Alça da direita: muda a largura.
  const arrastar = (e: PE<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX, w0 = largura;
    const mover = (ev: PointerEvent) => setLargura(Math.max(40, Math.min(larguraMaxima, w0 + (ev.clientX - x0) / zoom)));
    const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); area.current?.focus(); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const botao = (ativo = false) => `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ativo ? "bg-white/20" : ""} text-white hover:bg-white/15`;
  const semFoco = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

  return (
    <div ref={caixa} className="absolute z-20" style={{ left: texto.x * zoom, top: texto.y * zoom, width: largura * zoom }}
      onBlur={e => { if (!caixa.current?.contains(e.relatedTarget as Node | null)) terminar(); }}>
      <div ref={barra} role="toolbar" aria-label="Formatar texto" style={{ transform: `translateX(${desvio}px)` }} onMouseDown={semFoco} onPointerDown={e => e.stopPropagation()}
        className="absolute bottom-full left-0 mb-2 flex max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto rounded-xl bg-slate-900/95 p-1 shadow-xl">
        <button type="button" className={botao()} onClick={() => comando("bold")} title="Negrito (Ctrl+B)" aria-label="Negrito"><Bold className="h-4 w-4" /></button>
        <button type="button" className={botao()} onClick={() => comando("italic")} title="Itálico (Ctrl+I)" aria-label="Itálico"><Italic className="h-4 w-4" /></button>
        <button type="button" className={botao()} onClick={() => comando("underline")} title="Sublinhado (Ctrl+U)" aria-label="Sublinhado"><Underline className="h-4 w-4" /></button>
        <select aria-label="Tamanho do trecho" defaultValue="" onMouseDown={e => e.stopPropagation()} onChange={e => { if (e.target.value) tamanho(Number(e.target.value)); e.target.value = ""; }}
          className="h-8 shrink-0 rounded-lg bg-slate-800 px-1 text-xs font-bold text-white">
          <option value="">Tamanho</option>
          {TAMANHOS.map(t => <option key={t} value={t}>{t}px</option>)}
        </select>
        {CORES.slice(0, 7).map(c => (
          <button key={c} type="button" onClick={() => comando("foreColor", c)} aria-label={`Cor do trecho ${c}`} title="Cor do trecho"
            className="mx-0.5 h-5 w-5 shrink-0 rounded-full border border-white/60" style={{ background: c }} />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
        <button type="button" className={botao(!al || al === "left")} onClick={() => setAl("left")} aria-label="Alinhar à esquerda" title="À esquerda"><AlignLeft className="h-4 w-4" /></button>
        <button type="button" className={botao(al === "center")} onClick={() => setAl("center")} aria-label="Centralizar" title="Centralizar"><AlignCenter className="h-4 w-4" /></button>
        <button type="button" className={botao(al === "right")} onClick={() => setAl("right")} aria-label="Alinhar à direita" title="À direita"><AlignRight className="h-4 w-4" /></button>
        <button type="button" className={`${botao()} ml-1 bg-blue-600 hover:bg-blue-700`} onClick={terminar} aria-label="Pronto" title="Pronto (Esc)"><Check className="h-4 w-4" /></button>
      </div>
      <div ref={area} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Escrever texto"
        onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); terminar(); } e.stopPropagation(); }}
        onPointerDown={e => e.stopPropagation()}
        className="min-h-[1.3em] whitespace-pre-wrap break-words rounded border border-dashed border-violet-400 bg-white/85 outline-none"
        style={{ fontSize: texto.s * zoom, lineHeight: 1.3, color: texto.c, textAlign: al ?? "left", fontFamily: FONTE_TEXTO }} />
      <span role="slider" aria-label="Largura da caixa" aria-valuenow={Math.round(largura)} onPointerDown={arrastar} title="Arraste para mudar a largura"
        className="absolute -right-2 top-1/2 h-6 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-violet-600 bg-white shadow" style={{ touchAction: "none" }} />
    </div>
  );
});

export default EditorCaixaTexto;
