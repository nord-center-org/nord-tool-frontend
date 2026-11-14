import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import { linhaDeAcordes, transporAcordes, type AcordeNaLinha, type Cifra } from "@/react-app/utils/musica/cifra";

export interface ControleCifra {
  /** Atualiza o "karaokê" da linha atual (0–1), sem renderizar de novo. */
  progresso: (fracao: number) => void;
}

interface Props {
  cifra: Cifra;
  tempos: (number | null)[];
  atual: number;
  semitons: number;
  /** Rola sozinha até a linha atual. */
  seguir: boolean;
  /** Modo de marcar: a próxima linha a marcar fica em destaque. */
  marcando: number | null;
  onTocarLinha: (indice: number) => void;
  /** v13: clicar no nome do acorde toca o som dele (no tom que se vê) e acende no braço. */
  onTocarAcorde?: (nome: string) => void;
  tamanhoFonte: number;
}

/**
 * Cifra no estilo do Cifra Club: acordes em laranja sobre a letra, seções em destaque. A linha que está tocando
 * fica marcada e vai se preenchendo; a cifra rola sozinha para ela.
 */
const CifraRolando = forwardRef<ControleCifra, Props>(function CifraRolando({ cifra, tempos, atual, semitons, seguir, marcando, onTocarLinha, onTocarAcorde, tamanhoFonte }, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  const linhas = useRef(new Map<number, HTMLElement>());
  const preenchimento = useRef<HTMLElement | null>(null);

  const blocos = useMemo(() => cifra.blocos.map(b => ({ ...b, acordes: transporAcordes(b.acordes, semitons) })), [cifra, semitons]);

  useImperativeHandle(ref, () => ({
    progresso: f => { const el = preenchimento.current; if (el) el.style.backgroundSize = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}% 100%, 100% 100%`; },
  }), []);

  useEffect(() => {
    preenchimento.current = linhas.current.get(atual)?.querySelector<HTMLElement>("[data-letra]") ?? null;
    const alvo = linhas.current.get(marcando ?? atual);
    const c = caixa.current;
    if (!seguir || !alvo || !c) return;
    // deixa a linha atual a 1/3 da altura (dá para ler as próximas)
    const topo = alvo.offsetTop - c.clientHeight / 3;
    c.scrollTo({ top: Math.max(0, topo), behavior: "smooth" });
  }, [atual, seguir, marcando]);

  return (
    <div ref={caixa} className="relative h-full overflow-y-auto overscroll-contain px-3 py-4 md:px-5" aria-label="Letra e cifra" style={{ fontSize: tamanhoFonte }}>
      {!blocos.length && <p className="text-sm text-slate-500">Sem cifra ainda.</p>}
      {blocos.map((b, i) => {
        const tocando = i === atual, aMarcar = i === marcando;
        const temTempo = tempos[i] !== null && tempos[i] !== undefined;
        const comum = `${b.espacoAntes ? "mt-4" : ""} rounded-lg px-2 transition-colors duration-200`;
        if (b.tipo === "secao") {
          return (
            <div key={i} ref={el => { if (el) linhas.current.set(i, el); else linhas.current.delete(i); }} className={`${comum} ${tocando ? "bg-orange-50" : ""}`}>
              <button type="button" onClick={() => temTempo && onTocarLinha(i)} className="font-mono font-bold text-slate-500" style={{ fontSize: "0.85em" }}>
                [{b.texto}]{b.acordes.length > 0 && <span className="ml-2 text-orange-500">{b.acordes.map((a, k) => <span key={k}>{k > 0 && "  "}<AcordeClicavel nome={a.nome} onTocar={onTocarAcorde} /></span>)}</span>}
              </button>
            </div>
          );
        }
        if (b.tipo === "tab" || b.tipo === "info") {
          return <pre key={i} className={`${comum} whitespace-pre font-mono text-slate-400`} style={{ fontSize: "0.75em" }}>{b.texto}</pre>;
        }
        return (
          <div key={i} ref={el => { if (el) linhas.current.set(i, el); else linhas.current.delete(i); }}
            className={`${comum} cursor-pointer py-0.5 ${tocando ? "bg-orange-50 ring-1 ring-orange-200" : aMarcar ? "bg-blue-50 ring-2 ring-blue-400" : "hover:bg-slate-50"}`}
            onClick={() => onTocarLinha(i)} role="button" tabIndex={-1} aria-current={tocando ? "true" : undefined}>
            {b.acordes.length > 0 && <pre className="whitespace-pre font-mono font-bold leading-tight text-orange-500">{onTocarAcorde ? <LinhaDeAcordesClicavel acordes={b.acordes} onTocar={onTocarAcorde} /> : linhaDeAcordes(b.acordes)}</pre>}
            {b.texto && (
              <pre data-letra className={`whitespace-pre-wrap font-mono leading-snug ${tocando ? "font-bold" : "text-slate-700"}`}
                style={tocando ? { backgroundImage: "linear-gradient(90deg,#ea580c,#ea580c),linear-gradient(90deg,#64748b,#64748b)", backgroundRepeat: "no-repeat", backgroundSize: "0% 100%, 100% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" } : undefined}>
                {b.texto}
              </pre>
            )}
          </div>
        );
      })}
      <div className="h-[50vh]" aria-hidden="true" />
    </div>
  );
});

/** v13: o nome do acorde que toca ao clicar (sem pular a música para a linha). */
function AcordeClicavel({ nome, onTocar }: { nome: string; onTocar?: (nome: string) => void }) {
  if (!onTocar) return <>{nome}</>;
  return (
    <span role="button" tabIndex={0} aria-label={`Ouvir ${nome}`} title="Ouvir o acorde e ver no braço"
      onClick={e => { e.stopPropagation(); onTocar(nome); }} onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onTocar(nome); } }}
      className="cursor-pointer rounded-sm hover:bg-orange-100 hover:text-orange-700">{nome}</span>
  );
}

/** v13: a linha de acordes com cada acorde clicável, nas mesmas colunas do texto. */
function LinhaDeAcordesClicavel({ acordes, onTocar }: { acordes: AcordeNaLinha[]; onTocar: (nome: string) => void }) {
  let fim = 0;
  return (
    <>
      {acordes.map((a, k) => {
        const espaco = " ".repeat(Math.max(k > 0 ? 1 : 0, a.col - fim));
        fim = fim + espaco.length + a.nome.length;
        return <span key={k}>{espaco}<AcordeClicavel nome={a.nome} onTocar={onTocar} /></span>;
      })}
    </>
  );
}

export default CifraRolando;
