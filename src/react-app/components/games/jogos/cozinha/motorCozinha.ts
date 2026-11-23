import * as THREE from "three";
import type { Entrada } from "@/react-app/utils/games/bombas";
import {
  ALTURA, RECEITAS, TEMPO, estrelas, novaPartidaCozinha, passoCozinha, pontosCozinha,
  type Componente, type EstadoCozinha, type EventoCozinha, type Item, type ModoCozinha, type TemaCozinha, type TipoCelula,
} from "@/react-app/utils/games/cozinha";
import { desserializar, serializar } from "@/react-app/utils/games/espelho";
import type { FasePartida, GanchosMotor, MotorJogo, VagaJogo } from "../../comum/MolduraPartida";
import { som } from "../../audio/sintetizador";
import { CORES_JOGADORES, folhaDoCorpo, quadroDoCorpo } from "../../central/sprites";

export const TEMAS_COZINHA: Record<TemaCozinha, { nome: string; fundo: string; piso: [string, string]; balcao: string; tampo: string }> = {
  bistro: { nome: "Bistrô", fundo: "#1c1917", piso: ["#e7e5e4", "#d6d3d1"], balcao: "#78350f", tampo: "#d6d3d1" },
  food: { nome: "Food truck", fundo: "#0c4a6e", piso: ["#fde68a", "#fcd34d"], balcao: "#0369a1", tampo: "#e2e8f0" },
  navio: { nome: "Navio", fundo: "#082f49", piso: ["#a16207", "#854d0e"], balcao: "#475569", tampo: "#cbd5e1" },
};
const COR_TIPO: Partial<Record<TipoCelula, string>> = { tabua: "#d97706", fogao: "#111827", pia: "#38bdf8", retorno: "#64748b", pilha: "#f8fafc", entrega: "#16a34a", lixeira: "#374151" };
const COR_ING: Record<string, string> = { tomate: "#dc2626", alface: "#22c55e", carne: "#b45309", pao: "#f59e0b", sopa: "#ef4444" };
const CORES_TIME = ["#ef4444", "#3b82f6"];
const LARGURA_FOLHA = 128;
const ALTURA_FOLHA = 48 * 7;
const ALT_BALCAO = 0.9;

/** Motor da Cozinha Caótica (three.js): cozinha vista do alto em ângulo, com balcões, fogões, pia, comida e fogo. */
export function criarMotorCozinha(caixa: HTMLDivElement, vagas: VagaJogo[], modo: ModoCozinha, tema: TemaCozinha, ganchos: GanchosMotor): MotorJogo {
  const t = TEMAS_COZINHA[tema];
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Cozinha Caótica");
  renderer.domElement.className = "rounded-lg shadow-2xl ring-1 ring-white/10";
  caixa.appendChild(renderer.domElement);
  if (getComputedStyle(caixa).position === "static") caixa.style.position = "relative";
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(t.fundo);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  cena.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.2));
  const sol = new THREE.DirectionalLight(0xffffff, 1.2);
  sol.position.set(5, 20, 10);
  cena.add(sol);
  const descartaveis: { dispose(): void }[] = [];
  const guardar = <T extends { dispose(): void }>(x: T) => { descartaveis.push(x); return x; };
  const mat = (cor: string, extra: THREE.MeshStandardMaterialParameters = {}) => guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, ...extra }));

  // Pedidos: lista no canto de cima (uma coluna por cozinha no Duelo).
  const painel = document.createElement("div");
  painel.style.cssText = "position:absolute;left:8px;right:8px;top:8px;display:flex;gap:12px;justify-content:space-between;pointer-events:none;font:600 12px system-ui,sans-serif";
  caixa.appendChild(painel);

  const fixos = new THREE.Group();
  cena.add(fixos);
  let montado = "";
  function montarCozinha(e: EstadoCozinha) {
    const chave = `${e.largura}`;
    if (chave === montado) return;
    montado = chave;
    fixos.clear();
    const geoPiso = guardar(new THREE.PlaneGeometry(1, 1)), m0 = mat(t.piso[0]), m1 = mat(t.piso[1]);
    const geoBalcao = guardar(new THREE.BoxGeometry(0.98, ALT_BALCAO, 0.98)), mBalcao = mat(t.balcao), mTampo = mat(t.tampo);
    const geoTampo = guardar(new THREE.BoxGeometry(1, 0.06, 1));
    e.celulas.forEach((c, i) => {
      const x = i % e.largura + 0.5, z = Math.floor(i / e.largura) + 0.5;
      if (c.tipo === "chao") {
        const p = new THREE.Mesh(geoPiso, (Math.floor(x) + Math.floor(z)) % 2 ? m0 : m1);
        p.rotation.x = -Math.PI / 2; p.position.set(x, 0, z); fixos.add(p);
        return;
      }
      const b = new THREE.Mesh(geoBalcao, mBalcao); b.position.set(x, ALT_BALCAO / 2, z); fixos.add(b);
      const tampo = new THREE.Mesh(geoTampo, COR_TIPO[c.tipo] ? mat(COR_TIPO[c.tipo]!) : c.tipo === "caixa" ? mat("#a16207") : mTampo);
      tampo.position.set(x, ALT_BALCAO + 0.03, z); fixos.add(tampo);
      if (c.tipo === "caixa") {
        // Caixa aberta com o ingrediente desenhado na tampa.
        const ic = new THREE.Mesh(geoIng[c.caixa!], matIng[c.caixa!]); ic.position.set(x, ALT_BALCAO + 0.2, z); ic.scale.setScalar(1.3); fixos.add(ic);
      } else if (c.tipo === "fogao") {
        const boca = new THREE.Mesh(guardar(new THREE.TorusGeometry(0.28, 0.04, 6, 20)), mat("#9ca3af")); boca.rotation.x = Math.PI / 2; boca.position.set(x, ALT_BALCAO + 0.08, z); fixos.add(boca);
      } else if (c.tipo === "pia") {
        const agua = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.7, 0.05, 0.7)), mat("#0ea5e9", { metalness: 0.4 })); agua.position.set(x, ALT_BALCAO + 0.07, z); fixos.add(agua);
      } else if (c.tipo === "entrega") {
        const seta = new THREE.Mesh(guardar(new THREE.ConeGeometry(0.25, 0.4, 4)), mat("#bbf7d0", { emissive: "#16a34a" })); seta.position.set(x, ALT_BALCAO + 0.5, z); seta.rotation.x = Math.PI; fixos.add(seta);
      } else if (c.tipo === "lixeira") {
        const l = new THREE.Mesh(guardar(new THREE.CylinderGeometry(0.3, 0.25, 0.3, 14)), mat("#111827")); l.position.set(x, ALT_BALCAO + 0.15, z); fixos.add(l);
      }
    });
    // Divisória do Duelo.
    if (e.cozinhas === 2) {
      const d = new THREE.Mesh(guardar(new THREE.BoxGeometry(0.1, 1.6, ALTURA)), mat("#f8fafc", { emissive: "#64748b" }));
      d.position.set(e.largura / 2, 0.8, ALTURA / 2); fixos.add(d);
    }
  }

  // Comida e utensílios (reaproveitados quadro a quadro).
  const geoIng: Record<string, THREE.BufferGeometry> = {
    tomate: guardar(new THREE.SphereGeometry(0.16, 12, 8)), alface: guardar(new THREE.SphereGeometry(0.18, 8, 6)),
    carne: guardar(new THREE.BoxGeometry(0.3, 0.14, 0.26)), pao: guardar(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 12)),
    sopa: guardar(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14)),
  };
  const matIng: Record<string, THREE.Material> = Object.fromEntries(Object.entries(COR_ING).map(([k, c]) => [k, mat(c)]));
  const matFrito = mat("#78350f"), matQueimado = mat("#0a0a0a");
  const geoPrato = guardar(new THREE.CylinderGeometry(0.32, 0.26, 0.06, 18)), matPrato = mat("#f8fafc"), matSujo = mat("#a8a29e");
  const geoPanela = guardar(new THREE.CylinderGeometry(0.3, 0.26, 0.3, 16)), matPanela = mat("#9ca3af", { metalness: 0.6 });
  const geoFrigideira = guardar(new THREE.CylinderGeometry(0.32, 0.3, 0.08, 16)), matFrigideira = mat("#1f2937", { metalness: 0.5 });
  const geoCabo = guardar(new THREE.BoxGeometry(0.35, 0.04, 0.06));
  const geoExtintor = guardar(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 12)), matExtintor = mat("#dc2626");
  const geoBarra = guardar(new THREE.PlaneGeometry(0.7, 0.1));
  const matBarraFundo = guardar(new THREE.MeshBasicMaterial({ color: "#111827" })), matBarraVerde = guardar(new THREE.MeshBasicMaterial({ color: "#22c55e" })), matBarraAlerta = guardar(new THREE.MeshBasicMaterial({ color: "#f97316" }));
  const geoFogo = guardar(new THREE.ConeGeometry(0.3, 0.8, 7)), matFogo = guardar(new THREE.MeshBasicMaterial({ color: "#f97316", transparent: true, opacity: 0.85 })), matFogo2 = guardar(new THREE.MeshBasicMaterial({ color: "#fde047", transparent: true, opacity: 0.9 }));
  const piscinas = new Map<string, { lista: THREE.Mesh[]; usados: number }>();
  const dinamicos = new THREE.Group();
  cena.add(dinamicos);
  function peca(chave: string, geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
    let p = piscinas.get(chave);
    if (!p) { p = { lista: [], usados: 0 }; piscinas.set(chave, p); }
    if (p.usados >= p.lista.length) { const nova = new THREE.Mesh(geo, m); dinamicos.add(nova); p.lista.push(nova); }
    const mesh = p.lista[p.usados++];
    mesh.visible = true; mesh.material = m; mesh.scale.set(1, 1, 1); mesh.rotation.set(0, 0, 0);
    return mesh;
  }
  function barra(x: number, y: number, z: number, f: number, alerta = false) {
    const fundo = peca("barraF", geoBarra, matBarraFundo); fundo.position.set(x, y, z); fundo.quaternion.copy(camera.quaternion);
    const cheia = peca("barraC", geoBarra, alerta ? matBarraAlerta : matBarraVerde);
    cheia.quaternion.copy(camera.quaternion); cheia.scale.set(Math.max(0.01, Math.min(1, f)), 0.8, 1);
    cheia.position.set(x, y, z).add(new THREE.Vector3(-(1 - Math.min(1, f)) * 0.35, 0, 0.001).applyQuaternion(camera.quaternion));
  }
  function componente(c: Componente, x: number, y: number, z: number, k: number) {
    const m = peca(`c-${c}`, geoIng[c], c === "carne" ? matFrito : matIng[c]);
    m.position.set(x + (k % 2 ? 0.08 : -0.08), y + 0.06 + k * 0.07, z);
    m.scale.set(0.8, c === "pao" || c === "carne" || c === "sopa" ? 0.6 : 0.4, 0.8);
  }
  function desenharItem(it: Item, x: number, y: number, z: number) {
    if (it.k === "ing") {
      const m = peca(`i-${it.ing}`, geoIng[it.ing], matIng[it.ing]);
      m.position.set(x, y + 0.12, z);
      if (it.corte >= 1) m.scale.set(1.2, 0.4, 1.2);
      if (it.corte > 0 && it.corte < 1) barra(x, y + 0.6, z, it.corte);
    } else if (it.k === "prato") {
      const m = peca("prato", geoPrato, matPrato); m.position.set(x, y + 0.03, z);
      it.itens.forEach((c, k) => componente(c, x, y, z, k));
    } else if (it.k === "sujos") {
      for (let k = 0; k < Math.min(6, it.n); k++) { const m = peca("sujo", geoPrato, matSujo); m.position.set(x, y + 0.03 + k * 0.07, z); }
    } else if (it.k === "extintor") {
      const m = peca("extintor", geoExtintor, matExtintor); m.position.set(x, y + 0.25, z);
    } else {
      const panela = it.k === "panela";
      const m = peca(it.k, panela ? geoPanela : geoFrigideira, panela ? matPanela : matFrigideira); m.position.set(x, y + (panela ? 0.15 : 0.04), z);
      const cabo = peca("cabo", geoCabo, matFrigideira); cabo.position.set(x + 0.45, y + (panela ? 0.25 : 0.06), z);
      const topo = y + (panela ? 0.3 : 0.1);
      if (it.queimado) { const q = peca("queimado", geoIng.sopa, matQueimado); q.position.set(x, topo, z); }
      else if (panela && it.tomates) {
        if (it.tomates >= 3 && it.coz > 0) { const s = peca("sopa", geoIng.sopa, matIng.sopa); s.position.set(x, topo - 0.02, z); }
        else for (let k = 0; k < it.tomates; k++) { const s = peca("i-tomate", geoIng.tomate, matIng.tomate); s.scale.set(0.7, 0.4, 0.7); s.position.set(x - 0.1 + k * 0.1, topo - 0.02, z); }
      } else if (!panela && it.carne) { const c = peca("c-carne", geoIng.carne, it.coz >= 1 ? matFrito : matIng.carne); c.position.set(x, topo, z); }
      const temComida = panela ? it.tomates >= 3 : it.carne;
      if (temComida && !it.queimado) {
        if (it.coz < 1) barra(x, y + 0.8, z, it.coz);
        else if (Math.sin(tempo * 12) > 0) barra(x, y + 0.8, z, (it.coz - 1) / 0.8, true);
      }
    }
  }

  // Cozinheiros: avatar de corpo inteiro com touca branca, anel da cor (no Duelo, do time).
  const geoTouca = guardar(new THREE.CylinderGeometry(0.22, 0.18, 0.3, 12)), matTouca = mat("#ffffff");
  const geoAnel = guardar(new THREE.RingGeometry(0.32, 0.42, 20));
  const cozinheiros = vagas.map((v, i) => {
    const textura = guardar(new THREE.CanvasTexture(folhaDoCorpo(v.avatar, `corpo-${JSON.stringify(v.avatar)}`)));
    textura.magFilter = textura.minFilter = THREE.NearestFilter; textura.colorSpace = THREE.SRGBColorSpace;
    const corpo = new THREE.Mesh(guardar(new THREE.PlaneGeometry(0.9, 1.35)), guardar(new THREE.MeshBasicMaterial({ map: textura, transparent: true, alphaTest: 0.5 })));
    const touca = new THREE.Mesh(geoTouca, matTouca);
    const anel = new THREE.Mesh(geoAnel, guardar(new THREE.MeshBasicMaterial({ color: modo === "duelo" ? CORES_TIME[i % 2] : CORES_JOGADORES[i % 8], side: THREE.DoubleSide })));
    anel.rotation.x = -Math.PI / 2;
    cena.add(corpo, touca, anel);
    return { corpo, touca, anel, textura, x: 0, z: 0 };
  });

  const geoFaisca = guardar(new THREE.BoxGeometry(0.08, 0.08, 0.08));
  const faiscas: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  const faisca = (x: number, y: number, z: number, cor: string, n: number, forca: number) => {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geoFaisca, new THREE.MeshBasicMaterial({ color: cor }));
      m.position.set(x, y, z); cena.add(m);
      faiscas.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * forca, Math.random() * forca, (Math.random() - 0.5) * forca), t: 0 });
    }
  };

  let estado: EstadoCozinha | null = null;
  let pendentes: unknown[] = [];
  let tempo = 0;

  function efeitosDoPasso(e: EstadoCozinha) {
    for (const ev of e.eventos as EventoCozinha[]) {
      const humano = "jogador" in ev && !vagas[ev.jogador]?.bot;
      if (ev.tipo === "pegou" || ev.tipo === "soltou") { if (humano) som.clique(); }
      else if (ev.tipo === "juntou") { som.colocar(); faisca(ev.x, ALT_BALCAO + 0.3, ev.z, "#fef3c7", 4, 1.5); }
      else if (ev.tipo === "corte") { if (humano && Math.random() < 0.5) som.bloco(); if (ev.pronto) faisca(ev.x, ALT_BALCAO + 0.3, ev.z, "#bbf7d0", 6, 2); }
      else if (ev.tipo === "lavou") { som.moeda(); faisca(ev.x, ALT_BALCAO + 0.3, ev.z, "#7dd3fc", 8, 2); }
      else if (ev.tipo === "entrega") { som.powerup(); if (humano) ganchos.vibrarLocal(ev.jogador, 60); }
      else if (ev.tipo === "errado") { som.morte(); if (humano) ganchos.vibrarLocal(ev.jogador, 150); }
      else if (ev.tipo === "venceu") som.alerta();
      else if (ev.tipo === "pedido") som.contagem(false);
      else if (ev.tipo === "pronto") som.escudo();
      else if (ev.tipo === "queimou") { som.maldicao(); faisca(ev.x, ALT_BALCAO + 0.4, ev.z, "#1f2937", 10, 2); }
      else if (ev.tipo === "fogo") som.explosao(1);
      else if (ev.tipo === "extintor") faisca(ev.x, ALT_BALCAO + 0.4, ev.z, "#f8fafc", 5, 2.5);
      else if (ev.tipo === "apagou") som.arremesso();
    }
  }

  function atualizarPainel(e: EstadoCozinha) {
    const colunas: string[] = [];
    for (let k = 0; k < e.cozinhas; k++) {
      const cartoes = e.pedidos.filter(p => p.cozinha === k).sort((a, b) => a.prazo - b.prazo).map(p => {
        const r = RECEITAS[p.receita], f = Math.max(0, (p.prazo - e.passo) / r.prazo);
        const cor = f > 0.5 ? "#22c55e" : f > 0.25 ? "#eab308" : "#ef4444";
        const pontinhos = r.itens.map(c => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:2px;background:${COR_ING[c]}"></span>`).join("");
        return `<div style="background:rgba(15,23,42,.85);color:#fff;border-radius:8px;padding:4px 8px;min-width:96px"><div>${r.nome}</div><div>${pontinhos}</div><div style="height:4px;background:#334155;border-radius:2px;margin-top:3px"><div style="height:4px;width:${Math.round(f * 100)}%;background:${cor};border-radius:2px"></div></div></div>`;
      }).join("");
      const titulo = e.cozinhas === 2 ? `<div style="color:${CORES_TIME[k]};text-shadow:0 1px 2px #000">${k ? "Azul" : "Vermelho"} · ${e.pontos[k]} pts${e.combo[k] > 1 ? ` · combo ×${e.combo[k]}` : ""}</div>` : `<div style="color:#fff;text-shadow:0 1px 2px #000">${e.pontos[0]} / ${e.meta} pts · ${"★".repeat(estrelas(e))}${"☆".repeat(3 - estrelas(e))}${e.combo[0] > 1 ? ` · combo ×${e.combo[0]}` : ""}</div>`;
      colunas.push(`<div style="display:flex;flex-direction:column;gap:4px;${k ? "align-items:flex-end" : ""}">${titulo}<div style="display:flex;gap:4px;flex-wrap:wrap">${cartoes}</div></div>`);
    }
    const html = colunas.join("");
    if (painel.innerHTML !== html) painel.innerHTML = html;
  }

  function redimensionar() {
    const w = Math.max(1, caixa.clientWidth - 8), h = Math.max(1, caixa.clientHeight - 8);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const guardarAnteriores = (e: EstadoCozinha) => e.cozinheiros.forEach((c, i) => { if (cozinheiros[i]) { cozinheiros[i].x = c.x; cozinheiros[i].z = c.z; } });
  const DIR: Record<string, [number, number]> = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };

  return {
    iniciarRodada() {
      estado = novaPartidaCozinha({ modo, tema, semente: (Math.random() * 1e9) | 0, jogadores: vagas.map(v => ({ bot: v.bot })) });
      pendentes = [];
      faiscas.splice(0).forEach(f => { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); });
      montarCozinha(estado);
      guardarAnteriores(estado);
    },
    passo(entradas: Entrada[]) {
      const e = estado;
      if (!e) return null;
      guardarAnteriores(e);
      if (!e.terminado) { passoCozinha(e, entradas); efeitosDoPasso(e); if (pendentes.length < 400) pendentes.push(...e.eventos); }
      return e.terminado ? { vencedor: e.vencedor, time: e.timeVencedor, pontos: pontosCozinha(e) } : null;
    },
    desenhar(alfa: number, dt: number, fase: FasePartida, vencedor: number | null) {
      const e = estado;
      if (!e) return;
      tempo += dt;
      // Câmera: a cozinha inteira, de cima e um pouco de frente.
      const meioX = e.largura / 2, meioZ = ALTURA / 2;
      const ext = Math.max(e.largura / Math.max(0.6, camera.aspect), ALTURA * 1.5);
      const dist = ext / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.05;
      camera.position.set(meioX, dist * 0.85, meioZ + dist * 0.55);
      camera.lookAt(meioX, 0, meioZ + 0.3);
      for (const p of piscinas.values()) p.usados = 0;
      e.celulas.forEach((c, i) => {
        const x = i % e.largura + 0.5, z = Math.floor(i / e.largura) + 0.5, y = ALT_BALCAO + 0.06;
        if (c.item) desenharItem(c.item, x, y, z);
        if (c.tipo === "pilha") for (let k = 0; k < Math.min(8, c.pratos); k++) { const m = peca("prato", geoPrato, matPrato); m.position.set(x, y + 0.03 + k * 0.07, z); }
        if ((c.tipo === "pia" || c.tipo === "retorno") && c.pratos) {
          for (let k = 0; k < Math.min(6, c.pratos); k++) { const m = peca("sujo", geoPrato, matSujo); m.position.set(x, y + 0.03 + k * 0.07, z); }
          if (c.tipo === "pia" && c.lavagem > 0) barra(x, y + 0.7, z, c.lavagem / 80);
        }
        if (c.fogo > 0) {
          for (let k = 0; k < 3; k++) {
            const f = peca(`fogo${k % 2}`, geoFogo, k % 2 ? matFogo2 : matFogo);
            const s = (0.6 + 0.4 * Math.abs(Math.sin(tempo * 9 + k * 2 + i))) * (0.5 + c.fogo / 200);
            f.scale.set(s * (k ? 0.6 : 1), s * (k ? 0.7 : 1), s * (k ? 0.6 : 1));
            f.position.set(x + (k - 1) * 0.18, y + 0.35 * s, z + (k === 1 ? 0.1 : -0.05));
          }
        }
      });
      e.cozinheiros.forEach((s, i) => {
        const o = cozinheiros[i];
        if (!o) return;
        const x = o.x + (s.x - o.x) * alfa, z = o.z + (s.z - o.z) * alfa;
        const comemora = fase !== "jogando" && fase !== "contagem" && (vencedor === i || (modo !== "duelo" && vencedor !== null));
        const pulo = comemora ? Math.abs(Math.sin(tempo * 7 + i)) * 0.35 : 0;
        o.corpo.position.set(x, 0.7 + pulo, z); o.corpo.quaternion.copy(camera.quaternion);
        o.touca.position.set(x, 1.5 + pulo, z);
        o.anel.position.set(x, 0.02, z);
        const dir = s.bot ? "baixo" : s.dir;
        const r = quadroDoCorpo(dir === "cima" ? "cima" : dir === "baixo" ? "baixo" : "lado", "parado", tempo);
        o.textura.offset.set(r.sx / LARGURA_FOLHA, 1 - (r.sy + r.h) / ALTURA_FOLHA);
        o.textura.repeat.set(r.w / LARGURA_FOLHA, r.h / ALTURA_FOLHA);
        if (s.mao) { const [dx, dz] = DIR[s.dir]; desenharItem(s.mao, x + dx * 0.35, 0.85, z + dz * 0.35 + 0.05); }
      });
      for (const p of piscinas.values()) for (let k = p.usados; k < p.lista.length; k++) p.lista[k].visible = false;
      for (let k = faiscas.length - 1; k >= 0; k--) {
        const f = faiscas[k];
        f.t += dt; f.v.y -= 6 * dt; f.m.position.addScaledVector(f.v, dt);
        if (f.t > 0.6) { cena.remove(f.m); (f.m.material as THREE.Material).dispose(); faiscas.splice(k, 1); }
      }
      atualizarPainel(e);
      renderer.render(cena, camera);
    },
    placar() {
      const e = estado;
      if (!e) return { tempo: 0, jogadores: [] };
      return {
        tempo: Math.max(0, Math.ceil((TEMPO - e.passo) / 60)),
        alerta: TEMPO - e.passo < 20 * 60,
        jogadores: e.cozinheiros.map(c => ({
          vivo: true,
          texto: `${c.entregas} 🍽 · ${c.pontos} pts${e.cozinhas === 2 ? ` · ${c.time ? "azul" : "vermelho"}` : ""}`,
        })),
      };
    },
    redimensionar,
    quadro() { return estado ? serializar({ ...estado, eventos: [] }) : null; },
    tirarEventos() { const l = pendentes.map(x => serializar(x)); pendentes = []; return l; },
    aplicar(s: unknown, eventos: unknown[]) {
      const e = desserializar(s) as EstadoCozinha | null;
      if (!e || !Array.isArray(e.cozinheiros) || !Array.isArray(e.celulas)) return;
      if (estado) guardarAnteriores(estado); else guardarAnteriores(e);
      estado = e;
      e.eventos = eventos.map(x => desserializar(x)) as EventoCozinha[];
      montarCozinha(e);
      efeitosDoPasso(e);
    },
    destruir() {
      faiscas.forEach(f => (f.m.material as THREE.Material).dispose());
      descartaveis.forEach(d => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      painel.remove();
    },
  };
}
