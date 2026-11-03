import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Ponto } from "@/react-app/utils/escadinha";
import type { EstadoCamada } from "@/react-app/utils/escadinhaCury";
import type { Elemento } from "@/react-app/utils/escadinhaElementos";
import type { Peca, Pecas } from "@/react-app/utils/escadinhaPecas";

import { ESCALA_FOTO, obterTexturas } from "./texturas3d";

/** Altura do piso acabado em relação ao grupo do pavimento (a laje de baixo). */
export const BASE_PISO = 0.25;

/** Elementos no nível do teto: somem com o teto aberto ou com o corte para ver dentro. */
const NO_TETO = new Set<Elemento>(["laje", "forro", "textura_teto", "enfiacao_sistemas", "iluminacao_hall", "dist_agua", "dist_gas", "dist_ventilacao", "ventokit", "ventokit_acabamento"]);

// ---------------------------------------------------------------- geometria (uma vez por planta)

function geometriaDaPeca(p: Peca): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (p.k === "caixa") {
    g = new THREE.BoxGeometry(Math.max(0.005, p.w), Math.max(0.005, p.h), Math.max(0.005, p.d));
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * p.w) / ESCALA_FOTO, (uv.getY(i) * p.h) / ESCALA_FOTO);
    g.rotateY(p.ang);
    g.translate(p.x, p.z + p.h / 2, -p.y);
  } else if (p.k === "cilindro") {
    g = new THREE.CylinderGeometry(p.r, p.r, p.h, 10);
    g.translate(p.x, p.z + p.h / 2, -p.y);
  } else {
    const s = new THREE.Shape();
    p.poly.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    g = new THREE.ExtrudeGeometry(s, { depth: p.esp, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / ESCALA_FOTO, uv.getY(i) / ESCALA_FOTO);
    g.translate(0, p.z, 0);
  }
  const solta = g.index ? g.toNonIndexed() : g;
  if (solta !== g) g.dispose();
  return solta;
}

/** Peças de um elemento unidas por cor: poucas malhas mesmo com milhares de peças (e a mesma para todos os pavimentos). */
const cacheGeo = new WeakMap<Peca[], Map<string, THREE.BufferGeometry>>();
function geometriasPorCor(lista: Peca[]): Map<string, THREE.BufferGeometry> {
  const pronto = cacheGeo.get(lista);
  if (pronto) return pronto;
  const porCor = new Map<string, Peca[]>();
  for (const p of lista) porCor.set(p.cor, [...(porCor.get(p.cor) ?? []), p]);
  const saida = new Map<string, THREE.BufferGeometry>();
  for (const [cor, pecas] of porCor) {
    const partes = pecas.map(geometriaDaPeca);
    const unida = mergeGeometries(partes);
    partes.forEach(g => g.dispose());
    if (unida) saida.set(cor, unida);
  }
  cacheGeo.set(lista, saida);
  return saida;
}

// ---------------------------------------------------------------- materiais

function Material({ cor, emExecucao, corParede }: { cor: string; emExecucao: boolean; corParede?: string }) {
  const tex = obterTexturas();
  const transparente = emExecucao || cor === "vidro";
  const opacidade = cor === "vidro" ? (emExecucao ? 0.3 : 0.55) : emExecucao ? 0.45 : 1;
  if (cor === "bloco") {
    return corParede
      ? <meshStandardMaterial color={corParede} roughness={0.9} transparent={transparente} opacity={opacidade} />
      : <meshStandardMaterial color="#ffffff" map={tex.bloco} roughness={0.9} transparent={transparente} opacity={opacidade} />;
  }
  if (cor === "vidro") return <meshStandardMaterial color="#7dd3fc" metalness={0.3} roughness={0.08} transparent opacity={opacidade} depthWrite={false} />;
  if (cor === "madeira") return <meshStandardMaterial color="#ffffff" map={tex.madeira} roughness={0.7} transparent={transparente} opacity={opacidade} />;
  if (cor === "ceramica") return <meshStandardMaterial color="#ffffff" map={tex.piso} roughness={0.4} transparent={transparente} opacity={opacidade} />;
  return <meshStandardMaterial color={cor} roughness={0.6} metalness={/^#(cbd5e1|94a3b8|64748b|b45309)$/.test(cor) ? 0.5 : 0.05} transparent={transparente} opacity={opacidade} />;
}

function ElementoMalha({ lista, emExecucao, corParede, sombra }: { lista: Peca[]; emExecucao: boolean; corParede?: string; sombra: boolean }) {
  const geos = geometriasPorCor(lista);
  return (
    <>
      {[...geos].map(([cor, geo]) => (
        <mesh key={cor} geometry={geo} castShadow={sombra && !emExecucao} receiveShadow>
          <Material cor={cor} emExecucao={emExecucao} corParede={corParede} />
        </mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- ícones no chão

const cacheIcone = new Map<string, THREE.Texture>();
function texturaIcone(glifo: string, emExecucao: boolean): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const chave = `${glifo}|${emExecucao}`;
  const pronta = cacheIcone.get(chave);
  if (pronta) return pronta;
  const el = document.createElement("canvas");
  el.width = el.height = 128;
  const c = el.getContext("2d");
  if (c) {
    c.fillStyle = emExecucao ? "#2563eb" : "#059669";
    c.beginPath();
    c.arc(64, 64, 60, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = "#ffffff";
    c.stroke();
    c.fillStyle = "#ffffff";
    c.font = "bold 64px system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(glifo, 64, 70);
  }
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheIcone.set(chave, t);
  return t;
}

export interface IconeChao { chave: string; glifo: string; nome: string; noHall: boolean }

/** Atividades sem peça (testes, conferências, limpezas, proteções): um ícone redondo deitado no chão. */
function IconesNoChao({ icones, estado, lugares }: { icones: IconeChao[]; estado: Map<string, EstadoCamada>; lugares: { aptos: Ponto[]; hall: Ponto[] } }) {
  const lista = icones.filter(i => estado.has(i.chave));
  if (!lista.length) return null;
  const doApto = lista.filter(i => !i.noHall), doHall = lista.filter(i => i.noHall);
  const espalhar = (itens: IconeChao[], base: Ponto, prefixo: string) => itens.map((it, n) => {
    const col = n % 4, lin = Math.floor(n / 4);
    const x = base[0] + (col - 1.5) * 0.55, y = base[1] - lin * 0.55;
    const tex = texturaIcone(it.glifo, estado.get(it.chave) === "X");
    return (
      <mesh key={`${prefixo}${it.chave}`} position={[x, BASE_PISO + 0.06, -y]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 24]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    );
  });
  return (
    <group>
      {lugares.aptos.flatMap((p, i) => espalhar(doApto, p, `a${i}`))}
      {lugares.hall.slice(0, 1).flatMap((p, i) => espalhar(doHall, p, `h${i}`))}
    </group>
  );
}

// ---------------------------------------------------------------- pavimento

interface PecasPavimentoProps {
  pecas: Pecas;
  /** Estado de cada elemento e ícone neste lado (E feito, X em execução). */
  estado: Map<string, EstadoCamada> | undefined;
  /** Só estes elementos (null = todos). */
  filtro: Set<string> | null;
  icones: IconeChao[];
  lugares: { aptos: Ponto[]; hall: Ponto[] };
  tetoAberto?: boolean;
  /** Corte para ver dentro (m): some o que fica acima. */
  corte?: number | null;
}

/** Desenha só o que a escadinha diz que foi feito: cada elemento com a sua peça, em execução meio transparente. */
export default function PecasPavimento({ pecas, estado, filtro, icones, lugares, tetoAberto = false, corte = null }: PecasPavimentoProps) {
  const visiveis = useMemo(() => {
    if (!estado) return [];
    return (Object.keys(pecas) as Elemento[]).filter(el => {
      if (!estado.has(el) || (filtro && !filtro.has(el))) return false;
      if (el === "escoramento" && estado.get("desescoramento") === "E") return false;
      if (el === "desescoramento") return false;
      if ((tetoAberto || corte !== null) && NO_TETO.has(el)) return false;
      return true;
    });
  }, [pecas, estado, filtro, tetoAberto, corte]);
  if (!estado) return null;
  // Cor das paredes: a última demão que já foi feita (pintura > preparação > gesso liso > bloco aparente).
  const corParede = estado.get("pintura") === "E" ? "#f5efe2" : estado.get("preparacao_pintura") === "E" ? "#efece6" : estado.get("gesso_liso") === "E" ? "#fafaf9" : undefined;
  const iconesVisiveis = filtro ? icones.filter(i => filtro.has(i.chave)) : icones;
  return (
    <group position={[0, BASE_PISO, 0]}>
      {visiveis.map(el => {
        const lista = pecas[el]!;
        const emExecucao = estado.get(el) === "X";
        const parede = el === "alvenaria" || el === "muretas";
        return (
          <group key={el} scale={parede && emExecucao ? [1, 0.45, 1] : [1, 1, 1]}>
            <ElementoMalha lista={lista} emExecucao={emExecucao && !parede} corParede={parede ? corParede : undefined} sombra={parede || el === "laje"} />
          </group>
        );
      })}
      <group position={[0, -BASE_PISO, 0]}>
        <IconesNoChao icones={iconesVisiveis} estado={estado} lugares={lugares} />
      </group>
    </group>
  );
}
