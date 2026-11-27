import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";

import { Estabilizador, detectarFrequencia, nivelRms, notaDaFrequencia, oitavaDoMidi, textoDaAfinacao } from "@/react-app/utils/musica/afinador";
import { corDaNota, instrumento, posicoes, type IdInstrumento } from "@/react-app/utils/musica/instrumentos";
import { emSolfejo, letraDaNota, nomeDaNotaExibida } from "@/react-app/utils/musica/notacao";
import { useNotacao } from "./useNotacao";

type Baixo = Extract<IdInstrumento, "baixo4" | "baixo5">;
interface NotaAtual { midi: number; cents: number; frequencia: number }

/** Sensibilidade de 1 (só som forte) a 10 (pega até som baixinho): o volume mínimo para tentar reconhecer. */
const limiarDoVolume = (s: number) => 0.045 * 0.65 ** (Math.max(1, Math.min(10, s)) - 1);
const MARCAS = [3, 5, 7, 9, 12, 15, 17, 19];

/**
 * Repertório v20 — reconhecer a nota do baixo pelo microfone: a pessoa toca (direto ou numa caixinha de som perto do
 * celular) e a tela mostra, bem grande, qual nota é, se está afinada e onde ela fica no braço do baixo.
 */
export default function ReconhecerNota({ inicial = "baixo4", onFechar }: { inicial?: Baixo; onFechar: () => void }) {
  const notacao = useNotacao();
  const [idBaixo, setIdBaixo] = useState<Baixo>(inicial);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState<NotaAtual | null>(null);
  const [historico, setHistorico] = useState<number[]>([]);
  const [sensibilidade, setSensibilidade] = useState(6);
  const nivel = useRef<HTMLDivElement>(null);
  const sensRef = useRef(sensibilidade);
  sensRef.current = sensibilidade;
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; quadro: number } | null>(null);

  const parar = useCallback(() => {
    const a = audio.current;
    audio.current = null;
    if (!a) return;
    cancelAnimationFrame(a.quadro);
    a.stream.getTracks().forEach(t => t.stop());
    void a.ctx.close().catch(() => undefined);
    setOuvindo(false);
  }, []);

  const ouvir = useCallback(async () => {
    setErro(null);
    if (!navigator.mediaDevices?.getUserMedia) { setErro("Este navegador não deixa usar o microfone."); return; }
    try {
      // Sem cancelamento de eco, supressão de ruído nem ganho automático: eles "comem" o grave do baixo.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      await ctx.resume();
      const analisador = ctx.createAnalyser();
      analisador.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analisador);
      const buf = new Float32Array(analisador.fftSize);
      const est = new Estabilizador(3, 1800);
      let ultimo = 0, anterior: number | null = null;
      const passo = (t: number) => {
        if (!audio.current) return;
        audio.current.quadro = requestAnimationFrame(passo);
        if (t - ultimo < 45) return;
        ultimo = t;
        analisador.getFloatTimeDomainData(buf);
        const rms = nivelRms(buf);
        if (nivel.current) nivel.current.style.width = `${Math.min(100, Math.round(Math.sqrt(rms / 0.25) * 100))}%`;
        const leitura = rms >= limiarDoVolume(sensRef.current) ? detectarFrequencia(buf, ctx.sampleRate) : null;
        const n = leitura && leitura.clareza >= 0.6 ? { ...notaDaFrequencia(leitura.frequencia), frequencia: leitura.frequencia } : null;
        const mostrar = est.passo(n, t);
        setNota(mostrar ? { ...mostrar } : null);
        if (mostrar && mostrar.midi !== anterior) setHistorico(h => (h[0] === mostrar.midi ? h : [mostrar.midi, ...h].slice(0, 10)));
        anterior = mostrar?.midi ?? anterior;
      };
      audio.current = { ctx, stream, quadro: requestAnimationFrame(passo) };
      setOuvindo(true);
    } catch (e) {
      const nome = e instanceof DOMException ? e.name : "";
      setErro(nome === "NotAllowedError" || nome === "SecurityError"
        ? "Sem permissão para o microfone. Libere o microfone para o NordTool e tente de novo."
        : "Não deu para abrir o microfone.");
    }
  }, []);

  // Abre já ouvindo; fecha o microfone ao sair.
  useEffect(() => { void ouvir(); return parar; }, [ouvir, parar]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const ins = instrumento(idBaixo);
  const letra = nota ? letraDaNota(nota.midi, notacao) : "";
  const nomeGrande = nota ? nomeDaNotaExibida(nota.midi, notacao) : "";
  const outroNome = nota ? (notacao.nomes === "solfejo" ? letra : emSolfejo(letra)) : "";
  const cor = nota ? corDaNota(letra) : null;
  const afinacao = nota ? textoDaAfinacao(nota.cents) : null;
  const ondeTocar = nota ? posicoes(nota.midi, ins.cordas, ins.casas) : [];
  const maisFacil = ondeTocar.length ? ondeTocar.reduce((a, b) => (b.casa < a.casa ? b : a)) : null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal aria-label="Reconhecer nota" data-tema-fixo onClick={onFechar}>
      <div className="flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-y-auto rounded-t-2xl bg-[#14121b] text-slate-100 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${ouvindo ? "bg-red-500/20 text-red-300" : "bg-white/10 text-slate-400"}`}>
            {ouvindo ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
          </span>
          <div className="mr-auto min-w-0">
            <h2 className="text-base font-black leading-tight">Reconhecer nota</h2>
            <p className="text-[11px] text-slate-400">{ouvindo ? "Ouvindo pelo microfone…" : "Microfone desligado"}</p>
          </div>
          <div className="flex rounded-lg bg-white/5 p-0.5" role="radiogroup" aria-label="Baixo">
            {(["baixo4", "baixo5"] as const).map(b => (
              <button key={b} type="button" role="radio" aria-checked={idBaixo === b} onClick={() => setIdBaixo(b)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${idBaixo === b ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>{b === "baixo4" ? "4 cordas" : "5 cordas"}</button>
            ))}
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {erro && <p role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{erro}</p>}

          {/* Nota grande */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-stretch">
            <div aria-live="polite" aria-label={nota ? `Nota ${nomeGrande}, oitava ${oitavaDoMidi(nota.midi)}` : "Nenhuma nota"}
              className="grid h-44 w-44 shrink-0 place-items-center rounded-full text-center shadow-lg transition-colors duration-200"
              style={{ background: cor ? cor.fundo : "rgba(255,255,255,0.06)", color: cor ? cor.texto : "#94a3b8", boxShadow: cor ? `0 0 40px ${cor.fundo}88` : undefined }}>
              {nota ? (
                <span>
                  <span className="block text-7xl font-black leading-none tracking-tight">{nomeGrande}</span>
                  <span className="mt-1 block text-sm font-bold opacity-90">{outroNome} · oitava {oitavaDoMidi(nota.midi)}</span>
                </span>
              ) : <span className="px-6 text-sm font-semibold leading-snug">{ouvindo ? "Toque uma nota e deixe soar" : "—"}</span>}
            </div>

            <div className="flex w-full flex-col justify-center gap-3">
              {/* Afinador */}
              <div>
                <div className="mb-1 flex items-end justify-between text-[11px] font-bold text-slate-400">
                  <span>♭ mais grave</span>
                  <span className={`text-base ${afinacao?.afinado ? "text-emerald-300" : afinacao ? "text-amber-300" : "text-slate-500"}`}>
                    {afinacao ? `${afinacao.texto}${afinacao.afinado ? "" : ` (${nota!.cents > 0 ? "+" : ""}${nota!.cents} cents)`}` : "Afinação"}
                  </span>
                  <span>mais agudo ♯</span>
                </div>
                <div className="relative h-10 overflow-hidden rounded-lg bg-white/5" aria-hidden>
                  <div className="absolute inset-y-0 left-1/2 w-[10%] -translate-x-1/2 bg-emerald-500/25" />
                  {[-40, -30, -20, -10, 10, 20, 30, 40].map(c => <div key={c} className="absolute bottom-0 h-3 w-px bg-white/20" style={{ left: `${50 + c}%` }} />)}
                  <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-emerald-400" />
                  {nota && (
                    <div className={`absolute inset-y-1 w-2 -translate-x-1/2 rounded-full transition-[left] duration-150 ${afinacao?.afinado ? "bg-emerald-300" : "bg-amber-300"}`}
                      style={{ left: `${50 + Math.max(-50, Math.min(50, nota.cents))}%` }} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-white/5 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Frequência</p>
                  <p className="text-lg font-black tabular-nums">{nota ? `${nota.frequencia.toFixed(1).replace(".", ",")} Hz` : "—"}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-2 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mais fácil de tocar</p>
                  <p className="text-lg font-black">{maisFacil ? `Corda ${ins.nomesCordas[maisFacil.corda]} · ${maisFacil.casa === 0 ? "solta" : `casa ${maisFacil.casa}`}` : nota ? "fora do braço" : "—"}</p>
                </div>
              </div>
              {/* Volume que chega */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="w-24 shrink-0">Som no microfone</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div ref={nivel} className="h-full w-0 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 transition-[width] duration-75" /></div>
              </div>
            </div>
          </div>

          {/* Braço do baixo */}
          <section aria-label="Onde a nota fica no braço">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Onde tocar no braço {ondeTocar.length > 0 && <span className="normal-case tracking-normal text-slate-500">· {ondeTocar.length} {ondeTocar.length === 1 ? "lugar" : "lugares"} (o anel branco é o mais fácil)</span>}
            </h3>
            <Braco cordas={ins.cordas} nomes={ins.nomesCordas} casas={ins.casas} posicoes={ondeTocar} facil={maisFacil} nome={nomeGrande} cor={cor} />
          </section>

          {/* Últimas notas */}
          <section aria-label="Últimas notas">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Últimas notas</h3>
            {historico.length === 0 ? <p className="text-xs text-slate-500">As notas reconhecidas aparecem aqui, da mais nova para a mais antiga.</p> : (
              <ol className="flex flex-wrap gap-1.5">
                {historico.map((m, i) => {
                  const l = letraDaNota(m, notacao), c = corDaNota(l);
                  return <li key={`${i}-${m}`} className="rounded-lg px-2.5 py-1 text-sm font-black" style={{ background: c.fundo, color: c.texto, opacity: 1 - i * 0.07 }}>{nomeDaNotaExibida(m, notacao)}<sub className="ml-0.5 text-[10px] font-bold">{oitavaDoMidi(m)}</sub></li>;
                })}
              </ol>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
            {ouvindo
              ? <button type="button" onClick={parar} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15"><MicOff className="h-4 w-4" />Parar de ouvir</button>
              : <button type="button" onClick={() => void ouvir()} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-500"><Mic className="h-4 w-4" />Ouvir</button>}
            <label className="flex min-w-[220px] flex-1 items-center gap-2 text-xs text-slate-400">
              Sensibilidade
              <input type="range" min={1} max={10} value={sensibilidade} onChange={e => setSensibilidade(Number(e.target.value))} aria-label="Sensibilidade do microfone" className="flex-1 accent-red-500" />
              <span className="w-5 text-right font-bold tabular-nums text-slate-200">{sensibilidade}</span>
            </label>
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            Dica: deixe a caixinha de som perto do celular, toque uma nota de cada vez e deixe soar. Se reconhecer barulho do ambiente,
            diminua a sensibilidade; se não pegar notas baixinhas, aumente. O som não sai do aparelho.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Braço do baixo visto de frente, com a corda mais grave embaixo (como na tablatura) e a nota acesa em cada lugar em que ela existe. */
function Braco({ cordas, nomes, casas, posicoes: pos, facil, nome, cor }: {
  cordas: number[]; nomes: string[]; casas: number; posicoes: { corda: number; casa: number }[]; facil: { corda: number; casa: number } | null;
  nome: string; cor: { fundo: string; texto: string } | null;
}) {
  const W = 1000, margem = 46, alturaCorda = 34, H = alturaCorda * (cordas.length + 1);
  const larg = (W - margem - 10) / (casas + 0.6);
  const xCasa = (c: number) => (c === 0 ? margem - 18 : margem + (c - 0.5) * larg);
  const yCorda = (i: number) => H - alturaCorda * (i + 1); // corda 0 (mais grave) embaixo
  return (
    <div className="overflow-x-auto rounded-xl bg-[#2a1d14] p-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto min-w-[560px] w-full" role="img" aria-label="Braço do baixo">
        {/* Trastes e marcações */}
        {Array.from({ length: casas + 1 }, (_, c) => (
          <line key={c} x1={margem + c * larg} x2={margem + c * larg} y1={alturaCorda / 2} y2={H - alturaCorda / 2} stroke={c === 0 ? "#f1e6d0" : "#9a8a74"} strokeWidth={c === 0 ? 6 : 2} />
        ))}
        {MARCAS.filter(m => m <= casas).map(m => (
          m === 12
            ? [0.33, 0.67].map(f => <circle key={`${m}-${f}`} cx={xCasa(m)} cy={H * f} r={6} fill="#d9c9ad" opacity={0.5} />)
            : <circle key={m} cx={xCasa(m)} cy={H / 2} r={6} fill="#d9c9ad" opacity={0.5} />
        ))}
        {Array.from({ length: casas }, (_, i) => i + 1).filter(c => c === 1 || c % 2 === 1 || c === 12).map(c => (
          <text key={c} x={xCasa(c)} y={H - 4} textAnchor="middle" fontSize={11} fill="#bfae92" fontWeight={700}>{c}</text>
        ))}
        {/* Cordas */}
        {cordas.map((_, i) => (
          <g key={i}>
            <line x1={margem} x2={W - 6} y1={yCorda(i)} y2={yCorda(i)} stroke="#d8d2c8" strokeWidth={1.5 + (cordas.length - i) * 0.7} />
            <text x={12} y={yCorda(i) + 5} fontSize={15} fontWeight={800} fill="#f1e6d0">{nomes[i]}</text>
          </g>
        ))}
        {/* Onde a nota está */}
        {cor && pos.map(p => {
          const x = xCasa(p.casa), y = yCorda(p.corda), destaque = facil && p.corda === facil.corda && p.casa === facil.casa;
          return (
            <g key={`${p.corda}-${p.casa}`}>
              {destaque && <circle cx={x} cy={y} r={17} fill="none" stroke="#ffffff" strokeWidth={3} />}
              <circle cx={x} cy={y} r={13} fill={cor.fundo} stroke="#00000055" strokeWidth={1} />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize={nome.length > 2 ? 9 : 12} fontWeight={900} fill={cor.texto}>{nome}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
