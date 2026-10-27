import { ArrowLeft, Box, ListChecks, Maximize, Minus, Plus, RotateCcw, TrendingUp, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import AnexarProjeto from "@/react-app/components/escadinha/AnexarProjeto";
import PainelCiclos from "@/react-app/components/escadinha/PainelCiclos";
import Planta2D from "@/react-app/components/escadinha/Planta2D";
import Torre3D, { type ControleTorre } from "@/react-app/components/escadinha/Torre3D";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useObra } from "@/react-app/hooks/useObra";
import {
  alternarStatus, escadinhaExemplo, gerarEscadinha, lerEscadinha, opcoesDaTorre, reaproveitarCiclos, salvarEscadinha, statusCiclo,
  type Escadinha as DadosEscadinha, type StatusAtividade, type Torre,
} from "@/react-app/utils/escadinha";

const armazenamento = () => (typeof window !== "undefined" ? window.localStorage : undefined);
const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Escadinha 3D: croqui da torre a partir da prancha, giro de apresentação, pavimento saindo como fatia e virando planta 2D, ciclos ao lado. */
export default function Escadinha() {
  const { idObra, obra } = useObra();
  const [dados, setDados] = useState<DadosEscadinha>(() => lerEscadinha(armazenamento(), idObra) ?? escadinhaExemplo(hojeIso()));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [planta, setPlanta] = useState(false);
  const [apresentacao, setApresentacao] = useState(true);
  const [painel, setPainel] = useState(true);
  const [anexando, setAnexando] = useState(false);
  const controle = useRef<ControleTorre>(null);
  const visor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDados(lerEscadinha(armazenamento(), idObra) ?? escadinhaExemplo(hojeIso()));
    setSelecionado(null);
    setPlanta(false);
  }, [idObra]);

  const atualizar = (novo: DadosEscadinha) => {
    setDados(novo);
    salvarEscadinha(armazenamento(), idObra, novo);
  };

  const { torre, ciclos } = dados;
  const statusPorPavimento = useMemo(() => {
    const m: Record<string, StatusAtividade> = {};
    ciclos.forEach(c => { m[c.idPavimento] = statusCiclo(c); });
    return m;
  }, [ciclos]);
  const pavSelecionado = torre.pavimentos.find(p => p.id === selecionado) ?? null;
  const tipico = torre.pavimentos.find(p => p.tipo === "tipo") ?? null;

  const selecionar = (id: string | null) => {
    setSelecionado(id);
    setPlanta(false);
    if (id) setPainel(true);
  };

  const novaTorre = (t: Torre) => {
    const inicio = ciclos[0]?.inicio ?? hojeIso();
    atualizar({ torre: t, ciclos: reaproveitarCiclos(gerarEscadinha(t.pavimentos, inicio), ciclos) });
    setAnexando(false);
    selecionar(null);
    setApresentacao(true);
  };

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void visor.current?.requestFullscreen?.();
  };

  const botao = "flex h-10 w-10 items-center justify-center text-slate-200 hover:bg-slate-700/80 hover:text-white";

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <CabecalhoPagina
        icone={TrendingUp}
        titulo="Escadinha"
        subtitulo={`Prédio 3D interativo e ciclos por pavimento${obra ? ` · ${obra.nmObra}` : ""}`}
        acoes={
          <>
            <button type="button" onClick={() => setAnexando(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
              <Upload className="h-4 w-4" /> Anexar projeto
            </button>
            <button type="button" onClick={() => setPainel(p => !p)} aria-expanded={painel}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <ListChecks className="h-4 w-4" /> Ciclos
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-12.5rem)] lg:min-h-[560px] lg:flex-row">
        <section ref={visor} className="relative h-[70vh] min-h-[420px] overflow-hidden lg:flex-1 rounded-3xl border border-slate-800 bg-slate-900 shadow-lg lg:h-auto" aria-label="Prédio 3D interativo">
          <Torre3D
            ref={controle}
            torre={torre}
            selecionado={selecionado}
            statusPorPavimento={statusPorPavimento}
            apresentacao={apresentacao}
            onInteragir={() => setApresentacao(false)}
            onSelecionar={selecionar}
            onFatiaPronta={() => setPlanta(true)}
          />

          <div className="pointer-events-none absolute left-4 top-4 max-w-[60%]">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{torre.origem === "exemplo" ? "Exemplo · anexe o projeto" : "Croqui do projeto"}</p>
            <h3 className="truncate text-lg font-bold text-white">{torre.nome}</h3>
            <p className="text-xs font-medium text-slate-400">
              {torre.pavimentos.length} pavimentos{torre.arquivo ? ` · ${torre.arquivo}` : ""}
            </p>
          </div>

          {apresentacao && !selecionado && (
            <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full sm:block bg-slate-800/80 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur animate-aparecer">
              Clique no prédio para interagir · toque num pavimento para abrir a planta
            </p>
          )}

          {!planta && (
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3">
              {!selecionado && (
                <div className="hidden h-36 w-52 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90 p-2 shadow-lg sm:block">
                  <p className="px-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Planta · {tipico?.nome ?? "tipo"}</p>
                  <div className="h-[calc(100%-1rem)]"><Planta2D torre={torre} pavimento={tipico} mini /></div>
                </div>
              )}
              <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-800/90 shadow-lg backdrop-blur">
                <button type="button" className={botao} onClick={() => controle.current?.aproximar(0.75)} aria-label="Aproximar"><Plus className="h-4 w-4" /></button>
                <button type="button" className={botao} onClick={() => controle.current?.aproximar(1.33)} aria-label="Afastar"><Minus className="h-4 w-4" /></button>
                <button type="button" className={botao} onClick={() => { selecionar(null); controle.current?.vistaInicial(); setApresentacao(true); }} aria-label="Voltar à apresentação"><RotateCcw className="h-4 w-4" /></button>
                <button type="button" className={botao} onClick={telaCheia} aria-label="Tela cheia"><Maximize className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {planta && pavSelecionado && (
            <div className="absolute inset-0 z-30 flex flex-col bg-slate-950/95 animate-aparecer">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">Planta 2D</p>
                  <h3 className="text-lg font-bold text-white">{pavSelecionado.nome}</h3>
                </div>
                <button type="button" onClick={() => selecionar(null)}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700">
                  <ArrowLeft className="h-4 w-4" /> <Box className="h-4 w-4" /> Voltar ao 3D
                </button>
              </div>
              <div className="min-h-0 flex-1 px-4 pb-4 animate-entrada">
                <Planta2D torre={torre} pavimento={pavSelecionado} />
              </div>
            </div>
          )}
        </section>

        {painel && (
          <div className="h-[70vh] lg:h-auto lg:w-[22rem] lg:shrink-0">
            <PainelCiclos
              pavimentos={torre.pavimentos}
              ciclos={ciclos}
              selecionado={selecionado}
              onAlternar={id => atualizar({ torre, ciclos: alternarStatus(ciclos, id) })}
              onVerTudo={() => selecionar(null)}
              onAnexar={() => setAnexando(true)}
              onFechar={() => setPainel(false)}
              onFocar={id => { setApresentacao(false); setSelecionado(id); setPlanta(false); }}
            />
          </div>
        )}
      </div>

      {anexando && <AnexarProjeto inicial={opcoesDaTorre(torre)} onFechar={() => setAnexando(false)} onConfirmar={novaTorre} />}
    </div>
  );
}
