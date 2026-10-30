import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import CamadasPavimento from "./CamadasPavimento";
import { limites, type Lado, type Pavimento, type Ponto, type Torre } from "@/react-app/utils/escadinha";
import { metades as metadesDaTorre } from "@/react-app/utils/escadinhaApto";
import { centroNucleo, paredesPorLado } from "@/react-app/utils/escadinha3d";
import { ROTULO_CAMADA, type Camada, type EstadoCamada } from "@/react-app/utils/escadinhaCury";

/** Tudo pronto: o apartamento modelo (todas as camadas executadas nos dois lados). */
const TUDO_PRONTO = new Map((Object.keys(ROTULO_CAMADA) as Camada[]).filter(c => c !== "escoramento").map(c => [c, "E" as EstadoCamada]));

interface Pavimento3DProps {
  torre: Torre;
  pavimento: Pavimento;
  /** O que já foi feito neste pavimento, por lado (da escadinha). */
  estado: Record<Lado, Map<Camada, EstadoCamada> | undefined>;
  /** Mostra o apartamento modelo (tudo executado) em vez do estado atual. */
  modelo: boolean;
  /** Tira laje e forro para ver o interior. */
  tetoAberto: boolean;
  /** Filtro de camadas (null = todas). */
  filtro: Set<Camada> | null;
}

function forma(contorno: Ponto[]) {
  const s = new THREE.Shape();
  contorno.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/**
 * O pavimento isolado em 3D, como o protótipo do Juan (Torre 1, 2º pavimento): paredes reais da 1ª fiada subindo
 * conforme a alvenaria, e os acabamentos de cada cômodo conforme as atividades executadas — ou o apartamento modelo.
 */
export default function Pavimento3D({ torre, pavimento, estado, modelo, tetoAberto, filtro }: Pavimento3DProps) {
  const contorno = pavimento.contorno ?? torre.contorno;
  const tipico = !pavimento.contorno;
  const metades = useMemo(() => (tipico && torre.lados ? metadesDaTorre(torre.contorno, torre.lados) : { A: contorno, B: [] as Ponto[] }), [tipico, torre.contorno, torre.lados, contorno]);
  const nucleoC = useMemo(() => centroNucleo(torre.contorno), [torre.contorno]);
  const paredes = useMemo(() => (tipico && torre.paredes?.length && torre.lados ? paredesPorLado(torre.paredes, torre.lados) : null), [tipico, torre.paredes, torre.lados]);
  const base = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(forma(contorno), { depth: 0.25, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [contorno]);
  const lim = limites(contorno);
  const tamanho = Math.max(lim.largura, lim.profundidade);
  const vazio = !modelo && !estado.A?.size && !estado.B?.size;

  return (
    <div className="relative h-full w-full">
      <Canvas shadows camera={{ position: [tamanho * 0.75, tamanho * 1.05, tamanho * 0.95], fov: 40, near: 0.1, far: 1000 }} dpr={[1, 2]}>
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[tamanho, tamanho * 1.5, tamanho * 0.4]} intensity={1.3} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-tamanho} shadow-camera-right={tamanho} shadow-camera-top={tamanho} shadow-camera-bottom={-tamanho} />
        <hemisphereLight args={["#bfdbfe", "#1e293b", 0.5]} />
        <mesh geometry={base} receiveShadow>
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
          <Edges color="#94a3b8" />
        </mesh>
        <CamadasPavimento
          contorno={contorno}
          metades={metades}
          apartamentos={tipico ? torre.apartamentos ?? [] : []}
          altura={pavimento.altura}
          nucleoC={nucleoC}
          estado={modelo ? { A: TUDO_PRONTO, B: TUDO_PRONTO } : estado}
          filtro={filtro}
          comElevador
          paredesReais={paredes}
          comodos={tipico ? torre.comodos : undefined}
          aberturas={tipico ? torre.aberturas : undefined}
          tetoAberto={tetoAberto}
        />
        <OrbitControls makeDefault target={[0, 1, 0]} enableDamping maxPolarAngle={Math.PI * 0.49} minDistance={2} maxDistance={tamanho * 3} />
      </Canvas>
      {vazio && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/90 px-4 py-1.5 text-xs font-semibold text-slate-200">
          Nada executado ainda neste pavimento · veja o “Apartamento modelo” para o resultado final
        </p>
      )}
    </div>
  );
}
