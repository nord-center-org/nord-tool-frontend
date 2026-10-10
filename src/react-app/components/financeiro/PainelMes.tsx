import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Lock, Pencil, Unlock, XCircle } from "lucide-react";

import type { FinanceiroProjecaoLinha, FinanceiroProjecaoMes } from "@/shared/types";
import { formatarMoeda } from "@/react-app/utils/casamento";
import { rotuloMes } from "@/react-app/utils/financeiro";
import { ROTULO_ORIGEM, ehEstimado, textoFolga, textoPrevistos } from "@/react-app/utils/financeiroConta";
import { lerValor } from "@/react-app/utils/caixinha";

interface PainelMesProps {
  mes: FinanceiroProjecaoMes;
  /** Painel do mês corrente: o saldo final ganha destaque. */
  destaque?: boolean;
  ocupado?: boolean;
  onExportar?: () => void;
  onFechar?: () => void;
  onReabrir?: () => void;
  onSaldoInicial?: (valor: number | null) => Promise<string | null>;
}

function Tabela({ titulo, linhas, total, cor }: { titulo: string; linhas: FinanceiroProjecaoLinha[]; total: number; cor: "verde" | "vermelho" }) {
  const cabecalho = cor === "verde" ? "bg-green-600" : "bg-red-600";
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`${cabecalho} text-left text-white`}>
          <th className="rounded-tl-lg px-3 py-1.5 font-bold">{titulo}</th>
          <th className="rounded-tr-lg px-3 py-1.5 text-right font-bold">Valor</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => {
          const estimado = ehEstimado(l);
          return (
            <tr key={l.idCategoria} className="border-b border-slate-100">
              <td className="px-3 py-1.5 text-slate-700">
                {l.nmCategoria}
                {estimado && (
                  <span title={l.detalhe} className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    estimado · {ROTULO_ORIGEM[l.origem as keyof typeof ROTULO_ORIGEM] ?? l.origem}
                  </span>
                )}
              </td>
              <td className={`px-3 py-1.5 text-right tabular-nums ${estimado ? "italic text-slate-500" : "font-semibold text-slate-800"}`}>{formatarMoeda(l.projetado)}</td>
            </tr>
          );
        })}
        {linhas.length === 0 && <tr><td colSpan={2} className="px-3 py-3 text-center text-slate-400">Nada neste mês</td></tr>}
        <tr className="bg-slate-50 font-bold text-slate-900">
          <td className="px-3 py-1.5">Total</td>
          <td className="px-3 py-1.5 text-right tabular-nums">{formatarMoeda(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** O "fechamento do mês" da planilha: entradas, saídas e o saldo final verde ou vermelho. */
export default function PainelMes({ mes, destaque, ocupado, onExportar, onFechar, onReabrir, onSaldoInicial }: PainelMesProps) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const verde = mes.situacao === "VERDE";
  const previstos = textoPrevistos(mes.qtPrevistos);

  const salvarSaldo = async (limpar: boolean) => {
    const valor = limpar ? null : lerValor(texto);
    if (!limpar && valor === null && texto.trim() !== "0" && texto.trim() !== "0,00") return setErro("Informe um valor.");
    const mensagem = await onSaldoInicial?.(valor);
    if (mensagem) setErro(mensagem);
    else { setEditando(false); setErro(null); }
  };

  return (
    <article aria-label={rotuloMes(mes.competencia)} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <h3 className="text-base font-bold">Fechamento de {rotuloMes(mes.competencia)}</h3>
        <span className="flex items-center gap-2">
          {onExportar && (
            <button type="button" onClick={onExportar} aria-label={`Exportar ${rotuloMes(mes.competencia)} para planilha`} title="Exportar para planilha"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"><Download className="h-4 w-4" /></button>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${mes.fechado ? "bg-slate-700 text-slate-200" : "bg-blue-500/20 text-blue-200"}`}>
            {mes.fechado ? <><Lock className="h-3 w-3" /> Fechado</> : mes.estimado ? "Em projeção" : "A fechar"}
          </span>
        </span>
      </header>

      <div className="space-y-4 p-4">
        {mes.comSaldoAnterior && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-600">Saldo anterior</span>
            {editando ? (
              <span className="flex items-center gap-2">
                <input autoFocus aria-label="Saldo inicial" value={texto} onChange={e => setTexto(e.target.value)} inputMode="decimal"
                  className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm" />
                <button type="button" onClick={() => void salvarSaldo(false)} className="text-xs font-bold text-blue-600 hover:underline">Salvar</button>
                <button type="button" onClick={() => void salvarSaldo(true)} className="text-xs font-bold text-slate-500 hover:underline">Usar o calculado</button>
                <button type="button" onClick={() => { setEditando(false); setErro(null); }} className="text-xs text-slate-400 hover:underline">Cancelar</button>
              </span>
            ) : (
              <span className="flex items-center gap-2 font-bold tabular-nums text-slate-800">
                {formatarMoeda(mes.saldoAnterior ?? 0)}
                {onSaldoInicial && !mes.fechado && (
                  <button type="button" aria-label="Corrigir saldo anterior" onClick={() => { setTexto(String(mes.saldoAnterior ?? 0).replace(".", ",")); setEditando(true); }}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200"><Pencil className="h-3.5 w-3.5" /></button>
                )}
              </span>
            )}
          </div>
        )}
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
          <Tabela titulo="Entradas" linhas={mes.entradas} total={mes.totalEntradas} cor="verde" />
          <Tabela titulo="Saídas" linhas={mes.saidas} total={mes.totalSaidas} cor="vermelho" />
        </div>

        <div className={`rounded-xl border p-4 ${verde ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div>
              <p className={`flex items-center gap-1.5 text-sm font-bold ${verde ? "text-green-800" : "text-red-800"}`}>
                {verde ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                Saldo {mes.fechado ? "final" : "projetado"} · {verde ? "no verde" : "no vermelho"}
              </p>
              {mes.metaSaldo !== null && mes.folga !== null && (
                <p className="mt-0.5 text-xs text-slate-600">{textoFolga(mes.folga, mes.metaSaldo, formatarMoeda)}</p>
              )}
            </div>
            <p className={`font-black tabular-nums tracking-tight ${destaque ? "text-5xl" : "text-3xl"} ${verde ? "text-green-700" : "text-red-700"}`}>
              {formatarMoeda(mes.saldoFinal)}
            </p>
          </div>
          {previstos && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> {previstos}
            </p>
          )}
        </div>

        {(onFechar || onReabrir) && (
          <div className="flex justify-end">
            {mes.fechado ? (
              <button type="button" disabled={ocupado} onClick={onReabrir} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} Reabrir mês
              </button>
            ) : (
              <button type="button" disabled={ocupado} onClick={onFechar} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Fechar mês
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
