import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { authService } from "@/react-app/services/AuthService";

const MIN_SENHA = 10;

export default function AlterarSenhaModal({ onClose }: { onClose: () => void }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (enviando) return;
    if (novaSenha.length < MIN_SENHA) return setErro(`A nova senha deve ter ao menos ${MIN_SENHA} caracteres.`);
    if (novaSenha !== confirmacao) return setErro("A confirmação não confere com a nova senha.");
    setErro(null);
    setEnviando(true);
    try {
      await authService.alterarSenha(senhaAtual, novaSenha);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar a senha.");
    } finally {
      setEnviando(false);
    }
  };

  const campo = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-blue-500/30";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-label="Alterar senha">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Alterar senha</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {sucesso ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">Senha alterada com sucesso.</p>
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700">Fechar</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-3">
            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
            <label className="block text-sm font-semibold text-slate-700">Senha atual
              <input type="password" autoFocus autoComplete="current-password" required value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} className={campo} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Nova senha (mín. {MIN_SENHA} caracteres)
              <input type="password" autoComplete="new-password" required value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className={campo} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Confirmar nova senha
              <input type="password" autoComplete="new-password" required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className={campo} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button type="submit" disabled={enviando} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
