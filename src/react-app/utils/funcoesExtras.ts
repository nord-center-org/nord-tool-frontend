/**
 * Bloco de notas v5: funções do Google Sheets que o motor da planilha não tem. Recebem os argumentos já calculados
 * (intervalo = matriz de linhas) e devolvem o valor, uma matriz (que se espalha pelas células) ou lançam o erro.
 * Os nomes são os do motor (inglês); na célula ficam em português (PROCX, UNIRTEXTO…).
 */

export type Valor = string | number | boolean | null | undefined;
export type Matriz = Valor[][];
type Arg = Valor | Matriz;

/** Erros do motor (o editor mostra #N/D, #VALOR! etc.). */
export const ERRO = { na: "N/A", valor: "VALUE", ref: "REF", div0: "DIV/0" } as const;
const falha = (codigo: string): never => { throw new Error(codigo); };

const ehMatriz = (a: Arg): a is Matriz => Array.isArray(a);
const matriz = (a: Arg): Matriz => (ehMatriz(a) ? a : [[a]]);
const plano = (a: Arg): Valor[] => matriz(a).flat();
const vazio = (v: Valor) => v === null || v === undefined || v === "";
const numero = (v: Valor): number | null => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const logico = (v: Arg, padrao: boolean): boolean => {
  if (ehMatriz(v)) return logico(v[0]?.[0], padrao);
  if (vazio(v)) return padrao;
  if (typeof v === "string") return !["false", "falso", "0"].includes(v.toLowerCase());
  return Boolean(v);
};
const texto = (v: Valor) => (v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "VERDADEIRO" : "FALSO") : String(v));
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Igualdade como no Sheets: número com número, texto sem diferenciar maiúsculas. */
function iguais(a: Valor, b: Valor): boolean {
  const na = numero(a), nb = numero(b);
  if (na !== null && nb !== null && typeof a !== "string" && typeof b !== "string") return na === nb;
  return sem(texto(a)) === sem(texto(b));
}

/** "*" e "?" do critério viram expressão regular ("~*" é o asterisco de verdade). */
function curinga(padrao: string): RegExp {
  let re = "";
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === "~" && i + 1 < padrao.length) { re += padrao[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    re += c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

/** Critério do Sheets (">10", "<>x", "=texto", "ab*", 5) aplicado a um valor. */
export function atende(valor: Valor, criterio: Valor): boolean {
  if (typeof criterio !== "string") return iguais(valor, criterio);
  const m = /^(<=|>=|<>|=|<|>)?(.*)$/s.exec(criterio) as RegExpExecArray;
  const op = m[1] ?? "=";
  const alvo = m[2];
  const nAlvo = alvo.trim() !== "" && Number.isFinite(Number(alvo.replace(",", "."))) ? Number(alvo.replace(",", ".")) : null;
  const nValor = numero(valor);
  if (op === "=" || op === "<>") {
    let igual: boolean;
    if (nAlvo !== null && nValor !== null) igual = nAlvo === nValor;
    else if (alvo === "") igual = vazio(valor);
    else if (/[*?]/.test(alvo)) igual = curinga(sem(alvo)).test(sem(texto(valor)));
    else igual = sem(texto(valor)) === sem(alvo);
    return op === "=" ? igual : !igual;
  }
  if (nAlvo !== null) {
    if (nValor === null || vazio(valor)) return false;
    return op === "<" ? nValor < nAlvo : op === ">" ? nValor > nAlvo : op === "<=" ? nValor <= nAlvo : nValor >= nAlvo;
  }
  const a = sem(texto(valor)), b = sem(alvo);
  if (vazio(valor)) return false;
  return op === "<" ? a < b : op === ">" ? a > b : op === "<=" ? a <= b : a >= b;
}

/** UNIRTEXTO(separador; ignorar_vazios; texto1; …). */
export function TEXTJOIN(args: Arg[]): string {
  if (args.length < 3) falha(ERRO.na);
  const separador = texto(plano(args[0])[0]);
  const ignorar = logico(args[1], true);
  const partes = args.slice(2).flatMap(plano).filter(v => !(ignorar && vazio(v))).map(texto);
  return partes.join(separador);
}

/** Valores das linhas que atendem a todos os pares (intervalo_critério; critério) de MÁXIMOSES/MÍNIMOSES. */
function filtrarPorCriterios(valores: Valor[], pares: Arg[]): Valor[] {
  const marcas = quemAtende(valores.length, pares);
  return valores.filter((_, i) => marcas[i]);
}

/** MÁXIMOSES(intervalo_máximo; intervalo_critério1; critério1; …). */
export function MAXIFS(args: Arg[]): number {
  if (args.length < 3) falha(ERRO.na);
  const nums = filtrarPorCriterios(plano(args[0]), args.slice(1)).map(v => (typeof v === "number" ? v : null)).filter((v): v is number => v !== null);
  return nums.length ? Math.max(...nums) : 0;
}

/** MÍNIMOSES(intervalo_mínimo; intervalo_critério1; critério1; …). */
export function MINIFS(args: Arg[]): number {
  if (args.length < 3) falha(ERRO.na);
  const nums = filtrarPorCriterios(plano(args[0]), args.slice(1)).map(v => (typeof v === "number" ? v : null)).filter((v): v is number => v !== null);
  return nums.length ? Math.min(...nums) : 0;
}

/**
 * PROCX(chave; intervalo_busca; intervalo_resultado; [se_não_encontrado]; [tipo_corresp]; [modo_busca]).
 * tipo_corresp: 0 exato (padrão), -1 exato ou o próximo menor, 1 exato ou o próximo maior, 2 com curinga.
 * modo_busca: 1 do começo (padrão), -1 do fim. Devolve uma célula (o editor não espalha resultados por várias células).
 */
export function XLOOKUP(args: Arg[]): Valor {
  if (args.length < 3) falha(ERRO.na);
  const chave = plano(args[0])[0];
  const busca = matriz(args[1]);
  const resultado = matriz(args[2]);
  const naoAchou = args.length > 3 && !vazio(plano(args[3])[0]) ? args[3] : undefined;
  const tipo = numero(plano(args[4])[0]) ?? 0;
  const modo = numero(plano(args[5])[0]) ?? 1;
  const emColuna = busca.length > 1 || (busca[0]?.length ?? 0) === 1;
  const lista = busca.flat();
  const ordem = lista.map((_, i) => i);
  if (modo < 0) ordem.reverse();
  let achado = -1;
  if (tipo === 2) achado = ordem.find(i => atende(lista[i], typeof chave === "string" ? chave : texto(chave))) ?? -1;
  else achado = ordem.find(i => iguais(lista[i], chave)) ?? -1;
  if (achado < 0 && (tipo === 1 || tipo === -1)) {
    const nChave = numero(chave);
    let melhor: number | null = null;
    for (const i of ordem) {
      const n = numero(lista[i]);
      if (n === null || nChave === null || typeof lista[i] === "string") continue;
      const serve = tipo === -1 ? n < nChave : n > nChave;
      const melhorValor = melhor === null ? null : (numero(lista[melhor]) as number);
      if (serve && (melhorValor === null || (tipo === -1 ? n > melhorValor : n < melhorValor))) melhor = i;
    }
    achado = melhor ?? -1;
  }
  if (achado < 0) {
    if (naoAchou !== undefined) return plano(naoAchou)[0];
    return falha(ERRO.na);
  }
  const valor = emColuna ? resultado[achado]?.[0] : resultado[0]?.[achado];
  if (valor === undefined) falha(ERRO.valor);
  return valor;
}

/** Pares (intervalo; critério) → para cada posição, se atende a todos. Todos os intervalos têm o mesmo tamanho. */
function quemAtende(tamanho: number, pares: Arg[]): boolean[] {
  if (pares.length === 0 || pares.length % 2 !== 0) falha(ERRO.na);
  const marcas = Array<boolean>(tamanho).fill(true);
  for (let i = 0; i < pares.length; i += 2) {
    const intervalo = plano(pares[i]);
    if (intervalo.length !== tamanho) falha(ERRO.valor);
    const criterio = plano(pares[i + 1])[0];
    intervalo.forEach((v, k) => { if (!atende(v, criterio)) marcas[k] = false; });
  }
  return marcas;
}
const numerosMarcados = (valores: Valor[], marcas: boolean[]) =>
  valores.filter((v, i) => marcas[i] && typeof v === "number") as number[];

/** CONT.SE(intervalo; critério), sem diferenciar maiúsculas nem acentos, como no Sheets. */
export function COUNTIF(args: Arg[]): number {
  if (args.length !== 2) falha(ERRO.na);
  return quemAtende(plano(args[0]).length, args).filter(Boolean).length;
}

/** CONT.SES(intervalo1; critério1; …). */
export function COUNTIFS(args: Arg[]): number {
  return quemAtende(plano(args[0]).length, args).filter(Boolean).length;
}

/** SOMASE(intervalo; critério; [intervalo_soma]). */
export function SUMIF(args: Arg[]): number {
  if (args.length < 2 || args.length > 3) falha(ERRO.na);
  const marcas = quemAtende(plano(args[0]).length, args.slice(0, 2));
  const somar = plano(args.length === 3 ? args[2] : args[0]);
  return numerosMarcados(somar, marcas).reduce((a, b) => a + b, 0);
}

/** SOMASES(intervalo_soma; intervalo1; critério1; …). */
export function SUMIFS(args: Arg[]): number {
  const somar = plano(args[0]);
  return numerosMarcados(somar, quemAtende(somar.length, args.slice(1))).reduce((a, b) => a + b, 0);
}

/** MÉDIASE(intervalo; critério; [intervalo_média]). Sem nada para tirar a média: #DIV/0!. */
export function AVERAGEIF(args: Arg[]): number {
  if (args.length < 2 || args.length > 3) falha(ERRO.na);
  const marcas = quemAtende(plano(args[0]).length, args.slice(0, 2));
  const nums = numerosMarcados(plano(args.length === 3 ? args[2] : args[0]), marcas);
  if (!nums.length) falha(ERRO.div0);
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** MÉDIASES(intervalo_média; intervalo1; critério1; …). */
export function AVERAGEIFS(args: Arg[]): number {
  const valores = plano(args[0]);
  const nums = numerosMarcados(valores, quemAtende(valores.length, args.slice(1)));
  if (!nums.length) falha(ERRO.div0);
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const letraColuna = (n: number) => { let s = ""; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };

/** ENDEREÇO(linha; coluna; [tipo: 1 $A$1, 2 A$1, 3 $A1, 4 A1]; [estilo A1]; [página]). */
export function ADDRESS(args: Arg[]): string {
  const linha = numero(plano(args[0])[0]), coluna = numero(plano(args[1])[0]);
  const tipo = numero(plano(args[2])[0]) ?? 1;
  if (linha === null || coluna === null || linha < 1 || coluna < 1 || tipo < 1 || tipo > 4) return falha(ERRO.valor);
  const col = (tipo === 1 || tipo === 3 ? "$" : "") + letraColuna(Math.floor(coluna));
  const lin = (tipo === 1 || tipo === 2 ? "$" : "") + Math.floor(linha);
  const pagina = texto(plano(args[4])[0]);
  return `${pagina ? `${/[^A-Za-z0-9_]/.test(pagina) ? `'${pagina}'` : pagina}!` : ""}${col}${lin}`;
}

/** As funções novas, pelo nome do motor. */
export const EXTRAS: Record<string, (args: Arg[]) => Valor | Matriz> = {
  TEXTJOIN, MAXIFS, MINIFS, XLOOKUP, ADDRESS, COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF, AVERAGEIFS,
};
