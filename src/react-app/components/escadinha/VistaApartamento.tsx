import { ArrowLeft, ImagePlus, Loader2, RotateCw, Ruler, SquareDashed } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import CamadaMedicao from "./CamadaMedicao";
import { escadinhaService, type TipologiaServidor } from "@/react-app/services/EscadinhaService";
import { calcularDimensoes } from "@/react-app/utils/imagem";
import { limites, type Apartamento, type Pavimento, type Ponto } from "@/react-app/utils/escadinha";
import { medidas } from "@/react-app/utils/escadinha3d";
import { COR_STATUS, LEGENDA, type StatusCelula } from "@/react-app/utils/escadinhaCury";
import { fmtM, fmtM2, imantar } from "@/react-app/utils/medicao";

interface VistaApartamentoProps {
  apto: Apartamento;
  pavimento: Pavimento;
  idTorre: number | null;
  editavel: boolean;
  tipologias: TipologiaServidor[];
  /** Atividades deste pavimento/lado com o status calculado (na ordem da escadinha). */
  atividades: { nome: string; status: StatusCelula }[];
  onTipologias: () => void;
  onEscolherTipologia: (idTipologia: number | null) => void;
  onVoltar: () => void;
}

const ROTULO = Object.fromEntries(LEGENDA.map(l => [l.status, l.rotulo])) as Record<StatusCelula, string>;

/** Lê a imagem, reduz para no máximo 1800 px e devolve um JPEG em data URL (a planta da tipologia). */
async function imagemReduzida(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const { width, height } = calcularDimensoes(img.naturalWidth, img.naturalHeight, 1800);
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Não foi possível ler a imagem");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Apartamento aberto (duplo clique na planta): a planta da tipologia sobre o contorno do croqui, medição de distância
 * e de área com ímã nos cantos, e o que já foi executado neste pavimento/lado.
 */
export default function VistaApartamento({ apto, pavimento, idTorre, editavel, tipologias, atividades, onTipologias, onEscolherTipologia, onVoltar }: VistaApartamentoProps) {
  const svg = useRef<SVGSVGElement>(null);
  const [modo, setModo] = useState<"ver" | "medir" | "area">("ver");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [cursor, setCursor] = useState<Ponto | null>(null);
  const [imagem, setImagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [giro, setGiro] = useState(0);
  const [opacidade, setOpacidade] = useState(0.85);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeNova, setNomeNova] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  const tipologia = tipologias.find(t => t.id === apto.idTipologia) ?? null;
  const lim = limites(apto.contorno);
  const margem = Math.max(lim.largura, lim.profundidade) * 0.12;
  const escala = Math.max(lim.largura, lim.profundidade);
  const traco = escala / 260;
  const m = medidas(apto.contorno);
  const pts = (c: Ponto[]) => c.map(([x, y]) => `${x},${-y}`).join(" ");

  useEffect(() => {
    setImagem(null);
    if (!tipologia?.temImagem) return;
    let vivo = true;
    setCarregando(true);
    escadinhaService.imagemTipologia(tipologia.id).then(i => { if (vivo) setImagem(i); }).catch(() => undefined).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [tipologia?.id, tipologia?.temImagem]);

  const vertices = useMemo(() => apto.contorno, [apto.contorno]);
  const paraMetros = (e: PointerEvent<SVGSVGElement>): Ponto | null => {
    const mtx = svg.current?.getScreenCTM();
    if (!mtx) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(mtx.inverse());
    return imantar([Math.round(p.x * 100) / 100, Math.round(-p.y * 100) / 100], vertices, escala / 40);
  };

  const enviarImagem = async (f: File, id?: number) => {
    if (!idTorre) { setErro("Salve a torre antes de anexar tipologias."); return; }
    setErro(null);
    setCarregando(true);
    try {
      const dado = await imagemReduzida(f);
      const nome = id ? tipologias.find(t => t.id === id)?.nmTipologia ?? "Tipologia" : nomeNova.trim() || `Tipo ${tipologias.length + 1}`;
      const salvo = await escadinhaService.salvarTipologia(idTorre, { nmTipologia: nome, imagem: dado }, id);
      setNomeNova("");
      onTipologias();
      onEscolherTipologia(salvo.id);
      setImagem(dado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar a imagem");
    } finally {
      setCarregando(false);
    }
  };

  const cx = (lim.minX + lim.maxX) / 2, cy = -(lim.minY + lim.maxY) / 2;
  const deitado = giro % 180 !== 0;
  const [iw, ih] = deitado ? [lim.profundidade, lim.largura] : [lim.largura, lim.profundidade];
  const botao = (ativo: boolean) => `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${ativo ? "bg-orange-500 text-white" : "text-slate-200 hover:bg-slate-700"}`;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950 animate-aparecer">
      <div className="flex flex-wrap items-center gap-3 p-4 pb-2">
        <button type="button" onClick={onVoltar} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700">
          <ArrowLeft className="h-4 w-4" /> Pavimento
        </button>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">{pavimento.nome} · Lado {apto.lado}</p>
          <h3 className="text-lg font-bold text-white">{apto.nome}{tipologia ? ` · ${tipologia.nmTipologia}` : ""}</h3>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 p-1">
          <button type="button" onClick={() => { setModo("ver"); setPontos([]); }} className={botao(modo === "ver")}>Ver</button>
          <button type="button" onClick={() => { setModo("medir"); setPontos([]); }} className={botao(modo === "medir")}><Ruler className="h-3.5 w-3.5" /> Distância</button>
          <button type="button" onClick={() => { setModo("area"); setPontos([]); }} className={botao(modo === "area")}><SquareDashed className="h-3.5 w-3.5" /> Área</button>
          {imagem && <button type="button" onClick={() => setGiro(g => (g + 90) % 360)} className={botao(false)} title="Girar a planta da tipologia"><RotateCw className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 lg:flex-row">
        <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <svg ref={svg} viewBox={`${lim.minX - margem} ${-lim.maxY - margem} ${lim.largura + margem * 2} ${lim.profundidade + margem * 2}`}
            className="h-full w-full touch-none select-none" style={{ cursor: modo === "ver" ? undefined : "crosshair" }}
            onPointerMove={e => { if (modo !== "ver") setCursor(paraMetros(e)); }}
            onPointerUp={e => { if (modo === "ver") return; const p = paraMetros(e); if (p) setPontos(l => [...l, p]); }}
            role="img" aria-label={`Planta do ${apto.nome}`}>
            {imagem && (
              <g opacity={opacidade} transform={`rotate(${giro} ${cx} ${cy})`}>
                <image href={imagem} x={cx - iw / 2} y={cy - ih / 2} width={iw} height={ih} preserveAspectRatio="none" />
              </g>
            )}
            <polygon points={pts(apto.contorno)} fill={imagem ? "none" : "rgba(251,146,60,0.12)"} stroke="#fb923c" strokeWidth={traco * 2.5} strokeLinejoin="round" />
            {modo !== "ver" && <CamadaMedicao pontos={pontos} cursor={cursor} area={modo === "area"} fonte={escala * 0.03} traco={traco} />}
          </svg>
          {carregando && <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-slate-400" aria-label="Carregando" />}
          {modo !== "ver" && pontos.length > 0 && (
            <button type="button" onClick={() => setPontos([])} className="absolute bottom-3 left-3 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-yellow-300">Limpar medição</button>
          )}
          {!imagem && !carregando && (
            <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-400">Anexe a planta da tipologia para ver os ambientes por cima do contorno.</p>
          )}
        </div>

        <aside className="w-full shrink-0 space-y-3 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-3 text-slate-200 lg:w-72">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-xs">
            <dt className="text-slate-400">Área (croqui)</dt><dd className="font-bold">{fmtM2(m.area)}</dd>
            <dt className="text-slate-400">Perímetro</dt><dd className="font-bold">{fmtM(m.perimetro)}</dd>
            <dt className="text-slate-400">Pé-direito</dt><dd className="font-bold">{fmtM(pavimento.altura)}</dd>
            <dt className="text-slate-400">Volume do ambiente</dt><dd className="font-bold">{(m.area * pavimento.altura).toFixed(1).replace(".", ",")} m³</dd>
          </dl>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Tipologia</p>
            <select value={apto.idTipologia ?? ""} disabled={!editavel} onChange={e => onEscolherTipologia(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100">
              <option value="">Sem tipologia</option>
              {tipologias.map(t => <option key={t.id} value={t.id}>{t.nmTipologia}{t.temImagem ? "" : " (sem imagem)"}</option>)}
            </select>
            {imagem && (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">Transparência
                <input type="range" min={0.2} max={1} step={0.05} value={opacidade} onChange={e => setOpacidade(Number(e.target.value))} className="flex-1" />
              </label>
            )}
            {editavel && (
              <div className="mt-2 space-y-1.5">
                {tipologia && (
                  <button type="button" onClick={() => { arquivo.current?.setAttribute("data-id", String(tipologia.id)); arquivo.current?.click(); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1.5 text-xs font-bold hover:bg-slate-800">
                    <ImagePlus className="h-3.5 w-3.5" /> {tipologia.temImagem ? "Trocar a planta" : "Anexar a planta"}
                  </button>
                )}
                <div className="flex gap-1">
                  <input value={nomeNova} onChange={e => setNomeNova(e.target.value.slice(0, 60))} placeholder="Nova tipologia (ex.: Tipo 2 dorm.)"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100" aria-label="Nome da nova tipologia" />
                  <button type="button" onClick={() => { arquivo.current?.removeAttribute("data-id"); arquivo.current?.click(); }}
                    className="rounded-lg bg-orange-500 px-2 py-1.5 text-xs font-bold text-white hover:bg-orange-600" title="Criar com a imagem da planta">
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; const id = e.target.getAttribute("data-id"); e.target.value = ""; if (f) void enviarImagem(f, id ? Number(id) : undefined); }} />
              </div>
            )}
            {erro && <p role="alert" className="mt-1 text-[11px] text-red-400">{erro}</p>}
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Andamento deste lado</p>
            <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
              {atividades.filter(a => a.status !== "bloqueado" && a.status !== "vazio").map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px]" title={ROTULO[a.status]}>
                  <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COR_STATUS[a.status] }} />
                  <span className="leading-snug text-slate-300">{a.nome.toLowerCase()}</span>
                </li>
              ))}
              {atividades.every(a => a.status === "bloqueado" || a.status === "vazio") && <li className="text-[11px] text-slate-500">Nada começou neste lado ainda.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
