import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Bell, BellOff, BellRing, Loader2, Send, Share, Smartphone, SquarePlus } from "lucide-react";

import { notificacaoService, type Aparelho } from "@/react-app/services/NotificacaoService";
import {
  ANTECEDENCIAS, OPCOES_NOTIFICACAO, PREFERENCIAS_PADRAO, rotuloAntecedencia, suporteDoAparelho, type PreferenciasNotificacao, type Suporte,
} from "@/react-app/utils/notificacoes";

const instalado = () =>
  (typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const suporteAqui = (): Suporte => suporteDoAparelho({
  userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints,
  temServiceWorker: "serviceWorker" in navigator, temPush: typeof window !== "undefined" && "PushManager" in window && "Notification" in window,
  instalado: instalado(),
});

const dataCurta = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

/** Configurações → Notificações no celular: liga o push neste aparelho e escolhe o que avisar. */
export default function NotificacoesConfig() {
  const { hash } = useLocation();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (hash === "#notificacoes") ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [hash]);

  const [suporte] = useState<Suporte>(suporteAqui);
  const [chave, setChave] = useState<string | null>(null);
  const [servidorPronto, setServidorPronto] = useState(true);
  const [ativoAqui, setAtivoAqui] = useState(false);
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [prefs, setPrefs] = useState<PreferenciasNotificacao>(PREFERENCIAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<"" | "ativar" | "desativar" | "teste" | "prefs">("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const recarregarAparelhos = useCallback(async () => setAparelhos(await notificacaoService.aparelhos()), []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cfg, p, lista, inscricao] = await Promise.all([
          notificacaoService.config(), notificacaoService.preferencias(), notificacaoService.aparelhos(),
          suporte === "ok" ? notificacaoService.inscricaoAtual().catch(() => null) : Promise.resolve(null),
        ]);
        if (!vivo) return;
        setServidorPronto(cfg.habilitado && !!cfg.chavePublica);
        setChave(cfg.chavePublica);
        setPrefs(p);
        setAparelhos(lista);
        setAtivoAqui(!!inscricao && typeof Notification !== "undefined" && Notification.permission === "granted");
      } catch (e) {
        if (vivo) setAviso({ tipo: "erro", texto: mensagemDe(e) });
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [suporte]);

  const ativar = async () => {
    if (!chave) return;
    setOcupado("ativar"); setAviso(null);
    try {
      await notificacaoService.ativarEsteAparelho(chave);
      setAtivoAqui(true);
      await recarregarAparelhos();
      setAviso({ tipo: "ok", texto: "Pronto! Este aparelho vai receber as notificações do NordTool." });
    } catch (e) { setAviso({ tipo: "erro", texto: mensagemDe(e) }); }
    finally { setOcupado(""); }
  };

  const desativar = async () => {
    setOcupado("desativar"); setAviso(null);
    try {
      await notificacaoService.desativarEsteAparelho();
      setAtivoAqui(false);
      await recarregarAparelhos();
      setAviso({ tipo: "ok", texto: "Notificações desligadas neste aparelho." });
    } catch (e) { setAviso({ tipo: "erro", texto: mensagemDe(e) }); }
    finally { setOcupado(""); }
  };

  const testar = async () => {
    setOcupado("teste"); setAviso(null);
    try {
      const n = await notificacaoService.testar();
      setAviso(n > 0
        ? { tipo: "ok", texto: `Teste enviado para ${n === 1 ? "1 aparelho" : `${n} aparelhos`}. Deve chegar em alguns segundos.` }
        : { tipo: "erro", texto: "Nenhum aparelho ativo para receber o teste." });
    } catch (e) { setAviso({ tipo: "erro", texto: mensagemDe(e) }); }
    finally { setOcupado(""); }
  };

  const salvar = async (novas: PreferenciasNotificacao) => {
    const antes = prefs;
    setPrefs(novas); setOcupado("prefs");
    try { setPrefs(await notificacaoService.salvarPreferencias(novas)); }
    catch (e) { setPrefs(antes); setAviso({ tipo: "erro", texto: mensagemDe(e) }); }
    finally { setOcupado(""); }
  };

  return (
    <section ref={ref} id="notificacoes" className="rounded-2xl border border-slate-200 p-5 shadow-sm" aria-labelledby="config-notificacoes">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><BellRing className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 id="config-notificacoes" className="text-lg font-bold text-slate-800">Notificações no celular</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Avisos das suas demandas e do SAC direto no celular, mesmo com o NordTool fechado. Ative em cada aparelho em que quer receber.
          </p>

          {carregando ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                {!servidorPronto ? (
                  <p className="text-sm font-medium text-slate-600">As notificações ainda não foram ligadas no servidor. Avise um administrador.</p>
                ) : suporte === "instalar-ios" ? (
                  <div className="text-sm text-slate-700">
                    <p className="font-bold">No iPhone, adicione o NordTool à Tela de Início primeiro</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
                      <li>Abra o NordTool no <strong>Safari</strong>.</li>
                      <li>Toque em <Share className="inline h-4 w-4 align-text-bottom" aria-label="Compartilhar" /> <strong>Compartilhar</strong> e depois em <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> <strong>Adicionar à Tela de Início</strong>.</li>
                      <li>Abra o NordTool pelo ícone novo, entre na sua conta e volte aqui em Configurações.</li>
                    </ol>
                    <p className="mt-2 text-xs text-slate-500">Precisa do iOS 16.4 ou mais novo.</p>
                  </div>
                ) : suporte === "sem-suporte" ? (
                  <p className="text-sm font-medium text-slate-600">Este navegador não recebe notificações. No Android, use o Chrome; no iPhone, o Safari com o app na Tela de Início.</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      {ativoAqui ? <><Bell className="h-4 w-4 text-emerald-600" /> Ativas neste aparelho</> : <><BellOff className="h-4 w-4 text-slate-400" /> Desligadas neste aparelho</>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ativoAqui ? (
                        <>
                          <button type="button" onClick={testar} disabled={!!ocupado}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                            {ocupado === "teste" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar teste
                          </button>
                          <button type="button" onClick={desativar} disabled={!!ocupado}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                            {ocupado === "desativar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Desligar aqui
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={ativar} disabled={!!ocupado}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                          {ocupado === "ativar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Ativar notificações neste aparelho
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {aviso && (
                  <p role="status" className={`mt-3 text-xs font-bold ${aviso.tipo === "ok" ? "text-emerald-700" : "text-red-600"}`}>{aviso.texto}</p>
                )}
              </div>

              <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">O que avisar (vale para todos os seus aparelhos)</p>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {OPCOES_NOTIFICACAO.map(o => (
                  <li key={o.chave} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <label htmlFor={`notif-${o.chave}`} className="cursor-pointer">
                        <span className="block text-sm font-bold text-slate-700">{o.titulo}</span>
                        <span className="block text-xs text-slate-500">{o.texto}</span>
                      </label>
                      {o.chave === "inHorario" && prefs.inHorario && (
                        <select aria-label="Quanto tempo antes do horário" value={prefs.nrAntecedenciaMin} disabled={ocupado === "prefs"}
                          onChange={e => void salvar({ ...prefs, nrAntecedenciaMin: Number(e.target.value) })}
                          className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                          {ANTECEDENCIAS.map(m => <option key={m} value={m}>{rotuloAntecedencia(m)}</option>)}
                        </select>
                      )}
                    </div>
                    <input id={`notif-${o.chave}`} type="checkbox" role="switch" checked={prefs[o.chave]} disabled={ocupado === "prefs"}
                      onChange={e => void salvar({ ...prefs, [o.chave]: e.target.checked })}
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-blue-600" />
                  </li>
                ))}
              </ul>

              {aparelhos.length > 0 && (
                <>
                  <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aparelhos que recebem</p>
                  <ul className="mt-2 space-y-1.5">
                    {aparelhos.map(a => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <Smartphone className="h-4 w-4 text-slate-400" />
                        <span className="font-bold text-slate-700">{a.nmAparelho || "Aparelho"}</span>
                        <span>· ativado em {dataCurta(a.dhCriacao)}</span>
                        {a.dhUltimoEnvio && <span>· último aviso {dataCurta(a.dhUltimoEnvio)}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
