import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ArrowLeft, Eye, Home, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import * as THREE from "three";

import CamadasPavimento from "./CamadasPavimento";
import { limites, type Lado, type Pavimento, type Ponto, type Torre } from "@/react-app/utils/escadinha";
import { metades as metadesDaTorre } from "@/react-app/utils/escadinhaApto";
import { centroNucleo, paredesPorLado } from "@/react-app/utils/escadinha3d";
import { ROTULO_CAMADA, type Camada, type EstadoCamada } from "@/react-app/utils/escadinhaCury";

interface VistaPavimento3DProps {
  torre: Torre;
  pavimento: Pavimento;
  /** O que a escadinha tem de feito neste pavimento, por lado. */
  estado: Record<Lado, Map<Camada, EstadoCamada> | undefined>;
  onFechar: () => void;
}

const TODAS = Object.keys(ROTULO_CAMADA) as Camada[];
const TETO = new Set<Camada>(["laje", "gesso"]);

function Piso({ contorno }: { contorno: Ponto[] }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    contorno.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [contorno]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
    </mesh>
  );
}

/**
 * Pavimento sozinho em 3D: o estado atual pela escadinha (o que já foi executado em cada lado) ou o apartamento modelo
 * (tudo pronto). Dá para ver só um lado e tirar o teto para olhar por dentro.
 */
export default function VistaPavimento3D({ torre, pavimento, estado, onFechar }: VistaPavimento3DProps) {
  const [modo, setModo] = useState<"atual" | "modelo">("atual");
  const [lado, setLado] = useState<Lado | "AB">("AB");
  const [tetoAberto, setTetoAberto] = useState(true);
  const [corte, setCorte] = useState(false);
  const contorno = pavimento.contorno ?? torre.contorno;
  const tipico = !pavimento.contorno;
  const lim = useMemo(() => limites(contorno), [contorno]);
  const metades = useMemo(() => (torre.lados && tipico ? metadesDaTorre(torre.contorno, torre.lados) : { A: contorno, B: [] as Ponto[] }), [torre.lados, torre.contorno, contorno, tipico]);
  const nucleoC = useMemo(() => centroNucleo(torre.contorno), [torre.contorno]);
  const paredes = useMemo(() => (tipico && torre.paredes?.length && torre.lados ? paredesPorLado(torre.paredes, torre.lados) : null), [tipico, torre.paredes, torre.lados]);

  const tudo = useMemo(() => new Map(TODAS.map(c => [c, "E" as EstadoCamada])), []);
  const estadoVisto: Record<Lado, Map<Camada, EstadoCamada> | undefined> = {
    A: lado === "B" ? undefined : modo === "modelo" ? tudo : estado.A,
    B: lado === "A" ? undefined : modo === "modelo" ? tudo : estado.B,
  };
  const filtro = tetoAberto ? new Set(TODAS.filter(c => !TETO.has(c))) : null;
  const feitas = (["A", "B"] as Lado[]).flatMap(l => [...(estado[l]?.entries() ?? [])].filter(([, v]) => v === "E").map(([c]) => c));
  const tamanho = Math.max(lim.largura, lim.profundidade);

  const botao = (ativo: boolean) => `rounded-lg px-3 py-1.5 text-xs font-bold ${ativo ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:text-white"}`;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-950 animate-aparecer">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-400">Pavimento em 3D</p>
          <h3 className="text-lg font-bold text-white">{pavimento.nome}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="O que mostrar" className="flex rounded-xl bg-slate-800 p-1">
            <button type="button" role="tab" aria-selected={modo === "atual"} onClick={() => setModo("atual")} className={botao(modo === "atual")}>
              <Eye className="mr-1 inline h-3.5 w-3.5" />Estado atual
            </button>
            <button type="button" role="tab" aria-selected={modo === "modelo"} onClick={() => setModo("modelo")} className={botao(modo === "modelo")}>
              <Home className="mr-1 inline h-3.5 w-3.5" />Apartamento modelo
            </button>
          </div>
          <div role="tablist" aria-label="Lado" className="flex rounded-xl bg-slate-800 p-1">
            {(["AB", "A", "B"] as const).map(l => (
              <button key={l} type="button" role="tab" aria-selected={lado === l} onClick={() => setLado(l)} className={botao(lado === l)}>
                {l === "AB" ? "Os dois lados" : `Lado ${l}`}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200">
            <input type="checkbox" checked={tetoAberto} onChange={e => setTetoAberto(e.target.checked)} className="h-3.5 w-3.5" /> Abrir teto
          </label>
          <label className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200" title="Corta as paredes na altura de 1,35 m para olhar dentro dos apartamentos">
            <input type="checkbox" checked={corte} onChange={e => setCorte(e.target.checked)} className="h-3.5 w-3.5" /> Corte a 1,35 m
          </label>
          <button type="button" onClick={onFechar}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 px-4 pb-4">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950">
          <Canvas shadows camera={{ position: [tamanho * 0.55, tamanho * 0.75, tamanho * 0.7], fov: 40, near: 0.1, far: 1000 }}>
            <ambientLight intensity={0.75} />
            <directionalLight position={[tamanho, tamanho * 1.6, tamanho * 0.4]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]} />
            <hemisphereLight args={["#e0f2fe", "#1e293b", 0.5]} />
            <group position={[-(lim.minX + lim.maxX) / 2, 0, (lim.minY + lim.maxY) / 2]}>
              <Piso contorno={contorno} />
              <CamadasPavimento contorno={contorno} metades={metades} apartamentos={tipico ? torre.apartamentos ?? [] : []} altura={pavimento.altura}
                nucleoC={nucleoC} estado={estadoVisto} filtro={filtro} comElevador paredesReais={paredes} corte={corte ? 1.35 : null} />
            </group>
            <OrbitControls makeDefault enableDamping target={[0, 1, 0]} maxPolarAngle={Math.PI / 2.05} />
          </Canvas>
        </div>
        <div className="pointer-events-none absolute bottom-7 left-7 max-w-sm rounded-xl bg-slate-900/85 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
          <p className="mb-0.5 flex items-center gap-1 font-bold text-slate-100"><Layers className="h-3.5 w-3.5" />
            {modo === "modelo" ? "Tudo pronto (apartamento modelo)" : feitas.length ? "Executado pela escadinha" : "Nada executado ainda neste pavimento"}
          </p>
          {modo === "atual" && feitas.length > 0 && <p>{[...new Set(feitas)].map(c => ROTULO_CAMADA[c]).join(" · ")}</p>}
          {!paredes && tipico && <p className="mt-1 text-amber-300">Importe os projetos para ver as paredes reais deste pavimento.</p>}
        </div>
      </div>
    </div>
  );
}
