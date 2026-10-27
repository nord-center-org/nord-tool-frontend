import { Crop, FileUp, Loader2, ScanSearch, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";

import { contornoEmMetros, CONTORNO_EXEMPLO, montarPavimentos, type OpcoesPavimentos, type Torre } from "@/react-app/utils/escadinha";
import { analisarProjeto, type ProjetoAnalisado } from "@/react-app/utils/escadinhaPdf";
import { detectarContorno, type Recorte } from "@/react-app/utils/escadinhaPlanta";

interface AnexarProjetoProps {
  inicial: OpcoesPavimentos;
  onFechar: () => void;
  onConfirmar: (torre: Torre) => void;
}

/** Anexa a prancha (PDF), mostra a torre e os pavimentos encontrados e deixa ajustar antes de montar o 3D. */
export default function AnexarProjeto({ inicial, onFechar, onConfirmar }: AnexarProjetoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const arquivoAtual = useRef<File | null>(null);
  const [analise, setAnalise] = useState<ProjetoAnalisado | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesPavimentos>(inicial);
  const [largura, setLargura] = useState(32);
  const [recortando, setRecortando] = useState(false);
  const [arrasto, setArrasto] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const caixa = useRef<SVGSVGElement>(null);

  const ler = async (arquivo: File, pagina?: number) => {
    setErro(null);
    setLendo(true);
    try {
      const r = await analisarProjeto(arquivo, pagina);
      arquivoAtual.current = arquivo;
      setAnalise(r);
      const p = r.pavimentos;
      setOpcoes(o => ({
        ...o,
        tipos: p.tipos ?? o.tipos,
        subsolos: p.subsolos,
        terreo: p.terreo || o.terreo,
        mezanino: p.mezanino,
        cobertura: p.cobertura,
        barrilete: p.barrilete || o.barrilete,
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o PDF.");
    } finally {
      setLendo(false);
    }
  };

  const ponto = (e: PointerEvent<SVGSVGElement>) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * analise!.largura, y: ((e.clientY - r.top) / r.height) * analise!.altura };
  };

  const terminarRecorte = () => {
    if (!arrasto || !analise) return;
    const recorte: Recorte = {
      x: Math.min(arrasto.x0, arrasto.x1), y: Math.min(arrasto.y0, arrasto.y1),
      largura: Math.abs(arrasto.x1 - arrasto.x0), altura: Math.abs(arrasto.y1 - arrasto.y0),
    };
    setArrasto(null);
    setRecortando(false);
    if (recorte.largura < 20 || recorte.altura < 20) return;
    const deteccao = detectarContorno(analise.lum, analise.largura, analise.altura, { recorte });
    setAnalise({ ...analise, deteccao });
    if (!deteccao) setErro("Não achamos um contorno fechado nessa área. Tente uma área um pouco maior que a torre.");
    else setErro(null);
  };

  const confirmar = () => {
    const contornoPx = analise?.deteccao?.contorno;
    const contorno = contornoPx ? contornoEmMetros(contornoPx, largura) : CONTORNO_EXEMPLO;
    onConfirmar({
      nome: analise ? analise.arquivo.replace(/\.pdf$/i, "") : "Torre",
      contorno,
      pavimentos: montarPavimentos(opcoes, contorno),
      origem: analise ? "projeto" : "exemplo",
      arquivo: analise?.arquivo,
      planta: analise && contornoPx ? { imagem: analise.imagem, largura: analise.largura, altura: analise.altura, contornoPx } : undefined,
    });
  };

  const lidos = analise?.pavimentos;
  const caixaSel = arrasto && { x: Math.min(arrasto.x0, arrasto.x1), y: Math.min(arrasto.y0, arrasto.y1), w: Math.abs(arrasto.x1 - arrasto.x0), h: Math.abs(arrasto.y1 - arrasto.y0) };
  const numero = (campo: "tipos" | "subsolos", max: number) => (
    <input type="number" min={0} max={max} value={opcoes[campo]}
      onChange={e => setOpcoes({ ...opcoes, [campo]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-anexar"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="titulo-anexar" className="text-lg font-bold text-slate-800">Anexar projeto da torre</h3>
            <p className="text-sm text-slate-500">Envie a prancha em PDF: o NordTool acha o contorno da torre e quantos pavimentos ela tem.</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_18rem]">
          <div className="min-h-[18rem]">
            {!analise ? (
              <button type="button" onClick={() => entrada.current?.click()} disabled={lendo}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void ler(f); }}
                className="flex h-full min-h-[18rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500 hover:border-blue-400 hover:bg-blue-50/40">
                {lendo ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <FileUp className="h-8 w-8 text-blue-600" />}
                <span className="text-sm font-bold text-slate-700">{lendo ? "Lendo a prancha…" : "Escolher ou arrastar o PDF da prancha"}</span>
                <span className="text-xs">Planta chave ou planta do pavimento tipo · até 15 MB</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <img src={analise.imagem} alt={`Prancha ${analise.arquivo}`} className="block w-full select-none" draggable={false} />
                  <svg ref={caixa} viewBox={`0 0 ${analise.largura} ${analise.altura}`} className={`absolute inset-0 h-full w-full ${recortando ? "cursor-crosshair" : ""}`}
                    onPointerDown={e => { if (!recortando) return; const p = ponto(e); e.currentTarget.setPointerCapture(e.pointerId); setArrasto({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
                    onPointerMove={e => { if (arrasto) { const p = ponto(e); setArrasto({ ...arrasto, x1: p.x, y1: p.y }); } }}
                    onPointerUp={terminarRecorte}>
                    {analise.deteccao && (
                      <polygon points={analise.deteccao.contorno.map(p => p.join(",")).join(" ")} fill="rgba(251,146,60,0.25)" stroke="#ea580c" strokeWidth={analise.largura / 250} />
                    )}
                    {caixaSel && <rect x={caixaSel.x} y={caixaSel.y} width={caixaSel.w} height={caixaSel.h} fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth={analise.largura / 400} strokeDasharray="8 6" />}
                  </svg>
                  {lendo && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" onClick={() => { setRecortando(r => !r); setArrasto(null); }}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold ${recortando ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    <Crop className="h-4 w-4" /> {recortando ? "Arraste em volta da torre" : "Delimitar a torre"}
                  </button>
                  <button type="button" onClick={() => entrada.current?.click()} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50">
                    <FileUp className="h-4 w-4" /> Outro PDF
                  </button>
                  {analise.paginas > 1 && (
                    <label className="flex items-center gap-1.5 text-slate-500">
                      Página
                      <select value={analise.pagina} onChange={e => arquivoAtual.current && void ler(arquivoAtual.current, Number(e.target.value))}
                        className="rounded-xl border border-slate-200 px-2 py-1.5 text-sm">
                        {Array.from({ length: Math.min(analise.paginas, 30) }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            )}
            <input ref={entrada} type="file" accept="application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void ler(f); e.target.value = ""; }} />
            {erro && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          </div>

          <div className="space-y-4">
            {analise && (
              <div role="status" className={`rounded-2xl border px-3 py-2.5 text-sm ${analise.deteccao ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <p className="flex items-center gap-1.5 font-bold"><ScanSearch className="h-4 w-4" /> O que achamos</p>
                <p>{analise.deteccao ? `Contorno com ${analise.deteccao.contorno.length} lados.` : "Contorno não encontrado: use \"Delimitar a torre\"."}</p>
                <p>{lidos?.tipos ? `${lidos.tipos} pavimentos tipo na prancha.` : "A prancha não diz quantos pavimentos: informe abaixo."}</p>
              </div>
            )}
            <label className="block space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Pavimentos tipo</span>
              {numero("tipos", 120)}
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Subsolos</span>
              {numero("subsolos", 6)}
            </label>
            <fieldset className="space-y-1">
              <legend className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Pavimentos diferentes</legend>
              {([["terreo", "Térreo"], ["mezanino", "Mezanino"], ["cobertura", "Cobertura"], ["barrilete", "Barrilete / casa de máquinas"]] as const).map(([campo, rotulo]) => (
                <label key={campo} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={opcoes[campo]} onChange={e => setOpcoes({ ...opcoes, [campo]: e.target.checked })} className="h-4 w-4 rounded" />
                  {rotulo}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Largura (m)</span>
                <input type="number" min={5} max={300} step={0.5} value={largura} onChange={e => setLargura(Math.max(5, Number(e.target.value) || 5))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Pé-direito (m)</span>
                <input type="number" min={2.4} max={6} step={0.05} value={opcoes.peDireito ?? 2.9}
                  onChange={e => setOpcoes({ ...opcoes, peDireito: Math.max(2.4, Math.min(6, Number(e.target.value) || 2.9)) })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            <p className="text-xs text-slate-400">A largura é a medida real da torre de um lado ao outro na prancha (a escala do desenho não vem no PDF).</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={lendo || (opcoes.tipos < 1 && !opcoes.terreo)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {analise?.deteccao ? "Montar torre 3D" : "Montar com o contorno de exemplo"}
          </button>
        </div>
      </div>
    </div>
  );
}
