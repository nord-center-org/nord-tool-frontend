import { test } from "node:test";
import assert from "node:assert/strict";
import type { Camada } from "./drumcamAoVivo.ts";
import {
  aparar, apagarIntervalo, apagarTrecho, camadasNoTempo, correlacao, dbParaLinear, destaqueNoTempo, dividir, duracaoEditada, envelopeDeAtaques,
  ganhosNoTempo, iniciosEditados, intervalo, lerProjeto, lerSrt, melhorAtraso, mono, moverTrecho, novoProjeto, novoTexto, paraEditado, paraFonte,
  paraSrt, pedacosEditados, pesoNoIntervalo, picos, quebrarLinhas, relogioEdicao, sincronizarAudio, textosNoTempo, transicaoNoTempo, type Trecho,
} from "./editorVideo.ts";

const cam = (id: string, x = 0, y = 0, w = 1, h = 1, z = 0): Camada => ({ id, x, y, w, h, z, ajuste: "cobrir", raio: 0, visivel: true, espelhar: false });
const projeto = () => novoProjeto({ cameras: [{ id: "bat", nome: "Bateria" }, { id: "gui", nome: "Guitarra" }], duracao: 60, formato: "16:9", camadas: [cam("bat"), cam("gui", 0.7, 0.7, 0.25, 0.25, 1)] });
let seq = 0;
const id = () => `n${++seq}`;

test("projeto novo tem o vídeo inteiro num trecho e os canais no zero", () => {
  const p = projeto();
  assert.deepEqual(p.cortes, [{ id: "t1", inicio: 0, fim: 60 }]);
  assert.equal(duracaoEditada(p.cortes), 60);
  assert.deepEqual(p.canais.gui, { ganhoDb: 0, mudo: false, pan: 0 });
});

test("dividir, apagar e converter entre o tempo editado e o da gravação", () => {
  let c = dividir(projeto().cortes, 10, "t2");
  c = dividir(c, 30, "t3");
  assert.deepEqual(c.map(t => [t.inicio, t.fim]), [[0, 10], [10, 30], [30, 60]]);
  c = apagarTrecho(c, "t2");
  assert.equal(duracaoEditada(c), 40);
  assert.deepEqual(paraFonte(c, 12), { indice: 1, tFonte: 32 });
  assert.equal(paraEditado(c, 32), 12);
  assert.equal(paraEditado(c, 20), null, "o trecho apagado some do vídeo");
  assert.deepEqual(iniciosEditados(c), [0, 10]);
  // não divide colado na ponta e não apaga o último trecho
  assert.equal(dividir(c, 10.02, "x").length, 2);
  assert.equal(apagarTrecho([{ id: "a", inicio: 0, fim: 5 }], "a").length, 1);
});

test("aparar respeita o vizinho na gravação e o mínimo", () => {
  const c: Trecho[] = [{ id: "a", inicio: 0, fim: 10 }, { id: "b", inicio: 20, fim: 30 }];
  assert.equal(aparar(c, "a", "fim", 25, 60)[0].fim, 20);
  assert.equal(aparar(c, "b", "inicio", 5, 60)[1].inicio, 10);
  assert.equal(aparar(c, "b", "inicio", 29.99, 60)[1].inicio, 29.9);
  assert.equal(aparar(c, "b", "fim", 99, 60)[1].fim, 60);
});

test("mover trecho troca a ordem no vídeo final", () => {
  const c: Trecho[] = [{ id: "a", inicio: 0, fim: 5 }, { id: "b", inicio: 5, fim: 8 }];
  assert.deepEqual(moverTrecho(c, "b", -1).map(t => t.id), ["b", "a"]);
  assert.equal(moverTrecho(c, "a", -1), c);
});

test("apagar um intervalo do meio", () => {
  const c = apagarIntervalo([{ id: "a", inicio: 0, fim: 60 }], 10, 20, id);
  assert.deepEqual(c.map(t => [t.inicio, t.fim]), [[0, 10], [20, 60]]);
  assert.equal(duracaoEditada(c), 50);
});

test("layout por trecho: a cena mais nova vale; fora dela, o layout base", () => {
  const p = projeto();
  const menor = [cam("bat"), cam("gui", 0.05, 0.05, 0.2, 0.2, 1)];
  const lado = [cam("bat", 0, 0, 0.5, 1), cam("gui", 0.5, 0, 0.5, 1)];
  p.cenas = [{ id: "c1", inicio: 10, fim: 40, camadas: menor }, { id: "c2", inicio: 20, fim: 30, camadas: lado }];
  assert.equal(camadasNoTempo(p, 5), p.camadasBase);
  assert.equal(camadasNoTempo(p, 15), menor);
  assert.equal(camadasNoTempo(p, 25), lado);
  assert.equal(camadasNoTempo(p, 40), p.camadasBase, "o fim do intervalo já é fora");
});

test("destaque do solo: sobe a guitarra, abaixa a bateria e volta ao fim com rampa", () => {
  const p = projeto();
  p.destaques = [{ id: "d", inicio: 20, fim: 30, camera: "gui", ganhoDb: 6, abaixarDb: 6 }];
  p.rampa = 1;
  const antes = ganhosNoTempo(p, 10), meio = ganhosNoTempo(p, 25), rampa = ganhosNoTempo(p, 20.5), depois = ganhosNoTempo(p, 31);
  assert.equal(antes.gui, 1); assert.equal(antes.bat, 1);
  assert.ok(Math.abs(meio.gui - dbParaLinear(6)) < 1e-9);
  assert.ok(Math.abs(meio.bat - dbParaLinear(-6)) < 1e-9);
  assert.ok(rampa.gui > 1 && rampa.gui < meio.gui, "meia rampa");
  assert.equal(depois.gui, 1); assert.equal(depois.bat, 1);
  assert.equal(destaqueNoTempo(p.destaques, 25)?.camera, "gui");
  assert.equal(destaqueNoTempo(p.destaques, 35), null);
});

test("mudo e áudio externo substituindo zeram as câmeras", () => {
  const p = projeto();
  p.canais.bat = { ganhoDb: -3, mudo: true, pan: 0 };
  assert.equal(ganhosNoTempo(p, 0).bat, 0);
  p.externo = { faixaId: "x", nome: "mesa.wav", deslocamento: 2, ganhoDb: 0, substituir: true };
  assert.deepEqual(ganhosNoTempo(p, 0), { bat: 0, gui: 0 });
});

test("peso do intervalo com rampa", () => {
  assert.equal(pesoNoIntervalo(0, 10, -1, 1), 0);
  assert.equal(pesoNoIntervalo(0, 10, 0.5, 1), 0.5);
  assert.equal(pesoNoIntervalo(0, 10, 5, 1), 1);
  assert.equal(pesoNoIntervalo(0, 10, 9.75, 1), 0.25);
  assert.equal(pesoNoIntervalo(0, 10, 5, 0), 1);
});

test("transição escurecer no corte e entrada do primeiro trecho", () => {
  const c: Trecho[] = [{ id: "a", inicio: 0, fim: 10 }, { id: "b", inicio: 20, fim: 30 }];
  const tr = { b: { tipo: "escurecer" as const, duracao: 1 }, a: { tipo: "clarear" as const, duracao: 2 } };
  assert.equal(transicaoNoTempo(c, tr, 10).alfa, 1);
  assert.equal(transicaoNoTempo(c, tr, 10.25).alfa, 0.5);
  assert.equal(transicaoNoTempo(c, tr, 9.5).cor, "#000000");
  assert.equal(transicaoNoTempo(c, tr, 5).alfa, 0);
  assert.deepEqual(transicaoNoTempo(c, tr, 0), { cor: "#ffffff", alfa: 1 });
  assert.equal(transicaoNoTempo(c, tr, 1).alfa, 0.5);
  assert.equal(transicaoNoTempo(c, { b: { tipo: "corte", duracao: 1 } }, 10).alfa, 0);
});

test("textos no tempo e quebra de linha", () => {
  const t = [novoTexto("a", 5, 8, "legenda", "Solo de guitarra"), novoTexto("b", 0, 3, "titulo", "Show")];
  assert.deepEqual(textosNoTempo(t, 6).map(x => x.id), ["a"]);
  assert.equal(t[0].y > 0.8, true);
  assert.deepEqual(quebrarLinhas("um dois três quatro", 9, s => s.length), ["um dois", "três", "quatro"]);
  assert.deepEqual(quebrarLinhas("a\nb", 100, s => s.length), ["a", "b"]);
});

test("legendas em SRT seguem os cortes e voltam para a gravação", () => {
  const p = projeto();
  p.cortes = [{ id: "a", inicio: 0, fim: 10 }, { id: "b", inicio: 20, fim: 60 }];
  p.textos = [novoTexto("l1", 22, 24.5, "legenda", "Primeiro verso"), novoTexto("l2", 12, 14, "legenda", "cortada"), novoTexto("t", 1, 2, "titulo", "Título")];
  const srt = paraSrt(p);
  assert.equal(srt, "1\n00:00:12,000 --> 00:00:14,500\nPrimeiro verso\n");
  const lidas = lerSrt(srt, p.cortes, id);
  assert.equal(lidas.length, 1);
  assert.equal(lidas[0].inicio, 22);
  assert.ok(Math.abs(lidas[0].fim - 24.499) < 0.01);
  assert.equal(lidas[0].texto, "Primeiro verso");
});

test("intervalo ordena, limita e garante tamanho mínimo", () => {
  assert.deepEqual(intervalo(30, 10, 60), { inicio: 10, fim: 30 });
  assert.deepEqual(intervalo(-5, 70, 60), { inicio: 0, fim: 60 });
  assert.deepEqual(intervalo(5, 5, 60), { inicio: 5, fim: 7 });
});

test("ler projeto guardado completa o que falta", () => {
  const base = projeto();
  assert.equal(lerProjeto(null, base), base);
  const lido = lerProjeto({ versao: 1, cortes: [{ id: "a", inicio: 5, fim: 15 }], destaques: [{ id: "d", inicio: 0, fim: 1, camera: "sumiu", ganhoDb: 3, abaixarDb: 3 }] }, base);
  assert.deepEqual(lido.cortes, [{ id: "a", inicio: 5, fim: 15 }]);
  assert.equal(lido.destaques.length, 0, "destaque de câmera que não existe sai");
  assert.equal(lido.melhoria.ganhoDb, 0);
  assert.equal(lido.cameras, base.cameras);
});

test("relógio do editor", () => {
  assert.equal(relogioEdicao(75.34), "1:15,3");
  assert.equal(relogioEdicao(3.25), "0:03,3");
  assert.equal(relogioEdicao(0), "0:00,0");
});

test("correlação acha o atraso de um sinal deslocado", () => {
  const ref = new Float32Array(64);
  ref[5] = 1; ref[20] = 0.5; ref[40] = 0.8;
  const ext = new Float32Array(80);
  ext[12] = 1; ext[27] = 0.5; ext[47] = 0.8; // 7 depois
  assert.equal(melhorAtraso(ref, ext).atraso, 7);
  const c = correlacao(new Float32Array([1, 2]), new Float32Array([1, 2]));
  assert.deepEqual([...c].map(v => Math.round(v)), [2, 5, 2]);
});

/** Bateria de mentira: ataques em horas aleatórias, com decaimento. */
function batidas(taxa: number, segundos: number, horas: number[], ruido = 0): Float32Array {
  const a = new Float32Array(Math.round(taxa * segundos));
  let s = 7;
  const aleatorio = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5; };
  for (const h of horas) {
    const i0 = Math.round(h * taxa);
    for (let k = 0; k < taxa * 0.12 && i0 + k < a.length; k++) a[i0 + k] += Math.exp(-k / (taxa * 0.02)) * Math.sin(k * 0.3);
  }
  if (ruido) for (let i = 0; i < a.length; i++) a[i] += aleatorio() * ruido;
  return a;
}

test("sincroniza o áudio da mesa com o da câmera (com ms de precisão)", () => {
  const horas: number[] = [];
  let s = 3;
  for (let t = 0.5; t < 40; t += 0.25 + ((s = (s * 48271) % 2147483647) / 2147483647) * 0.4) horas.push(t);
  // A câmera gravou de 2,000 s a 32 s da música; a mesa gravou tudo (em outra taxa e com ruído).
  const camera = batidas(8000, 30, horas.filter(h => h >= 2 && h < 32).map(h => h - 2), 0.05);
  const mesa = batidas(11025, 40, horas, 0.02);
  const r = sincronizarAudio(camera, 8000, mesa, 11025);
  assert.ok(Math.abs(r.deslocamento - 2) <= 0.004, `deslocamento ${r.deslocamento}`);
  assert.ok(r.confianca > 0.5, `confiança ${r.confianca}`);
});

test("sincroniza quando o áudio externo começou depois da câmera", () => {
  const horas: number[] = [];
  let s = 11;
  for (let t = 0.3; t < 30; t += 0.2 + ((s = (s * 48271) % 2147483647) / 2147483647) * 0.5) horas.push(t);
  const camera = batidas(8000, 30, horas);
  const mesa = batidas(8000, 25, horas.filter(h => h >= 1.5).map(h => h - 1.5));
  const r = sincronizarAudio(camera, 8000, mesa, 8000);
  assert.ok(Math.abs(r.deslocamento + 1.5) <= 0.004, `deslocamento ${r.deslocamento}`);
});

test("envelope, mono e picos", () => {
  const e = envelopeDeAtaques(batidas(1000, 2, [0.5, 1.5]), 1000, 100);
  assert.equal(e.length, 200);
  assert.ok(e[50] > 3 && e[150] > 3, "os ataques se destacam");
  assert.deepEqual([...mono([new Float32Array([1, 0]), new Float32Array([0, 1])])], [0.5, 0.5]);
  assert.deepEqual(picos(new Float32Array([0, 0.5, 0, 0, -1, 0, 0, 0]), 2), [0, 1]);
});

test("intervalo da gravação visto no vídeo editado", () => {
  const c: Trecho[] = [{ id: "b", inicio: 20, fim: 30 }, { id: "a", inicio: 0, fim: 10 }];
  assert.deepEqual(pedacosEditados(c, 5, 25), [{ inicio: 0, fim: 5 }, { inicio: 15, fim: 20 }]);
  assert.deepEqual(pedacosEditados(c, 12, 18), []);
});
