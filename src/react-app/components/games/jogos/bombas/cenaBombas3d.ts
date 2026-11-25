import { criarMontariaBombas3d } from "./montariaBombas3d";
import { posicaoRevanche } from "@/react-app/utils/games/bombas";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { AVISO_MORTE_SUBITA, PAVIO, avisosMorteSubita, type Estado, type Evento, type PowerUp } from "@/react-app/utils/games/bombas";
import type { FasePartida, VagaJogo } from "../../comum/MolduraPartida";
import { CORES_JOGADORES } from "../../central/sprites";
import { desenharItem } from "./desenho";
import { criarAvatarBombas3d } from "./avatarBombas3d";

const PALETAS = {
  fabrica: { fundo: "#132c3a", piso: ["#527f85", "#5b8b90"], parede: "#b4d5d3", topo: "#d8efdf", caixa: "#f5bf70", friso: "#99613c", base: "#264953" },
  gelo: { fundo: "#28375e", piso: ["#acd6e6", "#bde5ef"], parede: "#8aafdf", topo: "#efffff", caixa: "#c9aaee", friso: "#8061a6", base: "#5b78a8" },
  vulcao: { fundo: "#281f3e", piso: ["#6c617f", "#776b8a"], parede: "#b399ad", topo: "#dac6ce", caixa: "#eeaa7d", friso: "#995751", base: "#4a365b" },
};

/** Cena 3D original com personagens articulados. Se WebGL falhar, o motor continua em Canvas 2D. */
export function criarCenaBombas3d(caixa: HTMLDivElement, vagas: VagaJogo[]) {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.className = "rounded-2xl ring-1 ring-white/10 shadow-2xl";
  renderer.domElement.style.marginTop = "52px";
  renderer.domElement.setAttribute("aria-label", "Arena 3D do Bombas Táticas");
  renderer.domElement.setAttribute("role", "img");
  caixa.appendChild(renderer.domElement);
  let disponivel = true;
  const perdeuContexto = (ev: Event) => { ev.preventDefault(); disponivel = false; renderer.domElement.style.display = "none"; };
  renderer.domElement.addEventListener("webglcontextlost", perdeuContexto);
  const cena = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  cena.add(new THREE.HemisphereLight("#e9f8ff", "#5c4968", 2.2));
  const luz = new THREE.DirectionalLight("#fff2d6", 3.3); luz.position.set(-5, 14, 8); cena.add(luz);
  const recorte = new THREE.DirectionalLight("#a9e7ff", 1.7); recorte.position.set(8, 7, -7); cena.add(recorte);
  const geometrias: THREE.BufferGeometry[] = [], materiais: THREE.Material[] = [], texturas: THREE.Texture[] = [];
  const padrao = (cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, ...extra }); materiais.push(m); return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { geometrias.push(g); return g; };
  const cubo = geo(new RoundedBoxGeometry(1, 1, 1, 2, 0.08));
  const esfera = geo(new THREE.SphereGeometry(1, 16, 12));
  const matBombas = padrao("#26313e", { metalness: 0.35, roughness: 0.28 });
  const matPavio = padrao("#ffe2b0"), matFaisca = padrao("#fff3b0", { emissive: "#ff9a23", emissiveIntensity: 2 });
  const matMoeda = padrao("#ffce45", { metalness: 0.65, roughness: 0.25 });
  const geoMoeda = geo(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 20));
  const piso = new THREE.Group(); cena.add(piso);
  const personagens = vagas.map((v, i) => {
    const avatar = criarAvatarBombas3d(v.avatar, CORES_JOGADORES[i % 8]); cena.add(avatar.grupo); return avatar;
  });
  function etiqueta(texto: string, cor: string) {
    const c = document.createElement("canvas"); c.width = 128; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#122334"; ctx.beginPath(); ctx.roundRect(4, 3, 120, 56, 18); ctx.fill();
    ctx.strokeStyle = cor; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "900 37px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, 64, 31);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; texturas.push(tx);
    const mat = new THREE.SpriteMaterial({ map: tx, depthTest: false }); materiais.push(mat);
    const sp = new THREE.Sprite(mat); sp.scale.set(0.5, 0.25, 1); return sp;
  }
  personagens.forEach((p, i) => { const sp = etiqueta(`P${i + 1}`, CORES_JOGADORES[i % 8]); sp.position.y = 1.72; p.grupo.add(sp); });
  const montarias = vagas.map(() => { const m = criarMontariaBombas3d(); cena.add(m.grupo); return m; });
  const configuracoes = vagas.map(v => JSON.stringify(v.avatar));
  const carros = vagas.map((_v, i) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(geo(new RoundedBoxGeometry(0.72, 0.24, 0.55, 2, 0.06)), padrao(CORES_JOGADORES[i % 8])); g.add(base);
    const faixa = new THREE.Mesh(cubo, padrao("#172c40")); faixa.scale.set(0.78, 0.08, 0.6); faixa.position.y = -0.08; g.add(faixa);
    g.visible = false; cena.add(g); return g;
  });
  const inimigos = Array.from({ length: 12 }, () => {
    const g = new THREE.Group();
    const casco = new THREE.Mesh(geo(new THREE.SphereGeometry(0.32, 14, 10)), padrao("#e97379")); casco.scale.y = 1.2; casco.position.y = 0.46; g.add(casco);
    for (const lado of [-1, 1]) {
      const olho = new THREE.Mesh(esfera, padrao("#fff9e9")); olho.scale.set(0.085, 0.105, 0.04); olho.position.set(lado * 0.12, 0.54, 0.28); g.add(olho);
      const pupila = new THREE.Mesh(esfera, padrao("#172337")); pupila.scale.set(0.035, 0.055, 0.025); pupila.position.set(lado * 0.12, 0.54, 0.315); g.add(pupila);
      const pe = new THREE.Mesh(cubo, padrao("#24354c")); pe.scale.set(0.21, 0.13, 0.30); pe.position.set(lado * 0.20, 0.13, 0.04); g.add(pe);
    }
    const antenas = new THREE.Group(); antenas.name = "antenas";
    for (const lado of [-1, 1]) { const a = new THREE.Mesh(cubo, padrao("#b7f2de")); a.position.set(lado * 0.20, 0.92, 0); a.scale.set(0.07, 0.33, 0.07); a.rotation.z = lado * 0.3; antenas.add(a); } g.add(antenas);
    const carapaca = new THREE.Mesh(cubo, padrao("#456074")); carapaca.name = "carapaca"; carapaca.position.set(0, 0.47, -0.12); carapaca.scale.set(0.76, 0.50, 0.40); g.add(carapaca);
    const coroa = new THREE.Mesh(geo(new THREE.ConeGeometry(0.28, 0.34, 5)), padrao("#ffe1a0", { metalness: 0.3 })); coroa.name = "coroa"; coroa.position.y = 1.0; g.add(coroa);
    g.visible = false; cena.add(g); return g;
  });
  const portal = new THREE.Mesh(geo(new THREE.TorusGeometry(0.35, 0.08, 8, 28)), padrao("#5ee6ac", { emissive: "#37ce8a", emissiveIntensity: 0.8 }));
  portal.rotation.x = -Math.PI / 2; portal.visible = false; cena.add(portal);
  const matriz = new THREE.Object3D();
  function lote(g: THREE.BufferGeometry, m: THREE.Material, n = 512) {
    const mesh = new THREE.InstancedMesh(g, m, n); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; cena.add(mesh); return mesh;
  }
  const chamas = lote(cubo, padrao("#ff9b24", { emissive: "#ff731a", emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
  const nucleos = lote(cubo, padrao("#fff4b2", { emissive: "#ffd269", emissiveIntensity: 1.2 }));
  const avisos = lote(cubo, padrao("#ffba69", { emissive: "#ff7f32", emissiveIntensity: 0.5 }));
  const particulas = lote(esfera, padrao("#ffcb67", { emissive: "#ff8429", emissiveIntensity: 0.5 }), 240);
  let faiscas: { x: number; y: number; z: number; vx: number; vy: number; vz: number; vida: number; total: number }[] = [];
  function instanciar(mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, giro = 0) {
    matriz.position.set(x, y, z); matriz.scale.set(sx, sy, sz); matriz.rotation.set(0, giro, 0); matriz.updateMatrix(); mesh.setMatrixAt(i, matriz.matrix);
  }
  const bombas = new Map<number, { grupo: THREE.Group; corpo: THREE.Mesh; arco: THREE.Mesh; brilho: THREE.Mesh }>();
  const bombasLivres: { grupo: THREE.Group; corpo: THREE.Mesh; arco: THREE.Mesh; brilho: THREE.Mesh }[] = [];
  const itens = new Map<string, THREE.Object3D>();
  const texturaItens = new Map<PowerUp, THREE.SpriteMaterial>();
  let chaveMapa = "", tempo = 0, largura = 0, altura = 0;
  let recursosMapa: { destruir: () => void }[] = [];
  function limparMapa() { piso.clear(); recursosMapa.forEach(r => r.destruir()); recursosMapa = []; }
  function montarMapa(e: Estado) {
    limparMapa(); const p = PALETAS[e.bioma]; cena.background = new THREE.Color(p.fundo);
    const cores = [...p.piso, p.parede, p.topo, p.caixa, p.friso, p.base];
    const mats = cores.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
    mats.forEach(m => recursosMapa.push({ destruir: () => m.dispose() }));
    const lotes = mats.map(m => { const l = new THREE.InstancedMesh(cubo, m, 600); l.count = 0; l.frustumCulled = false; piso.add(l); return l; });
    const por = (i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, giro = 0) => { const l = lotes[i]; instanciar(l, l.count++, x, y, z, sx, sy, sz, giro); };
    por(6, e.largura / 2, -0.25, e.altura / 2, e.largura + 0.6, 0.5, e.altura + 0.6);
    for (let y = 0; y < e.altura; y++) for (let x = 0; x < e.largura; x++) {
      por((x + y) % 2, x + 0.5, 0, y + 0.5, 0.98, 0.18, 0.98);
      const c = e.grade[y * e.largura + x];
      if (c === "pilar") {
        por(2, x + 0.5, 0.39, y + 0.5, 0.94, 0.65, 0.94);
        por(3, x + 0.5, 0.73, y + 0.5, 0.84, 0.10, 0.84);
        por(6, x + 0.5, 0.40, y + 0.975, 0.58, 0.12, 0.012);
      } else if (c === "caixa") {
        por(4, x + 0.5, 0.37, y + 0.5, 0.80, 0.58, 0.80);
        por(5, x + 0.5, 0.67, y + 0.5, 0.84, 0.055, 0.10, Math.PI / 4);
        por(5, x + 0.5, 0.67, y + 0.5, 0.84, 0.055, 0.10, -Math.PI / 4);
        por(5, x + 0.5, 0.23, y + 0.91, 0.74, 0.055, 0.025);
      }
    }
    lotes.forEach(l => { l.instanceMatrix.needsUpdate = true; recursosMapa.push({ destruir: () => l.dispose() }); });
  }
  function criarBomba(dono: number, remota: boolean) {
    const livre = bombasLivres.findIndex(b => b.grupo.userData.dono === dono && b.grupo.userData.remota === remota);
    if (livre >= 0) { const b = bombasLivres.splice(livre, 1)[0]; b.grupo.visible = true; return b; }
    const grupo = new THREE.Group();
    grupo.userData = { dono, remota };
    const corpo = new THREE.Mesh(esfera, matBombas); corpo.scale.setScalar(0.30); corpo.position.y = 0.38; grupo.add(corpo);
    const pavio = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.025, 0.025, 0.19, 6)), matPavio); pavio.position.set(0.04, 0.72, 0); pavio.rotation.z = -0.5; grupo.add(pavio);
    const brilho = new THREE.Mesh(esfera, matFaisca); brilho.scale.setScalar(0.055); brilho.position.set(0.085, 0.81, 0); grupo.add(brilho);
    const cor = CORES_JOGADORES[dono % 8] ?? "#ff6b82";
    const m = new THREE.MeshBasicMaterial({ color: cor, side: THREE.DoubleSide }); materiais.push(m);
    const arco = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.39, 40), m); arco.rotation.x = -Math.PI / 2; arco.position.y = 0.12; grupo.add(arco);
    const rotulo = etiqueta(dono < 0 ? "!" : remota ? `R${dono + 1}` : `${dono + 1}`, cor); rotulo.scale.set(0.23, 0.115, 1); rotulo.position.set(0, 0.43, 0.27); grupo.add(rotulo);
    cena.add(grupo); return { grupo, corpo, arco, brilho };
  }
  function itemMaterial(tipo: PowerUp) {
    const salvo = texturaItens.get(tipo); if (salvo) return salvo;
    const c = document.createElement("canvas"); c.width = c.height = 128;
    desenharItem(c.getContext("2d")!, tipo, 64, 64, 128, 0);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; texturas.push(tx);
    const m = new THREE.SpriteMaterial({ map: tx }); materiais.push(m); texturaItens.set(tipo, m); return m;
  }
  return {
    disponivel: () => disponivel,
    eventos(e: Estado, eventos: Evento[]) {
      for (const ev of eventos) {
        if (ev.tipo === "morte") personagens[ev.jogador]?.reagir("morte");
        if (ev.tipo === "powerup" || ev.tipo === "moeda") personagens[ev.jogador]?.reagir("item");
        if (ev.tipo === "bomba") {
          const b = e.bombas.find(b => b.x === ev.x && b.y === ev.y); if (b) personagens[b.dono]?.reagir("bomba");
        }
        if (ev.tipo === "explosao" || ev.tipo === "caixa") {
          for (let i = 0; i < (ev.tipo === "explosao" ? 16 : 8) && faiscas.length < 240; i++) {
            const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2;
            faiscas.push({ x: ev.x + 0.5, y: 0.4, z: ev.y + 0.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: 1.2 + Math.random() * 3, vida: 0.6, total: 0.6 });
          }
        }
      }
    },
    reiniciar() { faiscas = []; chaveMapa = ""; bombas.forEach(b => { b.grupo.visible = false; bombasLivres.push(b); }); bombas.clear(); },
    desenhar(e: Estado, anteriores: { x: number; y: number }[], alfa: number, dt: number, fase: FasePartida, vencedor: number | null, reduzir: boolean) {
      tempo += dt;
      const box = caixa.getBoundingClientRect();
      const w = Math.max(1, Math.floor(box.width - 24)), h = Math.max(1, Math.floor(box.height - 76));
      if (w !== largura || h !== altura) { largura = w; altura = h; renderer.setSize(w, h); }
      const vistaH = Math.max(e.largura / (w / h), e.altura * 0.82 + 2.6) * 1.07;
      camera.left = -vistaH * w / h / 2; camera.right = -camera.left; camera.top = vistaH / 2; camera.bottom = -camera.top;
      camera.position.set(e.largura / 2, 20, e.altura / 2 + 14); camera.lookAt(e.largura / 2, 0.2, e.altura / 2); camera.updateProjectionMatrix();
      const chave = `${e.bioma}/${e.grade.join(",")}`;
      if (chave !== chaveMapa) { montarMapa(e); chaveMapa = chave; }
      personagens.forEach((p, i) => {
        const j = e.jogadores[i]; if (!j) return;
        const configuracao = JSON.stringify(vagas[i].avatar);
        if (configuracao !== configuracoes[i]) {
          cena.remove(p.grupo); p.destruir();
          p = criarAvatarBombas3d(vagas[i].avatar, CORES_JOGADORES[i % 8]); personagens[i] = p;
          const sp = etiqueta(`P${i + 1}`, CORES_JOGADORES[i % 8]); sp.position.y = 1.72; p.grupo.add(sp); cena.add(p.grupo); configuracoes[i] = configuracao;
        }
        const ant = anteriores[i] ?? j, a = fase === "jogando" ? alfa : 1;
        const venceu = fase !== "jogando" && fase !== "contagem" && (e.timeVencedor !== null ? e.timeVencedor === j.time : vencedor === i);
        const borda = posicaoRevanche(e, j);
        p.atualizar(borda ? { ...j, vivo: true, direcao: borda.direcao } : j, borda?.x ?? ant.x + (j.x - ant.x) * a, borda?.y ?? ant.y + (j.y - ant.y) * a, dt, venceu, reduzir);
        p.grupo.position.y = borda ? 0.96 : j.montaria ? 0.76 : 0.1;
        montarias[i].atualizar(j, ant.x + (j.x - ant.x) * a, ant.y + (j.y - ant.y) * a, dt);
        carros[i].visible = !!borda;
        if (borda) carros[i].position.set(borda.x + 0.5, 1.0, borda.y + 0.5);
      });
      inimigos.forEach((mesh, i) => {
        const o = e.campanha?.inimigos[i]; mesh.visible = !!o && o.vida > 0;
        if (!o) return;
        mesh.position.set(o.x + 0.5, reduzir ? 0.1 : 0.1 + Math.abs(Math.sin(tempo * 5 + i)) * 0.06, o.y + 0.5);
        mesh.scale.setScalar(o.tipo === "chefe" ? 1.7 : o.tipo === "saltador" ? 0.85 : 1);
        mesh.getObjectByName("antenas")!.visible = o.tipo === "saltador";
        mesh.getObjectByName("carapaca")!.visible = o.tipo === "cauteloso" || o.tipo === "chefe" && o.aspecto === 0;
        mesh.getObjectByName("coroa")!.visible = o.tipo === "chefe";
        if (o.tipo === "saltador" && !reduzir) mesh.position.y += Math.max(0, Math.sin(tempo * 8)) * 0.25;
        const material = (mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
        material.color.set(e.passo < o.protecaoAte ? "#fff8b3" : o.tipo === "chefe" ? (["#e4b46b", "#97d8ef", "#ef796f"][o.aspecto ?? 0]) : o.tipo === "saltador" ? "#89dfb3" : o.tipo === "cauteloso" ? "#a7a0dc" : o.tipo === "cacador" ? "#f5a95e" : "#e97379");
        const alvo = Math.atan2(o.alvoX - o.x, o.alvoY - o.y); if (Math.hypot(o.alvoX - o.x, o.alvoY - o.y) > 0.01) mesh.rotation.y = alvo;
      });
      portal.visible = !!e.campanha;
      if (e.campanha) {
        portal.position.set(e.campanha.saida.x + 0.5, 0.18, e.campanha.saida.y + 0.5);
        (portal.material as THREE.MeshStandardMaterial).color.set(e.campanha.inimigos.some(o => o.vida > 0) ? "#956b83" : "#5ee6ac");
      }
      const ids = new Set(e.bombas.map(b => b.id));
      for (const [id, b] of bombas) if (!ids.has(id)) { b.grupo.visible = false; bombasLivres.push(b); bombas.delete(id); }
      for (const b of e.bombas) {
        let mesh = bombas.get(b.id); if (!mesh) { mesh = criarBomba(b.dono, b.remota); bombas.set(b.id, mesh); }
        const voo = b.voo > 0 ? 1 - b.voo / 24 : 0;
        let x = b.x, y = b.y;
        if (b.voo > 0) { x = b.origemX + (b.destinoX - b.origemX) * voo; y = b.origemY + (b.destinoY - b.origemY) * voo; }
        else if (b.deslizando) { const dir = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] }[b.deslizando]; x += dir[0] * b.progresso; y += dir[1] * b.progresso; }
        mesh.grupo.position.set(x + 0.5, b.voo > 0 && !reduzir ? Math.sin(voo * Math.PI) * 1.7 : 0, y + 0.5);
        const pulso = reduzir ? 1 : 1 + Math.sin(tempo * (8 + (1 - Math.min(1, b.pavio / PAVIO)) * 12)) * 0.045;
        mesh.corpo.scale.set(0.30 * pulso, 0.30 / pulso, 0.30 * pulso);
        mesh.arco.geometry.setDrawRange(0, Math.max(1, Math.ceil((b.remota ? 1 : Math.max(0, Math.min(1, b.pavio / PAVIO))) * 40)) * 6);
        mesh.brilho.visible = !b.remota;
      }
      const chaves = new Set<string>();
      for (const it of [...e.itens.map(i => ({ ...i, moeda: false })), ...e.moedas.map(m => ({ ...m, tipo: "bomba" as PowerUp, moeda: true }))]) {
        const chave = `${it.x}/${it.y}/${it.moeda ? "moeda" : it.tipo}`; chaves.add(chave);
        let mesh = itens.get(chave);
        if (!mesh) {
          mesh = it.moeda ? new THREE.Mesh(geoMoeda, matMoeda) : new THREE.Sprite(itemMaterial(it.tipo));
          if (it.moeda) mesh.rotation.z = Math.PI / 2; else mesh.scale.set(0.65, 0.65, 1);
          cena.add(mesh); itens.set(chave, mesh);
        }
        mesh.position.set(it.x + 0.5, 0.48 + (reduzir ? 0 : Math.sin(tempo * 3 + it.x) * 0.045), it.y + 0.5);
        if (it.moeda && !reduzir) mesh.rotation.y = tempo * 2;
      }
      for (const [chave, mesh] of itens) if (!chaves.has(chave)) { cena.remove(mesh); itens.delete(chave); }
      let n = 0;
      const unicas = new Map(e.chamas.map(c => [`${c.x}/${c.y}`, c]));
      for (const c of unicas.values()) {
        const tamanho = Math.min(1, (c.ate - e.passo) / 12);
        const oscilacao = reduzir ? 1 : 1 + Math.sin(tempo * 16 + c.x + c.y) * 0.12;
        instanciar(chamas, n, c.x + 0.5, 0.3, c.y + 0.5, 0.92, 0.4 * tamanho * oscilacao, 0.92);
        instanciar(nucleos, n++, c.x + 0.5, 0.38, c.y + 0.5, 0.4, 0.48 * tamanho * oscilacao, 0.4);
      }
      chamas.count = nucleos.count = n; chamas.instanceMatrix.needsUpdate = nucleos.instanceMatrix.needsUpdate = true;
      n = 0;
      for (const a of avisosMorteSubita(e)) {
        const urgencia = 1 - a.em / AVISO_MORTE_SUBITA;
        for (const dir of [-1, 1]) instanciar(avisos, n++, a.x + 0.5, 0.13, a.y + 0.5, 0.78, 0.035 + urgencia * 0.025, 0.10, dir * Math.PI / 4);
      }
      avisos.count = n; avisos.instanceMatrix.needsUpdate = true;
      faiscas.forEach(p => { p.vida -= dt; p.vy -= dt * 8; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; });
      faiscas = faiscas.filter(p => p.vida > 0 && p.y > 0);
      particulas.count = reduzir ? 0 : faiscas.length;
      faiscas.forEach((p, i) => { const s = 0.065 * p.vida / p.total; instanciar(particulas, i, p.x, p.y, p.z, s, s, s); });
      particulas.instanceMatrix.needsUpdate = true;
      renderer.render(cena, camera);
    },
    destruir() {
      renderer.domElement.removeEventListener("webglcontextlost", perdeuContexto);
      limparMapa(); personagens.forEach(p => p.destruir()); montarias.forEach(m => m.destruir()); bombas.forEach(b => b.arco.geometry.dispose()); bombasLivres.forEach(b => b.arco.geometry.dispose());
      [chamas, nucleos, avisos, particulas].forEach(m => m.dispose());
      geometrias.forEach(g => g.dispose()); materiais.forEach(m => m.dispose()); texturas.forEach(t => t.dispose());
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
