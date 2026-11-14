import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Headphones, Loader2, Music2, Undo2, X } from "lucide-react";

import { TIPOS_ACORDE, campoHarmonico } from "@/react-app/utils/musica/escritaCifra";
import { linhasEditaveis, moverAcorde, porAcorde, tirarAcorde } from "@/react-app/utils/musica/edicaoCifra";
import { transporAcordes } from "@/react-app/utils/musica/cifra";
import { NOTAS_BEMOL, NOTAS_SUSTENIDO, transporAcorde, usaBemol, type Tom } from "@/react-app/utils/musica/teoria";

const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

interface Props {
  /** A cifra como está escrita (o texto guardado). */
  texto: string;
  /** Semitons entre o escrito e o que se vê (o tom do player + o ajuste da cifra). */
  semitons: number;
  /** O tom que se ouve (para o campo harmônico e bemol/sustenido). */
  tomOuvido: Tom | null;
  tamanhoFonte: number;
  onMudar: (texto: string) => void;
  /** Toca o acorde (no tom que se vê) e acende no braço. */
  onTocarAcorde: (nome: string) => void;
  onFechar: () => void;
  /** O trecho da música de cada linha (o tempo achado sozinho), se já se sabe. */
  trechoDaLinha?: (linha: number) => { inicio: number; fim: number } | null;
  onOuvir?: (inicio: number, fim: number) => void;
  /** Ouve só o trecho da linha e escreve os acordes dele (devolve o texto novo, ou null). */
  onCifraDaLinha?: (linha: number, inicio: number, fim: number) => Promise<string | null>;
  /** Voltar para a letra (trocar a letra). */
  onTrocarLetra?: () => void;
}

/** Um arrasto: de um acorde da cifra (`origem`) ou de um pad (origem null). `nome` é o acorde como está escrito. */
interface Arrasto { origem: { linha: number; col: number } | null; nome: string; x0: number; y0: number; x: number; y: number; moveu: boolean }

/**
 * Repertório v13/v14 — escrever os acordes na cifra, numa tela no estilo do estúdio (Criar): a letra numa área grande
 * tipo canvas e os acordes em pads embaixo. Arraste um pad (ou um acorde já posto) e solte na sílaba: ele acompanha o
 * ponteiro e uma marca mostra onde vai cair. Clique numa sílaba e toque num pad (teclas 1–8) também põe. Clicar num
 * acorde toca (e acende no braço); Delete tira; Backspace desfaz.
 */
export default function EditorAcordes({ texto, semitons, tomOuvido, tamanhoFonte, onMudar, onTocarAcorde, onFechar, trechoDaLinha, onOuvir, onCifraDaLinha, onTrocarLetra }: Props) {
  const [ouvindo, setOuvindo] = useState(false);
  const [cursor, setCursor] = useState<{ linha: number; col: number } | null>(null);
  const [sel, setSel] = useState<{ linha: number; col: number } | null>(null);
  const [tipo, setTipo] = useState("");
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvo, setAlvo] = useState<{ linha: number; col: number } | null>(null);
  const historico = useRef<string[]>([]);
  const caixa = useRef<HTMLDivElement>(null);
  const regua = useRef<HTMLSpanElement>(null);
  const linhas = useMemo(() => linhasEditaveis(texto), [texto]);
  const bemol = tomOuvido ? usaBemol(tomOuvido.tonica, tomOuvido.menor) : false;
  const campo = useMemo(() => (tomOuvido ? campoHarmonico(tomOuvido) : ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "G7"]), [tomOuvido?.tonica, tomOuvido?.menor]); // eslint-disable-line react-hooks/exhaustive-deps
  const notas = bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
  const visto = (n: string) => (semitons ? transporAcorde(n, semitons, bemol) : n);
  const escrito = (n: string) => (semitons ? transporAcorde(n, -semitons) : n);
  const fonte = Math.max(15, tamanhoFonte + 2);

  const linhaEscolhida = sel?.linha ?? cursor?.linha ?? null;
  const trecho = linhaEscolhida !== null && trechoDaLinha ? trechoDaLinha(linhaEscolhida) : null;
  const mudar = (novo: string) => { if (novo === texto) return; historico.current = [...historico.current.slice(-99), texto]; onMudar(novo); };
  const desfazer = () => { const ant = historico.current.pop(); if (ant !== undefined) { onMudar(ant); setSel(null); } };
  /** Toque num pad: toca e, com uma sílaba marcada, põe o acorde nela. `nome` no tom que se vê. */
  const apertar = (nome: string) => {
    onTocarAcorde(nome);
    if (cursor) { mudar(porAcorde(texto, cursor.linha, cursor.col, escrito(nome))); setSel(cursor); }
  };
  const tirar = () => { if (sel) { mudar(tirarAcorde(texto, sel.linha, sel.col)); setSel(null); } };

  /** Linha e coluna sob o ponteiro: a linha mais perto e a coluna pela largura medida de uma letra. */
  const alvoNoPonto = (x: number, y: number): { linha: number; col: number } | null => {
    const c = caixa.current;
    if (!c) return null;
    const rc = c.getBoundingClientRect();
    if (x < rc.left - 20 || x > rc.right + 20 || y < rc.top - 20 || y > rc.bottom + 20) return null;
    const els = c.querySelectorAll<HTMLElement>("[data-linha-acordes]");
    let melhor: HTMLElement | null = null, dist = Infinity;
    els.forEach(el => { const r = el.getBoundingClientRect(); const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; if (d < dist) { dist = d; melhor = el; } });
    if (!melhor) return null;
    const el = melhor as HTMLElement;
    const larguraLetra = regua.current?.getBoundingClientRect().width || fonte * 0.6;
    const r = (el.querySelector<HTMLElement>("[data-base]") ?? el).getBoundingClientRect();
    return { linha: Number(el.dataset.linhaAcordes), col: Math.max(0, Math.round((x - r.left) / larguraLetra)) };
  };

  // o arrasto segue o ponteiro na janela toda (vale para os acordes da cifra e para os pads); os ouvintes entram já
  // no toque, sem esperar o React, para um clique rápido não se perder
  const vivo = useRef({ texto, alvoNoPonto, mudar, apertar, visto, onTocarAcorde });
  vivo.current = { texto, alvoNoPonto, mudar, apertar, visto, onTocarAcorde };
  const emCurso = useRef<{ d: Arrasto; parar: () => void } | null>(null);
  useEffect(() => () => emCurso.current?.parar(), []);
  const pegar = (e: React.PointerEvent, origem: Arrasto["origem"], nome: string) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    emCurso.current?.parar();
    const d: Arrasto = { origem, nome, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moveu: false };
    const mover = (ev: PointerEvent) => {
      d.x = ev.clientX; d.y = ev.clientY;
      d.moveu = d.moveu || Math.hypot(d.x - d.x0, d.y - d.y0) > 4;
      setArrasto({ ...d });
      if (d.moveu) setAlvo(vivo.current.alvoNoPonto(d.x - 4, d.y));
    };
    const parar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", parar);
      emCurso.current = null;
      setArrasto(null);
      setAlvo(null);
    };
    const soltar = (ev: PointerEvent) => {
      const v = vivo.current;
      parar();
      if (!d.moveu) {
        // foi um clique: no acorde toca e escolhe; no pad toca e põe na sílaba marcada
        if (d.origem) { v.onTocarAcorde(v.visto(d.nome)); setSel(d.origem); setCursor(null); } else v.apertar(v.visto(d.nome));
        return;
      }
      const a = v.alvoNoPonto(ev.clientX - 4, ev.clientY);
      if (!a) return;
      v.mudar(d.origem ? moverAcorde(v.texto, d.origem, a) : porAcorde(v.texto, a.linha, a.col, d.nome));
      if (!d.origem) v.onTocarAcorde(v.visto(d.nome));
      setSel(a);
      setCursor(null);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", parar);
    emCurso.current = { d, parar };
    setArrasto({ ...d });
  };

  // teclas: 1–8 campo harmônico, Delete tira o escolhido, Backspace desfaz, Esc solta
  const acoes = useRef({ apertar, tirar, desfazer, campo, sel });
  acoes.current = { apertar, tirar, desfazer, campo, sel };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const a = acoes.current, n = Number(e.key);
      if (n >= 1 && n <= a.campo.length) { e.preventDefault(); a.apertar(a.campo[n - 1]); }
      else if (e.key === "Delete" && a.sel) { e.preventDefault(); a.tirar(); }
      else if (e.key === "Backspace") { e.preventDefault(); a.desfazer(); }
      else if (e.key === "Escape") { setCursor(null); setSel(null); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const pad = "flex select-none flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-white shadow-sm hover:bg-slate-700 active:scale-[0.97] cursor-grab active:cursor-grabbing";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" role="region" aria-label="Mexer nos acordes">
      {/* barra de cima, como no estúdio */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
        <b className="mr-auto text-sm text-slate-700">Escrever cifra <span className="font-normal text-slate-400">· arraste os acordes para a letra</span></b>
        <button type="button" className={botao} onClick={desfazer} disabled={!historico.current.length} title="Desfazer (Backspace)"><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
        {sel && <button type="button" className={botao} onClick={tirar} title="Tirar o acorde escolhido (Delete)"><X className="h-3.5 w-3.5" />Tirar acorde</button>}
        {onTrocarLetra && <button type="button" className={botao} onClick={onTrocarLetra} title="Colar ou identificar outra letra"><FileText className="h-3.5 w-3.5" />Trocar a letra</button>}
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700" onClick={onFechar}><Check className="h-3.5 w-3.5" />Pronto</button>
      </div>

      {linhaEscolhida !== null && linhas[linhaEscolhida] && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-orange-50/60 px-2 py-1.5" role="group" aria-label="Linha escolhida">
          <span className="mr-1 text-[11px] font-bold text-slate-600">Linha {linhaEscolhida + 1}</span>
          {onOuvir && <button type="button" className={botao} disabled={!trecho} onClick={() => trecho && onOuvir(trecho.inicio, trecho.fim)} title="Toca só esta linha"><Headphones className="h-3.5 w-3.5" />Ouvir</button>}
          {onCifraDaLinha && (
            <button type="button" className={botao} disabled={!trecho || ouvindo} title="Ouve só o trecho desta linha e escreve os acordes dele"
              onClick={async () => {
                if (!trecho || linhaEscolhida === null) return;
                setOuvindo(true);
                try { const novo = await onCifraDaLinha(linhaEscolhida, trecho.inicio, trecho.fim); if (novo !== null) { mudar(novo); onOuvir?.(trecho.inicio, trecho.fim); } }
                finally { setOuvindo(false); }
              }}>{ouvindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Music2 className="h-3.5 w-3.5" />}Cifra da linha</button>
          )}
          {!trecho && <span className="text-[11px] text-slate-500">Ainda não sei o tempo desta linha: ponha alguns acordes nas outras (ou identifique a letra) que eu acho sozinho.</span>}
        </div>
      )}

      {/* a "tela": a letra com os acordes soltos em cima */}
      <div ref={caixa} className={`relative min-h-[9rem] flex-1 overflow-auto bg-[linear-gradient(#f1f5f9_1px,transparent_1px)] bg-[length:100%_2.9em] px-4 py-3 font-mono ${arrasto?.moveu ? "cursor-grabbing select-none" : ""}`}
        style={{ fontSize: fonte }} aria-label="Cifra para mexer">
        <span ref={regua} className="pointer-events-none invisible absolute">M</span>
        {!linhas.length && <p className="font-sans text-sm text-slate-500">A cifra não tem linhas de letra ainda. Use “Trocar a letra” para colar ou identificar a letra.</p>}
        {linhas.map((l, i) => {
          const nomes = l.itens.map(a => visto(a.nome));
          const cols = transporAcordes(l.itens.map((a, k) => ({ col: a.col, nome: nomes[k] })), 0).map(a => a.col);
          const largura = Math.max(l.texto.length + 6, ...cols.map((c, k) => c + nomes[k].length + 2), 16);
          const alvoAqui = alvo?.linha === i ? alvo.col : null;
          return (
            <div key={i} data-linha-acordes={i} className={`mb-1.5 rounded-md px-1 ${alvoAqui !== null ? "bg-orange-50" : cursor?.linha === i || sel?.linha === i ? "bg-orange-50/70" : ""}`}>
              <div data-base className="relative h-[1.45em]" style={{ width: `${largura}ch` }} aria-label={`Acordes da linha ${i + 1}`}>
                {l.itens.map((a, k) => {
                  const escolhido = sel?.linha === i && sel.col === a.col;
                  const emArrasto = arrasto?.moveu && arrasto.origem?.linha === i && arrasto.origem.col === a.col;
                  return (
                    <button key={`${a.col}-${k}`} type="button" style={{ left: `${cols[k]}ch`, touchAction: "none" }} title="Arraste para mover; clique para ouvir"
                      className={`absolute top-0 cursor-grab select-none rounded px-0.5 font-bold leading-[1.45em] active:cursor-grabbing ${escolhido ? "bg-orange-600 text-white" : "text-orange-600 hover:bg-orange-100"} ${emArrasto ? "opacity-25" : ""}`}
                      onPointerDown={e => pegar(e, { linha: i, col: a.col }, a.nome)}>
                      {nomes[k]}
                    </button>
                  );
                })}
                {/* onde o acorde vai cair */}
                {alvoAqui !== null && arrasto && (
                  <span className="pointer-events-none absolute top-0 z-10 rounded bg-orange-600 px-0.5 font-bold leading-[1.45em] text-white shadow" style={{ left: `${alvoAqui}ch` }} data-alvo>{visto(arrasto.nome)}</span>
                )}
              </div>
              <div className={`relative flex ${l.letra === null ? "text-slate-300" : "text-slate-800"}`} style={{ width: `${largura}ch` }} aria-label={`Letra da linha ${i + 1}`}>
                {alvoAqui !== null && <span className="pointer-events-none absolute -top-1 bottom-0 w-0.5 bg-orange-500" style={{ left: `${alvoAqui}ch` }} />}
                {Array.from((l.letra === null ? "" : l.texto).padEnd(largura, " ")).map((ch, c) => (
                  <span key={c} data-col={c} onClick={() => { setCursor({ linha: i, col: c }); setSel(null); }}
                    className={`inline-block w-[1ch] shrink-0 cursor-pointer whitespace-pre ${cursor?.linha === i && cursor.col === c ? "rounded-sm bg-orange-400 text-white" : "hover:bg-orange-100"}`}>{ch}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* o acorde acompanhando o ponteiro */}
      {arrasto?.moveu && !alvo && (
        <span className="pointer-events-none fixed z-50 rounded bg-slate-800 px-1.5 py-0.5 font-mono font-bold text-white opacity-80 shadow" style={{ left: arrasto.x + 8, top: arrasto.y - 20, fontSize: fonte }}>{visto(arrasto.nome)}</span>
      )}

      {/* os pads, como os da bateria no estúdio: toque ou arraste para a letra */}
      <div className="space-y-1.5 border-t border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8" role="group" aria-label="Acordes do campo harmônico">
          {campo.map((nome, i) => (
            <button key={nome} type="button" aria-label={`Acorde ${nome}`} style={{ touchAction: "none" }} className={`${pad} h-12`}
              onPointerDown={e => pegar(e, null, escrito(nome))} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apertar(nome); } }}>
              <span className="text-base font-bold leading-tight">{nome}</span>
              <span className="rounded bg-slate-600 px-1 text-[9px] leading-tight text-slate-200">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Teclado de acordes">
          {notas.map(n => (
            <button key={n} type="button" aria-label={`Teclado ${n}${tipo}`} style={{ touchAction: "none" }}
              onPointerDown={e => pegar(e, null, escrito(`${n}${tipo}`))} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apertar(`${n}${tipo}`); } }}
              className={`h-9 min-w-[2.4rem] shrink-0 cursor-grab select-none rounded-lg border px-1 text-xs font-bold active:scale-95 ${n.length > 1 ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-600" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"}`}>
              {n}{tipo && <span className="text-[9px] font-normal">{tipo}</span>}
            </button>
          ))}
          <div className="ml-1 flex shrink-0 gap-0.5" role="radiogroup" aria-label="Tipo do acorde">
            {TIPOS_ACORDE.map(t => (
              <button key={t.sufixo} type="button" role="radio" aria-checked={tipo === t.sufixo} onClick={() => setTipo(t.sufixo)}
                className={`rounded px-1.5 py-1 text-[11px] font-bold ${tipo === t.sufixo ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-200"}`}>{t.nome}</button>
            ))}
          </div>
        </div>
        <p className="hidden text-[11px] text-slate-500 sm:block">
          {cursor ? "Sílaba marcada: toque num acorde (ou 1–8) para pô-lo nela." : "Arraste um acorde e solte em cima da sílaba, ou clique na sílaba e toque no acorde."} Clique num acorde da cifra para ouvir e ver no braço. Delete tira; Backspace desfaz.
        </p>
      </div>
    </div>
  );
}
