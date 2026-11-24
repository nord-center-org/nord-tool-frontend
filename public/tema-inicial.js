// Aplica o tema antes de desenhar a página (arquivo próprio: a CSP do app não deixa rodar script embutido no HTML).
// Aplica o tema antes de desenhar a página (sem piscar branco no tema escuro). Mesma regra de utils/tema.ts.
try {
  var p = JSON.parse(localStorage.getItem("@NordTool:tema") || "{}");
  var caminho = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, "") : location.pathname;
  var t = (p.telas && p.telas[caminho]) || p.geral || "claro";
  if (t === "sistema") t = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  if (t === "escuro") { document.documentElement.classList.add("nt-escuro"); document.documentElement.style.colorScheme = "dark"; }
  // Menos movimento: "sempre" liga as animações mesmo com o aparelho pedindo menos; "desligadas" desliga.
  var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (p.animacoes === "desligadas" || (p.animacoes !== "sempre" && reduz)) document.documentElement.classList.add("nt-menos-movimento");
} catch (e) {}
