import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Pencil, Send, Sparkles, X } from "lucide-react";

import { CronogramaSemanalService, type RascunhoDemanda } from "../../services/CronogramaSemanalService";
import { quandoDoRascunho } from "../../utils/rascunhoDemanda";

interface ChatDemandaProps {
  /** Hoje na tela (AAAA-MM-DD), para "amanhã", "sexta que vem"... */
  hoje: string;
  onFechar: () => void;
  /** Salva a demanda (uma por dia se for fixa). */
  onCriar: (rascunho: RascunhoDemanda) => Promise<void>;
  /** Abre o formulário já preenchido para ajustar antes de salvar. */
  onRevisar: (rascunho: RascunhoDemanda) => void;
}

interface Mensagem {
  papel: "eu" | "lugia";
  texto: string;
  demandas?: RascunhoDemanda[];
}

const EXEMPLOS = [
  "Reunião de obra toda segunda e quarta às 9h",
  "Entregar o relatório de medição na sexta, prazo dia 6",
  "Ligar para o fornecedor de blocos amanhã às 14h",
];

/**
 * Chat da Lugia no cronograma: a pessoa escreve o que quer programar e recebe a demanda montada (título, categoria,
 * dias, horário, prazo) para criar com um clique ou revisar no formulário. Mensagens seguintes ajustam o pedido.
 */
export default function ChatDemanda({ hoje, onFechar, onCriar, onRevisar }: ChatDemandaProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [criadas, setCriadas] = useState<Set<RascunhoDemanda>>(new Set());
  const [criando, setCriando] = useState<RascunhoDemanda | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens, pensando]);

  const enviar = async (pedido: string) => {
    const limpo = pedido.trim();
    if (!limpo || pensando) return;
    const anteriores = mensagens.filter(m => m.papel === "eu").map(m => m.texto).slice(-6);
    setMensagens(l => [...l, { papel: "eu", texto: limpo }]);
    setTexto("");
    setErro(null);
    setPensando(true);
    try {
      const r = await CronogramaSemanalService.interpretar(limpo, anteriores, hoje);
      setMensagens(l => [...l, { papel: "lugia", texto: r.mensagem, demandas: r.demandas }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A Lugia não respondeu agora. Tente de novo.");
    } finally {
      setPensando(false);
    }
  };

  const criar = async (r: RascunhoDemanda) => {
    setErro(null);
    setCriando(r);
    try {
      await onCriar(r);
      setCriadas(s => new Set(s).add(r));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a demanda.");
    } finally {
      setCriando(null);
    }
  };

  const criarTodas = async (lista: RascunhoDemanda[]) => {
    for (const r of lista.filter(r => !criadas.has(r))) await criar(r);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onMouseDown={onFechar}>
      <aside role="dialog" aria-modal="true" aria-labelledby="titulo-chat-demanda" onMouseDown={e => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-violet-600 p-2 text-white"><Sparkles size={16} /></span>
            <div>
              <h2 id="titulo-chat-demanda" className="text-base font-bold text-slate-800">Criar com a Lugia</h2>
              <p className="text-xs text-slate-500">Escreva o que quer programar; ela monta a demanda.</p>
            </div>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!mensagens.length && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Pode escrever do seu jeito: o que é, quando, se repete toda semana, prazo, para quem…</p>
              {EXEMPLOS.map(e => (
                <button key={e} onClick={() => void enviar(e)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:border-violet-300 hover:bg-violet-50">
                  {e}
                </button>
              ))}
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={m.papel === "eu" ? "flex justify-end" : ""}>
              <div className={m.papel === "eu" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-sm text-white" : "space-y-2"}>
                {m.papel === "eu" ? m.texto : (
                  <>
                    <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-700">{m.texto}</p>
                    {m.demandas?.map((d, j) => {
                      const quando = quandoDoRascunho(d);
                      const feita = criadas.has(d);
                      return (
                        <article key={j} className={`rounded-2xl border p-3 ${feita ? "border-emerald-200 bg-emerald-50" : "border-violet-200 bg-white"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-800">{d.nmCronogramaSemanal}</h3>
                            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">{d.nmCategoria}</span>
                          </div>
                          {quando && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><CalendarClock size={12} /> {quando}</p>}
                          {d.txObservacao && <p className="mt-1 text-xs text-slate-500">{d.txObservacao}</p>}
                          {d.nmTag && <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">#{d.nmTag}</p>}
                          <div className="mt-2 flex gap-2">
                            {feita ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Criada</span>
                            ) : (
                              <>
                                <button onClick={() => void criar(d)} disabled={!!criando}
                                  className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                                  {criando === d ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Criar demanda
                                </button>
                                <button onClick={() => onRevisar(d)}
                                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                  <Pencil size={12} /> Revisar
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {(m.demandas?.filter(d => !criadas.has(d)).length ?? 0) > 1 && (
                      <button onClick={() => void criarTodas(m.demandas ?? [])} disabled={!!criando}
                        className="text-xs font-bold text-violet-600 hover:underline disabled:opacity-50">
                        Criar todas ({m.demandas?.filter(d => !criadas.has(d)).length})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {pensando && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> A Lugia está montando…</p>}
          {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div ref={fim} />
        </div>

        <form className="flex items-end gap-2 border-t border-slate-100 px-4 py-3" onSubmit={e => { e.preventDefault(); void enviar(texto); }}>
          <label htmlFor="pedido-demanda" className="sr-only">O que você quer programar?</label>
          <textarea id="pedido-demanda" value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={2000} autoFocus
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto); } }}
            placeholder={mensagens.length ? "Ajuste ou peça outra demanda…" : "O que você quer programar?"}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-600" />
          <button type="submit" disabled={!texto.trim() || pensando} aria-label="Enviar"
            className="rounded-xl bg-violet-600 p-3 text-white hover:bg-violet-700 disabled:opacity-50"><Send size={16} /></button>
        </form>
      </aside>
    </div>
  );
}
