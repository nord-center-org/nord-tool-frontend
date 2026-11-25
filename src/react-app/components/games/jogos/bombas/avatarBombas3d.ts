import { PassadaBombas } from "@/react-app/utils/games/passadaBombas";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BATONS, CORES_CABELO, CORES_CAPACETE, CORES_OLHOS, FUNCOES, PELES, type AvatarConfig } from "@/react-app/utils/avatar";
import type { Jogador } from "@/react-app/utils/games/bombas";

/** Personagem articulado original. Os dados são os mesmos do avatar da conta, sem textura externa. */
export function criarAvatarBombas3d(config: AvatarConfig, corJogador: string) {
  const grupo = new THREE.Group();
  const corpo = new THREE.Group(); grupo.add(corpo);
  const materiais: THREE.Material[] = [];
  const geometrias: THREE.BufferGeometry[] = [];
  const material = (cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.72, ...extra }); materiais.push(m); return m;
  };
  const pele = material(PELES[config.pele]);
  const cabelo = material(CORES_CABELO[config.corCabelo]);
  const roupa = material(FUNCOES[config.funcao].camisa);
  const escuro = material("#203144"), bota = material("#263244"), sola = material("#101d2c");
  const branco = material("#fff9e9"), preto = material("#17212c"), colete = material("#f7ae45");
  const reflexivo = material("#fff2b1"), metal = material("#acc2ce", { metalness: 0.5, roughness: 0.35 });
  function peca(g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D, x: number, y: number, z: number) {
    geometrias.push(g);
    const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); pai.add(mesh); return mesh;
  }
  const esfera = (rx: number, ry: number, rz: number, m: THREE.Material, pai: THREE.Object3D, x: number, y: number, z: number) => {
    const mesh = peca(new THREE.SphereGeometry(1, 16, 12), m, pai, x, y, z); mesh.scale.set(rx, ry, rz); return mesh;
  };
  const caixa = (w: number, h: number, d: number, m: THREE.Material, pai: THREE.Object3D, x: number, y: number, z: number, raio = 0.035) =>
    peca(new RoundedBoxGeometry(w, h, d, 2, raio), m, pai, x, y, z);

  const quadril = new THREE.Group(); quadril.position.y = 0.49; corpo.add(quadril);
  caixa(0.31, 0.17, 0.22, escuro, quadril, 0, 0, 0);
  const pernas = [-1, 1].map(lado => {
    const junta = new THREE.Group(); junta.position.set(lado * 0.09, 0.46, 0); corpo.add(junta);
    caixa(0.14, 0.32, 0.17, escuro, junta, 0, -0.14, 0);
    caixa(0.16, 0.16, 0.26, bota, junta, 0, -0.34, 0.035);
    caixa(0.17, 0.045, 0.28, sola, junta, 0, -0.405, 0.04, 0.015);
    caixa(0.09, 0.026, 0.015, metal, junta, 0, -0.29, 0.17, 0.008);
    return junta;
  });
  const tronco = new THREE.Group(); tronco.position.y = 0.73; corpo.add(tronco);
  caixa(0.36, 0.39, 0.24, roupa, tronco, 0, 0, 0, 0.055);
  if (["engenheiro", "pedreiro", "armador", "topografo"].includes(config.funcao)) {
    for (const lado of [-1, 1]) {
      caixa(0.13, 0.34, 0.035, colete, tronco, lado * 0.105, 0, 0.13, 0.012);
      caixa(0.035, 0.33, 0.012, reflexivo, tronco, lado * 0.11, 0, 0.154, 0.004);
    }
    caixa(0.33, 0.035, 0.012, reflexivo, tronco, 0, -0.09, 0.156, 0.004);
  } else {
    caixa(0.07, 0.09, 0.018, branco, tronco, 0.095, 0.07, 0.135, 0.008);
    caixa(0.04, 0.015, 0.01, metal, tronco, 0.095, 0.09, 0.148, 0.004);
  }
  caixa(0.36, 0.055, 0.25, bota, corpo, 0, 0.53, 0, 0.012);
  caixa(0.07, 0.055, 0.018, metal, corpo, 0, 0.53, 0.139, 0.008);
  caixa(0.09, 0.13, 0.07, roupa, corpo, -0.2, 0.51, 0, 0.02);
  const bracos = [-1, 1].map(lado => {
    const junta = new THREE.Group(); junta.position.set(lado * 0.225, 0.85, 0); corpo.add(junta);
    esfera(0.095, 0.11, 0.105, roupa, junta, 0, -0.025, 0);
    caixa(0.115, 0.22, 0.14, roupa, junta, 0, -0.13, 0);
    esfera(0.065, 0.085, 0.07, pele, junta, 0, -0.29, 0);
    esfera(0.026, 0.045, 0.035, pele, junta, -lado * 0.05, -0.28, 0.04);
    return junta;
  });
  esfera(0.075, 0.09, 0.075, pele, corpo, 0, 0.95, 0);
  const cabeca = new THREE.Group(); cabeca.position.y = 1.15; corpo.add(cabeca);
  esfera(0.205, 0.235, 0.18, pele, cabeca, 0, 0, 0);
  for (const lado of [-1, 1]) {
    esfera(0.045, 0.069, 0.035, pele, cabeca, lado * 0.205, -0.015, 0);
    esfera(0.025, 0.044, 0.027, material("#d68b7b"), cabeca, lado * 0.221, -0.012, 0.014);
    esfera(0.055, 0.071, 0.027, branco, cabeca, lado * 0.08, 0.01, 0.16);
    esfera(0.028, 0.043, 0.016, material(CORES_OLHOS[config.corOlhos]), cabeca, lado * 0.08, 0.005, 0.183);
    esfera(0.015, 0.027, 0.01, preto, cabeca, lado * 0.08, 0.005, 0.195);
    esfera(0.008, 0.011, 0.006, branco, cabeca, lado * 0.08 - 0.007, 0.019, 0.203);
    const sobrancelha = caixa(0.09, config.sobrancelha === "grossa" ? 0.025 : 0.017, 0.025, cabelo, cabeca, lado * 0.08, 0.102, 0.17, 0.006);
    sobrancelha.rotation.z = -lado * 0.08;
    if (config.tracos === "feminino") {
      const cilio = caixa(0.065, 0.012, 0.018, preto, cabeca, lado * 0.1, 0.069, 0.182, 0.004); cilio.rotation.z = lado * 0.15;
    }
  }
  esfera(0.032, 0.044, 0.04, pele, cabeca, 0, -0.051, 0.179);
  const boca = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.008, 5, 16, Math.PI * 0.75), material(config.batom !== "nenhum" ? BATONS[config.batom] : "#8c534f"));
  geometrias.push(boca.geometry); boca.position.set(0.015, -0.10, 0.156); boca.rotation.z = Math.PI * 1.12; cabeca.add(boca);
  if (config.barba !== "nenhuma") {
    esfera(config.barba === "bigode" ? 0.078 : 0.13, config.barba === "bigode" ? 0.024 : 0.075, 0.045, cabelo, cabeca, 0, config.barba === "bigode" ? -0.08 : -0.145, 0.14);
  }
  if (config.cabelo !== "careca") {
    const longo = ["longo", "longoLiso", "cachosLongos", "trancas", "dreads", "rabo", "coque", "chanel"].includes(config.cabelo);
    esfera(0.213, longo ? 0.26 : 0.16, 0.187, cabelo, cabeca, 0, longo ? -0.01 : 0.115, -0.04);
    // Mechas individuais criam silhueta e volume, sem a aparência de capacete liso.
    for (let i = 0; i < 5; i++) {
      const mecha = esfera(0.053, config.cabelo === "raspado" ? 0.035 : 0.09, 0.06, cabelo, cabeca, (i - 2) * 0.071, 0.155 - Math.abs(i - 2) * 0.018, 0.122);
      mecha.rotation.z = (i - 2) * -0.18;
    }
    if (["topete", "moicano", "afro", "cacheado"].includes(config.cabelo)) {
      for (let i = 0; i < 3; i++) esfera(0.095, 0.10, 0.12, cabelo, cabeca, (i - 1) * 0.10, 0.23, 0);
    }
    if (config.cabelo === "rabo" || config.cabelo === "coque") esfera(0.09, config.cabelo === "rabo" ? 0.22 : 0.09, 0.10, cabelo, cabeca, 0, 0.10, -0.21);
  }
  if (config.capacete) {
    const cor = config.corCapacete === "funcao" ? FUNCOES[config.funcao].capacete : CORES_CAPACETE[config.corCapacete];
    const casco = material(cor);
    const domo = peca(new THREE.SphereGeometry(0.23, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), casco, cabeca, 0, 0.12, 0);
    domo.scale.set(1, 0.85, 0.95);
    caixa(0.50, 0.04, 0.44, casco, cabeca, 0, 0.125, 0.025, 0.02);
    caixa(0.045, 0.08, 0.32, casco, cabeca, 0, 0.295, -0.01, 0.02);
    caixa(0.12, 0.045, 0.018, reflexivo, cabeca, 0, 0.17, 0.22, 0.008);
  }
  if (["oculos", "oculosSol", "oculosSeguranca"].includes(config.acessorio)) {
    const lente = material(config.acessorio === "oculosSol" ? "#182d43" : "#9cdae8", { transparent: true, opacity: config.acessorio === "oculosSol" ? 0.95 : 0.35 });
    for (const lado of [-1, 1]) {
      caixa(0.125, 0.095, 0.018, escuro, cabeca, lado * 0.08, 0.015, 0.19, 0.018);
      caixa(0.10, 0.069, 0.02, lente, cabeca, lado * 0.08, 0.015, 0.204, 0.014);
    }
    caixa(0.04, 0.018, 0.023, escuro, cabeca, 0, 0.02, 0.197, 0.005);
  }
  const anel = peca(new THREE.TorusGeometry(0.30, 0.021, 6, 32), material(corJogador, { emissive: corJogador, emissiveIntensity: 0.25 }), grupo, 0, 0.025, 0);
  anel.rotation.x = -Math.PI / 2;
  const sombra = peca(new THREE.CircleGeometry(0.30, 24), new THREE.MeshBasicMaterial({ color: "#071120", transparent: true, opacity: 0.3, depthWrite: false }), grupo, 0, 0.015, 0);
  materiais.push(sombra.material); sombra.rotation.x = -Math.PI / 2;
  const escudo = esfera(0.43, 0.76, 0.40, material("#9eeaff", { transparent: true, opacity: 0.17, metalness: 0.2, roughness: 0.1, depthWrite: false }), grupo, 0, 0.73, 0);
  const passada = new PassadaBombas();
  let tempo = 0, acaoAte = 0, morteEm: number | null = null;
  return {
    grupo,
    reagir(acao: "bomba" | "item" | "morte") {
      if (acao === "morte") morteEm = tempo;
      else acaoAte = tempo + (acao === "bomba" ? 0.3 : 0.45);
    },
    atualizar(j: Jogador, x: number, z: number, dt: number, venceu: boolean, reduzir: boolean) {
      tempo += dt;
      if (j.vivo) morteEm = null;
      grupo.position.set(x + 0.5, 0.1, z + 0.5);
      grupo.visible = j.vivo || (morteEm !== null && tempo - morteEm < 0.8);
      passada.atualizar(x, z, dt, j.vivo);
      const andando = passada.intensidade > 0.01;
      const ciclo = Math.sin(passada.fase);
      const anim = ciclo * passada.intensidade * (reduzir ? 0.35 : 0.85);
      const abaixar = acaoAte > tempo ? Math.sin(Math.min(1, (acaoAte - tempo) / 0.3) * Math.PI) : 0;
      const pulo = venceu && !reduzir ? Math.max(0, Math.sin(tempo * 6)) * 0.22 : 0;
      corpo.position.y = pulo + (reduzir ? 0 : andando ? Math.abs(ciclo) * passada.intensidade * 0.055 : Math.sin(tempo * 2.6 + j.id) * 0.012) - abaixar * 0.08;
      pernas[0].rotation.x = anim; pernas[1].rotation.x = -anim;
      bracos[0].rotation.x = venceu ? -2.5 : -anim * 0.7;
      bracos[1].rotation.x = venceu ? -2.5 : anim * 0.7 - abaixar * 1.2;
      bracos[0].rotation.z = venceu ? -0.25 : 0.08;
      bracos[1].rotation.z = venceu ? 0.25 : -0.08;
      tronco.rotation.x = abaixar * 0.18 + passada.intensidade * 0.08;
      tronco.rotation.y = anim * 0.1;
      cabeca.rotation.z = reduzir ? 0 : andando ? ciclo * 0.025 : Math.sin(tempo * 1.6) * 0.022;
      const alvo = ({ baixo: 0, cima: Math.PI, esquerda: -Math.PI / 2, direita: Math.PI / 2 })[j.direcao];
      if (dt > 0) corpo.rotation.y += Math.atan2(Math.sin(alvo - corpo.rotation.y), Math.cos(alvo - corpo.rotation.y)) * Math.min(1, dt * 16);
      corpo.rotation.z = !j.vivo && morteEm !== null ? (reduzir ? 0 : Math.min(1, (tempo - morteEm) / 0.5) * Math.PI / 2) : 0;
      corpo.scale.setScalar(!j.vivo && morteEm !== null ? Math.max(0, 1 - (tempo - morteEm) / 0.8) : 1);
      escudo.visible = j.escudo;
      anel.visible = j.vivo; sombra.visible = j.vivo;
    },
    destruir() { geometrias.forEach(g => g.dispose()); materiais.forEach(m => m.dispose()); },
  };
}
