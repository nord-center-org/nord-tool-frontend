import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import TelaPublica, { classeBotaoPublico, classeCampoPublico, classeRotuloPublico } from "@/react-app/components/auth/TelaPublica";
import { ApiError } from "@/react-app/services/apiClient";
import { authService } from "@/react-app/services/AuthService";
import { emailValido, forcaSenha, problemaNaSenha } from "@/react-app/utils/cadastro";

const ROTULO_FORCA = ["", "fraca", "boa", "forte"];

export default function CadastroPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [obra, setObra] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const forca = forcaSenha(senha);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (!nome.trim()) return setErro("Informe o seu nome.");
    if (!emailValido(email)) return setErro("Informe um e-mail válido.");
    if (!obra.trim()) return setErro("Informe o código da obra (peça ao responsável da obra).");
    const problema = problemaNaSenha(senha, confirmacao);
    if (problema) return setErro(problema);
    setErro(null);
    setEnviando(true);
    try {
      const r = await authService.cadastrar({ nmNome: nome.trim(), nmEmail: email.trim(), nrCelular: celular.trim(), cdObra: obra.trim(), senha });
      setFeito(r?.txMensagem ?? "Cadastro enviado.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível conectar ao servidor. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (feito) {
    return (
      <TelaPublica subtitulo="Cadastro enviado">
        <div role="status" className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="text-sm text-slate-600">{feito}</p>
          <p className="text-xs text-slate-400">Você recebe um e-mail quando for aprovado.</p>
        </div>
        <Link to="/login" className={classeBotaoPublico}>Voltar para o login</Link>
      </TelaPublica>
    );
  }

  return (
    <TelaPublica subtitulo="Crie sua conta para usar o app da obra">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        {erro && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
        <label className="block"><span className={classeRotuloPublico}>Nome completo</span>
          <input autoFocus autoComplete="name" maxLength={150} value={nome} onChange={e => setNome(e.target.value)} className={classeCampoPublico} />
        </label>
        <label className="block"><span className={classeRotuloPublico}>E-mail</span>
          <input type="email" autoComplete="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} className={classeCampoPublico} />
        </label>
        <label className="block"><span className={classeRotuloPublico}>Celular (opcional)</span>
          <input type="tel" autoComplete="tel" maxLength={20} placeholder="(11) 99999-9999" value={celular} onChange={e => setCelular(e.target.value)} className={classeCampoPublico} />
        </label>
        <label className="block"><span className={classeRotuloPublico}>Código da obra</span>
          <input autoCapitalize="characters" maxLength={20} placeholder="Peça ao responsável da obra" value={obra} onChange={e => setObra(e.target.value.toUpperCase())} className={classeCampoPublico} />
        </label>
        <div>
        <label className="block"><span className={classeRotuloPublico}>Senha</span>
          <input type="password" autoComplete="new-password" maxLength={200} value={senha} onChange={e => setSenha(e.target.value)} aria-describedby="forca-senha" className={classeCampoPublico} />
        </label>
          <span id="forca-senha" className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map(n => <span key={n} className={`h-1.5 w-8 rounded-full ${forca >= n ? (forca === 1 ? "bg-amber-400" : "bg-green-500") : "bg-slate-200"}`} />)}
            </span>
            {senha ? (forca === 0 ? "mínimo de 10 caracteres" : `senha ${ROTULO_FORCA[forca]}`) : "mínimo de 10 caracteres"}
          </span>
        </div>
        <label className="block"><span className={classeRotuloPublico}>Confirme a senha</span>
          <input type="password" autoComplete="new-password" maxLength={200} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} className={classeCampoPublico} />
        </label>
        <button type="submit" disabled={enviando} className={classeBotaoPublico}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Criar conta
        </button>
        <p className="text-center text-sm text-slate-500">Já tem conta? <Link to="/login" className="font-semibold text-blue-600 hover:underline">Entrar</Link></p>
      </form>
    </TelaPublica>
  );
}
