import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerDownLeft, Plus, Undo2, X } from "lucide-react";

import {
  TIPOS_ACORDE, acordesDaIntro, acordesDaLinha, campoHarmonico, linhasDaLetra, marcarAcorde, montarCifra, noTempo, type EscritaCifra,
} from "@/react-app/utils/musica/escritaCifra";
import { NOTAS_BEMOL, NOTAS_SUSTENIDO, transporAcorde, transporTom, usaBemol, type Tom } from "@/react-app/utils/musica/teoria";

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
  onAplicar: (texto: string, tempos: (number | null)[]) => void;
  onFechar: () => void;
}

/**
 * Repertório v10 — "Escrever cifra": a pessoa toca a música e aperta o acorde na hora em que ele entra (os do campo
 * harmônico do tom, teclas 1–8, ou qualquer outro). Se colou a letra, "Próxima linha" (Enter) marca onde cada verso
 * começa e o acorde cai em cima da sílaba certa. "Aplicar" vira a cifra (com o tempo de cada linha).
 */
export default function EscreverCifra({ escrita, tom, semitons, batidas, duracao, agora, onMudar, onAplicar, onFechar }: Props) {
  const [noTempoBatida, setNoTempoBatida] = useState(true);
  const [raiz, setRaiz] = useState(0);
  const [tipo, setTipo] = useState("");
  const [editandoLetra, setEditandoLetra] = useState(!escrita.letra.trim());
  const versos = useMemo(() => linhasDaLetra(escrita.letra), [escrita.letra]);
  const ouvido = tom ? transporTom(tom, semitons) : null;
  const bemol = ouvido ? usaBemol(ouvido.tonica, ouvido.menor) : false;
  const campo = useMemo(() => (ouvido ? campoHarmonico(ouvido) : ["C", "Dm", "Em", "F", "G", "Am", "Bdim", "G7"]), [ouvido?.tonica, ouvido?.menor]); // eslint-disable-line react-hooks/exhaustive-deps
  const proximaLinha = escrita.inicios.findIndex((v, i) => i < versos.length && v === null) >= 0
    ? escrita.inicios.findIndex(v => v === null)
    : Math.min(escrita.inicios.length, versos.length);
  const linhaAtual = proximaLinha - 1;
  const lista = useRef<HTMLDivElement>(null);

  const tempoAgora = () => (noTempoBatida ? noTempo(agora(), batidas) : Math.round(agora() * 1000) / 1000);
  /** O acorde apertado (no tom que se ouve) é guardado no tom do áudio, como a cifra. */
  const apertar = (nome: string) => onMudar({ ...escrita, acordes: marcarAcorde(escrita.acordes, tempoAgora(), semitons ? transporAcorde(nome, -semitons) : nome) });
  const marcarLinha = () => {
    if (proximaLinha >= versos.length) return;
    const inicios = versos.map((_, i) => escrita.inicios[i] ?? null);
    inicios[proximaLinha] = tempoAgora();
    onMudar({ ...escrita, inicios });
  };
  const desfazer = () => {
    // desfaz o que foi marcado por último (acorde ou começo de linha)
    const ultAcorde = escrita.acordes[escrita.acordes.length - 1];
    const ultLinha = linhaAtual >= 0 ? escrita.inicios[linhaAtual] : null;
    if (ultLinha !== null && ultLinha !== undefined && (!ultAcorde || ultLinha >= ultAcorde.tempo)) {
      const inicios = [...escrita.inicios]; inicios[linhaAtual] = null; onMudar({ ...escrita, inicios });
    } else if (ultAcorde) onMudar({ ...escrita, acordes: escrita.acordes.slice(0, -1) });
  };
  const nomeNoTom = (n: string) => (semitons ? transporAcorde(n, semitons, bemol) : n);

  // teclas: 1–8 campo harmônico, Enter próxima linha, Backspace desfaz
  const acoes = useRef({ apertar, marcarLinha, desfazer, campo });
  acoes.current = { apertar, marcarLinha, desfazer, campo };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= acoes.current.campo.length) { e.preventDefault(); acoes.current.apertar(acoes.current.campo[n - 1]); }
      else if (e.key === "Enter") { e.preventDefault(); acoes.current.marcarLinha(); }
      else if (e.key === "Backspace") { e.preventDefault(); acoes.current.desfazer(); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  useEffect(() => { lista.current?.querySelector('[data-atual="true"]')?.scrollIntoView({ block: "nearest" }); }, [linhaAtual]);

  const previa = useMemo(() => montarCifra({ ...escrita, inicios: versos.map((_, i) => escrita.inicios[i] ?? null) }, duracao), [escrita, versos, duracao]);
  const notas = bemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
  const intro = acordesDaIntro(escrita);

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="region" aria-label="Escrever cifra">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 p-2">
        <b className="mr-auto text-sm text-slate-700">Escrever cifra {ouvido && <span className="font-normal text-slate-400">· campo harmônico de {campo[0]}</span>}</b>
        <label className="flex items-center gap-1 text-[11px] text-slate-600" title="O acorde entra na batida mais próxima"><input type="checkbox" checked={noTempoBatida} onChange={e => setNoTempoBatida(e.target.checked)} />No tempo</label>
        <button type="button" className={botao} onClick={desfazer} disabled={!escrita.acordes.length && linhaAtual < 0} title="Desfazer a última marca (Backspace)"><Undo2 className="h-3.5 w-3.5" />Desfazer</button>
        <button type="button" className={botao} onClick={() => setEditandoLetra(v => !v)}>{escrita.letra.trim() ? "Editar letra" : "Colar letra"}</button>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
          disabled={!escrita.acordes.length && !versos.length} onClick={() => onAplicar(previa.texto, previa.tempos)} title="Troca a cifra pela escrita aqui"><Check className="h-3.5 w-3.5" />Aplicar na cifra</button>
        <button type="button" className={botao} onClick={onFechar} aria-label="Fechar o modo escrever cifra"><X className="h-3.5 w-3.5" /></button>
      </div>

      {editandoLetra && (
        <div className="border-b border-slate-100 p-2">
          <textarea value={escrita.letra} onChange={e => onMudar({ ...escrita, letra: e.target.value.slice(0, 20_000) })} aria-label="Letra da música" rows={5}
            placeholder={"Cole a letra aqui (uma linha por verso; linha vazia separa as estrofes).\nDepois dê play e toque em Próxima linha (Enter) quando cada verso começar."}
            className="w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-500" />
        </div>
      )}

      {/* os acordes para apertar */}
      <div className="border-b border-slate-100 p-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Acordes do campo harmônico">
          {campo.map((nome, i) => (
            <button key={nome} type="button" onClick={() => apertar(nome)} aria-label={`Acorde ${nome}`}
              className="flex min-w-[3.5rem] flex-col items-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-base font-bold text-orange-700 hover:bg-orange-100 active:scale-95">
              {nome}<span className="text-[9px] font-normal text-orange-400">{i + 1}</span>
            </button>
          ))}
          <span className="flex items-center gap-1 rounded-xl border border-slate-200 px-2">
            <select aria-label="Nota do outro acorde" value={raiz} onChange={e => setRaiz(Number(e.target.value))} className="bg-transparent py-1 text-sm font-bold">
              {notas.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
            <select aria-label="Tipo do outro acorde" value={tipo} onChange={e => setTipo(e.target.value)} className="bg-transparent py-1 text-sm">
              {TIPOS_ACORDE.map(t => <option key={t.sufixo} value={t.sufixo}>{t.nome}</option>)}
            </select>
            <button type="button" onClick={() => apertar(`${notas[raiz]}${tipo}`)} aria-label="Pôr o outro acorde" className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"><Plus className="h-4 w-4" /></button>
          </span>
          {versos.length > 0 && (
            <button type="button" onClick={marcarLinha} disabled={proximaLinha >= versos.length}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40" title="Marque quando o próximo verso começar (Enter)">
              <CornerDownLeft className="h-4 w-4" />Próxima linha
            </button>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Dê play e aperte o acorde quando ele entrar (teclas 1–{campo.length}).{versos.length ? " Toque em Próxima linha (Enter) quando cada verso começar." : " Cole a letra para os acordes caírem em cima das sílabas."}</p>
      </div>

      {/* prévia: a letra com os acordes marcados */}
      <div ref={lista} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-sm leading-snug" aria-label="Prévia da cifra">
        {versos.length ? (<>
          {intro.length > 0 && (
            <div className="px-2 py-0.5"><span className="text-xs text-slate-400">Intro </span><span className="font-bold text-orange-600">{intro.map(a => nomeNoTom(a.acorde)).join("  ")}</span></div>
          )}
          {versos.map((v, i) => {
            const ini = escrita.inicios[i] ?? null;
            const prox = escrita.inicios.slice(i + 1).find(x => x !== null && x !== undefined) ?? duracao;
            return (
              <div key={i} data-atual={i === linhaAtual} className={`rounded px-2 py-0.5 ${i === linhaAtual ? "bg-orange-50 ring-1 ring-orange-200" : i === proximaLinha ? "bg-blue-50/60" : ""}`}>
                <div className="min-h-[1.25rem] whitespace-pre font-bold text-orange-600">{ini === null ? "" : acordesDaLinha(escrita.acordes, v, ini, prox, nomeNoTom)}</div>
                <div className={`whitespace-pre-wrap ${ini === null ? "text-slate-400" : "text-slate-800"}`}>{v}</div>
              </div>
            );
          })}
        </>) : (
          <pre className="whitespace-pre-wrap text-slate-700">{escrita.acordes.length ? previa.texto : "Os acordes que você apertar aparecem aqui."}</pre>
        )}
      </div>
    </div>
  );
}
