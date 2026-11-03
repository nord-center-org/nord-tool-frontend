import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toBlob } from "html-to-image";
import { CalendarDays, Download, Loader2, Share2, X } from "lucide-react";

import { agruparEmOrdem, dataHoraBr, type ModoExportacao } from "@/react-app/utils/exportacaoCronograma";

/** Uma demanda já pronta para a imagem (texto e cores resolvidos pela tela). */
export interface DemandaExportada {
  chave: string;
  titulo: string;
  observacao?: string | null;
  status?: string | null;
  statusId?: string | null;
  categoria?: string | null;
  frente?: string | null;
  prazo?: string | null;
  dono?: string | null;
  /** Na rotina: horário, "📌 fixa" ou "Prazo". */
  quando?: string | null;
  riscada?: boolean;
}

export interface DiaExportado {
  data: Date;
  hoje?: boolean;
  foraDoMes?: boolean;
  itens: DemandaExportada[];
}

interface Props {
  modo: ModoExportacao;
  /** Ex.: "Lista de demandas", "Semana de 02/11 a 08/11/2026", "Novembro de 2026". */
  periodo: string;
  filtros: string[];
  autor?: string | null;
  lista?: DemandaExportada[];
  /** Na lista sem ordenação escolhida, agrupa por fila. */
  agruparPorStatus?: boolean;
  dias?: DiaExportado[];
  nomeArquivo: string;
  onFechar: () => void;
}

// Cores fixas da imagem (sempre clara, mesmo com o app no tema escuro).
const COR_STATUS: Record<string, { fundo: string; texto: string; barra: string }> = {
  pendentes: { fundo: "#f1f5f9", texto: "#475569", barra: "#94a3b8" },
  executar: { fundo: "#dbeafe", texto: "#1d4ed8", barra: "#3b82f6" },
  aguardar: { fundo: "#fef3c7", texto: "#b45309", barra: "#f59e0b" },
  acompanhar: { fundo: "#ede9fe", texto: "#6d28d9", barra: "#8b5cf6" },
  finalizada: { fundo: "#d1fae5", texto: "#047857", barra: "#10b981" },
};
const COR_CATEGORIA: Record<string, { fundo: string; texto: string }> = {
  Pessoal: { fundo: "#fce7f3", texto: "#be185d" },
  "Acadêmica": { fundo: "#e0e7ff", texto: "#4338ca" },
  "Atlética": { fundo: "#ffedd5", texto: "#c2410c" },
  Musical: { fundo: "#fae8ff", texto: "#a21caf" },
  Devocional: { fundo: "#fef3c7", texto: "#b45309" },
  Engenharia: { fundo: "#e0f2fe", texto: "#0369a1" },
  "Programação": { fundo: "#d1fae5", texto: "#047857" },
};
const corCategoria = (c?: string | null) => (c && COR_CATEGORIA[c]) || { fundo: "#f1f5f9", texto: "#475569" };
const corStatus = (s?: string | null) => (s && COR_STATUS[s]) || COR_STATUS.pendentes;
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LARGURA: Record<ModoExportacao, number> = { lista: 1080, semana: 1600, mes: 1600 };
/** Limite seguro de altura do canvas nos navegadores de celular. */
const ALTURA_MAX_PX = 15_000;

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span style={{ background: fundo, color: cor }} className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold">{texto}</span>;
}

function Observacao({ texto, pequena = false }: { texto?: string | null; pequena?: boolean }) {
  if (!texto?.trim()) return null;
  return (
    <p className={`mt-1.5 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-2.5 py-1.5 leading-snug text-slate-600 ${pequena ? "text-[11px]" : "text-[13px]"}`}
      style={{ borderLeft: "3px solid #ddd6fe" }}>
      {texto.trim()}
    </p>
  );
}

/** Cartão de demanda da lista. */
function CartaoLista({ d }: { d: DemandaExportada }) {
  const st = corStatus(d.statusId);
  const cat = corCategoria(d.categoria);
  return (
    <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white" style={{ breakInside: "avoid" }}>
      <div style={{ background: st.barra, width: 6 }} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {d.status && <Selo texto={d.status} fundo={st.fundo} cor={st.texto} />}
          {d.categoria && <Selo texto={d.categoria} fundo={cat.fundo} cor={cat.texto} />}
          {d.frente && <span className="text-[11px] font-semibold text-slate-500">· {d.frente}</span>}
          <span className="ml-auto text-[12px] font-bold" style={{ color: d.prazo ? "#059669" : "#94a3b8" }}>{d.prazo ? `Prazo ${d.prazo}` : "Sem prazo"}</span>
        </div>
        <p className="mt-1.5 text-[16px] font-bold leading-snug text-slate-900">{d.titulo}</p>
        {d.dono && <p className="text-[11px] font-semibold text-sky-700">de {d.dono}</p>}
        <Observacao texto={d.observacao} />
      </div>
    </div>
  );
}

/** Compromisso dentro de um dia da rotina. */
function CartaoDia({ d, compacto }: { d: DemandaExportada; compacto: boolean }) {
  const cat = corCategoria(d.categoria);
  return (
    <div className="rounded-xl px-2 py-1.5" style={{ background: cat.fundo, opacity: d.riscada ? 0.45 : 1 }}>
      <div className="flex items-center justify-between gap-1 text-[10px] font-bold" style={{ color: cat.texto }}>
        <span>{d.quando}</span>
        {d.categoria && <span className="truncate">{d.categoria}</span>}
      </div>
      <p className={`font-bold leading-snug text-slate-900 ${compacto ? "text-[11px]" : "text-[13px]"} ${d.riscada ? "line-through" : ""}`}>{d.titulo}</p>
      {d.dono && <p className="text-[10px] font-semibold text-sky-700">de {d.dono}</p>}
      <Observacao texto={d.observacao} pequena />
    </div>
  );
}

/** O desenho da imagem (renderizado fora da tela e convertido em PNG). */
function Folha({ modo, periodo, filtros, autor, lista = [], agruparPorStatus, dias = [], gerado }: Omit<Props, "nomeArquivo" | "onFechar"> & { gerado: Date }) {
  const total = modo === "lista" ? lista.length : dias.filter(d => !d.foraDoMes).reduce((n, d) => n + d.itens.length, 0);
  const grupos = agruparPorStatus ? agruparEmOrdem(lista, d => d.status ?? "Sem fila") : [{ chave: "", itens: lista }];
  return (
    <div data-tema-fixo style={{ width: LARGURA[modo], background: "#f8fafc", color: "#1e293b", fontFamily: "Inter, system-ui, Arial, sans-serif" }}>
      <header className="px-10 pb-7 pt-8 text-white" style={{ background: "linear-gradient(120deg, #7c3aed 0%, #4f46e5 60%, #2563eb 100%)" }}>
        <div className="flex items-center gap-4">
          <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.18)" }}><CalendarDays className="h-8 w-8" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.75)" }}>Cronograma semanal</p>
            <h1 className="text-[30px] font-black leading-tight">{periodo}</h1>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-black leading-none">{total}</p>
            <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>{modo === "lista" ? (total === 1 ? "demanda" : "demandas") : (total === 1 ? "compromisso" : "compromissos")}</p>
          </div>
        </div>
        {filtros.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filtros.map(f => <span key={f} className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: "rgba(255,255,255,0.18)" }}>{f}</span>)}
          </div>
        )}
      </header>

      <main className="px-8 py-7">
        {modo === "lista" && (
          lista.length === 0 ? <p className="py-16 text-center text-[16px] font-semibold text-slate-400">Nenhuma demanda com esses filtros.</p> : (
            <div className="space-y-6">
              {grupos.map(g => (
                <section key={g.chave || "todas"}>
                  {g.chave && (
                    <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-black uppercase tracking-widest" style={{ color: corStatus(g.itens[0]?.statusId).texto }}>
                      {g.chave} <span className="rounded-full bg-white px-2 text-[11px] text-slate-500">{g.itens.length}</span>
                    </h2>
                  )}
                  <div className="space-y-2.5">{g.itens.map(d => <CartaoLista key={d.chave} d={d} />)}</div>
                </section>
              ))}
            </div>
          )
        )}

        {modo === "semana" && (
          <div className="grid grid-cols-7 gap-3">
            {dias.map(dia => (
              <section key={dia.data.toISOString()} className="rounded-2xl border bg-white p-2.5" style={{ borderColor: dia.hoje ? "#7c3aed" : "#e2e8f0", borderWidth: dia.hoje ? 2 : 1 }}>
                <header className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-[12px] font-black uppercase text-slate-500">{DIAS[dia.data.getDay()]}</span>
                  <strong className="text-[20px] font-black" style={{ color: dia.hoje ? "#7c3aed" : "#0f172a" }}>{dia.data.getDate()}</strong>
                </header>
                <div className="space-y-1.5">
                  {dia.itens.map(d => <CartaoDia key={d.chave} d={d} compacto={false} />)}
                  {!dia.itens.length && <p className="rounded-xl border border-dashed border-slate-200 py-3 text-center text-[11px] font-bold uppercase text-slate-300">Livre</p>}
                </div>
              </section>
            ))}
          </div>
        )}

        {modo === "mes" && (
          <div className="grid grid-cols-7 gap-2">
            {DIAS.map(d => <div key={d} className="pb-1 text-center text-[12px] font-black uppercase tracking-wider text-slate-500">{d}</div>)}
            {dias.map(dia => (
              <section key={dia.data.toISOString()} className="min-h-[110px] rounded-xl border bg-white p-1.5"
                style={{ borderColor: dia.hoje ? "#7c3aed" : "#e2e8f0", borderWidth: dia.hoje ? 2 : 1, opacity: dia.foraDoMes ? 0.35 : 1 }}>
                <header className="mb-1 px-0.5 text-[13px] font-black" style={{ color: dia.hoje ? "#7c3aed" : "#334155" }}>{dia.data.getDate()}</header>
                <div className="space-y-1">{dia.itens.map(d => <CartaoDia key={d.chave} d={d} compacto />)}</div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between px-10 pb-7 text-[12px] text-slate-400">
        <span>Gerado em {dataHoraBr(gerado)}{autor ? ` por ${autor}` : ""}</span>
        <span className="font-black tracking-tight"><span className="text-slate-600">Nord</span><span style={{ color: "#4f46e5" }}>Tool</span></span>
      </footer>
    </div>
  );
}

/**
 * Exportar o cronograma em imagem: desenha uma folha caprichada fora da tela, converte em PNG
 * e mostra a prévia com Baixar e (no celular) Compartilhar.
 */
export default function ExportarImagem(props: Props) {
  const { nomeArquivo, onFechar } = props;
  const folha = useRef<HTMLDivElement>(null);
  const [gerado] = useState(() => new Date());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await document.fonts?.ready;
        const el = folha.current?.firstElementChild as HTMLElement | null;
        if (!el) return;
        const altura = el.scrollHeight;
        const escala = Math.max(1, Math.min(2, ALTURA_MAX_PX / Math.max(1, altura)));
        const blob = await toBlob(el, { pixelRatio: escala, backgroundColor: "#f8fafc", cacheBust: true });
        if (!blob) throw new Error("vazio");
        if (!vivo) return;
        const f = new File([blob], nomeArquivo, { type: "image/png" });
        setArquivo(f);
        setUrl(URL.createObjectURL(f));
      } catch {
        if (vivo) setErro("Não foi possível gerar a imagem. Tente de novo.");
      }
    })();
    return () => { vivo = false; };
  }, [nomeArquivo]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const baixar = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
  };
  const podeCompartilhar = arquivo !== null && typeof navigator !== "undefined"
    && typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] });
  const compartilhar = async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], title: "Cronograma semanal" });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setErro("Não foi possível compartilhar. Use Baixar.");
    }
  };

  return (
    <>
      {/* A folha fica fora da tela só para ser fotografada. */}
      {createPortal(
        <div ref={folha} aria-hidden="true" style={{ position: "fixed", left: -100_000, top: 0, pointerEvents: "none" }}>
          <Folha {...props} gerado={gerado} />
        </div>,
        document.body,
      )}
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-3 sm:p-6" onMouseDown={onFechar}>
        <div role="dialog" aria-modal="true" aria-label="Exportar imagem do cronograma" onMouseDown={e => e.stopPropagation()}
          className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">Imagem do cronograma</p>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
          </div>
          <div className="min-h-[200px] flex-1 overflow-auto bg-slate-100 p-3">
            {erro ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
              : url ? <img src={url} alt="Prévia da imagem do cronograma" className="mx-auto w-full rounded-lg shadow-md" />
              : <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-7 w-7 animate-spin text-violet-600" /> Montando a imagem…</div>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
            {podeCompartilhar && (
              <button type="button" onClick={() => void compartilhar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <Share2 className="h-4 w-4" /> Compartilhar
              </button>
            )}
            <button type="button" onClick={baixar} disabled={!url} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              <Download className="h-4 w-4" /> Baixar PNG
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
