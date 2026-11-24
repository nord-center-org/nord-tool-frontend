import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlertTriangle, BarChart3, CheckCircle2, ExternalLink, Eye, Heart, Instagram, Link2, Loader2, LogOut, Megaphone, MessageCircle,
  Music2, RefreshCw, Send, Upload, Users, Youtube, type LucideIcon,
} from "lucide-react";
import {
  marketingService, type CodigoRede, type PainelMarketing, type PublicacaoMarketing, type RedeMarketing,
} from "@/react-app/services/MarketingService";
import { INFO_REDE, numeroCurto, partesDoVideo, problemaDoVideo, STATUS_PUBLICACAO, totaisDoPainel } from "@/react-app/utils/marketing";

type Aba = "painel" | "publicar" | "contas";
const ICONE: Record<CodigoRede, LucideIcon> = { YOUTUBE: Youtube, INSTAGRAM: Instagram, TIKTOK: Music2 };

function msgErro(e: unknown): string {
  return e instanceof Error ? e.message : "Algo deu errado. Tente de novo.";
}

function IconeRede({ rede, className = "h-5 w-5" }: { rede: CodigoRede; className?: string }) {
  const I = ICONE[rede];
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: INFO_REDE[rede].cor }}>
      <I className={className} />
    </span>
  );
}

/**
 * Marketing (v1): conecta as próprias contas do YouTube, Instagram e TikTok pelo login oficial de cada rede, publica um
 * vídeo em várias delas de uma vez e mostra seguidores e views num painel só.
 */
export default function MarketingPage() {
  const [busca, setBusca] = useSearchParams();
  const aba = (["painel", "publicar", "contas"].includes(busca.get("aba") ?? "") ? busca.get("aba") : "painel") as Aba;
  const mudarAba = (a: Aba) => setBusca(b => { const n = new URLSearchParams(b); n.set("aba", a); n.delete("conectada"); return n; }, { replace: true });
  const [redes, setRedes] = useState<RedeMarketing[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const conectada = busca.get("conectada");

  const carregarRedes = useCallback(() => {
    marketingService.redes().then(setRedes).catch(e => setErro(msgErro(e)));
  }, []);
  useEffect(() => { carregarRedes(); }, [carregarRedes]);

  const contas = useMemo(() => (redes ?? []).flatMap(r => r.contas), [redes]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 text-white shadow-md">
            <Megaphone className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-black tracking-tight text-slate-800">Marketing</span>
            <span className="block text-xs font-medium text-slate-500">YouTube, Instagram e TikTok num lugar só</span>
          </span>
        </h1>
      </div>
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Marketing">
        {([["painel", "Painel", BarChart3], ["publicar", "Publicar", Send], ["contas", "Contas", Link2]] as const).map(([a, r, I]) => (
          <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => mudarAba(a)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ${aba === a ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <I className="h-4 w-4" />{r}
          </button>
        ))}
      </div>
      {conectada && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />Conta {conectada} conectada.
        </p>
      )}
      {erro && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {redes === null && !erro ? (
        <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p>
      ) : redes && (
        aba === "contas" ? <Contas redes={redes} aoMudar={carregarRedes} />
          : contas.length === 0 ? <SemContas irParaContas={() => mudarAba("contas")} />
            : aba === "publicar" ? <Publicar redes={redes} />
              : <Painel />
      )}
    </div>
  );
}

function SemContas({ irParaContas }: { irParaContas: () => void }) {
  return (
    <div className="grid place-items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="flex gap-2">{(["YOUTUBE", "INSTAGRAM", "TIKTOK"] as CodigoRede[]).map(r => <IconeRede key={r} rede={r} />)}</div>
      <p className="text-base font-bold text-slate-700">Conecte suas contas para começar</p>
      <p className="max-w-md text-sm text-slate-500">Entre no YouTube, Instagram ou TikTok pelo login oficial de cada rede. Depois é só escolher o vídeo e tocar em Compartilhar.</p>
      <button type="button" onClick={irParaContas} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">Conectar contas</button>
    </div>
  );
}

// ------------------------------------------------------------------ Contas

function Contas({ redes, aoMudar }: { redes: RedeMarketing[]; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const conectar = async (rede: CodigoRede) => {
    setOcupado(rede);
    setErro(null);
    try {
      const { txUrl } = await marketingService.conexao(rede, window.location.origin);
      window.location.assign(txUrl);
    } catch (e) {
      setErro(msgErro(e));
      setOcupado(null);
    }
  };
  const desconectar = async (id: number, nome: string) => {
    if (!window.confirm(`Desconectar ${nome}? O NordTool apaga o acesso a esta conta (o que já foi publicado continua na rede).`)) return;
    try { await marketingService.desconectar(id); aoMudar(); } catch (e) { setErro(msgErro(e)); }
  };

  return (
    <div className="space-y-3">
      {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {redes.map(r => (
          <section key={r.cdRede} aria-label={r.nmRede} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <IconeRede rede={r.cdRede} />
              <div className="min-w-0">
                <p className="font-bold text-slate-800">{r.nmRede}</p>
                <p className="text-xs text-slate-500">Publica {INFO_REDE[r.cdRede].publica}</p>
              </div>
            </div>
            {r.contas.length > 0 && (
              <ul className="space-y-1.5">
                {r.contas.map(c => (
                  <li key={c.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-2 py-1.5">
                    {c.txFoto ? <img src={c.txFoto} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="h-7 w-7 rounded-full bg-slate-200" />}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{c.txNome}</span>
                    <button type="button" onClick={() => void desconectar(c.id, c.txNome)} aria-label={`Desconectar ${c.txNome}`}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto">
              {r.inConfigurada ? (
                <button type="button" onClick={() => void conectar(r.cdRede)} disabled={ocupado !== null}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: INFO_REDE[r.cdRede].cor }}>
                  {ocupado === r.cdRede ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {r.contas.length ? "Conectar outra conta" : `Conectar ${r.nmRede}`}
                </button>
              ) : (
                <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Falta configurar o app do {r.nmRede} no servidor (as chaves do console de desenvolvedor da rede).
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        O login é feito na própria rede: o NordTool nunca vê a sua senha. O acesso fica guardado criptografado e você pode desconectar quando quiser.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Publicar

function Publicar({ redes }: { redes: RedeMarketing[] }) {
  const contas = useMemo(() => redes.flatMap(r => r.contas), [redes]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [legenda, setLegenda] = useState("");
  const [publico, setPublico] = useState(true);
  const [escolhidas, setEscolhidas] = useState<number[]>(() => contas.map(c => c.id));
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [publicacoes, setPublicacoes] = useState<PublicacaoMarketing[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!arquivo) { setPrevia(null); return; }
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const carregar = useCallback(() => { marketingService.publicacoes().then(setPublicacoes).catch(() => undefined); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  // Enquanto alguma publicação está enviando, confere a cada 4 s.
  const enviando = publicacoes.some(p => p.cdStatus === "ENVIANDO");
  useEffect(() => {
    if (!enviando) return;
    const t = setInterval(carregar, 4_000);
    return () => clearInterval(t);
  }, [enviando, carregar]);

  const redesEscolhidas = contas.filter(c => escolhidas.includes(c.id)).map(c => c.cdRede);
  const problema = arquivo ? problemaDoVideo(arquivo, redesEscolhidas) : null;
  const pode = !!arquivo && !problema && titulo.trim().length > 0 && escolhidas.length > 0 && progresso === null;

  const compartilhar = async () => {
    if (!arquivo || !pode) return;
    setErro(null);
    setProgresso(0);
    try {
      const midia = await marketingService.iniciarMidia(arquivo.name, arquivo.size, arquivo.type);
      const partes = partesDoVideo(arquivo.size, midia.nrTamanhoParte);
      for (let i = 0; i < partes.length; i++) {
        const [ini, fim] = partes[i];
        await marketingService.enviarParte(midia.id, i, await arquivo.slice(ini, fim).arrayBuffer());
        setProgresso(fim / arquivo.size);
      }
      await marketingService.publicar(midia.id, titulo.trim(), legenda.trim(), publico, escolhidas);
      setArquivo(null);
      setTitulo("");
      setLegenda("");
      carregar();
    } catch (e) {
      setErro(msgErro(e));
    } finally {
      setProgresso(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Novo vídeo">
        <input ref={entrada} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" aria-label="Vídeo para publicar"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setArquivo(f); if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, "")); } }} />
        {previa ? (
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video src={previa} controls playsInline className="mx-auto max-h-80" />
            <button type="button" onClick={() => entrada.current?.click()} className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-bold text-white">Trocar</button>
          </div>
        ) : (
          <button type="button" onClick={() => entrada.current?.click()}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setArquivo(f); }}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:bg-slate-50">
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="font-bold text-slate-700">Escolher vídeo</span>
            <span className="text-xs text-slate-500">MP4 ou MOV (WebM só no YouTube e TikTok), até 500 MB. Vertical 9:16 funciona em todas.</span>
          </button>
        )}
        {problema && <p role="alert" className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{problema}</p>}
        <label className="block text-xs font-bold text-slate-600">Título
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={100}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" placeholder="Ex.: NordTool em 30 segundos" />
        </label>
        <label className="block text-xs font-bold text-slate-600">Legenda / descrição
          <textarea value={legenda} onChange={e => setLegenda(e.target.value)} maxLength={2200} rows={4}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" placeholder="Fale do NordTool, link e #hashtags" />
          <span className="block text-right text-[10px] font-normal text-slate-400">{legenda.length}/2200</span>
        </label>
        <fieldset>
          <legend className="mb-1 text-xs font-bold text-slate-600">Onde publicar</legend>
          <div className="flex flex-wrap gap-2">
            {contas.map(c => {
              const marcada = escolhidas.includes(c.id);
              return (
                <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm ${marcada ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600"}`}>
                  <input type="checkbox" className="sr-only" checked={marcada}
                    onChange={() => setEscolhidas(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))} />
                  {(() => { const I = ICONE[c.cdRede]; return <I className="h-4 w-4" />; })()}{c.txNome}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)} className="h-4 w-4" />
          Público (YouTube e TikTok; o Instagram publica sempre público)
        </label>
        {erro && <p role="alert" className="rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{erro}</p>}
        <button type="button" onClick={() => void compartilhar()} disabled={!pode}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2.5 text-sm font-black text-white shadow disabled:opacity-50">
          {progresso !== null ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando {Math.round(progresso * 100)}%</> : <><Send className="h-4 w-4" />Compartilhar</>}
        </button>
        {progresso !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full bg-rose-500 transition-all" style={{ width: `${Math.round(progresso * 100)}%` }} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Publicações">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Publicações</h2>
        {publicacoes.length === 0 ? <p className="text-sm text-slate-500">Nada publicado pelo NordTool ainda.</p> : (
          <ul className="space-y-2">
            {publicacoes.map(p => {
              const st = STATUS_PUBLICACAO[p.cdStatus] ?? STATUS_PUBLICACAO.ERRO;
              return (
                <li key={p.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2">
                  <IconeRede rede={p.cdRede} className="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{p.txTitulo}</p>
                    <p className="truncate text-xs text-slate-500">{p.txConta} · {new Date(p.dhCriacao).toLocaleString("pt-BR")}</p>
                    {p.txAviso && <p className="mt-0.5 text-xs text-slate-600">{p.txAviso}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cor}`}>
                      {p.cdStatus === "ENVIANDO" && <Loader2 className="h-3 w-3 animate-spin" />}{st.rotulo}
                    </span>
                    {p.txLink && <a href={p.txLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">Abrir<ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Painel

function Painel() {
  const [painel, setPainel] = useState<PainelMarketing[] | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback((atualizar: boolean) => {
    setAtualizando(true);
    marketingService.painel(atualizar).then(p => { setPainel(p); setErro(null); }).catch(e => setErro(msgErro(e))).finally(() => setAtualizando(false));
  }, []);
  useEffect(() => { carregar(false); }, [carregar]);

  if (painel === null) {
    return erro ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      : <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando os números nas redes…</p>;
  }
  const totais = totaisDoPainel(painel);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Numero icone={Users} rotulo="Seguidores (todas as contas)" valor={numeroCurto(totais.seguidores)} />
        <Numero icone={Eye} rotulo="Views (somadas)" valor={numeroCurto(totais.views)} />
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Os números vêm direto das redes e são guardados por 5 minutos.</p>
          <button type="button" onClick={() => carregar(true)} disabled={atualizando} aria-label="Atualizar números"
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {painel.map(c => (
        <section key={c.idConta} aria-label={`Painel de ${c.txConta}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <IconeRede rede={c.cdRede} />
            <p className="mr-auto font-bold text-slate-800">{c.txConta}</p>
            <span className="flex items-center gap-1 text-sm text-slate-600"><Users className="h-4 w-4" />{numeroCurto(c.nrSeguidores)}</span>
            <span className="flex items-center gap-1 text-sm text-slate-600"><Eye className="h-4 w-4" />{numeroCurto(c.nrViewsTotais)}</span>
          </div>
          {c.txErro ? <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{c.txErro}</p>
            : c.posts.length === 0 ? <p className="text-sm text-slate-500">Nenhum post ainda.</p> : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {c.posts.map(p => (
                  <li key={p.id}>
                    <a href={p.txLink ?? undefined} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200 hover:ring-slate-400">
                      <span className="block aspect-[9/12] bg-slate-200">
                        {p.txMiniatura && <img src={p.txMiniatura} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                      </span>
                      <span className="block truncate px-1.5 pt-1 text-[11px] font-semibold text-slate-700" title={p.txTitulo}>{p.txTitulo || "Sem título"}</span>
                      <span className="flex gap-2 px-1.5 pb-1.5 text-[11px] text-slate-500">
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{numeroCurto(p.nrViews)}</span>
                        <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{numeroCurto(p.nrCurtidas)}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{numeroCurto(p.nrComentarios)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
        </section>
      ))}
    </div>
  );
}

function Numero({ icone: I, rotulo, valor }: { icone: LucideIcon; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><I className="h-5 w-5" /></span>
      <div><p className="text-2xl font-black text-slate-800">{valor}</p><p className="text-xs text-slate-500">{rotulo}</p></div>
    </div>
  );
}
