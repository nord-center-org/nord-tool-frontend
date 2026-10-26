import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { authService } from "@/react-app/services/AuthService";
import { emailValido } from "@/react-app/utils/cadastro";

export default function AlterarEmailPage() {
  const { usuario, atualizarSessao } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    if (!emailValido(email)) return setErro("Informe um e-mail válido.");
    if (email.trim().toLowerCase() === usuario?.email.toLowerCase()) return setErro("Esse já é o seu e-mail.");
    setEnviando(true);
    try {
      // O backend devolve um token novo com o e-mail trocado.
      const sessao = await authService.alterarEmail(email.trim(), senha);
      atualizarSessao(sessao);
      setSucesso(sessao.usuario.email);
      setEmail("");
      setSenha("");
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : "Não foi possível alterar o e-mail.");
    } finally {
      setEnviando(false);
    }
  };

  const campo = "mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="max-w-md mx-auto py-8">
      <form onSubmit={enviar} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 space-y-5" noValidate>
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-black text-slate-800">Alterar e-mail</h2>
        </div>
        <p className="text-sm text-slate-500">
          Hoje você entra com <strong className="text-slate-700">{usuario?.email}</strong>. Depois da troca, o login passa a ser o e-mail novo.
        </p>

        {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
        {sucesso && <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">E-mail alterado. Agora você entra com {sucesso}.</p>}

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Novo e-mail</span>
          <input type="email" autoComplete="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} className={campo} />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Senha atual (para confirmar)</span>
          <input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} className={campo} />
        </label>

        <button
          type="submit" disabled={enviando || !email.trim() || !senha}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white font-bold py-3 text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar novo e-mail
        </button>
      </form>
    </div>
  );
}
