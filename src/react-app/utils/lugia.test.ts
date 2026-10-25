import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparModelos, criarLeitorSse, modeloInicial, textoDaMensagem, urlLugia, validarArquivo, type ModeloIa } from "./lugia.ts";

test("urlLugia: base relativa usa a origem; absoluta fica como está", () => {
  assert.equal(urlLugia("/api/v1/lugia", "/chat", "http://localhost:5173"), "http://localhost:5173/api/v1/lugia/chat");
  assert.equal(urlLugia("https://lugia.nord.app/api/v1/lugia", "modelos", "http://x"), "https://lugia.nord.app/api/v1/lugia/modelos");
});

test("leitor SSE junta pedaços quebrados no meio do evento", () => {
  const ler = criarLeitorSse();
  assert.deepEqual(ler('event: conversa\ndata: {"id":1}\n\nevent: tex'), [{ evento: "conversa", dados: '{"id":1}' }]);
  assert.deepEqual(ler('to\ndata: {"delta":"Oi"}\n'), []);
  assert.deepEqual(ler("\nevent: fim\r\ndata: {}\r\n\r\n"), [
    { evento: "texto", dados: '{"delta":"Oi"}' },
    { evento: "fim", dados: "{}" },
  ]);
});

test("leitor SSE ignora comentários e junta várias linhas data", () => {
  const ler = criarLeitorSse();
  assert.deepEqual(ler(": ping\n\ndata: a\ndata: b\n\n"), [{ evento: "message", dados: "a\nb" }]);
});

test("validarArquivo: tipo, tamanho e quantidade", () => {
  assert.equal(validarArquivo({ name: "a.png", type: "image/png", size: 1000 }, 0), null);
  assert.equal(validarArquivo({ name: "t.pdf", type: "application/pdf", size: 1000 }, 4), null);
  assert.match(validarArquivo({ name: "a.png", type: "image/png", size: 1000 }, 5) ?? "", /máximo 5/);
  assert.match(validarArquivo({ name: "a.exe", type: "application/x-msdownload", size: 1 }, 0) ?? "", /a\.exe/);
  assert.match(validarArquivo({ name: "g.png", type: "image/png", size: 11 * 1024 * 1024 }, 0) ?? "", /10 MB/);
});

test("textoDaMensagem ignora anexos", () => {
  assert.equal(textoDaMensagem({ papel: "usuario", partes: [{ tipo: "pdf", nome: "x.pdf" }, { tipo: "texto", texto: "Resuma" }] }), "Resuma");
});

const modelos: ModeloIa[] = [
  { provedor: "claude", id: "claude-opus-5-5", nome: "Claude · claude-opus-5-5" },
  { provedor: "gemini", id: "gemini-flash-latest", nome: "Gemini · gemini-flash-latest" },
  { provedor: "claude", id: "claude-sonnet-5-5", nome: "Claude · claude-sonnet-5-5" },
];

test("agruparModelos mantém a ordem dos provedores", () => {
  const grupos = agruparModelos(modelos);
  assert.deepEqual(grupos.map(g => g.provedor), ["claude", "gemini"]);
  assert.equal(grupos[0].modelos.length, 2);
});

test("modeloInicial usa o preferido só se ainda existir", () => {
  assert.equal(modeloInicial(modelos, "gemini-flash-latest"), "gemini-flash-latest");
  assert.equal(modeloInicial(modelos, "removido"), "claude-opus-5-5");
  assert.equal(modeloInicial([], null), null);
});
