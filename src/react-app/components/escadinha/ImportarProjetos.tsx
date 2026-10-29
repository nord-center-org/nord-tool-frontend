import { CheckCircle2, CircleAlert, FileArchive, Layers, Loader2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { limites, type Torre } from "@/react-app/utils/escadinha";
import { lerPacote, montarTorreDoPacote, torreDoPacote, type PacoteLido } from "@/react-app/utils/projetoPacote";
import { ROTULO_PRANCHA, torresDoPacote, type TipoPrancha } from "@/react-app/utils/projetoVetorial";

interface ImportarProjetosProps {
  /** Torre aberta agora (o número no nome sugere qual torre do pacote usar). */
  atual: Torre;
  hoje: string;
  onFechar: () => void;
  /** Primeira = torre aberta; as demais viram torres novas. */
  onConfirmar: (torres: Torre[]) => void;
  /** Projeto sem desenho vetorial (escaneado, planta chave): volta para o croqui pela imagem. */
  onCroqui: () => void;
}

const numeroDoNome = (nome: string) => Number(nome.match(/\d+/)?.[0] ?? NaN);

/**
 * Importa o pacote de projetos (ZIP do Construcode ou PDFs): lê as pranchas vetoriais, mostra a torre montada
 * (paredes reais da 1ª fiada, pavimentos do corte, junta), o quantitativo de blocos e o que falta pedir.
 */
export default function ImportarProjetos({ atual, hoje, onFechar, onConfirmar, onCroqui }: ImportarProjetosProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pacote, setPacote] = useState<PacoteLido | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number; atual: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [outras, setOutras] = useState(true);

  const ler = async (arquivos: File[]) => {
    if (!arquivos.length) return;
    setErro(null);
    setPacote(null);
    setProgresso({ feitos: 0, total: 1, atual: "" });
    try {
      const p = await lerPacote(arquivos, (feitos, total, nome) => setProgresso({ feitos, total, atual: nome }));
      setPacote(p);
      const torres = torresDoPacote(p.pranchas);
      const n = numeroDoNome(atual.nome);
      setEscolhida(torres.includes(n) ? n : torres[0] ?? null);
      if (!torres.length) setErro("Não achamos planta de 1ª fiada (modulação) com blocos nesse pacote. Confira se veio a prancha MOD do pavimento tipo.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler os arquivos.");
    } finally {
      setProgresso(null);
    }
  };

  const torres = useMemo(() => (pacote ? torresDoPacote(pacote.pranchas) : []), [pacote]);
  const montada = useMemo(() => (pacote && escolhida !== null ? montarTorreDoPacote(pacote.pranchas, escolhida, hoje) : null), [pacote, escolhida, hoje]);

  const confirmar = () => {
    if (!pacote || !montada || escolhida === null) return;
    const lista = [torreDoPacote(montada, atual.nome, pacote.nome, atual)];
    if (outras) {
      for (const t of torres.filter(t => t !== escolhida)) {
        const m = montarTorreDoPacote(pacote.pranchas, t, hoje);
        if (m) lista.push(torreDoPacote(m, `Torre ${t}`, pacote.nome));
      }
    }
    onConfirmar(lista);
  };

  const caixa = montada ? limites(montada.contorno) : null;
  const totalPav = montada?.pavimentos.length ?? 0;
  const faixa = montada?.projeto.quantitativos[0];
  const blocos1f = faixa ? faixa.itens.reduce((s, i) => s + i.qtd, 0) : 0;
  const metros = faixa ? Object.values(faixa.metrosPorEspessura).reduce((s, v) => s + v, 0) : 0;
  const pranchasDaTorre = montada?.projeto.pranchas ?? [];
  const porTipo = pranchasDaTorre.reduce<Record<string, number>>((m, p) => ({ ...m, [p.tipo]: (m[p.tipo] ?? 0) + 1 }), {});

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-importar"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 id="titulo-importar" className="text-lg font-bold text-slate-800">Importar projetos da obra</h3>
            <p className="text-sm text-slate-500">Envie o ZIP baixado do Construcode (ou os PDFs): o NordTool lê as pranchas vetoriais e monta a torre com as paredes reais.</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!pacote ? (
            <button type="button" onClick={() => entrada.current?.click()} disabled={!!progresso}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); void ler([...e.dataTransfer.files]); }}
              className="flex min-h-[18rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-slate-500 hover:border-blue-400 hover:bg-blue-50/40">
              {progresso ? <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> : <FileArchive className="h-8 w-8 text-blue-600" />}
              <span className="text-sm font-bold text-slate-700">
                {progresso ? `Lendo prancha ${Math.min(progresso.feitos + 1, progresso.total)} de ${progresso.total}…` : "Escolher ou arrastar o ZIP / PDFs dos projetos"}
              </span>
              {progresso ? (
                <>
                  <span className="h-2 w-64 overflow-hidden rounded-full bg-slate-200">
                    <span className="block h-full bg-blue-600 transition-all" style={{ width: `${(progresso.feitos / Math.max(1, progresso.total)) * 100}%` }} />
                  </span>
                  <span className="max-w-full truncate text-xs">{progresso.atual}</span>
                </>
              ) : (
                <span className="text-xs">Fôrma, 1ª fiada (modulação), elevações, graute… · PDF vetorial (como sai do AutoCAD) · ZIP com várias pranchas</span>
              )}
            </button>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-3">
                {torres.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-500">Torre do pacote:</span>
                    {torres.map(t => (
                      <button key={t} type="button" onClick={() => setEscolhida(t)}
                        className={`rounded-full border px-3 py-1 font-bold ${escolhida === t ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        Torre {t}
                      </button>
                    ))}
                  </div>
                )}
                {montada && caixa ? (
                  <>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <svg viewBox={`${caixa.minX - 1} ${-caixa.maxY - 1} ${caixa.largura + 2} ${caixa.profundidade + 2}`} className="block max-h-[52vh] w-full" role="img"
                        aria-label={`Planta da 1ª fiada da Torre ${escolhida}`}>
                        <polygon points={montada.contorno.map(([x, y]) => `${x},${-y}`).join(" ")} fill="#fff7ed" stroke="#fb923c" strokeWidth={0.12} />
                        {montada.paredes.map((p, i) => (
                          <line key={i} x1={p.a[0]} y1={-p.a[1]} x2={p.b[0]} y2={-p.b[1]} stroke={p.esp <= 0.09 ? "#d4a017" : "#334155"} strokeWidth={p.esp} />
                        ))}
                        {montada.junta && (
                          <line x1={montada.junta.a[0]} y1={-montada.junta.a[1]} x2={montada.junta.b[0]} y2={-montada.junta.b[1]} stroke="#dc2626" strokeWidth={0.15} strokeDasharray="0.8 0.5" />
                        )}
                      </svg>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded bg-slate-700" /> Bloco estrutural (14 cm)</span>
                      <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded bg-yellow-600" /> Vedação (9 cm)</span>
                      {montada.junta && <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t-2 border-dashed border-red-600" /> Junta de dilatação (separa lado A e B)</span>}
                    </div>
                  </>
                ) : (
                  <p className="rounded-2xl bg-amber-50 px-3 py-6 text-center text-sm text-amber-800">Escolha uma torre com planta de 1ª fiada.</p>
                )}
                {pacote.falhas.length > 0 && (
                  <details className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                    <summary className="cursor-pointer font-bold">{pacote.falhas.length} arquivo(s) não lidos</summary>
                    <ul className="mt-1 list-disc pl-4">{pacote.falhas.map(f => <li key={f.arquivo}>{f.arquivo}: {f.motivo}</li>)}</ul>
                  </details>
                )}
              </div>

              <div className="space-y-4 text-sm">
                {montada && caixa && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-900">
                    <p className="mb-1 flex items-center gap-1.5 font-bold"><Layers className="h-4 w-4" /> Torre {escolhida}</p>
                    <p>{caixa.largura.toFixed(2)} × {caixa.profundidade.toFixed(2)} m · escala 1:{montada.projeto.escala}</p>
                    <p>{totalPav} pavimentos pelo corte ({montada.pavimentos.filter(p => p.tipo === "tipo").length} tipo)</p>
                    <p>{montada.paredes.length} paredes · {metros.toFixed(0)} m na 1ª fiada</p>
                    <p>{blocos1f.toLocaleString("pt-BR")} blocos na 1ª fiada do pavimento</p>
                    <p>{montada.junta ? "Junta de dilatação achada: ela divide os lados A e B." : "Sem junta escrita: lados pela forma da torre."}</p>
                  </div>
                )}
                {montada && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">O que tem e o que falta</p>
                    <ul className="space-y-1.5">
                      {montada.projeto.checklist.map(c => (
                        <li key={c.item} className="flex gap-2">
                          {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                          <span><span className="font-semibold text-slate-700">{c.item}</span><span className="block text-xs text-slate-500">{c.detalhe}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pranchasDaTorre.length > 0 && (
                  <details className="rounded-xl border border-slate-200 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-bold text-slate-600">
                      {pranchasDaTorre.length} pranchas · {Object.entries(porTipo).map(([t, n]) => `${n} ${ROTULO_PRANCHA[t as TipoPrancha].toLowerCase()}`).join(", ")}
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {pranchasDaTorre.map(p => <li key={p.arquivo}><span className="font-semibold text-slate-700">{p.titulo ?? p.arquivo}</span>{p.revisao ? ` · ${p.revisao}` : ""}</li>)}
                    </ul>
                  </details>
                )}
                {torres.length > 1 && (
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={outras} onChange={e => setOutras(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
                    <span>Criar também as outras torres do pacote ({torres.filter(t => t !== escolhida).map(t => `Torre ${t}`).join(", ")})</span>
                  </label>
                )}
              </div>
            </div>
          )}
          <input ref={entrada} type="file" accept=".zip,.pdf,application/zip,application/pdf" multiple className="hidden"
            onChange={e => { void ler([...(e.target.files ?? [])]); e.target.value = ""; }} />
          {erro && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <p className="mt-3 text-xs text-slate-400">
            Projeto escaneado ou só a planta chave?{" "}
            <button type="button" onClick={onCroqui} className="font-semibold text-blue-600 hover:underline">Montar o croqui pela imagem da prancha</button>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {pacote && (
            <button type="button" onClick={() => { setPacote(null); setErro(null); entrada.current?.click(); }}
              className="mr-auto rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Outro pacote</button>
          )}
          <button type="button" onClick={onFechar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={!montada}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            {outras && torres.length > 1 ? `Montar ${torres.length} torres` : "Montar a torre"}
          </button>
        </div>
      </div>
    </div>
  );
}
