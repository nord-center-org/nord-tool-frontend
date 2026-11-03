import { Edges, GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useCallback, useEffect, useImperativeHandle, type ComponentRef, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";

import CamadasPavimento from "./CamadasPavimento";
import NavegacaoLivre from "./NavegacaoLivre";
import { ORBITA_LIVRE } from "./orbitaLivre";
import type { IconeChao } from "./PecasPavimento";
import { cotas, limites, pilares, type Apartamento, type Lado, type Pavimento, type Ponto, type StatusAtividade, type Torre } from "@/react-app/utils/escadinha";
import { metades as metadesDaTorre } from "@/react-app/utils/escadinhaApto";
import { centroNucleo, paredesPorLado, type Segmento } from "@/react-app/utils/escadinha3d";
import type { Camada, EstadoCamada } from "@/react-app/utils/escadinhaCury";

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

/** Cores do croqui (padrão de modelo estrutural: laje clara, volume translúcido, pilar, destaque laranja). */
const COR = {
  laje: "#e2e8f0",
  borda: "#94a3b8",
  volume: "#93c5fd",
  pilar: "#cbd5e1",
  destaque: "#fb923c",
  terreno: "#334155",
  status: { finalizado: "#34d399", andamento: "#60a5fa", pendente: "#94a3b8" } as Record<StatusAtividade, string>,
};

const ESPESSURA_LAJE = 0.25;
/** Quanto a fatia anda para fora da torre (em larguras da torre). */
const SAIDA = 1.05;

export interface ControleTorre {
  aproximar: (fator: number) => void;
  vistaInicial: () => void;
}

interface Torre3DProps {
  torre: Torre;
  /** Pavimento escolhido (destacado na torre, painel ao lado); um segundo clique abre. */
  selecionado: string | null;
  /** Pavimento aberto: a fatia sai da torre e a câmera vai para cima dela. */
  aberto: string | null;
  statusPorPavimento: Record<string, StatusAtividade>;
  /** O que já foi feito em cada pavimento|lado (da escadinha). */
  camadas?: Map<string, Map<Camada, EstadoCamada>>;
  /** Filtro do 3D: só estas camadas (null = todas). */
  filtroCamadas?: Set<Camada> | null;
  /** Estado de cada elemento (um por atividade) por pavimento|lado, o filtro por elemento e os ícones das atividades sem peça. */
  elementos?: Map<string, Map<string, EstadoCamada>>;
  filtroElementos?: Set<string> | null;
  icones?: IconeChao[];
  apresentacao: boolean;
  onInteragir: () => void;
  onSelecionar: (id: string | null) => void;
  /** Segundo clique no pavimento já escolhido. */
  onAbrir: (id: string) => void;
  /** Chamado quando a fatia terminou de sair e a câmera chegou em cima dela. */
  onFatiaPronta: () => void;
  /** Para de desenhar (janela aberta por cima, leitura de projeto): devolve a CPU/GPU para o resto da tela. */
  pausado?: boolean;
}

function forma(contorno: Ponto[]) {
  const s = new THREE.Shape();
  contorno.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Extrusão do contorno em pé (eixo y para cima; o y da planta vira -z). */
function useExtrusao(contorno: Ponto[], altura: number) {
  return useMemo(() => {
    const g = new THREE.ExtrudeGeometry(forma(contorno), { depth: altura, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [contorno, altura]);
}

interface PavimentoProps {
  pav: Pavimento;
  contorno: Ponto[];
  cota: number;
  saidaX: number;
  selecionado: boolean;
  algumSelecionado: boolean;
  destacado: boolean;
  onPassar: (id: string | null) => void;
  onClicar: (id: string) => void;
  chegou: MutableRefObject<boolean>;
  registrar: (id: string, grupo: THREE.Group | null) => void;
  /** Ainda não começou (a torre "cresce" com a obra): só o contorno apagado. */
  fantasma: boolean;
  camadas: {
    metades: Record<Lado, Ponto[]>;
    apartamentos: Apartamento[];
    nucleoC: Ponto;
    estado: Record<Lado, Map<Camada, EstadoCamada> | undefined>;
    filtro: Set<Camada> | null;
    /** Paredes reais do projeto (pavimento tipo); com elas não há pilares de croqui (alvenaria estrutural). */
    paredes: Record<Lado, Segmento[]> | null;
    semPilares: boolean;
    comodos?: Torre["comodos"];
    aberturas?: Torre["aberturas"];
    planta?: { paredes: NonNullable<Torre["paredes"]>; vaos: NonNullable<Torre["vaos"]>; sacadas: NonNullable<Torre["sacadas"]> } | null;
    elementos?: Record<Lado, Map<string, EstadoCamada> | undefined>;
    filtroElementos?: Set<string> | null;
    icones?: IconeChao[];
  };
}

function PavimentoMesh({ pav, contorno, cota, saidaX, selecionado, algumSelecionado, destacado, onPassar, onClicar, chegou, registrar, fantasma, camadas }: PavimentoProps) {
  const grupo = useRef<THREE.Group>(null);
  const volumeMat = useRef<THREE.MeshStandardMaterial>(null);
  const lajeMat = useRef<THREE.MeshStandardMaterial>(null);
  const laje = useExtrusao(contorno, ESPESSURA_LAJE);
  const volume = useExtrusao(contorno, Math.max(0.1, pav.altura - ESPESSURA_LAJE));
  const colunas = useMemo(() => (camadas.semPilares ? [] : pilares(contorno)), [contorno, camadas.semPilares]);
  const apagado = algumSelecionado && !selecionado;

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    const alvoX = selecionado ? saidaX : 0;
    const alvoY = selecionado ? 0.6 : 0;
    g.position.x = THREE.MathUtils.damp(g.position.x, alvoX, 5, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, cota + alvoY, 5, dt);
    if (selecionado && Math.abs(g.position.x - alvoX) < 0.15) chegou.current = true;
    const opVol = apagado ? 0.02 : destacado || selecionado ? 0.5 : fantasma ? 0.02 : 0.07;
    if (volumeMat.current) volumeMat.current.opacity = THREE.MathUtils.damp(volumeMat.current.opacity, opVol, 6, dt);
    const opLaje = apagado ? 0.18 : fantasma && !destacado && !selecionado ? 0.12 : 1;
    if (lajeMat.current) lajeMat.current.opacity = THREE.MathUtils.damp(lajeMat.current.opacity, opLaje, 6, dt);
  });

  const corVolume = destacado || selecionado ? COR.destaque : COR.volume;
  return (
    <group
      ref={g => { grupo.current = g; registrar(pav.id, g); }}
      position={[0, cota, 0]}
      onPointerOver={e => { e.stopPropagation(); onPassar(pav.id); }}
      onPointerOut={() => onPassar(null)}
      onClick={e => { e.stopPropagation(); onClicar(pav.id); }}
    >
      <mesh geometry={laje} castShadow receiveShadow>
        <meshStandardMaterial ref={lajeMat} color={destacado || selecionado ? "#fed7aa" : COR.laje} transparent roughness={0.8} />
        <Edges color={COR.borda} />
      </mesh>
      <mesh geometry={volume} position={[0, ESPESSURA_LAJE, 0]}>
        <meshStandardMaterial ref={volumeMat} color={corVolume} transparent opacity={0.07} depthWrite={false} roughness={0.3} />
        {!apagado && <Edges color="#64748b" />}
      </mesh>
      {!apagado && !fantasma && (
        <CamadasPavimento contorno={contorno} metades={camadas.metades} apartamentos={camadas.apartamentos} altura={pav.altura}
          nucleoC={camadas.nucleoC} estado={camadas.estado} filtro={camadas.filtro} comElevador paredesReais={camadas.paredes}
          comodos={camadas.comodos} aberturas={camadas.aberturas} planta={camadas.planta} elementos={camadas.elementos}
          filtroElementos={camadas.filtroElementos} icones={camadas.icones} />
      )}
      {!apagado && !fantasma && colunas.map(([x, y], i) => (
        <mesh key={i} position={[x, ESPESSURA_LAJE + (pav.altura - ESPESSURA_LAJE) / 2, -y]}>
          <boxGeometry args={[0.45, pav.altura - ESPESSURA_LAJE, 0.45]} />
          <meshStandardMaterial color={COR.pilar} />
        </mesh>
      ))}
    </group>
  );
}

/** Guindaste simples ao lado da torre, só para dar cara de obra. */
function Guindaste({ x, z, altura }: { x: number; z: number; altura: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, altura / 2, 0]}>
        <boxGeometry args={[0.7, altura, 0.7]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[8, altura + 0.5, 0]}>
        <boxGeometry args={[22, 0.5, 0.5]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[-3.5, altura + 0.2, 0]}>
        <boxGeometry args={[2.5, 1.2, 1.2]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0, altura + 2.2, 0]}>
        <boxGeometry args={[0.6, 3, 0.6]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

interface RotulosProps {
  pavimentos: Pavimento[];
  grupos: MutableRefObject<Record<string, THREE.Group | null>>;
  botoes: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  x: number;
}

/** Posiciona os rótulos (botões HTML fora do canvas) ao lado de cada pavimento, acompanhando a câmera e a fatia. */
function ProjetarRotulos({ pavimentos, grupos, botoes, x }: RotulosProps) {
  const ponto = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const p of pavimentos) {
      const g = grupos.current[p.id];
      const b = botoes.current[p.id];
      if (!g || !b) continue;
      ponto.set(x + 1.6, p.altura / 2, 0);
      g.localToWorld(ponto);
      ponto.project(camera);
      const visivel = ponto.z < 1 && Math.abs(ponto.x) < 1.2 && Math.abs(ponto.y) < 1.2;
      const transform = `translate(${Math.round(((ponto.x + 1) / 2) * size.width)}px, ${Math.round(((1 - ponto.y) / 2) * size.height)}px) translate(-50%, -50%)`;
      if (b.style.transform !== transform) b.style.transform = transform;
      const visibilidade = visivel ? "visible" : "hidden";
      if (b.style.visibility !== visibilidade) b.style.visibility = visibilidade;
    }
  });
  return null;
}

interface CameraProps {
  alvo: MutableRefObject<{ posicao: THREE.Vector3; foco: THREE.Vector3 } | null>;
  controles: MutableRefObject<OrbitControlsImpl | null>;
  chegou: MutableRefObject<boolean>;
  esperandoFatia: MutableRefObject<boolean>;
  onFatiaPronta: () => void;
}

/** Leva a câmera suavemente até o alvo pedido (vista de cima da fatia, vista inicial) e solta o controle quando chega. */
function MovimentoCamera({ alvo, controles, chegou, esperandoFatia, onFatiaPronta }: CameraProps) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const a = alvo.current;
    const c = controles.current;
    if (!a || !c) return;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, a.posicao.x, 3.2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, a.posicao.y, 3.2, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, a.posicao.z, 3.2, dt);
    c.target.x = THREE.MathUtils.damp(c.target.x, a.foco.x, 3.2, dt);
    c.target.y = THREE.MathUtils.damp(c.target.y, a.foco.y, 3.2, dt);
    c.target.z = THREE.MathUtils.damp(c.target.z, a.foco.z, 3.2, dt);
    c.update();
    if (camera.position.distanceTo(a.posicao) < 0.5 && c.target.distanceTo(a.foco) < 0.3) {
      alvo.current = null;
      if (esperandoFatia.current && chegou.current) {
        esperandoFatia.current = false;
        onFatiaPronta();
      }
    }
  });
  return null;
}

/** Prédio 3D do croqui: gira como apresentação até o primeiro toque; cubo de vistas no canto; pavimentos clicáveis. */
const Torre3D = forwardRef<ControleTorre, Torre3DProps>(function Torre3D(
  {
    torre, selecionado, aberto, statusPorPavimento, camadas, filtroCamadas = null, elementos, filtroElementos = null, icones = [], apresentacao, onInteragir,
    onSelecionar, onAbrir, onFatiaPronta, pausado = false,
  }, ref,
) {
  const planta = useMemo(() => (torre.comodos?.length && torre.paredes ? { paredes: torre.paredes, vaos: torre.vaos ?? [], sacadas: torre.sacadas ?? [] } : null), [torre.comodos, torre.paredes, torre.vaos, torre.sacadas]);
  const metadesT = useMemo(() => (torre.lados ? metadesDaTorre(torre.contorno, torre.lados) : { A: torre.contorno, B: [] as Ponto[] }), [torre.contorno, torre.lados]);
  const nucleoC = useMemo(() => centroNucleo(torre.contorno), [torre.contorno]);
  const paredesLados = useMemo(() => (torre.paredes?.length && torre.lados ? paredesPorLado(torre.paredes, torre.lados) : null), [torre.paredes, torre.lados]);
  // A torre cresce com a obra: pavimento sem nada marcado e sem a laje de baixo pronta fica fantasma.
  // Torre sem nenhuma marcação (ou com filtro ligado) mostra o croqui inteiro.
  const fantasmas = useMemo(() => {
    const f = new Set<string>();
    if (!camadas?.size || filtroCamadas) return f;
    const naGrade = torre.pavimentos.filter(p => p.tipo !== "subsolo" && p.tipo !== "barrilete");
    naGrade.forEach((p, i) => {
      const tem = (id: string) => camadas.has(`${id}|A`) || camadas.has(`${id}|B`);
      const lajeAbaixo = i > 0 && (["A", "B"] as Lado[]).some(l => camadas.get(`${naGrade[i - 1].id}|${l}`)?.get("laje") === "E");
      if (i > 0 && !tem(p.id) && !lajeAbaixo) f.add(p.id);
    });
    // Barrilete acompanha o último pavimento.
    const ultimo = naGrade[naGrade.length - 1];
    if (ultimo && f.has(ultimo.id)) torre.pavimentos.filter(p => p.tipo === "barrilete").forEach(p => f.add(p.id));
    return f;
  }, [camadas, filtroCamadas, torre.pavimentos]);
  const [passando, setPassando] = useState<string | null>(null);
  const controles = useRef<OrbitControlsImpl | null>(null);
  const alvo = useRef<{ posicao: THREE.Vector3; foco: THREE.Vector3 } | null>(null);
  const chegou = useRef(false);
  const esperandoFatia = useRef(false);
  const grupos = useRef<Record<string, THREE.Group | null>>({});
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const registrar = useCallback((id: string, g: THREE.Group | null) => { grupos.current[id] = g; }, []);

  const lim = useMemo(() => limites(torre.contorno), [torre.contorno]);
  const niveis = useMemo(() => cotas(torre.pavimentos), [torre.pavimentos]);
  const topo = niveis.length ? niveis[niveis.length - 1] + torre.pavimentos[torre.pavimentos.length - 1].altura : 10;
  const base = niveis[0] ?? 0;
  const tamanho = Math.max(lim.largura, lim.profundidade, topo - base);
  const centroY = (topo + base) / 2;
  const posInicial = useMemo(() => new THREE.Vector3(tamanho * 1.55, centroY + tamanho * 0.85, tamanho * 1.55), [tamanho, centroY]);
  const focoInicial = useMemo(() => new THREE.Vector3(0, centroY, 0), [centroY]);
  const saidaX = lim.largura * SAIDA + 4;

  useImperativeHandle(ref, () => ({
    aproximar: (fator: number) => {
      const c = controles.current;
      if (!c) return;
      const cam = c.object;
      const dir = cam.position.clone().sub(c.target).multiplyScalar(fator);
      alvo.current = { posicao: c.target.clone().add(dir), foco: c.target.clone() };
    },
    vistaInicial: () => { alvo.current = { posicao: posInicial.clone(), foco: focoInicial.clone() }; },
  }), [posInicial, focoInicial]);

  // O primeiro toque durante a apresentação só para o giro; não abre pavimento.
  const apresentandoNoToque = useRef(false);
  const clicar = (id: string) => {
    if (apresentandoNoToque.current) return;
    onInteragir();
    if (id === selecionado) onAbrir(id); else onSelecionar(id);
  };

  // Pavimento aberto (pelo 3D ou pela lista): a fatia sai e a câmera vai para cima dela; fechado, volta à apresentação.
  useEffect(() => {
    const i = torre.pavimentos.findIndex(p => p.id === aberto);
    if (i < 0) {
      esperandoFatia.current = false;
      alvo.current = { posicao: posInicial.clone(), foco: focoInicial.clone() };
      return;
    }
    chegou.current = false;
    esperandoFatia.current = true;
    const y = niveis[i] + 0.6;
    // Primeiro a fatia desliza para fora (vista de onde a pessoa está); depois a câmera sobe para cima dela.
    const t = window.setTimeout(() => {
      alvo.current = {
        posicao: new THREE.Vector3(saidaX, y + Math.max(lim.largura, lim.profundidade) * 1.7, 0.01),
        foco: new THREE.Vector3(saidaX, y, 0),
      };
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à troca de pavimento
  }, [aberto]);

  const lote = Math.max(lim.largura, lim.profundidade) * 2.2;

  return (
    <div className="relative h-full w-full">
    <Canvas
      shadows
      frameloop={pausado ? "never" : "always"}
      camera={{ position: posInicial.toArray(), fov: 35, near: 0.5, far: 2000 }}
      onPointerDown={() => { apresentandoNoToque.current = apresentacao; onInteragir(); }}
      // Só um clique no vazio do 3D desfaz a seleção (os rótulos HTML também disparam "missed").
      onPointerMissed={e => { if (selecionado && !aberto && (e.target as HTMLElement | null)?.tagName === "CANVAS") onSelecionar(null); }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0f172a"]} />
      <fog attach="fog" args={["#0f172a", tamanho * 3, tamanho * 7]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[tamanho, tamanho * 2, tamanho * 0.6]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-lote} shadow-camera-right={lote} shadow-camera-top={lote} shadow-camera-bottom={-lote} />
      <hemisphereLight args={["#bfdbfe", "#1e293b", 0.5]} />

      <group position={[0, base - 0.01, 0]}>
        <mesh position={[0, -0.6, 0]} receiveShadow>
          <boxGeometry args={[lote, 1.2, lote]} />
          <meshStandardMaterial color={COR.terreno} />
        </mesh>
        <gridHelper args={[lote * 3, Math.round(lote * 3 / 4), "#334155", "#1e293b"]} position={[0, -1.2, 0]} />
      </group>

      {torre.pavimentos.map((p, i) => (
        <PavimentoMesh
          key={p.id}
          pav={p}
          contorno={p.contorno ?? torre.contorno}
          cota={niveis[i]}
          saidaX={saidaX}
          selecionado={p.id === aberto}
          algumSelecionado={!!aberto}
          destacado={p.id === passando || p.id === selecionado}
          onPassar={setPassando}
          onClicar={clicar}
          chegou={chegou}
          registrar={registrar}
          fantasma={fantasmas.has(p.id)}
          camadas={{
            metades: p.contorno ? { A: p.contorno, B: [] } : metadesT,
            apartamentos: !p.contorno && (p.tipo === "tipo" || p.tipo === "cobertura" || p.tipo === "mezanino") ? torre.apartamentos ?? [] : [],
            nucleoC,
            estado: { A: camadas?.get(`${p.id}|A`), B: camadas?.get(`${p.id}|B`) },
            filtro: filtroCamadas,
            paredes: !p.contorno && p.tipo === "tipo" ? paredesLados : null,
            semPilares: !!paredesLados,
            comodos: !p.contorno && p.tipo === "tipo" ? torre.comodos : undefined,
            aberturas: !p.contorno && p.tipo === "tipo" ? torre.aberturas : undefined,
            planta: !p.contorno && p.tipo === "tipo" ? planta : null,
            elementos: elementos ? { A: elementos.get(`${p.id}|A`), B: elementos.get(`${p.id}|B`) } : undefined,
            filtroElementos,
            icones,
          }}
        />
      ))}
      {!aberto && <Guindaste x={lim.minX - 4} z={0} altura={topo + 6} />}

      <OrbitControls
        ref={controles}
        makeDefault
        target={focoInicial.toArray()}
        autoRotate={apresentacao && !selecionado && !aberto}
        autoRotateSpeed={0.8}
        {...ORBITA_LIVRE}
        minDistance={1}
        maxDistance={tamanho * 5}
        onStart={() => { alvo.current = null; }}
      />
      <NavegacaoLivre ativo={!apresentacao} />
      <ProjetarRotulos pavimentos={torre.pavimentos} grupos={grupos} botoes={botoes} x={lim.maxX} />
      <MovimentoCamera alvo={alvo} controles={controles} chegou={chegou} esperandoFatia={esperandoFatia} onFatiaPronta={onFatiaPronta} />

      <GizmoHelper alignment="top-right" margin={[72, 72]}>
        <GizmoViewcube
          faces={["Direita", "Esquerda", "Topo", "Base", "Frente", "Fundos"]}
          color="#e2e8f0"
          hoverColor="#fb923c"
          textColor="#0f172a"
          strokeColor="#64748b"
          opacity={0.95}
        />
      </GizmoHelper>
    </Canvas>
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="Pavimentos">
      {torre.pavimentos.map(p => {
        const apagado = !!aberto && p.id !== aberto;
        const ativo = p.id === passando || p.id === selecionado;
        return (
          <button
            key={p.id}
            ref={b => { botoes.current[p.id] = b; }}
            type="button"
            onClick={() => { onInteragir(); if (p.id === selecionado) onAbrir(p.id); else onSelecionar(p.id); }}
            onPointerEnter={() => setPassando(p.id)}
            onPointerLeave={() => setPassando(null)}
            tabIndex={apagado ? -1 : 0}
            className={`absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold shadow-sm transition-opacity ${
              apagado ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
            } ${ativo ? "border-orange-300 bg-orange-500 text-white" : "border-slate-600 bg-slate-800/90 text-slate-100 hover:bg-slate-700"}`}
            title={p.nome}
            aria-label={p.id === selecionado ? `Abrir ${p.nome}` : `Escolher ${p.nome}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COR.status[statusPorPavimento[p.id] ?? "pendente"] }} />
            {p.sigla}
          </button>
        );
      })}
    </div>
    </div>
  );
});

export default Torre3D;
