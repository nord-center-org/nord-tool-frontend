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

interface Arrasto { linha: number; col: number; nome: string; x0: number; y0: number; x: number; y: number; moveu: boolean }

/**
 * Repertório v13 — mexer nos acordes direto na cifra: clique na sílaba e toque no acorde para pô-lo em cima dela;
 * arraste um acorde com o mouse (ou o dedo) para outra sílaba ou outra linha; clique nele para ouvir (e ver no braço);
 * Delete tira; Desfazer volta.
 */
export default function EditorAcordes({ texto, semitons, tomOuvido, tamanhoFonte, onMudar, onTocarAcorde, onFechar, trechoDaLinha, onOuvir, onCifraDaLinha, onTrocarLetra }: Props) {
  const [ouvindo, setOuvindo] = useState(false);
  const [cursor, setCursor] = useState<{ linha: number; col: number } | null>(null);
  const [sel, setSel] = useState<{ linha: number; col: number } | null>(null);
  const [tipo, setTipo] = useState("");
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const historico = useRef<string[]>([]);
  const caixa = useRef<HTMLDivElement>(null);
  const linhas = useMemo(() => linhasEditaveis(texto), [texto]);
  const bemol = tomOuvido ? usaBemol(tomOuvido.tonica, tomOuvido.menor) : false;
  const campo = useMemo(() => (tomOuvido ? campoHarmonico(tomOuvido) : ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "G7"]), [tomOuvido?.tonica, tomOuvido?.menor]); // eslint-disable-line react-hooks/exhaustive-deps
  const notas = bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
  const visto = (n: string) => (semitons ? transporAcorde(n, semitons, bemol) : n);
  const escrito = (n: string) => (semitons ? transporAcorde(n, -semitons) : n);

  const linhaEscolhida = sel?.linha ?? cursor?.linha ?? null;
  const trecho = linhaEscolhida !== null && trechoDaLinha ? trechoDaLinha(linhaEscolhida) : null;
  const mudar = (novo: string) => { if (novo === texto) return; historico.current = [...historico.current.slice(-99), texto]; onMudar(novo); };
  const desfazer = () => { const ant = historico.current.pop(); if (ant !== undefined) { onMudar(ant); setSel(null); } };
  const apertar = (nome: string) => {
    onTocarAcorde(nome);
    if (cursor) { mudar(porAcorde(texto, cursor.linha, cursor.col, escrito(nome))); setSel(cursor); }
  };
  const tirar = () => { if (sel) { mudar(tirarAcorde(texto, sel.linha, sel.col)); setSel(null); } };

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

  /** Linha e coluna sob o ponteiro (pela linha da letra mais perto e a largura de uma letra). */
  const alvoNoPonto = (x: number, y: number): { linha: number; col: number } | null => {
    const els = caixa.current?.querySelectorAll<HTMLElement>("[data-linha-acordes]");
    if (!els?.length) return null;
    let melhor: HTMLElement | null = null, dist = Infinity;
    els.forEach(el => { const r = el.getBoundingClientRect(); const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; if (d < dist) { dist = d; melhor = el; } });
    if (!melhor || dist > 40) return null;
    const el = melhor as HTMLElement;
    const letra = el.querySelector<HTMLElement>("[data-letra-largura]");
    const larguraLetra = letra ? letra.getBoundingClientRect().width : tamanhoFonte * 0.6;
    const r = (el.querySelector<HTMLElement>("[data-base]") ?? el).getBoundingClientRect();
    return { linha: Number(el.dataset.linhaAcordes), col: Math.max(0, Math.round((x - r.left) / larguraLetra)) };
  };

  const soltar = (a: Arrasto) => {
    if (!a.moveu) { onTocarAcorde(visto(a.nome)); setSel({ linha: a.linha, col: a.col }); setCursor(null); return; }
    const alvo = alvoNoPonto(a.x, a.y);
    if (!alvo) return;
    mudar(moverAcorde(texto, { linha: a.linha, col: a.col }, alvo));
    setSel(alvo);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" role="region" aria-label="Mexer nos acordes">
      <div className="space-y-1.5 border-b border-slate-100 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <b className="mr-auto text-sm text-slate-700">Escrever cifra <span className="font-normal text-slate-400">· os acordes</span></b>
          {onTrocarLetra && <button type="button" className={botao} onClick={onTrocarLetra} title="Colar ou identificar outra letra"><FileText className="h-3.5 w-3.5" />Trocar a letra</button>}
          <button type="button" className={botao} onClick={desfazer} disabled={!historico.current.length} title="Desfazer (Backspace)"><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
          {sel && <button type="button" className={botao} onClick={tirar} title="Tirar o acorde escolhido (Delete)"><X className="h-3.5 w-3.5" />Tirar acorde</button>}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700" onClick={onFechar}><Check className="h-3.5 w-3.5" />Pronto</button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 sm:flex-wrap" role="group" aria-label="Acordes do campo harmônico">
          {campo.map((nome, i) => (
            <button key={nome} type="button" onClick={() => apertar(nome)} aria-label={`Acorde ${nome}`}
              className="flex min-w-[2.75rem] shrink-0 flex-col items-center rounded-lg border border-orange-200 bg-orange-50 px-2 py-0.5 text-sm font-bold leading-tight text-orange-700 hover:bg-orange-100 active:scale-95">
              {nome}<span className="text-[9px] font-normal text-orange-400">{i + 1}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap" role="group" aria-label="Teclado de acordes">
          {notas.map(n => (
            <button key={n} type="button" onClick={() => apertar(`${n}${tipo}`)} aria-label={`Teclado ${n}${tipo}`}
              className={`h-8 min-w-[2.2rem] shrink-0 rounded-md border px-1 text-xs font-bold active:scale-95 ${n.length > 1 ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-600" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
              {n}{tipo && <span className="text-[9px] font-normal">{tipo}</span>}
            </button>
          ))}
          <div className="ml-1 flex shrink-0 gap-0.5 sm:flex-wrap" role="radiogroup" aria-label="Tipo do acorde">
            {TIPOS_ACORDE.map(t => (
              <button key={t.sufixo} type="button" role="radio" aria-checked={tipo === t.sufixo} onClick={() => setTipo(t.sufixo)}
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${tipo === t.sufixo ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.nome}</button>
            ))}
          </div>
        </div>
        <p className="hidden text-[11px] text-slate-500 sm:block">
          {cursor ? "Toque num acorde para pô-lo na sílaba marcada (teclas 1–8)." : "Clique na sílaba e toque no acorde; arraste um acorde para mudar de lugar; clique nele para ouvir e ver no braço."} Delete tira; Backspace desfaz.
        </p>
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

      <div ref={caixa} className="relative min-h-[40vh] overflow-x-auto px-3 py-3 font-mono" style={{ fontSize: tamanhoFonte }} aria-label="Cifra para mexer">
        <span data-letra-largura className="invisible absolute">M</span>
        {!linhas.length && <p className="font-sans text-sm text-slate-500">A cifra não tem linhas de letra ou de acordes ainda. Cole a cifra ou escreva a letra primeiro.</p>}
        {linhas.map((l, i) => {
          const nomes = l.itens.map(a => visto(a.nome));
          const cols = transporAcordes(l.itens.map((a, k) => ({ col: a.col, nome: nomes[k] })), 0).map(a => a.col);
          const largura = Math.max(l.texto.length + 4, ...cols.map((c, k) => c + nomes[k].length + 2), 12);
          return (
            <div key={i} data-linha-acordes={i} className={`mb-1 rounded px-1 ${cursor?.linha === i || sel?.linha === i ? "bg-orange-50" : ""}`}>
              <div data-base className="relative h-[1.35em]" style={{ width: `${largura}ch` }} aria-label={`Acordes da linha ${i + 1}`}>
                {l.itens.map((a, k) => {
                  const escolhido = sel?.linha === i && sel.col === a.col;
                  const sendoArrastado = arrasto?.linha === i && arrasto.col === a.col && arrasto.moveu;
                  return (
                    <button key={`${a.col}-${k}`} type="button" style={{ left: `${cols[k]}ch`, touchAction: "none" }} title="Arraste para mover; clique para ouvir"
                      className={`absolute top-0 cursor-grab select-none rounded-sm font-bold leading-[1.35em] active:cursor-grabbing ${escolhido ? "bg-orange-600 text-white" : "text-orange-600 hover:bg-orange-100"} ${sendoArrastado ? "opacity-30" : ""}`}
                      onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); setArrasto({ linha: i, col: a.col, nome: a.nome, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moveu: false }); }}
                      onPointerMove={e => setArrasto(d => (d ? { ...d, x: e.clientX, y: e.clientY, moveu: d.moveu || Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4 } : d))}
                      onPointerUp={() => { if (arrasto) soltar(arrasto); setArrasto(null); }}
                      onPointerCancel={() => setArrasto(null)}>
                      {nomes[k]}
                    </button>
                  );
                })}
              </div>
              <div className={`flex ${l.letra === null ? "text-slate-300" : "text-slate-800"}`} style={{ width: `${largura}ch` }} aria-label={`Letra da linha ${i + 1}`}>
                {Array.from((l.letra === null ? "" : l.texto).padEnd(largura, " ")).map((ch, c) => (
                  <span key={c} data-col={c} onClick={() => { setCursor({ linha: i, col: c }); setSel(null); }}
                    className={`inline-block w-[1ch] shrink-0 cursor-pointer whitespace-pre ${cursor?.linha === i && cursor.col === c ? "rounded-sm bg-orange-400 text-white" : "hover:bg-orange-100"}`}>{ch}</span>
                ))}
              </div>
            </div>
          );
        })}
        {arrasto?.moveu && (
          <span className="pointer-events-none fixed z-50 rounded bg-orange-600 px-1 font-bold text-white shadow" style={{ left: arrasto.x + 6, top: arrasto.y - 18, fontSize: tamanhoFonte }}>{visto(arrasto.nome)}</span>
        )}
      </div>
    </div>
  );
}
