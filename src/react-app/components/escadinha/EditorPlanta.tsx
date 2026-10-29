import { ArrowLeftRight, DoorOpen, Merge, MousePointer2, PenLine, RefreshCw, Ruler, Square, SquareDashed, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import Planta2D from "./Planta2D";
import { area, pilares, type Lado, type Pavimento, type Ponto, type Torre } from "@/react-app/utils/escadinha";
import { medidas } from "@/react-app/utils/escadinha3d";
import { cantosDaParede, fmtM, fmtM2, fmtM3, imantar } from "@/react-app/utils/medicao";
import type { TipologiaServidor } from "@/react-app/services/EscadinhaService";
import {
  apartamentoRetangulo, atribuirLados, definirLados, divisaoManual, inverterLados, COR_LADO,
} from "@/react-app/utils/escadinhaApto";

type Modo = "selecionar" | "apartamento" | "divisao" | "medir" | "area";

interface EditorPlantaProps {
  torre: Torre;
  pavimento: Pavimento;
  imagem: string | null;
  editavel: boolean;
  onAlterar: (t: Torre) => void;
  tipologias?: TipologiaServidor[];
  /** Duplo clique (ou botão) abre a vista do apartamento. */
  onAbrirApto?: (id: string) => void;
}

const FONTE_LADO: Record<string, string> = {
  junta: "pela junta de dilatação da prancha",
  automatica: "pelo formato da torre (confira a junta)",
  manual: "definida à mão",
};

/**
 * Planta 2D com edição: selecionar apartamentos (clique; Shift soma), desenhar um apartamento (arrastar),
 * desenhar a divisão dos lados (arrastar de um lado ao outro da torre), inverter A/B e editar nome e lado do apartamento.
 */
export default function EditorPlanta({ torre, pavimento, imagem, editavel, onAlterar, tipologias = [], onAbrirApto }: EditorPlantaProps) {
  const [modo, setModo] = useState<Modo>("selecionar");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [rascunho, setRascunho] = useState<{ tipo: "retangulo" | "linha"; a: Ponto; b: Ponto } | null>(null);
  const tipico = !pavimento.contorno;
  const apartamentos = useMemo(() => torre.apartamentos ?? [], [torre.apartamentos]);
  const lados = torre.lados;
  const escolhidos = apartamentos.filter(a => selecionados.includes(a.id));
  const [medPontos, setMedPontos] = useState<Ponto[]>([]);
  const [medCursor, setMedCursor] = useState<Ponto | null>(null);
  const medindo = modo === "medir" || modo === "area";
  const contornoPav = pavimento.contorno ?? torre.contorno;
  // Ímã: vértices do contorno, dos apartamentos e os pilares (para medir de canto a canto).
  // Ímã da medição: cantos do contorno e dos apartamentos e, com o projeto importado, as faces das paredes reais.
  const vertices = useMemo(() => {
    const faces = tipico && torre.paredes?.length ? torre.paredes.flatMap(cantosDaParede) : pilares(contornoPav);
    return [...contornoPav, ...(tipico ? apartamentos.flatMap(a => a.contorno) : []), ...faces];
  }, [contornoPav, tipico, apartamentos, torre.paredes]);
  const info = useMemo(() => {
    const pav = medidas(contornoPav);
    const privativa = tipico ? apartamentos.reduce((s, a) => s + Math.abs(area(a.contorno)), 0) : 0;
    const esp = torre.espessuraLaje ?? 0.12;
    return { pav, privativa, comum: Math.max(0, pav.area - privativa), esp, volume: pav.area * esp };
  }, [contornoPav, tipico, apartamentos, torre.espessuraLaje]);

  const clicar = (id: string, somar: boolean) => {
    if (modo !== "selecionar") return;
    setSelecionados(s => (somar ? (s.includes(id) ? s.filter(x => x !== id) : [...s, id]) : s.length === 1 && s[0] === id ? [] : [id]));
  };

  const ponteiro = (tipo: "inicio" | "movimento" | "fim", p: Ponto) => {
    if (medindo) {
      const q = imantar(p, vertices, 0.35);
      if (tipo === "movimento") setMedCursor(q);
      if (tipo === "fim") setMedPontos(l => (l.length >= 3 && modo === "area" && Math.hypot(q[0] - l[0][0], q[1] - l[0][1]) < 0.35 ? l : [...l, q]));
      return;
    }
    if (!editavel || modo === "selecionar") {
      if (tipo === "inicio" && modo === "selecionar") setSelecionados([]);
      return;
    }
    if (tipo === "inicio") { setRascunho({ tipo: modo === "divisao" ? "linha" : "retangulo", a: p, b: p }); return; }
    if (!rascunho) return;
    if (tipo === "movimento") { setRascunho({ ...rascunho, b: p }); return; }
    setRascunho(null);
    if (modo === "apartamento") {
      const novo = apartamentoRetangulo(rascunho.a, p, apartamentos, lados);
      if (novo) { onAlterar({ ...torre, apartamentos: [...apartamentos, novo] }); setSelecionados([novo.id]); setModo("selecionar"); }
    } else {
      const divisao = divisaoManual(torre.contorno, rascunho.a, p, lados);
      if (divisao) { onAlterar({ ...torre, lados: divisao, apartamentos: atribuirLados(apartamentos, divisao) }); setModo("selecionar"); }
    }
  };

  const alterarAptos = (mudar: (id: string) => Partial<(typeof apartamentos)[number]> | null) =>
    onAlterar({ ...torre, apartamentos: apartamentos.map(a => (selecionados.includes(a.id) ? { ...a, ...(mudar(a.id) ?? {}) } : a)) });

  const inverter = () => {
    if (!lados) return;
    const novo = inverterLados(lados);
    onAlterar({ ...torre, lados: novo, apartamentos: atribuirLados(apartamentos, novo) });
  };
  const refazerAutomatico = () => {
    const novo = definirLados(torre.contorno, null);
    onAlterar({ ...torre, lados: novo, apartamentos: atribuirLados(apartamentos.map(a => ({ ...a, ladoManual: false })), novo) });
  };
  const excluir = () => { onAlterar({ ...torre, apartamentos: apartamentos.filter(a => !selecionados.includes(a.id)) }); setSelecionados([]); };
  const unir = () => {
    if (escolhidos.length < 2) return;
    // Une pela caixa que envolve os apartamentos escolhidos (bom para a planta chave, de unidades retangulares).
    const xs = escolhidos.flatMap(a => a.contorno.map(p => p[0])), ys = escolhidos.flatMap(a => a.contorno.map(p => p[1]));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const base = [...escolhidos].sort((a, b) => Math.abs(area(b.contorno)) - Math.abs(area(a.contorno)))[0];
    const unido = { ...base, contorno: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Ponto[] };
    onAlterar({ ...torre, apartamentos: [...apartamentos.filter(a => !selecionados.includes(a.id)), unido] });
    setSelecionados([unido.id]);
  };

  const ferramenta = (m: Modo, rotulo: string, Icone: typeof Square) => (
    <button type="button" onClick={() => { setModo(m); setRascunho(null); setMedPontos([]); setMedCursor(null); }} aria-pressed={modo === m} title={rotulo}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${modo === m ? "bg-orange-500 text-white" : "text-slate-200 hover:bg-slate-700"}`}>
      <Icone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{rotulo}</span>
    </button>
  );

  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 p-1">
        {ferramenta("selecionar", "Selecionar", MousePointer2)}
        {ferramenta("medir", "Medir distância", Ruler)}
        {ferramenta("area", "Medir área", SquareDashed)}
        {medindo && medPontos.length > 0 && (
          <button type="button" onClick={() => { setMedPontos([]); setMedCursor(null); }} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-yellow-300 hover:bg-slate-700">Limpar medição</button>
        )}
      </div>
      {tipico && editavel && (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/90 p-1">
          {ferramenta("apartamento", "Desenhar apartamento", Square)}
          {ferramenta("divisao", "Desenhar divisão A/B", PenLine)}
          <span className="mx-1 h-5 w-px bg-slate-700" aria-hidden="true" />
          <button type="button" onClick={inverter} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700" title="Trocar lado A e lado B">
            <ArrowLeftRight className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Inverter A/B</span>
          </button>
          <button type="button" onClick={refazerAutomatico} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700" title="Refazer a divisão pelo formato da torre">
            <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Divisão automática</span>
          </button>
        </div>
      )}
      {tipico && lados && (
        <p className="mb-1 text-[11px] font-semibold text-slate-400">
          Lados {FONTE_LADO[lados.fonte]}. O lado A é o que tem a junta.
          {modo === "divisao" && " Arraste de um lado ao outro da torre para traçar a divisão."}
          {modo === "apartamento" && " Arraste para desenhar o apartamento."}
          {medindo && " Clique ponto a ponto (o ponto gruda nos cantos). Toque no primeiro ponto para fechar a área."}
          {modo === "selecionar" && onAbrirApto && " Dois cliques num apartamento abrem a planta dele."}
        </p>
      )}
      {!tipico && <p className="mb-1 text-[11px] font-semibold text-slate-400">Este pavimento tem outro formato: os apartamentos são marcados no pavimento tipo.</p>}
      <div className="min-h-0 flex-1">
        <Planta2D torre={torre} pavimento={pavimento} imagem={imagem} selecionados={selecionados}
          onClicarApto={tipico && modo === "selecionar" ? clicar : undefined} onAbrirApto={tipico ? onAbrirApto : undefined}
          onPonteiro={tipico || medindo ? ponteiro : undefined} rascunho={rascunho}
          medicao={medindo ? { pontos: medPontos, cursor: medCursor, area: modo === "area" } : null}
          cursor={modo === "selecionar" ? undefined : "crosshair"} />
      </div>
      {escolhidos.length === 0 && !medindo && (
        <div className="absolute bottom-2 left-2 w-60 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 text-[11px] text-slate-200 shadow-xl">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{pavimento.nome}</p>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
            <dt className="text-slate-400">Área do pavimento</dt><dd className="font-bold">{fmtM2(info.pav.area)}</dd>
            {tipico && <><dt className="text-slate-400">Área privativa ({apartamentos.length} aptos)</dt><dd className="font-bold">{fmtM2(info.privativa)}</dd></>}
            {tipico && <><dt className="text-slate-400">Hall e circulação</dt><dd className="font-bold">{fmtM2(info.comum)}</dd></>}
            <dt className="text-slate-400">Perímetro (fachada)</dt><dd className="font-bold">{fmtM(info.pav.perimetro)}</dd>
            <dt className="text-slate-400">Pé-direito</dt><dd className="font-bold">{fmtM(pavimento.altura)}</dd>
            <dt className="flex items-center gap-1 text-slate-400">Laje
              <input type="number" min={0.06} max={0.5} step={0.01} value={info.esp} disabled={!editavel} aria-label="Espessura da laje (m)"
                onChange={e => onAlterar({ ...torre, espessuraLaje: Math.min(0.5, Math.max(0.06, Number(e.target.value) || 0.12)) })}
                className="w-14 rounded border border-slate-600 bg-slate-800 px-1 text-[11px] text-white" /> m
            </dt><dd className="font-bold">{fmtM3(info.volume)}</dd>
          </dl>
          <p className="mt-1 text-[10px] text-slate-500">
            {torre.projeto?.escala
              ? `Medidas do projeto (escala 1:${torre.projeto.escala}); a área privativa depende dos apartamentos desenhados.`
              : "Medidas do croqui: ficam exatas quando o projeto é lido em escala."}
          </p>
        </div>
      )}
      {escolhidos.length > 0 && (
        <div className="absolute bottom-2 left-2 w-64 rounded-2xl border border-slate-700 bg-slate-900/95 p-3 text-slate-100 shadow-xl animate-entrada">
          {escolhidos.length === 1 ? (
            <>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Apartamento</p>
              <input value={escolhidos[0].nome} disabled={!editavel} onChange={e => alterarAptos(() => ({ nome: e.target.value.slice(0, 30) }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm font-bold" aria-label="Nome do apartamento" />
              <p className="mt-1 text-[11px] text-slate-400">
                {fmtM2(medidas(escolhidos[0].contorno).area)} · perímetro {fmtM(medidas(escolhidos[0].contorno).perimetro)} (croqui)
              </p>
              <label className="mt-2 block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Tipologia
                <select value={escolhidos[0].idTipologia ?? ""} disabled={!editavel} onChange={e => alterarAptos(() => ({ idTipologia: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold normal-case tracking-normal text-slate-100">
                  <option value="">Sem tipologia</option>
                  {tipologias.map(t => <option key={t.id} value={t.id}>{t.nmTipologia}</option>)}
                </select>
              </label>
              {onAbrirApto && (
                <button type="button" onClick={() => onAbrirApto(escolhidos[0].id)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-2 py-1.5 text-xs font-bold text-white hover:bg-orange-600">
                  <DoorOpen className="h-3.5 w-3.5" /> Abrir apartamento
                </button>
              )}
            </>
          ) : (
            <p className="text-sm font-bold">{escolhidos.length} apartamentos</p>
          )}
          <div className="mt-2 flex items-center gap-1">
            {(["A", "B"] as Lado[]).map(l => {
              const ativo = escolhidos.every(a => a.lado === l);
              return (
                <button key={l} type="button" disabled={!editavel} onClick={() => alterarAptos(() => ({ lado: l, ladoManual: true }))} aria-pressed={ativo}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-extrabold disabled:opacity-60"
                  style={{ borderColor: COR_LADO[l], background: ativo ? COR_LADO[l] : "transparent", color: ativo ? "#0f172a" : COR_LADO[l] }}>
                  Lado {l}
                </button>
              );
            })}
          </div>
          {escolhidos.some(a => a.ladoManual) && <p className="mt-1 text-[10px] text-slate-400">Lado escolhido à mão (não muda com a divisão).</p>}
          {editavel && (
            <div className="mt-2 flex gap-1">
              {escolhidos.length > 1 && (
                <button type="button" onClick={unir} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-800 px-2 py-1.5 text-xs font-bold hover:bg-slate-700">
                  <Merge className="h-3.5 w-3.5" /> Unir
                </button>
              )}
              <button type="button" onClick={excluir} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-500/15 px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/25">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
