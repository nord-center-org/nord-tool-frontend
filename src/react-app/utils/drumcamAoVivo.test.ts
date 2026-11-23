import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANAL_PADRAO, FILTRO_NEUTRO, PRESETS, alinhamento, botoesDeZoom, cssDoFiltro, dbDoGanho, diferencaDeRelogio, duracaoTexto, formatoDeGravacao,
  fracaoDeMovimento, ganhoDoDb, ganhoEfetivo, layoutPadrao, lenteParaZoom, lentesDosDispositivos, lerComando, lerSinal, limiarDaSensibilidade,
  moverCamada, nivelDoMedidor, nomeDoArquivo, novoAvisoDeMovimento, paraFrente, partesDoArquivo, redimensionarCamada, retanguloDeDesenho,
  tamanhoTexto, zoomPorPinca,
} from "./drumcamAoVivo.ts";

test("sinal do WebRTC: só o formato esperado passa", () => {
  assert.deepEqual(lerSinal({ tipo: "quero", qualidade: "baixa" }), { tipo: "quero", qualidade: "baixa" });
  assert.deepEqual(lerSinal({ tipo: "quero", qualidade: "hack" }), { tipo: "quero", qualidade: "media" });
  assert.equal(lerSinal({ tipo: "oferta", sdp: "v=0" })?.tipo, "oferta");
  assert.equal(lerSinal({ tipo: "oferta", sdp: "x".repeat(70_000) }), null);
  assert.deepEqual(lerSinal({ tipo: "candidato", c: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0, extra: 1 } }),
    { tipo: "candidato", c: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 } });
  assert.equal(lerSinal({ tipo: "candidato", c: { candidate: 5 } }), null);
  assert.equal(lerSinal(null), null);
  assert.equal(lerSinal({ tipo: "outro" }), null);
  assert.deepEqual(lerSinal({ tipo: "fim" }), { tipo: "fim" });
});

test("comandos da câmera: validados e limitados", () => {
  assert.deepEqual(lerComando({ id: 1, c: "zoom", valor: 2.5 }), { id: 1, c: "zoom", valor: 2.5 });
  assert.equal(lerComando({ id: 1, c: "zoom", valor: "2" }), null);
  assert.deepEqual(lerComando({ id: 2, c: "lente", lente: "abc" }), { id: 2, c: "lente", lente: "abc" });
  assert.deepEqual(lerComando({ id: 3, c: "nome", nome: "x".repeat(80) }), { id: 3, c: "nome", nome: "x".repeat(60) });
  assert.equal(lerComando({ id: 4, c: "gravar", sessao: "../etc" }), null);
  assert.deepEqual(lerComando({ id: 4, c: "gravar", sessao: "s-123" }), { id: 4, c: "gravar", sessao: "s-123" });
  assert.deepEqual(lerComando({ id: 5, c: "resolucao", altura: 1080 }), { id: 5, c: "resolucao", altura: 1080 });
  assert.equal(lerComando({ id: 5, c: "resolucao", altura: 999 }), null);
  assert.deepEqual(lerComando({ id: 6, c: "foto" }), { id: 6, c: "foto" });
  assert.equal(lerComando({ id: 7, c: "apagar-tudo" }), null);
  assert.equal(lerComando({ c: "foto" }), null);
});

test("lentes pelos nomes, botões de zoom e a lente certa para cada zoom", () => {
  const lentes = lentesDosDispositivos([
    { deviceId: "a", label: "camera2 0, facing back" }, { deviceId: "b", label: "camera2 1, facing front" },
    { deviceId: "c", label: "Back Ultra Wide Camera" }, { deviceId: "d", label: "Back Telephoto 3x" },
  ]);
  assert.deepEqual(lentes.map(l => [l.id, l.fator, l.frente]), [["a", 1, false], ["b", 1, true], ["c", 0.5, false], ["d", 3, false]]);
  assert.equal(lentes[0].nome, "Principal");
  assert.deepEqual(botoesDeZoom({ min: 1, max: 8 }, lentes), [0.5, 1, 2, 3, 5]);
  assert.deepEqual(botoesDeZoom(null, []), [1]);
  assert.deepEqual(lenteParaZoom(0.5, lentes, "a"), { lente: "c", zoom: 1 });
  assert.deepEqual(lenteParaZoom(2, lentes, "a"), { lente: "a", zoom: 2 });
  assert.deepEqual(lenteParaZoom(6, lentes, "a"), { lente: "d", zoom: 2 });
  assert.deepEqual(lenteParaZoom(2, lentes, "b"), { lente: "b", zoom: 2 }, "na frontal o zoom é digital");
  assert.equal(zoomPorPinca(2, 100, 200, 1, 8), 4);
  assert.equal(zoomPorPinca(2, 100, 10, 1, 8), 1);
  assert.equal(zoomPorPinca(2, 0, 10, 1, 8), 2);
});

test("layouts: lado a lado, PiP, grade e destaque cobrem a tela sem sair dela", () => {
  const lado = layoutPadrao(["a", "b"], "lado");
  assert.deepEqual(lado.map(c => [c.x, c.w, c.h]), [[0, 0.5, 1], [0.5, 0.5, 1]]);
  const emp = layoutPadrao(["a", "b"], "empilhado", "9:16");
  assert.deepEqual(emp.map(c => [c.y, c.h]), [[0, 0.5], [0.5, 0.5]]);
  const pip = layoutPadrao(["a", "b", "c"], "pip");
  assert.equal(pip[0].w, 1);
  for (const c of pip.slice(1)) assert.ok(c.x + c.w <= 1 && c.y >= 0 && c.y + c.h <= 1 && c.z > 0);
  const grade = layoutPadrao(["a", "b", "c", "d", "e"], "grade");
  assert.ok(grade.every(c => c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9));
  assert.equal(new Set(grade.map(c => `${c.x},${c.y}`)).size, 5);
  const dest = layoutPadrao(["a", "b", "c"], "destaque");
  assert.equal(dest[0].w, 0.75);
  assert.equal(layoutPadrao(["a", "b"], "unica")[1].visivel, false);
  assert.deepEqual(layoutPadrao([], "grade"), []);
});

test("mover e redimensionar a câmera sem sair da tela; trazer para a frente", () => {
  const [c] = layoutPadrao(["a", "b"], "pip").slice(1);
  const m = moverCamada(c, 5, 5);
  assert.ok(Math.abs(m.x + m.w - 1) < 1e-9 && Math.abs(m.y + m.h - 1) < 1e-9);
  assert.deepEqual(moverCamada(c, -5, -5).x, 0);
  const r = redimensionarCamada({ ...c, x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, "se", 0.2, 0.1);
  assert.ok(Math.abs(r.w - 0.5) < 1e-9 && Math.abs(r.h - 0.4) < 1e-9);
  const mini = redimensionarCamada({ ...c, x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, "no", 0.5, 0.5);
  assert.ok(mini.w >= 0.08 - 1e-9 && mini.h >= 0.08 - 1e-9);
  const prop = redimensionarCamada({ ...c, x: 0.1, y: 0.1, w: 0.32, h: 0.18 }, "se", 0.16, 0, 16 / 9);
  assert.ok(Math.abs(prop.w / prop.h - 16 / 9) < 1e-6);
  const frente = paraFrente(layoutPadrao(["a", "b"], "pip"), "a");
  assert.ok(frente[0].z > frente[1].z);
});

test("recorte: cobrir corta as sobras, conter deixa faixas", () => {
  const c = { id: "a", x: 0, y: 0, w: 0.5, h: 1, z: 0, ajuste: "cobrir" as const, raio: 0, visivel: true, espelhar: false };
  const cobrir = retanguloDeDesenho(1920, 1080, c, 1920, 1080);
  assert.equal(cobrir.dw, 960);
  assert.ok(Math.abs(cobrir.sw / cobrir.sh - 960 / 1080) < 1e-9);
  assert.ok(cobrir.sx > 0);
  const conter = retanguloDeDesenho(1920, 1080, { ...c, ajuste: "conter" }, 1920, 1080);
  assert.equal(conter.dw, 960);
  assert.ok(conter.dh < 1080 && conter.dy > 0);
  assert.equal(retanguloDeDesenho(0, 0, c, 1920, 1080).sw, 0);
});

test("filtros viram o ctx.filter do canvas", () => {
  assert.equal(cssDoFiltro(FILTRO_NEUTRO), "none");
  assert.equal(cssDoFiltro({ ...FILTRO_NEUTRO, brilho: 120, contraste: 90 }), "brightness(120%) contrast(90%)");
  assert.match(cssDoFiltro(PRESETS.pb.filtro), /grayscale\(100%\)/);
  assert.match(cssDoFiltro({ ...FILTRO_NEUTRO, temperatura: 40 }), /sepia\(14%\) hue-rotate\(-6deg\)/);
  assert.match(cssDoFiltro({ ...FILTRO_NEUTRO, temperatura: -40 }), /hue-rotate\(168deg\)/);
  assert.match(cssDoFiltro({ ...FILTRO_NEUTRO, desfoque: 3 }), /blur\(3px\)/);
});

test("mixer: mudo, solo, limite de ganho, dB e medidor", () => {
  assert.equal(ganhoEfetivo({ ...CANAL_PADRAO, ganho: 1.5 }, false), 1.5);
  assert.equal(ganhoEfetivo({ ...CANAL_PADRAO, mudo: true }, false), 0);
  assert.equal(ganhoEfetivo(CANAL_PADRAO, true), 0);
  assert.equal(ganhoEfetivo({ ...CANAL_PADRAO, solo: true }, true), 1);
  assert.equal(ganhoEfetivo({ ...CANAL_PADRAO, ganho: 9 }, false), 2);
  assert.equal(Math.round(dbDoGanho(2)), 6);
  assert.equal(dbDoGanho(0), -Infinity);
  assert.ok(Math.abs(ganhoDoDb(-6) - 0.501) < 0.001);
  assert.equal(ganhoDoDb(-Infinity), 0);
  assert.equal(nivelDoMedidor(new Float32Array(128)), 0);
  assert.equal(nivelDoMedidor(new Float32Array(128).fill(1)), 1);
  assert.ok(nivelDoMedidor(new Float32Array(128).fill(0.1)) > 0.6);
});

test("movimento: fração de pixels mudados, sensibilidade e aviso sem repetir", () => {
  const a = new Uint8ClampedArray(4 * 100).fill(10);
  const b = a.slice();
  for (let i = 0; i < 20; i++) b.set([250, 250, 250, 255], i * 4);
  assert.equal(fracaoDeMovimento(a, a), 0);
  assert.equal(fracaoDeMovimento(a, b), 0.2);
  assert.equal(fracaoDeMovimento(a, new Uint8ClampedArray(8)), 0);
  assert.ok(limiarDaSensibilidade(10) < limiarDaSensibilidade(1));
  assert.equal(limiarDaSensibilidade(99), limiarDaSensibilidade(10));
  assert.equal(novoAvisoDeMovimento([true], 0, 50_000), false);
  assert.equal(novoAvisoDeMovimento([false, true, true], 0, 50_000), true);
  assert.equal(novoAvisoDeMovimento([true, true], 45_000, 50_000), false, "espera entre avisos");
});

test("relógio, alinhamento e partes do arquivo", () => {
  assert.equal(diferencaDeRelogio(1000, 5100, 1200), 4000);
  // A câmera B começou a gravar 0,5 s depois (no relógio do painel): A precisa pular 0,5 s.
  const al = alinhamento([{ id: "A", inicio: 10_000, diferenca: 0 }, { id: "B", inicio: 14_500, diferenca: 4_000 }]);
  assert.deepEqual(al, { A: 0.5, B: 0 });
  assert.deepEqual(partesDoArquivo(150_000, 64 * 1024).map(p => p.fim - p.inicio), [65536, 65536, 18928]);
  assert.deepEqual(partesDoArquivo(0), []);
});

test("formato de gravação, nome, duração e tamanho", () => {
  assert.equal(formatoDeGravacao(m => m === "video/mp4").ext, "mp4");
  assert.equal(formatoDeGravacao(m => m.startsWith("video/webm;codecs=vp8")).mime, "video/webm;codecs=vp8,opus");
  assert.deepEqual(formatoDeGravacao(() => false), { mime: "", ext: "webm" });
  assert.equal(nomeDoArquivo("Drumcam", new Date(2026, 10, 23, 18, 5, 9), "mp4"), "Drumcam 2026-11-23 18h0509.mp4");
  assert.equal(duracaoTexto(75), "1:15");
  assert.equal(duracaoTexto(3725), "1:02:05");
  assert.equal(tamanhoTexto(1536), "1,5 KB");
  assert.equal(tamanhoTexto(3_500_000), "3,3 MB");
  assert.equal(tamanhoTexto(12), "12 B");
});
