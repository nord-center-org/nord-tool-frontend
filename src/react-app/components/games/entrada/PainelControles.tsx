import { useEffect, useRef, useState, type ReactNode } from "react";
import { Gamepad2, Keyboard, RotateCcw, Smartphone, X } from "lucide-react";
import {
  ACOES, CONFIG_PADRAO, NOME_ACAO, nomeDaTecla, salvarConfig, trocarTecla, type AcaoControle, type ConfigControles,
} from "@/react-app/utils/games/configControles";
import { gamepadsConectados, lerGamepad } from "./entrada";
import { useConfigControles } from "./useConfigControles";

function Opcoes<T extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: T; opcoes: { v: T; r: string }[]; aoMudar: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap items-center gap-1.5">
      <span className="w-28 text-xs font-bold text-white/60">{rotulo}</span>
      {opcoes.map(o => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} onClick={() => aoMudar(o.v)}
          className={`rounded-lg px-2.5 py-1 text-xs font-black ${valor === o.v ? "bg-cyan-400 text-slate-950" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>{o.r}</button>
      ))}
    </div>
  );
}

function Chave({ rotulo, valor, aoMudar }: { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-white/80">
      <input type="checkbox" checked={valor} onChange={e => aoMudar(e.target.checked)} className="h-4 w-4 accent-cyan-400" />{rotulo}
    </label>
  );
}

function Secao({ icone, titulo, children }: { icone: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-fuchsia-300">{icone}{titulo}</h3>
      {children}
    </section>
  );
}

/** Teste ao vivo de um gamepad: mostra a direção e os botões apertados. */
function TesteGamepad({ indice, nome }: { indice: number; nome: string }) {
  const [l, setL] = useState(() => lerGamepad(indice));
  useEffect(() => {
    let q = 0;
    const laco = () => { setL(lerGamepad(indice)); q = requestAnimationFrame(laco); };
    q = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(q);
  }, [indice]);
  const luz = (on: boolean, txt: string) => <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-black ${on ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-white/50"}`}>{txt}</span>;
  return (
    <li className="flex flex-wrap items-center gap-1.5 rounded-xl bg-black/30 px-2 py-1.5 text-xs">
      <Gamepad2 className="h-4 w-4 text-cyan-300" /><span className="mr-auto font-bold">Controle {indice + 1} · {nome}</span>
      {luz(l?.direcao === "cima", "↑")}{luz(l?.direcao === "baixo", "↓")}{luz(l?.direcao === "esquerda", "←")}{luz(l?.direcao === "direita", "→")}
      {luz(!!l?.a, "A")}{luz(!!l?.b, "B")}{luz(!!l?.pausa, "Start")}
    </li>
  );
}

/**
 * Preferências de controle deste aparelho: controle na tela, teclas do teclado e o controle de videogame.
 * {@code soToque} esconde a parte do teclado (no celular que é controle).
 */
export default function PainelControles({ onFechar, soToque = false }: { onFechar: () => void; soToque?: boolean }) {
  const cfg = useConfigControles();
  const [ouvindo, setOuvindo] = useState<AcaoControle | null>(null);
  const [pads, setPads] = useState(gamepadsConectados);
  const caixa = useRef<HTMLDivElement>(null);
  const mudar = (p: Partial<ConfigControles>) => salvarConfig({ ...cfg, ...p });

  // Gamepads entram e saem (o navegador só os mostra depois de apertar um botão).
  useEffect(() => {
    const atualizar = () => setPads(gamepadsConectados());
    window.addEventListener("gamepadconnected", atualizar);
    window.addEventListener("gamepaddisconnected", atualizar);
    const t = window.setInterval(atualizar, 1000);
    return () => { window.removeEventListener("gamepadconnected", atualizar); window.removeEventListener("gamepaddisconnected", atualizar); window.clearInterval(t); };
  }, []);

  // Esperando a nova tecla: a próxima tecla apertada vira a tecla da ação (Esc cancela).
  useEffect(() => {
    if (!ouvindo) return;
    const tecla = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape" || ouvindo === "pausa") salvarConfig(trocarTecla(cfg, ouvindo, e.code));
      setOuvindo(null);
    };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [ouvindo, cfg]);

  useEffect(() => { caixa.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Controles" data-sem-atalho
        onKeyDown={e => { if (e.key === "Escape" && !ouvindo) onFechar(); }}
        className="flex max-h-[92vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-t-3xl bg-slate-950 p-4 text-white shadow-[0_0_60px_rgba(34,211,238,.3)] ring-1 ring-cyan-400/30 outline-none sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase italic tracking-tight">Controles</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar controles" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-white/50">Vale para este aparelho e já funciona na partida em andamento.</p>

        <Secao icone={<Smartphone className="h-4 w-4" />} titulo="Controle na tela (toque)">
          {!soToque && <Opcoes rotulo="Mostrar" valor={cfg.naTela} aoMudar={v => mudar({ naTela: v })}
            opcoes={[{ v: "auto", r: "Automático" }, { v: "sempre", r: "Sempre" }, { v: "nunca", r: "Nunca" }]} />}
          <Opcoes rotulo="Direcional" valor={cfg.estilo} aoMudar={v => mudar({ estilo: v })}
            opcoes={[{ v: "analogico", r: "Analógico (arrastar)" }, { v: "setas", r: "Setas (tocar)" }]} />
          <Opcoes rotulo="Tamanho" valor={cfg.tamanho} aoMudar={v => mudar({ tamanho: v })}
            opcoes={[{ v: "p", r: "Pequeno" }, { v: "m", r: "Médio" }, { v: "g", r: "Grande" }]} />
          <div className="flex flex-wrap gap-4 pt-1">
            <Chave rotulo="Canhoto (direcional à direita)" valor={cfg.canhoto} aoMudar={v => mudar({ canhoto: v })} />
            <Chave rotulo="Vibrar" valor={cfg.vibrar} aoMudar={v => mudar({ vibrar: v })} />
          </div>
        </Secao>

        {!soToque && (
          <Secao icone={<Keyboard className="h-4 w-4" />} titulo="Teclado">
            <ul className="space-y-1">
              {ACOES.map(a => (
                <li key={a} className="flex items-center gap-2 text-xs">
                  <span className="w-20 font-bold text-white/70">{NOME_ACAO[a]}</span>
                  <span className="flex flex-1 flex-wrap gap-1">
                    {cfg.teclas[a].map(t => <kbd key={t} className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">{nomeDaTecla(t)}</kbd>)}
                  </span>
                  <button type="button" onClick={() => setOuvindo(a)} aria-label={`Trocar a tecla de ${NOME_ACAO[a]}`}
                    className={`rounded-lg px-2 py-1 text-[11px] font-black ${ouvindo === a ? "animate-pulse bg-amber-400 text-slate-950" : "bg-white/10 hover:bg-white/20"}`}>
                    {ouvindo === a ? "Aperte a tecla…" : "Trocar"}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => mudar({ teclas: CONFIG_PADRAO.teclas })} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold hover:bg-white/20">
              <RotateCcw className="h-3.5 w-3.5" />Teclas padrão
            </button>
          </Secao>
        )}

        <Secao icone={<Gamepad2 className="h-4 w-4" />} titulo="Controle de videogame">
          <p className="text-xs text-white/60">Conecte por Bluetooth ou USB e aperte qualquer botão para ele aparecer. Cruz ou analógico andam, A/X é o botão A, B/Y é o B e Start pausa.{soToque ? "" : " O 1º controle joga junto com o teclado; os outros podem entrar como novos jogadores na preparação da partida."}</p>
          {pads.length ? <ul className="space-y-1" aria-label="Controles conectados">{pads.map(p => <TesteGamepad key={p.indice} indice={p.indice} nome={p.nome} />)}</ul>
            : <p className="rounded-xl bg-black/30 px-2 py-2 text-xs text-white/50">Nenhum controle encontrado ainda.</p>}
          <div className="flex flex-wrap items-center gap-4">
            <Chave rotulo="Trocar A e B" valor={cfg.gamepadTrocarAB} aoMudar={v => mudar({ gamepadTrocarAB: v })} />
            <label className="flex items-center gap-2 text-xs font-bold text-white/80">Sensibilidade do analógico
              <input type="range" min={0.2} max={0.8} step={0.05} value={1 - cfg.zonaMorta} aria-label="Sensibilidade do analógico"
                onChange={e => mudar({ zonaMorta: Math.round((1 - Number(e.target.value)) * 100) / 100 })} className="accent-cyan-400" />
            </label>
          </div>
        </Secao>
      </div>
    </div>
  );
}
