import {
  AlertTriangle, ArrowLeft, Box, Check, CloudOff, ListChecks, Loader2, Maximize, Minus, Pencil, Plus, RotateCcw, Trash2, TrendingUp, Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AnexarProjeto from "@/react-app/components/escadinha/AnexarProjeto";
import EditorPlanta from "@/react-app/components/escadinha/EditorPlanta";
import ModeloCiclos from "@/react-app/components/escadinha/ModeloCiclos";
import PainelCiclos from "@/react-app/components/escadinha/PainelCiclos";
import Planta2D from "@/react-app/components/escadinha/Planta2D";
import Torre3D, { type ControleTorre } from "@/react-app/components/escadinha/Torre3D";
import CabecalhoPagina from "@/react-app/components/ui/CabecalhoPagina";
import { useAuth } from "@/react-app/hooks/useAuth";
import { useObra } from "@/react-app/hooks/useObra";
import { ApiError } from "@/react-app/services/apiClient";
import { escadinhaService, semImagem, type TorreServidor } from "@/react-app/services/EscadinhaService";
import {
  alternarStatus, aplicarModelo, escadinhaExemplo, gerarEscadinha, lerModelo, opcoesDaTorre, reaproveitarCiclos, statusCiclo,
  MODELO_PADRAO, type Ciclo, type ModeloCiclos as Modelo, type StatusAtividade, type Torre,
} from "@/react-app/utils/escadinha";
import { prepararTorre } from "@/react-app/utils/escadinhaApto";
import { podeAcessar } from "@/react-app/utils/sessao";

const hojeIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Torre na tela: o que veio do servidor, o que mudou e a imagem da prancha (carregada só quando precisa). */
interface EstadoTorre {
  chave: string;
  idTorre: number | null;
  nmTorre: string;
  nrVersao: number | null;
  torre: Torre;
  ciclos: Ciclo[];
  temPlanta: boolean;
  /** undefined = ainda não carregada. */
  imagem?: string | null;
  /** Prancha a enviar no próximo salvamento: data URL troca, "" remove. */
  plantaPendente?: string;
  /** Torre de exemplo, ainda não criada no servidor (a primeira edição cria). */
  exemplo?: boolean;
}

type Salvamento = "salvo" | "pendente" | "salvando" | "erro";

const doServidor = (t: TorreServidor): EstadoTorre => ({
  chave: `t${t.idTorre}`,
  idTorre: t.idTorre,
  nmTorre: t.nmTorre,
  nrVersao: t.nrVersao,
  torre: prepararTorre(t.config),
  ciclos: Array.isArray(t.ciclos) ? t.ciclos : [],
  temPlanta: t.temPlanta,
  imagem: t.temPlanta ? undefined : null,
});

function exemplo(nome = "Torre 1"): EstadoTorre {
  const e = escadinhaExemplo(hojeIso());
  return { chave: "exemplo", idTorre: null, nmTorre: nome, nrVersao: null, torre: prepararTorre(e.torre), ciclos: e.ciclos, temPlanta: false, imagem: null, exemplo: true };
}

/**
 * Escadinha 3D: torres da obra (várias, salvas no servidor para todos), croqui a partir da prancha, giro de apresentação,
 * pavimento saindo como fatia e virando planta 2D com apartamentos e lados A/B, ciclos e atividades editáveis ao lado.
 */
export default function Escadinha() {
  const { idObra, obra } = useObra();
  const { usuario } = useAuth();
  const editavel = podeAcessar(usuario?.permissoes, "ESCADINHA", "ESCRITA");
  const [torres, setTorres] = useState<EstadoTorre[]>([]);
  const [atual, setAtual] = useState<string | null>(null);
  const [modelo, setModelo] = useState<Modelo>(MODELO_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvamento, setSalvamento] = useState<Salvamento>("salvo");
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [planta, setPlanta] = useState(false);
  const [apresentacao, setApresentacao] = useState(true);
  const [painel, setPainel] = useState(true);
  const [anexando, setAnexando] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const controle = useRef<ControleTorre>(null);
  const visor = useRef<HTMLDivElement>(null);
  const torresRef = useRef(torres);
  torresRef.current = torres;
  const sujos = useRef(new Set<string>());
  const timer = useRef<number>(0);
  const salvandoRef = useRef(false);

  // ---------------------------------------------------------------- carga

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    sujos.current.clear();
    try {
      const r = await escadinhaService.carregar();
      const lista = r.torres.map(doServidor);
      setModelo(lerModelo(r.modelo));
      const comExemplo = lista.length ? lista : [exemplo()];
      setTorres(comExemplo);
      setAtual(a => (comExemplo.some(t => t.chave === a) ? a : comExemplo[0].chave));
      setSalvamento("salvo");
      setErroSalvar(null);
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : "Não foi possível carregar a escadinha.");
      setTorres([exemplo()]);
      setAtual("exemplo");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    setSelecionado(null);
    setPlanta(false);
  }, [idObra, carregar]);

  // ---------------------------------------------------------------- salvamento automático

  const salvarPendentes = useCallback(async () => {
    if (salvandoRef.current || !sujos.current.size) return;
    salvandoRef.current = true;
    setSalvamento("salvando");
    try {
      while (sujos.current.size) {
        const [chave] = sujos.current;
        sujos.current.delete(chave);
        const t = torresRef.current.find(x => x.chave === chave);
        if (!t) continue;
        const form = {
          nmTorre: t.nmTorre,
          config: semImagem(t.torre),
          ciclos: t.ciclos,
          planta: t.plantaPendente ?? null,
          nrVersao: t.nrVersao ?? undefined,
        };
        const salvo = t.idTorre == null ? await escadinhaService.criarTorre(form) : await escadinhaService.alterarTorre(t.idTorre, form);
        setTorres(lista => lista.map(x => (x.chave === chave ? {
          ...x, idTorre: salvo.idTorre, nrVersao: salvo.nrVersao, temPlanta: salvo.temPlanta, exemplo: false,
          plantaPendente: x.plantaPendente === t.plantaPendente ? undefined : x.plantaPendente,
        } : x)));
        // A ref só atualiza no próximo render: guarda a versão nova já para o próximo salvamento da mesma torre.
        torresRef.current = torresRef.current.map(x => (x.chave === chave ? { ...x, idTorre: salvo.idTorre, nrVersao: salvo.nrVersao, exemplo: false } : x));
      }
      setSalvamento("salvo");
      setErroSalvar(null);
    } catch (e) {
      setSalvamento("erro");
      setErroSalvar(e instanceof ApiError && e.status === 409
        ? "Outra pessoa alterou esta torre. Recarregue para ver a versão atual (suas últimas mudanças não foram salvas)."
        : e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      salvandoRef.current = false;
      if (sujos.current.size) timer.current = window.setTimeout(() => void salvarPendentes(), 800);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const alterarTorre = (chave: string, mudar: (t: EstadoTorre) => EstadoTorre) => {
    setTorres(lista => lista.map(t => (t.chave === chave ? mudar(t) : t)));
    if (!editavel) return;
    sujos.current.add(chave);
    setSalvamento("pendente");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvarPendentes(), 900);
  };

  // ---------------------------------------------------------------- torre atual

  const estado = torres.find(t => t.chave === atual) ?? torres[0];
  const torre = estado?.torre;
  const ciclos = useMemo(() => estado?.ciclos ?? [], [estado]);
  const statusPorPavimento = useMemo(() => {
    const m: Record<string, StatusAtividade> = {};
    ciclos.forEach(c => { m[c.idPavimento] = statusCiclo(c); });
    return m;
  }, [ciclos]);

  // Prancha: carrega quando a planta 2D (ou a miniatura) precisa.
  useEffect(() => {
    if (!estado || estado.imagem !== undefined || !estado.idTorre || !estado.temPlanta) return;
    const { chave, idTorre } = estado;
    escadinhaService.planta(idTorre)
      .then(img => setTorres(lista => lista.map(t => (t.chave === chave ? { ...t, imagem: img } : t))))
      .catch(() => setTorres(lista => lista.map(t => (t.chave === chave ? { ...t, imagem: null } : t))));
  }, [estado]);

  if (carregando || !estado || !torre) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Carregando" /></div>;
  }

  const pavSelecionado = torre.pavimentos.find(p => p.id === selecionado) ?? null;
  const tipico = torre.pavimentos.find(p => p.tipo === "tipo") ?? null;
  const mudarAtual = (mudar: (t: EstadoTorre) => EstadoTorre) => alterarTorre(estado.chave, mudar);

  const selecionar = (id: string | null) => {
    setSelecionado(id);
    setPlanta(false);
    if (id) setPainel(true);
  };

  const trocarTorre = (chave: string) => {
    setAtual(chave);
    selecionar(null);
    setApresentacao(true);
    setRenomeando(false);
  };

  const novaTorreDoProjeto = (t: Torre) => {
    const inicio = estado.ciclos[0]?.inicio ?? hojeIso();
    mudarAtual(e => ({
      ...e,
      torre: prepararTorre(t),
      ciclos: reaproveitarCiclos(gerarEscadinha(t.pavimentos, inicio, undefined, modelo), e.ciclos),
      imagem: t.planta?.imagem ?? null,
      plantaPendente: t.planta?.imagem ?? (e.temPlanta ? "" : undefined),
    }));
    setAnexando(false);
    selecionar(null);
    setApresentacao(true);
  };

  const adicionarTorre = () => {
    const numero = torres.length + 1;
    const base = exemplo(`Torre ${numero}`);
    const nova: EstadoTorre = { ...base, chave: `nova-${Date.now()}`, exemplo: false, torre: { ...base.torre, nome: `Torre ${numero}` } };
    setTorres(lista => [...lista, nova]);
    sujos.current.add(nova.chave);
    setSalvamento("pendente");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvarPendentes(), 300);
    trocarTorre(nova.chave);
    setAnexando(true);
  };

  const excluirTorre = async () => {
    if (!window.confirm(`Excluir a ${estado.nmTorre}? Os ciclos e apartamentos dela também serão apagados.`)) return;
    sujos.current.delete(estado.chave);
    try {
      if (estado.idTorre) await escadinhaService.excluirTorre(estado.idTorre);
      const resto = torres.filter(t => t.chave !== estado.chave);
      const lista = resto.length ? resto : [exemplo()];
      setTorres(lista);
      trocarTorre(lista[0].chave);
    } catch (e) {
      setSalvamento("erro");
      setErroSalvar(e instanceof Error ? e.message : "Não foi possível excluir a torre.");
    }
  };

  const salvarModelo = async (novo: Modelo, aplicar: boolean) => {
    const r = await escadinhaService.salvarModelo(novo);
    setModelo(lerModelo(r.modelo));
    if (aplicar) mudarAtual(e => ({ ...e, ciclos: aplicarModelo(e.ciclos, novo) }));
    setEditandoModelo(false);
  };

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void visor.current?.requestFullscreen?.();
  };

  const botao = "flex h-10 w-10 items-center justify-center text-slate-200 hover:bg-slate-700/80 hover:text-white";
  const indicador = {
    salvo: { icone: <Check className="h-3.5 w-3.5" />, texto: estado.exemplo ? "Exemplo (não salvo)" : "Salvo para todos", cor: "text-emerald-600" },
    pendente: { icone: <Loader2 className="h-3.5 w-3.5" />, texto: "Alterações pendentes", cor: "text-slate-500" },
    salvando: { icone: <Loader2 className="h-3.5 w-3.5 animate-spin" />, texto: "Salvando…", cor: "text-blue-600" },
    erro: { icone: <CloudOff className="h-3.5 w-3.5" />, texto: "Não salvo", cor: "text-red-600" },
  }[salvamento];

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <CabecalhoPagina
        icone={TrendingUp}
        titulo="Escadinha"
        subtitulo={`Prédio 3D, apartamentos e ciclos por pavimento${obra ? ` · ${obra.nmObra}` : ""}`}
        acoes={
          <>
            {editavel && (
              <button type="button" onClick={() => setAnexando(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                <Upload className="h-4 w-4" /> Anexar projeto
              </button>
            )}
            <button type="button" onClick={() => setPainel(p => !p)} aria-expanded={painel}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <ListChecks className="h-4 w-4" /> Ciclos
            </button>
          </>
        }
      />

      {erroCarga && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {erroCarga} Mostrando a torre de exemplo.
          <button type="button" onClick={() => void carregar()} className="ml-auto font-bold underline">Tentar de novo</button>
        </p>
      )}

      {/* Torres da obra */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Torres">
          {torres.map(t => (
            <button key={t.chave} type="button" role="tab" aria-selected={t.chave === estado.chave} onClick={() => trocarTorre(t.chave)}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold ${t.chave === estado.chave ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {t.nmTorre}{t.exemplo ? " (exemplo)" : ""}
            </button>
          ))}
          {editavel && (
            <button type="button" onClick={adicionarTorre} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4" /> Torre
            </button>
          )}
        </div>
        {editavel && (renomeando ? (
          <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); setRenomeando(false); }}>
            <input autoFocus value={estado.nmTorre} maxLength={80} onBlur={() => setRenomeando(false)}
              onChange={e => mudarAtual(t => ({ ...t, nmTorre: e.target.value || "Torre" }))}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold" aria-label="Nome da torre" />
          </form>
        ) : (
          <>
            <button type="button" onClick={() => setRenomeando(true)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Renomear torre"><Pencil className="h-4 w-4" /></button>
            {!estado.exemplo && <button type="button" onClick={() => void excluirTorre()} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir torre"><Trash2 className="h-4 w-4" /></button>}
          </>
        ))}
        <span className={`ml-auto flex items-center gap-1 text-xs font-bold ${indicador.cor}`} role="status">{indicador.icone} {indicador.texto}</span>
      </div>
      {erroSalvar && (
        <p role="alert" className="mb-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erroSalvar}
          <button type="button" onClick={() => void carregar()} className="ml-auto font-bold underline">Recarregar</button>
        </p>
      )}

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-15.5rem)] lg:min-h-[560px] lg:flex-row">
        <section ref={visor} className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-lg lg:h-auto lg:flex-1" aria-label="Prédio 3D interativo">
          <Torre3D
            key={estado.chave}
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
            <h3 className="truncate text-lg font-bold text-white">{estado.nmTorre}</h3>
            <p className="text-xs font-medium text-slate-400">
              {torre.pavimentos.length} pavimentos · {torre.apartamentos?.length ?? 0} apartamentos por andar{torre.arquivo ? ` · ${torre.arquivo}` : ""}
            </p>
          </div>

          {apresentacao && !selecionado && (
            <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full bg-slate-800/80 px-4 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur animate-aparecer sm:block">
              Clique no prédio para interagir · toque num pavimento para abrir a planta
            </p>
          )}

          {!planta && (
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-3">
              {!selecionado && (
                <div className="hidden h-36 w-52 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90 p-2 shadow-lg sm:block">
                  <p className="px-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Planta · {tipico?.nome ?? "tipo"}</p>
                  <div className="h-[calc(100%-1rem)]"><Planta2D torre={torre} pavimento={tipico} imagem={estado.imagem} mini /></div>
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
              <div className="flex items-center justify-between gap-3 p-4 pb-2">
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
                <EditorPlanta torre={torre} pavimento={pavSelecionado} imagem={estado.imagem ?? null} editavel={editavel}
                  onAlterar={t => mudarAtual(e => ({ ...e, torre: t }))} />
              </div>
            </div>
          )}
        </section>

        {painel && (
          <div className="h-[70vh] lg:h-auto lg:w-[23rem] lg:shrink-0">
            <PainelCiclos
              pavimentos={torre.pavimentos}
              ciclos={ciclos}
              selecionado={selecionado}
              editavel={editavel}
              onAlterarCiclos={novos => mudarAtual(e => ({ ...e, ciclos: novos }))}
              onAlternar={id => mudarAtual(e => ({ ...e, ciclos: alternarStatus(e.ciclos, id) }))}
              onVerTudo={() => selecionar(null)}
              onAnexar={() => setAnexando(true)}
              onModelo={() => setEditandoModelo(true)}
              onFechar={() => setPainel(false)}
              onFocar={id => { setApresentacao(false); setSelecionado(id); setPlanta(false); }}
            />
          </div>
        )}
      </div>

      {anexando && <AnexarProjeto inicial={opcoesDaTorre(torre)} onFechar={() => setAnexando(false)} onConfirmar={novaTorreDoProjeto} />}
      {editandoModelo && <ModeloCiclos modelo={modelo} onFechar={() => setEditandoModelo(false)} onSalvar={salvarModelo} />}
    </div>
  );
}
