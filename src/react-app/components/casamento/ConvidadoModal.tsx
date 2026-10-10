import { useMemo, useState, type FormEvent } from "react";

import type { CasamentoConvidado, StatusConvidado } from "@/shared/types";
import Campo, { classeInput } from "@/react-app/components/casamento/Campo";
import ModalBase from "@/react-app/components/casamento/ModalBase";
import type { ConvidadoForm } from "@/react-app/services/CasamentoService";
import { ROTULO_STATUS_CONVIDADO, descendentes, papeisDoCortejo } from "@/react-app/utils/convidados";

interface ConvidadoModalProps {
  /** Ausente = novo convidado. */
  convidado?: CasamentoConvidado;
  /** Grupos já usados, para sugerir no campo. */
  grupos: string[];
  /** Todos os convidados: a lista de "acompanhante de quem". */
  convidados: CasamentoConvidado[];
  onSalvar: (form: ConvidadoForm) => void;
  onFechar: () => void;
}

export default function ConvidadoModal({ convidado, grupos, convidados, onSalvar, onFechar }: ConvidadoModalProps) {
  const [form, setForm] = useState({
    nmConvidado: convidado?.nmConvidado ?? "",
    nmGrupo: convidado?.nmGrupo ?? "",
    nrTelefone: convidado?.nrTelefone ?? "",
    nmRelacao: convidado?.nmRelacao ?? "",
    nmStatus: (convidado?.nmStatus ?? "NAO_CONVIDADO") as StatusConvidado,
    nrAcompanhantes: String(convidado?.nrAcompanhantes ?? 0),
    nmMesa: convidado?.nmMesa ?? "",
    nmCortejo: convidado?.nmCortejo ?? "",
  });
  const [acompanhante, setAcompanhante] = useState(convidado?.idConvidadoPrincipal != null);
  const [idPrincipal, setIdPrincipal] = useState(convidado?.idConvidadoPrincipal != null ? String(convidado.idConvidadoPrincipal) : "");
  const [erro, setErro] = useState<string | null>(null);

  // Não dá para acompanhar a si mesmo nem alguém que já está ligado a ele (faria um círculo).
  const opcoesPrincipal = useMemo(() => {
    const fora = convidado ? descendentes(convidados, convidado.idConvidado) : new Set<number>();
    return convidados
      .filter(c => c.idConvidado !== convidado?.idConvidado && !fora.has(c.idConvidado))
      .sort((a, b) => a.nmConvidado.localeCompare(b.nmConvidado, "pt-BR", { sensitivity: "base" }));
  }, [convidados, convidado]);

  const papeis = useMemo(() => papeisDoCortejo(convidados), [convidados]);
  const alterar = (campo: keyof typeof form, valor: string) => setForm(f => ({ ...f, [campo]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!form.nmConvidado.trim()) return setErro("Informe o nome do convidado.");
    const acompanhantes = Number(form.nrAcompanhantes === "" ? 0 : form.nrAcompanhantes);
    if (!Number.isInteger(acompanhantes) || acompanhantes < 0 || acompanhantes > 50) {
      return setErro("Acompanhantes deve ser um número inteiro entre 0 e 50.");
    }
    if (acompanhante && idPrincipal === "") return setErro("Escolha de quem ele é acompanhante.");
    onSalvar({
      nmConvidado: form.nmConvidado.trim(),
      nmGrupo: form.nmGrupo.trim(),
      nrTelefone: form.nrTelefone.trim(),
      nmRelacao: form.nmRelacao.trim(),
      nmStatus: form.nmStatus,
      nrAcompanhantes: acompanhantes,
      nmMesa: form.nmMesa.trim(),
      idConvidadoPrincipal: acompanhante ? Number(idPrincipal) : null,
      nmCortejo: form.nmCortejo.trim(),
    });
    onFechar();
  };

  return (
    <ModalBase titulo={convidado ? "Editar convidado" : "Novo convidado"} onFechar={onFechar}>
      <form onSubmit={enviar} className="space-y-4">
        {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <Campo rotulo="Nome">
          <input autoFocus maxLength={150} value={form.nmConvidado} onChange={e => alterar("nmConvidado", e.target.value)} className={classeInput} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Grupo">
            <input list="grupos-convidados" maxLength={80} value={form.nmGrupo} onChange={e => alterar("nmGrupo", e.target.value)} placeholder="Família, Amigos…" className={classeInput} />
            <datalist id="grupos-convidados">{grupos.map(g => <option key={g} value={g} />)}</datalist>
          </Campo>
          <Campo rotulo="Relação">
            <input maxLength={80} value={form.nmRelacao} onChange={e => alterar("nmRelacao", e.target.value)} className={classeInput} />
          </Campo>
        </div>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={acompanhante} onChange={e => { setAcompanhante(e.target.checked); if (!e.target.checked) setIdPrincipal(""); }} className="h-4 w-4 accent-blue-600" />
            É acompanhante de outro convidado
          </label>
          {acompanhante && (
            <Campo rotulo="Acompanhante de quem?" dica={opcoesPrincipal.length === 0 ? "Cadastre antes o convidado principal." : undefined}>
              <select value={idPrincipal} onChange={e => setIdPrincipal(e.target.value)} className={classeInput}>
                <option value="">Selecione…</option>
                {opcoesPrincipal.map(c => <option key={c.idConvidado} value={c.idConvidado}>{c.nmConvidado}{c.nmGrupo ? ` (${c.nmGrupo})` : ""}</option>)}
              </select>
            </Campo>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Telefone">
            <input inputMode="tel" maxLength={30} value={form.nrTelefone} onChange={e => alterar("nrTelefone", e.target.value)} placeholder="(11) 90000-0000" className={classeInput} />
          </Campo>
          <Campo rotulo="Confirmação">
            <select value={form.nmStatus} onChange={e => alterar("nmStatus", e.target.value)} className={classeInput}>
              {(Object.keys(ROTULO_STATUS_CONVIDADO) as StatusConvidado[]).map(s => <option key={s} value={s}>{ROTULO_STATUS_CONVIDADO[s]}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Acompanhantes">
            <input type="number" min={0} max={50} value={form.nrAcompanhantes} onChange={e => alterar("nrAcompanhantes", e.target.value)} className={classeInput} />
          </Campo>
          <Campo rotulo="Mesa">
            <input maxLength={40} value={form.nmMesa} onChange={e => alterar("nmMesa", e.target.value)} placeholder="Ex.: 3" className={classeInput} />
          </Campo>
        </div>
        <Campo rotulo="Cortejo nupcial" dica="Se faz parte do cortejo: padrinho, madrinha, daminha… Deixe vazio se não faz.">
          <input list="papeis-cortejo" maxLength={40} value={form.nmCortejo} onChange={e => alterar("nmCortejo", e.target.value)} placeholder="Ex.: Madrinha" className={classeInput} />
          <datalist id="papeis-cortejo">{papeis.map(p => <option key={p} value={p} />)}</datalist>
        </Campo>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Salvar</button>
        </div>
      </form>
    </ModalBase>
  );
}
