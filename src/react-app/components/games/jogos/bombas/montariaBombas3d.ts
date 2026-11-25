import * as THREE from "three";
import type { Jogador } from "@/react-app/utils/games/bombas";
import { PassadaBombas } from "@/react-app/utils/games/passadaBombas";

/** Criaturas originais: raposa do vento, tatu de pedra e pequeno dragão de brasa. */
export function criarMontariaBombas3d() {
  const grupo = new THREE.Group(), corpo = new THREE.Group(); grupo.add(corpo);
  const geometrias: THREE.BufferGeometry[] = [], materiais: THREE.Material[] = [];
  const pele = new THREE.MeshStandardMaterial({ color: "#f59e61", roughness: 0.65 }); materiais.push(pele);
  function esfera(x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material = pele) {
    const geo = new THREE.SphereGeometry(1, 12, 9); geometrias.push(geo);
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); corpo.add(m); return m;
  }
  const claro = new THREE.MeshStandardMaterial({ color: "#fff1cd" }), preto = new THREE.MeshStandardMaterial({ color: "#172337" }); materiais.push(claro, preto);
  esfera(0, 0.40, 0, 0.32, 0.26, 0.43); esfera(0, 0.61, 0.34, 0.24, 0.23, 0.26);
  esfera(0, 0.53, 0.52, 0.18, 0.10, 0.17, claro); esfera(0, 0.58, 0.65, 0.055, 0.045, 0.04, preto);
  const orelhas = [-1, 1].map(l => esfera(l * 0.15, 0.84, 0.30, 0.065, 0.17, 0.07));
  for (const l of [-1, 1]) { esfera(l * 0.17, 0.66, 0.50, 0.065, 0.075, 0.025, claro); esfera(l * 0.17, 0.66, 0.525, 0.026, 0.04, 0.015, preto); }
  const cauda = esfera(0, 0.45, -0.45, 0.12, 0.13, 0.34); cauda.rotation.x = -0.4;
  const casco = esfera(0, 0.52, -0.05, 0.35, 0.19, 0.40, preto);
  const pernas = [-1, 1].flatMap(l => [-1, 1].map(z => esfera(l * 0.23, 0.18, z * 0.25, 0.09, 0.18, 0.11)));
  const asas = [-1, 1].map(l => { const a = esfera(l * 0.34, 0.48, -0.06, 0.20, 0.04, 0.20, claro); a.rotation.z = l * 0.6; return a; });
  const passada = new PassadaBombas();
  return {
    grupo,
    atualizar(j: Jogador, x: number, y: number, dt: number) {
      grupo.visible = j.vivo && !!j.montaria; if (!j.montaria) return;
      passada.atualizar(x, y, dt, j.vivo);
      grupo.position.set(x + 0.5, 0.1, y + 0.5);
      corpo.rotation.y = ({ baixo: 0, cima: Math.PI, esquerda: -Math.PI / 2, direita: Math.PI / 2 })[j.direcao];
      const tipo = j.montaria.tipo;
      pele.color.set(tipo === "vento" ? "#8de3d2" : tipo === "pedra" ? "#b8a7dc" : "#f5a063");
      casco.visible = tipo === "pedra"; asas.forEach(a => a.visible = tipo === "brasa");
      orelhas.forEach(a => a.scale.y = tipo === "vento" ? 0.22 : 0.08);
      cauda.scale.z = tipo === "pedra" ? 0.10 : 0.34;
      pernas.forEach((p, i) => p.position.z = (i % 2 ? 1 : -1) * 0.25 + Math.sin(passada.fase + i * Math.PI) * passada.intensidade * 0.10);
      corpo.position.y = Math.abs(Math.sin(passada.fase)) * passada.intensidade * 0.035;
    },
    destruir() { geometrias.forEach(g => g.dispose()); materiais.forEach(m => m.dispose()); },
  };
}
