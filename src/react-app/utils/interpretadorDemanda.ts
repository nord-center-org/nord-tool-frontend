/**
 * Interpretador do chat de demandas do cronograma, sem IA: lê o que a pessoa escreve em português e monta as
 * demandas (título, categoria, dias da semana, data e horário, período, prazo, tag). Roda no aparelho, na hora.
 * Puro, testável em node.
 */
import type { Categoria, RascunhoDemanda, Status } from "../services/CronogramaSemanalService";

export interface Interpretacao { mensagem: string; demandas: RascunhoDemanda[] }

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------- datas

const DIAS: { re: string; id: number; js: number; nome: string }[] = [
  { re: "segunda(?:-feira| feira)?s?|seg", id: 1, js: 1, nome: "segunda" },
  { re: "terca(?:-feira| feira)?s?|ter", id: 2, js: 2, nome: "terça" },
  { re: "quarta(?:-feira| feira)?s?|qua", id: 3, js: 3, nome: "quarta" },
  { re: "quinta(?:-feira| feira)?s?|qui", id: 4, js: 4, nome: "quinta" },
  { re: "sexta(?:-feira| feira)?s?|sex", id: 5, js: 5, nome: "sexta" },
  { re: "sabados?|sab", id: 7, js: 6, nome: "sábado" },
  { re: "domingos?|dom", id: 0, js: 0, nome: "domingo" },
];
const RE_DIA = DIAS.map(d => d.re).join("|");
const diaDe = (palavra: string) => DIAS.find(d => new RegExp(`^(?:${d.re})$`).test(palavra));

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
const somarDias = (s: string, n: number) => { const d = deIso(s); d.setDate(d.getDate() + n); return iso(d); };

/** Próximo dia da semana (JS: 0 = domingo) a partir de hoje; "que vem/próxima" pula para a semana seguinte se for hoje. */
function proximoDia(hoje: string, js: number, quevem: boolean) {
  const d = deIso(hoje);
  let n = (js - d.getDay() + 7) % 7;
  if (n === 0 && quevem) n = 7;
  return somarDias(hoje, n);
}

/** Dia do mês: este mês, ou o próximo se já passou. */
function diaDoMes(hoje: string, dia: number, mes?: number, ano?: number) {
  const h = deIso(hoje);
  let a = ano ?? h.getFullYear();
  if (a < 100) a += 2000;
  let m = mes ?? h.getMonth() + 1;
  let d = new Date(a, m - 1, dia);
  if (mes === undefined && d < h) { m += 1; d = new Date(a, m - 1, dia); }
  else if (mes !== undefined && ano === undefined && d < h) d = new Date(a + 1, m - 1, dia);
  return d.getDate() === dia ? iso(d) : null;
}

interface Achado { valor: string; inicio: number; fim: number }

/** Acha uma data num trecho (já sem acento e minúsculo). */
function acharData(t: string, hoje: string): Achado | null {
  const testes: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/\bdepois de amanha\b/, () => somarDias(hoje, 2)],
    [/\bamanha\b/, () => somarDias(hoje, 1)],
    [/\bhoje\b/, () => hoje],
    [/\b(?:daqui a|em) (\d{1,2}) dias?\b/, m => somarDias(hoje, Number(m[1]))],
    [/\b(?:semana que vem|proxima semana)\b/, () => proximoDia(hoje, 1, true)],
    [/\b(?:dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => diaDoMes(hoje, Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined)],
    [new RegExp(`\\b(\\d{1,2}) de (${MESES.join("|")})\\b`), m => diaDoMes(hoje, Number(m[1]), MESES.indexOf(m[2]) + 1)],
    [/\bdia (\d{1,2})\b(?!\/)/, m => diaDoMes(hoje, Number(m[1]))],
    [new RegExp(`\\b(?:na |no |nesta |neste |essa |esse |esta |este |proxima |proximo )?(${RE_DIA})\\b( que vem| proxima| proximo)?`), m => {
      const d = diaDe(m[1]);
      if (!d) return null;
      return proximoDia(hoje, d.js, !!m[2] || /proxim/.test(m[0]));
    }],
  ];
  let melhor: Achado | null = null;
  for (const [re, f] of testes) {
    const m = re.exec(t);
    if (!m) continue;
    const v = f(m);
    if (v && (!melhor || m.index < melhor.inicio)) melhor = { valor: v, inicio: m.index, fim: m.index + m[0].length };
  }
  return melhor;
}

/** Horário: "9h", "9h30", "09:30", "às 14", "9 horas", "meio-dia". */
function acharHora(t: string): Achado | null {
  const testes: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/\bmeio[- ]dia(?: e meia)?\b/, m => (m[0].includes("meia") ? "12:30" : "12:00")],
    [/\b(\d{1,2})[:h](\d{2})\b/, m => hora(Number(m[1]), Number(m[2]))],
    [/\b(\d{1,2}) ?(?:h|hs|horas?)\b(?: e (\d{1,2})(?: min(?:utos)?)?)?/, m => hora(Number(m[1]), m[2] ? Number(m[2]) : 0)],
    [/\bas (\d{1,2})(?: e meia)?\b(?!\/)/, m => hora(Number(m[1]), m[0].includes("meia") ? 30 : 0)],
  ];
  for (const [re, f] of testes) {
    const m = re.exec(t);
    if (!m) continue;
    let v = f(m);
    if (!v) continue;
    // "às 2 da tarde", "7 da noite"
    const depois = t.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (/^ da (tarde|noite)/.test(depois)) { const h = Number(v.slice(0, 2)); if (h < 12) v = `${String(h + 12).padStart(2, "0")}${v.slice(2)}`; }
    const fim = m.index + m[0].length + (/^ da (tarde|noite|manha)/.exec(depois)?.[0].length ?? 0);
    return { valor: v, inicio: m.index, fim };
  }
  return null;
}
const hora = (h: number, m: number) => (h >= 0 && h <= 23 && m >= 0 && m <= 59 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null);

/** Dias da semana de uma atividade que se repete; null se não é repetição. */
function acharRepeticao(t: string): (Achado & { dias: number[]; domingo: boolean }) | null {
  const marca = /\b(todo dia|todos os dias|diariamente|dias? ute(?:is|l)|toda semana|semanalmente|tod[ao]s? (?:as |os )?|sempre (?:as |aos |na |no )?|de (?:segunda|seg) a (?:sexta|sex|sabado|sab)|(?:as|aos) (?:segundas|tercas|quartas|quintas|sextas|sabados|domingos))/;
  const m = marca.exec(t);
  if (!m) return null;
  const ini = m.index;
  if (/todo dia|todos os dias|diariamente/.test(m[0])) return { valor: "", dias: [1, 2, 3, 4, 5, 7], domingo: false, inicio: ini, fim: ini + m[0].length };
  if (/dias? ute/.test(m[0])) return { valor: "", dias: [1, 2, 3, 4, 5], domingo: false, inicio: ini, fim: ini + m[0].length };
  const faixa = /de (segunda|seg) a (sexta|sex|sabado|sab)/.exec(t.slice(ini));
  if (faixa && faixa.index === 0) return { valor: "", dias: /sab/.test(faixa[2]) ? [1, 2, 3, 4, 5, 7] : [1, 2, 3, 4, 5], domingo: false, inicio: ini, fim: ini + faixa[0].length };
  // lista de dias logo depois da marca: "toda segunda, quarta e sexta"
  const resto = t.slice(ini);
  const lista = new RegExp(`^(?:[a-z ]*?)((?:(?:${RE_DIA})(?:\\s*,\\s*|\\s+e\\s+|\\s*/\\s*)?)+)`).exec(resto);
  if (!lista) return /toda semana|semanalmente/.test(m[0]) ? null : null;
  const palavras = lista[1].split(/\s*,\s*|\s+e\s+|\s*\/\s*|\s+/).filter(Boolean);
  const dias: number[] = [];
  let domingo = false;
  for (const p of palavras) { const d = diaDe(p); if (d) { if (d.id === 0) domingo = true; else dias.push(d.id); } }
  if (!dias.length && !domingo) return null;
  return { valor: "", dias: [...new Set(dias)].sort((a, b) => a - b), domingo, inicio: ini, fim: ini + lista[0].length };
}

// ---------------------------------------------------------------- categoria, status, tag

const PALAVRAS: [Categoria, RegExp][] = [
  ["Programação", /\b(codigo|programar|programacao|deploy|bug|sistema|app|aplicativo|site|api|banco de dados|commit|pull request|pr|front ?end|back ?end|nordtool|github)\b/],
  ["Acadêmica", /\b(aula|prova|estudar|estudo|faculdade|tcc|trabalho da faculdade|seminario|curso|matricula|professor|disciplina|artigo|pos|mestrado)\b/],
  ["Atlética", /\b(treino|treinar|academia|corrida|correr|futebol|musculacao|bike|pedal|natacao|crossfit|jiu|luta|caminhada)\b/],
  ["Musical", /\b(ensaio|ensaiar|musica|baixo|violao|guitarra|bateria|teclado|banda|show|repertorio|cifra|tocar)\b/],
  ["Devocional", /\b(oracao|orar|culto|igreja|biblia|devocional|celula|jejum|missa|louvor|ministerio)\b/],
  ["Engenharia", /\b(obra|medicao|concreto|concretagem|vistoria|fornecedor|projeto|cliente|relatorio|apartamento|entrega|engenh\w*|bloco|laje|fvs|rte|diario|empreiteir\w*|material|orcamento|cronograma|pavimento|torre)\b/],
];
const CATEGORIA_PADRAO: Categoria = "Engenharia";
const NOMES_CATEGORIA: [Categoria, RegExp][] = [
  ["Pessoal", /\bpessoal\b/], ["Acadêmica", /\bacademic[ao]\b/], ["Atlética", /\batletic[ao]\b/], ["Musical", /\bmusical\b/],
  ["Devocional", /\bdevocional\b/], ["Engenharia", /\bengenharia\b/], ["Programação", /\bprogramacao\b/],
];

function acharCategoria(t: string): { categoria: Categoria; explicita: boolean } {
  const explicita = /\bcategoria:? ?(\w+)/.exec(t)?.[1];
  if (explicita) { const c = NOMES_CATEGORIA.find(([, re]) => re.test(explicita)); if (c) return { categoria: c[0], explicita: true }; }
  for (const [c, re] of PALAVRAS) if (re.test(t)) return { categoria: c, explicita: false };
  if (/\b(medico|dentista|mercado|banco|pagar|conta|aniversario|familia|casa|carro|consulta|cabelo|viagem)\b/.test(t)) return { categoria: "Pessoal", explicita: false };
  return { categoria: CATEGORIA_PADRAO, explicita: false };
}

function acharStatus(t: string): Status {
  if (/\b(aguardar|aguardando|esperar|esperando|depende de)\b/.test(t)) return "aguardar";
  if (/\b(acompanhar|acompanhando|monitorar|ficar de olho)\b/.test(t)) return "acompanhar";
  if (/\b(urgente|agora|ja ja|executar)\b/.test(t)) return "executar";
  return "pendentes";
}

// ---------------------------------------------------------------- título

/** Tira do texto os pedaços usados (datas, horas, prazo…), conectivos soltos e pontuação nas pontas. */
function limparTitulo(original: string, cortes: { inicio: number; fim: number }[]) {
  const ordem = [...cortes].sort((a, b) => b.inicio - a.inicio);
  let s = original;
  for (const c of ordem) s = `${s.slice(0, c.inicio)} ${s.slice(c.fim)}`;
  s = s.replace(/#\S+/g, " ").replace(/\bcategoria:? ?\S+/i, " ").replace(/\((?:[^)]*)\)/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // conectivos que ficaram sobrando no fim ou no meio ("na", "às", "dia", "toda", ",")
  // minúsculas de propósito: "bloco A" não perde o "A"
  const conectivo = /(?:^|\s)(na|no|nas|nos|as|às|a|à|em|de|do|da|dia|dias|toda|todas|todo|todos|sempre|prazo|ate|até|para|pra|,|e|-)$/;
  for (let i = 0; i < 6; i++) s = s.replace(conectivo, "").trim();
  s = s.replace(/^(?:eu )?(?:preciso |tenho que |quero |lembrar de |lembrete:? |agendar |marcar |programar )/i, "").trim();
  s = s.replace(/\s+(,|\.)/g, "$1").replace(/[,.;:\s-]+$/, "").replace(/^[,.;:\s-]+/, "");
  return s ? s[0].toUpperCase() + s.slice(1, 120) : "";
}

// ---------------------------------------------------------------- uma demanda

interface Parcial {
  titulo: string;
  observacao: string | null;
  categoria: Categoria;
  categoriaExplicita: boolean;
  status: Status;
  tag: string | null;
  prazo: string | null;
  dias: number[];
  domingo: boolean;
  horario: string | null;
  data: string | null;
  dataFim: string | null;
  horaInventada: boolean;
}

/** Lê um pedido (uma demanda). As posições valem para `t` (sem acento), que tem o mesmo tamanho do original. */
function lerPedido(original: string, hoje: string): Parcial {
  const t = sem(original);
  const cortes: { inicio: number; fim: number }[] = [];
  // prazo: "prazo dia 6", "prazo até sexta", "até dia 10", "entregar até 06/11"
  let prazo: string | null = null;
  const mPrazo = /\b(?:com prazo|prazo|ate|vence|vencimento|entrega ate)\b:?\s*(?:para |pra |de |ate |o |a |no |na )?/.exec(t);
  if (mPrazo) {
    const resto = t.slice(mPrazo.index + mPrazo[0].length);
    const d = acharData(resto, hoje);
    if (d && d.inicio <= 3) { prazo = d.valor; cortes.push({ inicio: mPrazo.index, fim: mPrazo.index + mPrazo[0].length + d.fim }); }
  }
  const semPrazo = (s: string) => { let x = s; for (const c of cortes) x = x.slice(0, c.inicio) + " ".repeat(c.fim - c.inicio) + x.slice(c.fim); return x; };
  // período: "de 10 a 15/11", "de segunda a quarta" (pontual), "do dia 3 ao dia 7"
  let data: string | null = null, dataFim: string | null = null;
  const rep = acharRepeticao(semPrazo(t));
  if (!rep) {
    const mPer = /\b(?:de|do dia|do) (\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?|[a-z-]+) (?:a|ao dia|ate|ao) (\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?(?: de [a-z]+)?|[a-z-]+(?: que vem)?)\b/.exec(semPrazo(t));
    if (mPer) {
      const fim = acharData(mPer[2].match(/^\d+$/) ? `dia ${mPer[2]}` : mPer[2], hoje);
      let ini = acharData(mPer[1].match(/^\d+$/) ? `dia ${mPer[1]}` : mPer[1], hoje);
      // "de 10 a 15/11": o início herda o mês do fim
      if (fim && /^\d+$/.test(mPer[1]) && /\//.test(mPer[2])) ini = { ...fim, valor: `${fim.valor.slice(0, 8)}${mPer[1].padStart(2, "0")}` };
      if (ini && fim && fim.valor > ini.valor) { data = ini.valor; dataFim = fim.valor; cortes.push({ inicio: mPer.index, fim: mPer.index + mPer[0].length }); }
    }
  }
  let dias: number[] = [], domingo = false;
  if (rep) { dias = rep.dias; domingo = rep.domingo; cortes.push({ inicio: rep.inicio, fim: rep.fim }); }
  const h = acharHora(semPrazo(t));
  if (h) cortes.push({ inicio: h.inicio, fim: h.fim });
  if (!rep && !data) {
    const d = acharData(semPrazo(t), hoje);
    if (d) {
      // "domingo" não existe no cronograma
      if (/\bdomingo/.test(t.slice(d.inicio, d.fim))) domingo = true;
      data = d.valor;
      cortes.push({ inicio: d.inicio, fim: d.fim });
    }
  }
  // detalhes entre parênteses viram observação
  const obs = [...original.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim()).filter(Boolean);
  const mTag = /#([\p{L}\p{N}_-]+)/u.exec(original) ?? /\btag:? ?([\p{L}\p{N}_-]+)/iu.exec(original);
  const tag = mTag?.[1] ?? null;
  if (mTag) cortes.push({ inicio: mTag.index, fim: mTag.index + mTag[0].length });
  const { categoria, explicita } = acharCategoria(t);
  const titulo = limparTitulo(original, cortes);
  return {
    titulo, observacao: obs.length ? obs.join("; ") : null, categoria, categoriaExplicita: explicita, status: acharStatus(t), tag,
    prazo, dias, domingo, horario: h?.valor ?? null, data, dataFim, horaInventada: false,
  };
}

function paraRascunho(p: Parcial): RascunhoDemanda {
  const fixa = p.dias.length > 0;
  let agendamento: string | null = null;
  if (!fixa && p.data) {
    agendamento = `${p.data}T${p.horario ?? "09:00"}`;
    p.horaInventada = !p.horario;
  }
  return {
    nmCronogramaSemanal: p.titulo,
    txObservacao: p.observacao,
    nmCategoria: p.categoria,
    nmStatusCronograma: p.status,
    nmTag: p.tag,
    dtPrazo: p.prazo,
    flFixo: fixa,
    diasSemana: fixa ? p.dias : [],
    nmHorario: fixa ? p.horario : null,
    dtAgendamento: agendamento,
    dtFimAgendamento: !fixa && p.data ? p.dataFim : null,
  };
}

// ---------------------------------------------------------------- pedido inteiro (e ajustes)

/** Divide em pedidos: uma demanda por linha, por ";" ou por item de lista. */
export function dividirPedidos(texto: string): string[] {
  return texto.split(/\n|;|\s+\d+[).]\s+|^\s*[-•*]\s+/m)
    .map(s => s.replace(/^\s*(?:[-•*]|\d+[).])\s*/, "").trim())
    .filter(s => s.length > 1);
}

const RE_AJUSTE = /^(?:muda|mude|mudar|troca|troque|trocar|altera|altere|alterar|coloca|coloque|poe|ponha|passa|passe|na verdade|corrige|corrija|e?\s*(?:o\s+)?prazo|e?\s*(?:a\s+)?categoria|agora|melhor|faz|faca)\b/;

/**
 * Lê a mensagem. Se for um ajuste ("muda para quinta", "às 10h", "categoria pessoal") e houver demandas antes,
 * devolve as anteriores ajustadas; senão, monta uma demanda por pedido.
 */
export function interpretarDemanda(texto: string, hoje: string, anteriores: RascunhoDemanda[] = []): Interpretacao {
  const limpo = texto.trim();
  if (!limpo) return { mensagem: "Escreva o que quer programar.", demandas: [] };
  const t = sem(limpo);
  const pedidos = dividirPedidos(limpo);
  // ajuste: começa com "muda/troca/coloca…" ou só traz quando/prazo/categoria, sem o que fazer
  const p = lerPedido(limpo, hoje);
  const soQuando = !p.titulo || /^(?:as|a partir das|para as|pra|para)\b/.test(t);
  const ajuste = anteriores.length > 0 && pedidos.length === 1 && (RE_AJUSTE.test(t) || soQuando);
  if (ajuste) {
    const novoTitulo = /\b(?:titulo|chama de|nome)\b:? ?(.+)$/i.exec(limpo)?.[1]?.trim();
    const mudou: string[] = [];
    // com várias na tela, o ajuste vale para a última, a não ser que diga "todas", "as duas", "ambas"
    const todas = anteriores.length === 1 || /\b(todas|todos|as duas|os dois|ambas|ambos|as \d+)\b/.test(t);
    const alvo = (i: number) => todas || i === anteriores.length - 1;
    const demandas = anteriores.map((a, i) => {
      if (!alvo(i)) return a;
      const r = { ...a };
      if (p.dias.length) { r.flFixo = true; r.diasSemana = p.dias; r.dtAgendamento = null; r.dtFimAgendamento = null; if (!mudou.includes("dias")) mudou.push("dias"); }
      else if (p.data) { r.flFixo = false; r.diasSemana = []; r.nmHorario = null; r.dtAgendamento = `${p.data}T${p.horario ?? a.dtAgendamento?.slice(11, 16) ?? "09:00"}`; r.dtFimAgendamento = p.dataFim; if (!mudou.includes("data")) mudou.push("data"); }
      if (p.horario) {
        if (r.flFixo) r.nmHorario = p.horario;
        else if (r.dtAgendamento) r.dtAgendamento = `${r.dtAgendamento.slice(0, 10)}T${p.horario}`;
        if (!mudou.includes("horário")) mudou.push("horário");
      }
      if (p.prazo) { r.dtPrazo = p.prazo; if (!mudou.includes("prazo")) mudou.push("prazo"); }
      if (p.categoriaExplicita || /\bcategoria\b/.test(t)) { r.nmCategoria = p.categoria; if (!mudou.includes("categoria")) mudou.push("categoria"); }
      if (p.tag) { r.nmTag = p.tag; if (!mudou.includes("tag")) mudou.push("tag"); }
      if (/\b(aguardar|acompanhar|urgente|executar)\b/.test(t)) { r.nmStatusCronograma = p.status; if (!mudou.includes("fila")) mudou.push("fila"); }
      if (novoTitulo) { r.nmCronogramaSemanal = novoTitulo[0].toUpperCase() + novoTitulo.slice(1, 120); if (!mudou.includes("título")) mudou.push("título"); }
      return r;
    });
    if (mudou.length) {
      const qual = todas ? (anteriores.length > 1 ? " de todas" : "") : ` de "${anteriores[anteriores.length - 1].nmCronogramaSemanal}" (para mudar todas, diga "todas")`;
      return { mensagem: `Pronto, ajustei ${juntar(mudou)}${qual}.`, demandas: todas ? demandas : [demandas[demandas.length - 1]] };
    }
    // não era ajuste de verdade: segue como pedido novo
  }
  const avisos: string[] = [];
  const demandas: RascunhoDemanda[] = [];
  for (const pedido of pedidos) {
    const p = lerPedido(pedido, hoje);
    if (!p.titulo) continue;
    if (p.domingo) avisos.push("domingo não existe no cronograma, então deixei de fora");
    if (p.domingo && !p.dias.length && p.data) p.data = null;
    const r = paraRascunho(p);
    if (p.horaInventada) avisos.push(`coloquei 9h em "${r.nmCronogramaSemanal}" porque não vi horário`);
    demandas.push(r);
  }
  if (!demandas.length) return { mensagem: "Não achei o que programar. Escreva o que é e, se quiser, quando (ex.: \"Vistoria do bloco B sexta às 10h\").", demandas: [] };
  const n = demandas.length;
  const base = n === 1 ? "Montei a demanda abaixo." : `Montei ${n} demandas.`;
  const dica = " Confira e toque em Criar, ou em Revisar para ajustar; se quiser mudar algo, escreva aqui (ex.: \"muda para quinta às 10h\").";
  return { mensagem: `${base}${avisos.length ? ` Obs.: ${juntar([...new Set(avisos)])}.` : ""}${dica}`, demandas };
}

const juntar = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`);
