import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, CornerDownLeft, Headphones, Minus, Music2, Plus, Undo2, Wand2, X } from "lucide-react";

import {
  TIPOS_ACORDE, acordesDaIntro, campoHarmonico, colunasSemEncostar, itensDaLinha, linhasDaLetra, marcarAcorde, montarCifra, noTempo, porNaSilaba,
  cifraNoTrecho, escreverTempo, lerTempo, tirarItem, transporEscrita, trechoDoVerso, type EscritaCifra, type MarcaAcorde,
} from "@/react-app/utils/musica/escritaCifra";
import type { ModeloLetra } from "@/react-app/workers/letraMusica.worker";
import { NOTAS_BEMOL, NOTAS_SUSTENIDO, mod12, transporAcorde, transporTom, usaBemol, type Tom } from "@/react-app/utils/musica/teoria";

const botao = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

interface Props {
  escrita: EscritaCifra;
  /** Tom do áudio (sem a mudança de tom), se a análise já reconheceu. */
  tom: Tom | null;
  /** Semitons que o player está transpondo: os botões mostram os acordes no tom que se ouve. */
  semitons: number;
  batidas: number[];
  duracao: number;
  /** Tempo atual da música (s). */
  agora: () => number;
  onMudar: (e: EscritaCifra) => void;
  /** Troca a cifra pela escrita (tempos null: sem tempo marcado, o player calcula pelos acordes). */
  onAplicar: (texto: string, tempos: (number | null)[] | null) => void;
  onFechar: () => void;
  /** v11: identificar a letra no áudio. */
  onIdentificarLetra?: (modelo: ModeloLetra, idioma: string | null) => void;
  /** v11: identificar a letra só de um verso (trecho da música). */
  onIdentificarVerso?: (i: number, inicio: number, fim: number, modelo: ModeloLetra, idioma: string | null) => void;
  /** v11: trocar as marcas pelos acordes reconhecidos na análise. */
  onAcordesDoAudio?: () => void;
  /** v11: ouve só um trecho e devolve os acordes dele (tom do áudio). */
  onCifraDoTrecho?: (inicio: number, fim: number) => Promise<MarcaAcorde[]>;
  /** v11: tocar um trecho da música (e parar no fim). */
  onOuvir?: (inicio: number, fim: number) => void;
  /** v11: tocar o som de um acorde (no tom que se ouve). */
  onTocarAcorde?: (nome: string) => void;
  ocupado?: boolean;
  vozSeparada?: boolean;
}

const IDIOMAS: Array<[string, string]> = [["portuguese", "Português"], ["english", "Inglês"], ["spanish", "Espanhol"], ["", "Detectar"]];

/**
 * Repertório v10/v11 — "Escrever cifra". Dois jeitos de pôr os acordes:
 * - clicando na sílaba da letra e tocando no acorde (campo harmônico, teclas 1–8, ou o teclado de acordes): ele fica
 *   em cima daquela sílaba;
 * - com a música tocando e nenhuma sílaba escolhida, o acorde entra no tempo; "Próxima linha" (Enter) marca o começo
 *   de cada verso.
 * Com um verso escolhido dá para ouvir só ele, identificar os acordes dele no áudio e a letra dele.
 */
export default function EscreverCifra(props: Props) {
  const { escrita, tom, semitons, batidas, duracao, agora, onMudar, onAplicar, onFechar, onIdentificarLetra, onIdentificarVerso, onAcordesDoAudio, onCifraDoTrecho, onOuvir, onTocarAcorde, ocupado, vozSeparada } = props;
  const [idioma, setIdioma] = useState("portuguese");
  const [modelo, setModelo] = useState<ModeloLetra>("rapido");
  const [noTempoBatida, setNoTempoBatida] = useState(true);
  const [tipo, setTipo] = useState("");
  const [cursor, setCursor] = useState<{ linha: number; col: number } | null>(null);
  const [sel, setSel] = useState<{ linha: number; k: number } | null>(null);
  const [editandoLetra, setEditandoLetra] = useState(!escrita.letra.trim());
  const historico = useRef<EscritaCifra[]>([]);
  const versos = useMemo(() => linhasDaLetra(escrita.letra), [escrita.letra]);
  const ouvido = tom ? transporTom(tom, semitons) : null;
  const bemol = ouvido ? usaBemol(ouvido.tonica, ouvido.menor) : false;
  const campo = useMemo(() => (ouvido ? campoHarmonico(ouvido) : ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "G7"]), [ouvido?.tonica, ouvido?.menor]); // eslint-disable-line react-hooks/exhaustive-deps
  const proximaLinha = (() => { const i = versos.findIndex((_, k) => (escrita.inicios[k] ?? null) === null); return i < 0 ? versos.length : i; })();
  const linhaAtual = proximaLinha - 1;
  const lista = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const caixaLetra = useRef<HTMLTextAreaElement>(null);
  // a letra chegou de fora (identificada no áudio): fecha a caixa e mostra a letra para pôr os acordes
  const letraAnterior = useRef(escrita.letra);
  useEffect(() => {
    if (escrita.letra !== letraAnterior.current && escrita.letra.trim() && document.activeElement !== caixaLetra.current) {
      setEditandoLetra(false);
      lista.current?.scrollIntoView({ block: "start" });
    }
    letraAnterior.current = escrita.letra;
  }, [escrita.letra]);
  const notas = bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;

  /** Toda mudança guarda a anterior para o "Desfazer". */
  const mudar = (nova: EscritaCifra) => { historico.current = [...historico.current.slice(-99), escrita]; onMudar(nova); };
  const desfazer = () => { const ant = historico.current.pop(); if (ant) { onMudar(ant); setSel(null); } };
  const tempoAgora = () => (noTempoBatida ? noTempo(agora(), batidas) : Math.round(agora() * 1000) / 1000);
  const doAudio = (nome: string) => (semitons ? transporAcorde(nome, -semitons) : nome);
  const nomeNoTom = (n: string) => (semitons ? transporAcorde(n, semitons, bemol) : n);

  /** O acorde apertado (no tom que se ouve) é guardado no tom do áudio, como a cifra. */
  const apertar = (nome: string) => {
    if (cursor) {
      mudar(porNaSilaba(escrita, cursor.linha, cursor.col, doAudio(nome)));
      onTocarAcorde?.(nome);
    } else {
      mudar({ ...escrita, acordes: marcarAcorde(escrita.acordes, tempoAgora(), doAudio(nome)) });
    }
  };
  const marcarLinha = () => {
    if (proximaLinha >= versos.length) return;
    const inicios = versos.map((_, i) => escrita.inicios[i] ?? null);
    inicios[proximaLinha] = tempoAgora();
    mudar({ ...escrita, inicios });
  };
  const itensDe = (i: number) => itensDaLinha(escrita, i, versos, duracao);
  const tirarSelecionado = () => {
    if (!sel) return;
    const it = itensDe(sel.linha)[sel.k];
    if (it) mudar(tirarItem(escrita, it));
    setSel(null);
  };

  // verso escolhido (pelo cursor ou pelo acorde selecionado)
  const versoEscolhido = cursor?.linha ?? sel?.linha ?? null;
  const doVerso = versoEscolhido === null ? null : trechoDoVerso(escrita, versoEscolhido, versos.length, duracao);
  // v11: o trecho que a pessoa escolheu para o verso (começa no do verso; dá para mudar o começo e o fim)
  const [faixa, setFaixa] = useState<{ verso: number; de: string; ate: string } | null>(null);
  const deTxt = faixa && faixa.verso === versoEscolhido ? faixa.de : doVerso ? escreverTempo(doVerso.inicio) : "";
  const ateTxt = faixa && faixa.verso === versoEscolhido ? faixa.ate : doVerso ? escreverTempo(doVerso.fim) : "";
  const mudarFaixa = (m: Partial<{ de: string; ate: string }>) => { if (versoEscolhido !== null) setFaixa({ verso: versoEscolhido, de: deTxt, ate: ateTxt, ...m }); };
  const de = lerTempo(deTxt), ate = lerTempo(ateTxt);
  const trecho = de !== null && ate !== null && ate - de >= 0.5 && de < duracao ? { inicio: de, fim: Math.min(ate, duracao) } : null;
  const [ouvindo, setOuvindo] = useState(false);
  const cifraDoTrecho = async () => {
    if (versoEscolhido === null || !trecho || !onCifraDoTrecho) return;
    const verso = versoEscolhido, base = escrita;
    setOuvindo(true);
    try {
      const marcas = await onCifraDoTrecho(trecho.inicio, trecho.fim);
      if (!marcas.length) return;
      historico.current = [...historico.current.slice(-99), base];
      onMudar(cifraNoTrecho(base, verso, versos.length, duracao, trecho.inicio, marcas));
      setFaixa(null);
      onOuvir?.(trecho.inicio, trecho.fim);
    } finally {
      setOuvindo(false);
    }
  };

  // teclas: 1–8 campo harmônico, Enter próxima linha, Backspace desfaz, Delete tira o acorde escolhido, Esc solta
  const acoes = useRef({ apertar, marcarLinha, desfazer, tirarSelecionado, campo, sel });
  acoes.current = { apertar, marcarLinha, desfazer, tirarSelecionado, campo, sel };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const n = Number(e.key);
      const a = acoes.current;
      if (n >= 1 && n <= a.campo.length) { e.preventDefault(); a.apertar(a.campo[n - 1]); }
      else if (e.key === "Enter") { e.preventDefault(); a.marcarLinha(); }
      else if (e.key === "Backspace") { e.preventDefault(); a.desfazer(); }
      else if (e.key === "Delete" && a.sel) { e.preventDefault(); a.tirarSelecionado(); }
      else if (e.key === "Escape") { setCursor(null); setSel(null); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => { if (!cursor) lista.current?.querySelector('[data-atual="true"]')?.scrollIntoView({ block: "nearest" }); }, [linhaAtual, cursor]);

  const intro = acordesDaIntro(escrita);
  const aplicar = () => {
    const r = montarCifra({ ...escrita, inicios: versos.map((_, i) => escrita.inicios[i] ?? null) }, duracao);
    onAplicar(r.texto, r.tempos.some(t => t !== null) ? r.tempos : null);
  };
  const temAlgo = escrita.acordes.length > 0 || (escrita.fixos?.length ?? 0) > 0 || versos.length > 0;

  return (
    <div ref={rolagem} className="flex min-h-0 flex-1 flex-col overflow-y-auto" role="region" aria-label="Escrever cifra">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
        <b className="mr-auto text-sm text-slate-700">Escrever cifra {ouvido && <span className="font-normal text-slate-400">· campo harmônico de {campo[0]}</span>}</b>
        <label className="flex items-center gap-1 text-[11px] text-slate-600" title="Tocando, o acorde entra na batida mais próxima"><input type="checkbox" checked={noTempoBatida} onChange={e => setNoTempoBatida(e.target.checked)} />No tempo</label>
        <div className="flex items-center gap-0.5" role="group" aria-label="Tom da cifra" title="Sobe ou desce o tom de tudo o que foi escrito (o áudio não muda)">
          <span className="text-[10px] font-bold uppercase text-slate-400">Tom da cifra</span>
          {([[-1, "Descer meio tom da cifra", Minus], [1, "Subir meio tom da cifra", Plus]] as const).map(([d, rot, Icone]) => (
            <button key={d} type="button" aria-label={rot} disabled={!escrita.acordes.length && !(escrita.fixos?.length)}
              onClick={() => mudar(transporEscrita(escrita, d, ouvido ? usaBemol(mod12(ouvido.tonica + d), ouvido.menor) : undefined))}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Icone className="h-3.5 w-3.5" /></button>
          ))}
        </div>
        <button type="button" className={botao} onClick={desfazer} disabled={!historico.current.length} title="Desfazer (Backspace)"><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
        {onAcordesDoAudio && (
          <button type="button" className={botao} disabled={ocupado} title="Põe no tempo os acordes que reconheci no áudio (troca os marcados)"
            onClick={() => { if (!escrita.acordes.length || window.confirm("Trocar os acordes marcados pelos reconhecidos no áudio?")) { historico.current.push(escrita); onAcordesDoAudio(); } }}>
            <Wand2 className="h-3.5 w-3.5" />Acordes do áudio
          </button>
        )}
        <button type="button" className={botao} onClick={() => setEditandoLetra(v => !v)}>{escrita.letra.trim() ? "Editar letra" : "Colar letra"}</button>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          disabled={!temAlgo} onClick={aplicar} title="Troca a cifra pela escrita aqui"><Check className="h-3.5 w-3.5" />Aplicar na cifra</button>
        <button type="button" className={botao} onClick={onFechar} aria-label="Fechar o modo escrever cifra"><X className="h-3.5 w-3.5" /></button>
      </div>

      {editandoLetra && (
        <div className="border-b border-slate-100 p-2">
          <textarea ref={caixaLetra} value={escrita.letra} onChange={e => onMudar({ ...escrita, letra: e.target.value.slice(0, 20_000) })} aria-label="Letra da música" rows={5}
            placeholder={"Cole a letra aqui (uma linha por verso; linha vazia separa as estrofes) ou toque em Identificar letra.\nDepois clique na sílaba e toque no acorde para ele ficar em cima dela."}
            className="w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-500" />
          {onIdentificarLetra && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
                onClick={() => { if (!escrita.letra.trim() || window.confirm("Trocar a letra atual pela reconhecida no áudio?")) { historico.current.push(escrita); onIdentificarLetra(modelo, idioma || null); } }}>
                <AudioLines className="h-3.5 w-3.5" />Identificar letra
              </button>
              <SeletoresReconhecedor idioma={idioma} setIdioma={setIdioma} modelo={modelo} setModelo={setModelo} />
              <span className="text-[11px] text-slate-500">
                Ouço a voz no aparelho e escrevo cada linha com a hora em que começa (o áudio não sai daqui; o reconhecedor baixa uma vez).
                {vozSeparada ? " Uso a voz separada." : " Dica: separe as faixas antes para eu ouvir só a voz."} Confira e corrija depois.
              </span>
            </div>
          )}
        </div>
      )}

      {/* os acordes para apertar */}
      <div className="space-y-1.5 border-b border-slate-100 p-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Acordes do campo harmônico">
          {campo.map((nome, i) => (
            <button key={nome} type="button" onClick={() => apertar(nome)} aria-label={`Acorde ${nome}`}
              className="flex min-w-[3rem] flex-col items-center rounded-xl border border-orange-200 bg-orange-50 px-2 py-1 text-base font-bold leading-tight text-orange-700 hover:bg-orange-100 active:scale-95">
              {nome}<span className="text-[9px] font-normal text-orange-400">{i + 1}</span>
            </button>
          ))}
          {versos.length > 0 && (
            <button type="button" onClick={marcarLinha} disabled={proximaLinha >= versos.length}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40" title="Tocando: marque quando o próximo verso começar (Enter)">
              <CornerDownLeft className="h-4 w-4" />Próxima linha
            </button>
          )}
        </div>
        {/* teclado de acordes: qualquer nota com o tipo escolhido */}
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Teclado de acordes">
          {notas.map(n => (
            <button key={n} type="button" onClick={() => apertar(`${n}${tipo}`)} aria-label={`Teclado ${n}${tipo}`}
              className={`h-9 min-w-[2.4rem] rounded-lg border px-1.5 text-sm font-bold active:scale-95 ${n.length > 1 ? "border-slate-700 bg-slate-700 text-white hover:bg-slate-600" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}>
              {n}{tipo && <span className="text-[10px] font-normal">{tipo}</span>}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <div className="flex flex-wrap gap-0.5" role="radiogroup" aria-label="Tipo do acorde">
            {TIPOS_ACORDE.map(t => (
              <button key={t.sufixo} type="button" role="radio" aria-checked={tipo === t.sufixo} onClick={() => setTipo(t.sufixo)}
                className={`rounded-md px-1.5 py-1 text-[11px] font-bold ${tipo === t.sufixo ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.nome}</button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          {cursor
            ? `Toque num acorde para pô-lo em cima de “${(versos[cursor.linha] ?? "").slice(cursor.col, cursor.col + 6).trim() || "…"}” (teclas 1–${campo.length}). Esc solta.`
            : versos.length
              ? "Clique na sílaba da letra e toque no acorde para ele ficar em cima dela. Ou dê play e aperte os acordes na hora (Próxima linha marca os versos)."
              : "Dê play e aperte o acorde quando ele entrar (teclas 1–8). Cole ou identifique a letra para pôr os acordes em cima das sílabas."}
          {" "}Clique num acorde da cifra para ouvir; Delete o tira.
        </p>
      </div>

      {/* ações do verso escolhido */}
      {versoEscolhido !== null && versos[versoEscolhido] !== undefined && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-orange-50/60 px-2 py-1.5" role="group" aria-label="Verso escolhido">
          <span className="mr-1 text-[11px] font-bold text-slate-600">Verso {versoEscolhido + 1}</span>
          <label className="flex items-center gap-1 text-[11px] text-slate-600">de
            <input value={deTxt} onChange={e => mudarFaixa({ de: e.target.value })} aria-label="Começo do trecho" placeholder="0:00.0" className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[11px]" />
          </label>
          <button type="button" className="rounded px-1 text-[11px] font-bold text-blue-700 hover:bg-white" onClick={() => mudarFaixa({ de: escreverTempo(agora()) })} title="O trecho começa onde a música está agora">agora</button>
          <label className="flex items-center gap-1 text-[11px] text-slate-600">até
            <input value={ateTxt} onChange={e => mudarFaixa({ ate: e.target.value })} aria-label="Fim do trecho" placeholder="0:00.0" className="w-16 rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[11px]" />
          </label>
          <button type="button" className="rounded px-1 text-[11px] font-bold text-blue-700 hover:bg-white" onClick={() => mudarFaixa({ ate: escreverTempo(agora()) })} title="O trecho termina onde a música está agora">agora</button>
          <button type="button" className={botao} disabled={!trecho || !onOuvir} onClick={() => trecho && onOuvir?.(trecho.inicio, trecho.fim)}
            title={trecho ? "Toca só este trecho" : "Escolha o começo e o fim do trecho (ou identifique a letra / marque com Próxima linha)"}><Headphones className="h-3.5 w-3.5" />Ouvir</button>
          {onCifraDoTrecho && (
            <button type="button" className={botao} disabled={!trecho || ocupado || ouvindo} onClick={() => void cifraDoTrecho()}
              title="Ouve só este trecho, escreve os acordes dele em cima do verso e toca para você conferir"><Music2 className="h-3.5 w-3.5" />Cifra do trecho</button>
          )}
          {onIdentificarVerso && (
            <button type="button" className={botao} disabled={!trecho || ocupado}
              onClick={() => { if (trecho && versoEscolhido !== null) { historico.current.push(escrita); onIdentificarVerso(versoEscolhido, trecho.inicio, trecho.fim, modelo, idioma || null); } }}
              title="Ouve só este trecho e reescreve a letra do verso"><AudioLines className="h-3.5 w-3.5" />Letra da linha</button>
          )}
          {sel && <button type="button" className={botao} onClick={tirarSelecionado}><X className="h-3.5 w-3.5" />Tirar acorde</button>}
          {!doVerso && !trecho && <span className="text-[11px] text-slate-500">Este verso ainda não tem tempo: escolha o trecho (de/até, ou "agora" tocando).</span>}
          <button type="button" className="ml-auto rounded p-1 text-slate-500 hover:bg-white" aria-label="Soltar o verso" onClick={() => { setCursor(null); setSel(null); }}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* a letra com os acordes: clique na sílaba para escolher onde o acorde vai */}
      <div ref={lista} className="min-h-[50vh] overflow-x-auto p-3 font-mono text-sm leading-snug" aria-label="Prévia da cifra">
        {versos.length ? (<>
          {intro.length > 0 && (
            <div className="px-2 py-0.5"><span className="text-xs text-slate-400">Intro </span><span className="font-bold text-orange-600">{intro.map(a => nomeNoTom(a.acorde)).join("  ")}</span></div>
          )}
          {versos.map((v, i) => {
            const itens = itensDe(i);
            const nomes = itens.map(it => nomeNoTom(it.acorde));
            const cols = colunasSemEncostar(itens.map((item, k) => ({ col: item.col, nome: nomes[k] })));
            const largura = Math.max(v.length + 3, ...cols.map((c, k) => c + nomes[k].length + 1));
            const temTempo = (escrita.inicios[i] ?? null) !== null;
            const escolhido = versoEscolhido === i;
            return (
              <div key={i} data-atual={i === linhaAtual} data-verso={i}
                className={`rounded px-2 py-0.5 ${escolhido ? "bg-orange-50 ring-1 ring-orange-300" : i === linhaAtual ? "bg-orange-50/60" : i === proximaLinha ? "bg-blue-50/60" : ""}`}>
                <div className="relative h-5" style={{ width: `${largura}ch` }} aria-label={`Acordes do verso ${i + 1}`}>
                  {itens.map((_, k) => (
                    <button key={k} type="button" style={{ left: `${cols[k]}ch` }} title="Toca o acorde; Delete tira"
                      onClick={() => { onTocarAcorde?.(nomes[k]); setSel({ linha: i, k }); setCursor(null); }}
                      className={`absolute top-0 rounded-sm px-0 font-bold leading-5 ${sel?.linha === i && sel.k === k ? "bg-orange-600 text-white" : "text-orange-600 hover:bg-orange-100"}`}>{nomes[k]}</button>
                  ))}
                </div>
                <div className={`flex ${temTempo ? "text-slate-800" : "text-slate-500"}`} style={{ width: `${largura}ch` }} aria-label={`Verso ${i + 1}`}>
                  {Array.from(v.padEnd(largura, " ")).map((ch, c) => (
                    <span key={c} onClick={() => { setCursor({ linha: i, col: c }); setSel(null); }} data-col={c}
                      className={`inline-block w-[1ch] shrink-0 cursor-pointer whitespace-pre ${cursor?.linha === i && cursor.col === c ? "rounded-sm bg-orange-400 text-white" : "hover:bg-orange-100"}`}>{ch}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </>) : (
          <pre className="whitespace-pre-wrap text-slate-700">{escrita.acordes.length ? montarCifra(escrita, duracao).texto : "Os acordes que você apertar aparecem aqui."}</pre>
        )}
      </div>
    </div>
  );
}

function SeletoresReconhecedor({ idioma, setIdioma, modelo, setModelo }: { idioma: string; setIdioma: (v: string) => void; modelo: ModeloLetra; setModelo: (m: ModeloLetra) => void }) {
  return (
    <>
      <select aria-label="Idioma da letra" value={idioma} onChange={e => setIdioma(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
        {IDIOMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
      <select aria-label="Reconhecedor" value={modelo} onChange={e => setModelo(e.target.value as ModeloLetra)} className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs">
        <option value="rapido">Rápido (baixa ~80 MB)</option>
        <option value="preciso">Mais preciso (baixa ~250 MB)</option>
      </select>
    </>
  );
}
