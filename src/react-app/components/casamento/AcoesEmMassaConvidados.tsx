import { useMemo, useState } from "react";
import { Users, X } from "lucide-react";

import type { CasamentoConvidado, StatusConvidado } from "@/shared/types";
import type { ConvidadoForm } from "@/react-app/services/CasamentoService";
import { ROTULO_STATUS_CONVIDADO, opcoesPrincipalEmMassa, papeisDoCortejo } from "@/react-app/utils/convidados";

interface Props {
  selecionados: CasamentoConvidado[];
  todos: CasamentoConvidado[];
  grupos: string[];
  ocupado: boolean;
  /** Altera todos os selecionados de uma vez; `descricao` entra no aviso de sucesso. */
  onAplicar: (alteracao: Partial<ConvidadoForm>, descricao: string) => void;
  onLimpar: () => void;
}

const classeCampo = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-400";
const classeBotao = "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50";

/** Barra que aparece com convidados marcados: muda status, ligação, grupo, mesa e cortejo de todos de uma vez. */
export default function AcoesEmMassaConvidados({ selecionados, todos, grupos, ocupado, onAplicar, onLimpar }: Props) {
  const [status, setStatus] = useState<StatusConvidado>("CONFIRMADO");
  const [principal, setPrincipal] = useState("");
  const [grupo, setGrupo] = useState("");
  const [mesa, setMesa] = useState("");
  const [cortejo, setCortejo] = useState("");

  const n = selecionados.length;
  const opcoes = useMemo(
    () => opcoesPrincipalEmMassa(todos, selecionados.map(c => c.idConvidado))
      .sort((a, b) => a.nmConvidado.localeCompare(b.nmConvidado, "pt-BR", { sensitivity: "base" })),
    [todos, selecionados],
  );
  const papeis = useMemo(() => papeisDoCortejo(todos), [todos]);

  /** Campo de texto: vazio limpa o valor dos selecionados (com confirmação). */
  const aplicarTexto = (rotulo: string, valor: string, chave: "nmGrupo" | "nmMesa" | "nmCortejo") => {
    const v = valor.trim();
    if (v === "" && !window.confirm(`Limpar ${rotulo} de ${n} convidado(s)?`)) return;
    onAplicar({ [chave]: v }, v === "" ? `${rotulo} removido` : `${rotulo}: ${v}`);
  };

  const aplicarPrincipal = () => {
    if (principal === "") return;
    if (principal === "solto") {
      if (!window.confirm(`Soltar ${n} convidado(s) (deixam de ser acompanhantes)?`)) return;
      onAplicar({ idConvidadoPrincipal: null }, "sem ligação");
      return;
    }
    const alvo = opcoes.find(c => String(c.idConvidado) === principal);
    onAplicar({ idConvidadoPrincipal: Number(principal) }, `acompanhantes de ${alvo?.nmConvidado ?? "outro convidado"}`);
  };

  return (
    <section aria-label="Ações em massa" className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-blue-800"><Users className="h-4 w-4" /> {n} convidado(s) selecionado(s)</p>
        <button type="button" onClick={onLimpar} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><X className="h-3.5 w-3.5" /> Limpar seleção</button>
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="massa-status" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmação</label>
          <div className="flex gap-1.5">
            <select id="massa-status" value={status} onChange={e => setStatus(e.target.value as StatusConvidado)} className={classeCampo}>
              {(Object.keys(ROTULO_STATUS_CONVIDADO) as StatusConvidado[]).map(s => <option key={s} value={s}>{ROTULO_STATUS_CONVIDADO[s]}</option>)}
            </select>
            <button type="button" disabled={ocupado} onClick={() => onAplicar({ nmStatus: status }, ROTULO_STATUS_CONVIDADO[status].toLowerCase())} className={classeBotao} aria-label="Aplicar confirmação">Aplicar</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="massa-principal" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Acompanhante de</label>
          <div className="flex gap-1.5">
            <select id="massa-principal" value={principal} onChange={e => setPrincipal(e.target.value)} className={`${classeCampo} max-w-52`}>
              <option value="">Selecione…</option>
              <option value="solto">Ninguém (soltar)</option>
              {opcoes.map(c => <option key={c.idConvidado} value={c.idConvidado}>{c.nmConvidado}{c.nmGrupo ? ` (${c.nmGrupo})` : ""}</option>)}
            </select>
            <button type="button" disabled={ocupado || principal === ""} onClick={aplicarPrincipal} className={classeBotao} aria-label="Aplicar acompanhante de">Aplicar</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="massa-grupo" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Grupo</label>
          <div className="flex gap-1.5">
            <input id="massa-grupo" list="massa-grupos" maxLength={80} value={grupo} onChange={e => setGrupo(e.target.value)} placeholder="Família, Amigos…" className={`${classeCampo} w-36`} />
            <datalist id="massa-grupos">{grupos.map(g => <option key={g} value={g} />)}</datalist>
            <button type="button" disabled={ocupado} onClick={() => aplicarTexto("o grupo", grupo, "nmGrupo")} className={classeBotao} aria-label="Aplicar grupo">Aplicar</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="massa-mesa" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mesa</label>
          <div className="flex gap-1.5">
            <input id="massa-mesa" maxLength={40} value={mesa} onChange={e => setMesa(e.target.value)} placeholder="Ex.: 3" className={`${classeCampo} w-24`} />
            <button type="button" disabled={ocupado} onClick={() => aplicarTexto("a mesa", mesa, "nmMesa")} className={classeBotao} aria-label="Aplicar mesa">Aplicar</button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="massa-cortejo" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cortejo nupcial</label>
          <div className="flex gap-1.5">
            <input id="massa-cortejo" list="massa-papeis" maxLength={40} value={cortejo} onChange={e => setCortejo(e.target.value)} placeholder="Ex.: Padrinho" className={`${classeCampo} w-36`} />
            <datalist id="massa-papeis">{papeis.map(p => <option key={p} value={p} />)}</datalist>
            <button type="button" disabled={ocupado} onClick={() => aplicarTexto("o cortejo", cortejo, "nmCortejo")} className={classeBotao} aria-label="Aplicar cortejo">Aplicar</button>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-500">Campo de texto vazio + Aplicar limpa o valor dos selecionados.</p>
    </section>
  );
}
