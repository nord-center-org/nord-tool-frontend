import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CheckCircle2, Crop, LifeBuoy, Loader2, Send, X } from "lucide-react";

import Avatar from "@/react-app/components/avatar/Avatar";
import { rascunhoSac } from "@/react-app/components/sac/rascunhoSac";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useCapturaLugia } from "@/react-app/hooks/useCapturaLugia";
import { useNovidadesSac } from "@/react-app/hooks/useNovidadesSac";
import { avatarService, type AvatarUsuario } from "@/react-app/services/AvatarService";
import { sacService } from "@/react-app/services/SacService";
import { lerAvatar } from "@/react-app/utils/avatar";
import { MAX_DESCRICAO, MAX_TITULO, posicaoBotaoSac, primeiroNome, problemaDoRascunho, saudacaoSac } from "@/react-app/utils/sac";

/**
 * SAC v3: um botão pequeno no canto de todas as telas. Ao tocar, abre uma janelinha com o avatar de quem cuida do
 * NordTool dando as boas-vindas e um formulário curto para abrir o chamado ali mesmo (com a tela atual anotada), ou
 * para tirar um print desta tela e terminar no SAC.
 */
export default function BotaoSac() {
  const { usuario } = useAuth();
  const { chamados } = useNovidadesSac();
  const captura = useCapturaLugia();
  const location = useLocation();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [voz, setVoz] = useState<AvatarUsuario | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  // quem recebe: o avatar do dono do NordTool (o mesmo das novidades)
  useEffect(() => {
    if (!aberto || voz) return;
    avatarService.portaVoz().then(v => setVoz(v ?? null)).catch(() => setVoz(null));
  }, [aberto, voz]);

  // Esc fecha
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  const posicao = posicaoBotaoSac(location.pathname);
  if (!usuario || posicao === "escondido" || captura.estado !== "inativo") return null;

  const base = posicao === "acima-do-mascote" ? "bottom-16 sm:bottom-[4.5rem]" : "bottom-3 sm:bottom-5";
  const novidades = chamados.length;
  const configVoz = voz ? lerAvatar(voz.dsConfig, voz.idUsuario, voz.nmCargo) : null;
  const quem = voz ? primeiroNome(voz.nmNome) : "a equipe do NordTool";

  const enviar = async () => {
    const problema = problemaDoRascunho({ titulo, descricao }, 0);
    if (problema) { setErro(problema); return; }
    setErro(null);
    setEnviando(true);
    try {
      const novo = await sacService.abrir({ nmTitulo: titulo.trim(), txDescricao: descricao.trim(), txTela: location.pathname }, []);
      setAberta(novo?.id ?? 0);
      setTitulo(""); setDescricao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para abrir o chamado. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  // print desta tela: o texto vai para o rascunho do SAC, a captura começa e termina no SAC com o print anexado
  const comPrint = () => {
    rascunhoSac.titulo = titulo;
    rascunhoSac.descricao = descricao;
    setAberto(false);
    captura.iniciar("agora", "/sac");
  };

  return (
    <div data-sem-print className={`fixed right-3 z-[60] flex flex-col items-end gap-2 sm:right-5 ${base}`}>
      {aberto && (
        <div ref={caixa} role="dialog" aria-label="Abrir chamado no SAC"
          className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-surgir">
          <div className="flex items-end gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 pt-3">
            <div className="h-16 w-16 shrink-0">
              {configVoz ? <Avatar config={configVoz} tamanho={64} semFundo animado rotulo={quem} /> : (
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white"><LifeBuoy className="h-7 w-7" /></span>
              )}
            </div>
            <div className="mb-3 min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <p className="font-bold">{saudacaoSac(usuario.nome, new Date().getHours())}</p>
              <p className="text-xs text-slate-500">{voz ? `Aqui é ${quem}.` : "Aqui é a equipe do NordTool."} Conte o que não funcionou ou a ideia que você teve.</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="mb-auto mt-0 rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
          {aberta !== null ? (
            <div className="space-y-3 p-4 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="text-sm font-bold text-slate-800">Chamado{aberta ? ` #${aberta}` : ""} aberto!</p>
              <p className="text-xs text-slate-500">Você recebe o aviso aqui quando responderem.</p>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => { setAberto(false); navigate("/sac"); }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Ver meus chamados</button>
                <button type="button" onClick={() => setAberta(null)} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">Abrir outro</button>
              </div>
            </div>
          ) : (
            <form className="space-y-2 p-4" onSubmit={e => { e.preventDefault(); void enviar(); }}>
              <label className="block text-xs font-bold text-slate-600">Título
                <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={MAX_TITULO} autoFocus placeholder="Ex.: Botão de salvar não responde"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-xs font-bold text-slate-600">O que aconteceu ou o que você precisa
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={MAX_DESCRICAO} rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-blue-500" />
              </label>
              <p className="text-[11px] text-slate-400">Vai junto: a tela em que você está ({location.pathname}).</p>
              {erro && <p role="alert" className="rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">{erro}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="submit" disabled={enviando} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Enviar
                </button>
                <button type="button" onClick={comPrint} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" title="Marque uma área desta tela; você termina o chamado no SAC com o print">
                  <Crop className="h-3.5 w-3.5" />Com print desta tela
                </button>
                <button type="button" onClick={() => { setAberto(false); navigate("/sac"); }} className="ml-auto text-xs font-bold text-blue-600 hover:underline">
                  Meus chamados{novidades ? ` (${novidades} nova${novidades > 1 ? "s" : ""})` : ""}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      <button type="button" data-tutorial="sac-flutuante" onClick={() => setAberto(a => !a)} aria-expanded={aberto} aria-label={aberto ? "Fechar o SAC" : "Abrir o SAC"} title="SAC: peça uma mudança ou avise de um problema"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-md backdrop-blur transition hover:bg-white hover:text-blue-600 active:scale-95">
        {aberto ? <X className="h-4 w-4" /> : <LifeBuoy className="h-5 w-5" />}
        {!aberto && novidades > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{novidades}</span>}
      </button>
    </div>
  );
}
