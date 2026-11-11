/**
 * Bloco de notas v5: as funções da planilha com os nomes do Google Sheets em português. Chave: o nome do motor
 * (inglês); valor: [nome em português, o que faz]. O motor continua calculando pelo nome em inglês: a fórmula é
 * traduzida na hora do cálculo e a célula fica com o nome em português.
 */

export type Funcao = [pt: string, descricao: string];

export const FUNCOES: Record<string, Funcao> = {
  // Matemática
  SUM: ["SOMA", "Soma os números."], SUMIF: ["SOMASE", "Soma os valores que atendem a um critério."],
  SUMIFS: ["SOMASES", "Soma os valores que atendem a vários critérios."], SUMPRODUCT: ["SOMARPRODUTO", "Multiplica os intervalos item a item e soma os resultados."],
  SUMSQ: ["SOMAQUAD", "Soma os quadrados dos números."], PRODUCT: ["MULT", "Multiplica os números."], QUOTIENT: ["QUOCIENTE", "Parte inteira de uma divisão."],
  MOD: ["MOD", "Resto de uma divisão."], ABS: ["ABS", "Valor absoluto (sem sinal)."], INT: ["INT", "Arredonda para baixo até o inteiro."],
  TRUNC: ["TRUNCAR", "Corta as casas decimais."], ROUND: ["ARRED", "Arredonda para o número de casas pedido."],
  ROUNDUP: ["ARREDONDAR.PARA.CIMA", "Arredonda para cima."], ROUNDDOWN: ["ARREDONDAR.PARA.BAIXO", "Arredonda para baixo."],
  MROUND: ["MARRED", "Arredonda para o múltiplo mais próximo."], CEILING: ["TETO", "Arredonda para cima até um múltiplo."],
  FLOOR: ["ARREDMULTB", "Arredonda para baixo até um múltiplo."], POWER: ["POTÊNCIA", "Número elevado a uma potência."],
  SQRT: ["RAIZ", "Raiz quadrada."], SQRTPI: ["RAIZPI", "Raiz quadrada de (número × pi)."], EXP: ["EXP", "e elevado ao número."],
  LN: ["LN", "Logaritmo natural."], LOG: ["LOG", "Logaritmo na base pedida (10 se não informar)."], LOG10: ["LOG10", "Logaritmo na base 10."],
  PI: ["PI", "O número pi."], RAND: ["ALEATÓRIO", "Número aleatório entre 0 e 1."], RANDBETWEEN: ["ALEATÓRIOENTRE", "Inteiro aleatório entre dois números."],
  SIGN: ["SINAL", "1 se positivo, -1 se negativo, 0 se zero."], EVEN: ["PAR", "Arredonda para o próximo par."], ODD: ["ÍMPAR", "Arredonda para o próximo ímpar."],
  FACT: ["FATORIAL", "Fatorial do número."], FACTDOUBLE: ["FATDUPLO", "Fatorial duplo do número."], COMBIN: ["COMBIN", "Número de combinações."],
  GCD: ["MDC", "Máximo divisor comum."], LCM: ["MMC", "Mínimo múltiplo comum."], DEGREES: ["GRAUS", "Radianos para graus."],
  RADIANS: ["RADIANOS", "Graus para radianos."], SIN: ["SEN", "Seno."], COS: ["COS", "Cosseno."], TAN: ["TAN", "Tangente."], ASIN: ["ASEN", "Arco seno."],
  ACOS: ["ACOS", "Arco cosseno."], ATAN: ["ATAN", "Arco tangente."], ATAN2: ["ATAN2", "Arco tangente de x e y."], SINH: ["SENH", "Seno hiperbólico."],
  COSH: ["COSH", "Cosseno hiperbólico."], TANH: ["TANH", "Tangente hiperbólica."], ASINH: ["ASENH", "Arco seno hiperbólico."],
  ACOSH: ["ACOSH", "Arco cosseno hiperbólico."], ATANH: ["ATANH", "Arco tangente hiperbólica."], MULTINOMIAL: ["MULTINOMIAL", "Multinomial dos números."],
  SUBTOTAL: ["SUBTOTAL", "Subtotal com a função escolhida (9 = soma, 1 = média…)."], SERIESSUM: ["SOMASEQUÊNCIA", "Soma de uma série de potências."],
  GAMMALN: ["LNGAMA", "Logaritmo natural da função gama."], ISEVEN: ["ÉPAR", "VERDADEIRO se o número for par."], ISODD: ["ÉIMPAR", "VERDADEIRO se o número for ímpar."],
  COUNTUNIQUE: ["CONT.ÚNICOS", "Conta os valores sem repetir."], ROMAN: ["ROMANO", "Número em algarismos romanos."], ARABIC: ["ARÁBICO", "Algarismos romanos em número."],
  // Estatística
  AVERAGE: ["MÉDIA", "Média dos números."], AVERAGEA: ["MÉDIAA", "Média contando textos como zero."], AVERAGEIF: ["MÉDIASE", "Média dos valores que atendem a um critério."],
  AVERAGEIFS: ["MÉDIASES", "Média dos valores que atendem a vários critérios."], COUNT: ["CONT.NÚM", "Conta as células com número."],
  COUNTA: ["CONT.VALORES", "Conta as células preenchidas."], COUNTBLANK: ["CONTAR.VAZIO", "Conta as células vazias."],
  COUNTIF: ["CONT.SE", "Conta as células que atendem a um critério."], COUNTIFS: ["CONT.SES", "Conta as células que atendem a vários critérios."],
  MAX: ["MÁXIMO", "Maior número."], MAXA: ["MÁXIMOA", "Maior valor, contando textos como zero."], MIN: ["MÍNIMO", "Menor número."],
  MINA: ["MÍNIMOA", "Menor valor, contando textos como zero."], MEDIAN: ["MED", "Mediana (o valor do meio)."], "MODE.SNGL": ["MODO.ÚNICO", "Valor que mais se repete."],
  LARGE: ["MAIOR", "O enésimo maior valor."], SMALL: ["MENOR", "O enésimo menor valor."], "RANK.EQ": ["ORDEM.EQ", "Posição do número na lista."],
  "RANK.AVG": ["ORDEM.MÉD", "Posição do número na lista (média nos empates)."], STDEVA: ["DESVPADA", "Desvio padrão da amostra (com textos)."],
  STDEVP: ["DESVPADP", "Desvio padrão da população."], GEOMEAN: ["MÉDIA.GEOMÉTRICA", "Média geométrica."], HARMEAN: ["MÉDIA.HARMÔNICA", "Média harmônica."],
  AVEDEV: ["DESV.MÉDIO", "Desvio médio absoluto."], DEVSQ: ["DESVQ", "Soma dos quadrados dos desvios."], CORREL: ["CORREL", "Correlação entre dois intervalos."],
  PEARSON: ["PEARSON", "Coeficiente de correlação de Pearson."], FORECAST: ["PREVISÃO", "Prevê um valor pela tendência linear."],
  INTERCEPT: ["INTERCEPÇÃO", "Onde a reta de tendência corta o eixo Y."], SLOPE: ["INCLINAÇÃO", "Inclinação da reta de tendência."],
  RSQ: ["RQUAD", "Quadrado do coeficiente de correlação."], STEYX: ["EPADYX", "Erro padrão da previsão."], TRIMMEAN: ["MÉDIA.INTERNA", "Média sem as pontas."],
  "PERCENTILE.INC": ["PERCENTIL.INC", "Percentil (incluindo 0 e 1)."], "PERCENTILE.EXC": ["PERCENTIL.EXC", "Percentil (sem 0 e 1)."],
  "QUARTILE.INC": ["QUARTIL.INC", "Quartil (incluindo 0 e 1)."], "QUARTILE.EXC": ["QUARTIL.EXC", "Quartil (sem 0 e 1)."], "VAR.S": ["VAR.A", "Variância da amostra."],
  "VAR.P": ["VAR.P", "Variância da população."], VARA: ["VARA", "Variância da amostra (com textos)."], VARPA: ["VARPA", "Variância da população (com textos)."],
  KURT: ["CURT", "Curtose."], SKEW: ["DISTORÇÃO", "Assimetria da distribuição."], STANDARDIZE: ["PADRONIZAR", "Valor padronizado (escore z)."],
  PERMUT: ["PERMUT", "Número de permutações."], "COVARIANCE.P": ["COVARIAÇÃO.P", "Covariância da população."], "COVARIANCE.S": ["COVARIAÇÃO.S", "Covariância da amostra."],
  "PERCENTRANK.INC": ["ORDEM.PORCENTUAL.INC", "Posição percentual (incluindo 0 e 1)."], "PERCENTRANK.EXC": ["ORDEM.PORCENTUAL.EXC", "Posição percentual (sem 0 e 1)."],
  "NORM.DIST": ["DIST.NORM.N", "Distribuição normal."], "NORM.INV": ["INV.NORM.N", "Inverso da distribuição normal."],
  "NORM.S.DIST": ["DIST.NORMP.N", "Distribuição normal padrão."], "NORM.S.INV": ["INV.NORMP.N", "Inverso da normal padrão."],
  "BINOM.DIST": ["DISTR.BINOM", "Distribuição binomial."], "POISSON.DIST": ["DIST.POISSON", "Distribuição de Poisson."], "EXPON.DIST": ["DISTR.EXPON", "Distribuição exponencial."],
  MAXIFS: ["MÁXIMOSES", "Maior valor entre os que atendem aos critérios."], MINIFS: ["MÍNIMOSES", "Menor valor entre os que atendem aos critérios."],
  // Pesquisa e matrizes
  VLOOKUP: ["PROCV", "Procura na primeira coluna e devolve o valor da coluna pedida."], HLOOKUP: ["PROCH", "Procura na primeira linha e devolve o valor da linha pedida."],
  LOOKUP: ["PROC", "Procura um valor numa linha ou coluna."], XLOOKUP: ["PROCX", "Procura um valor e devolve o do outro intervalo, na mesma posição."],
  MATCH: ["CORRESP", "Posição de um valor no intervalo."], INDEX: ["ÍNDICE", "Valor da célula na linha e coluna pedidas."], CHOOSE: ["ESCOLHER", "Escolhe um valor da lista pela posição."],
  ROW: ["LIN", "Número da linha."], ROWS: ["LINS", "Quantas linhas o intervalo tem."], COLUMN: ["COL", "Número da coluna."], COLUMNS: ["COLS", "Quantas colunas o intervalo tem."],
  ADDRESS: ["ENDEREÇO", "Endereço da célula como texto (ex.: $A$1)."], HYPERLINK: ["HIPERLINK", "Cria um link."],
  // Data e hora
  TODAY: ["HOJE", "Data de hoje."], NOW: ["AGORA", "Data e hora de agora."], DATE: ["DATA", "Monta uma data com ano, mês e dia."], TIME: ["TEMPO", "Monta uma hora com hora, minuto e segundo."],
  DAY: ["DIA", "Dia da data."], MONTH: ["MÊS", "Mês da data."], YEAR: ["ANO", "Ano da data."], HOUR: ["HORA", "Hora."], MINUTE: ["MINUTO", "Minutos."], SECOND: ["SEGUNDO", "Segundos."],
  WEEKDAY: ["DIA.DA.SEMANA", "Dia da semana (1 = domingo)."], WEEKNUM: ["NÚMSEMANA", "Número da semana no ano."], ISOWEEKNUM: ["NÚMSEMANAISO", "Número da semana ISO."],
  DATEDIF: ["DATADIF", "Diferença entre datas em dias (\"D\"), meses (\"M\") ou anos (\"Y\")."], DAYS: ["DIAS", "Dias entre duas datas."], DAYS360: ["DIAS360", "Dias entre datas no ano de 360 dias."],
  EDATE: ["DATAM", "Data alguns meses antes ou depois."], EOMONTH: ["FIMMÊS", "Último dia do mês, alguns meses antes ou depois."],
  NETWORKDAYS: ["DIATRABALHOTOTAL", "Dias úteis entre duas datas."], "NETWORKDAYS.INTL": ["DIATRABALHOTOTAL.INTL", "Dias úteis com fim de semana escolhido."],
  WORKDAY: ["DIATRABALHO", "Data depois de alguns dias úteis."], "WORKDAY.INTL": ["DIATRABALHO.INTL", "Data depois de dias úteis, com fim de semana escolhido."],
  YEARFRAC: ["FRAÇÃOANO", "Fração do ano entre duas datas."], DATEVALUE: ["DATA.VALOR", "Texto de data em data."], TIMEVALUE: ["VALOR.TEMPO", "Texto de hora em hora."],
  // Lógica
  IF: ["SE", "Um valor se a condição for verdadeira, outro se for falsa."], IFS: ["SES", "Testa várias condições e devolve o valor da primeira verdadeira."],
  IFERROR: ["SEERRO", "Um valor no lugar do erro."], IFNA: ["SENÃODISP", "Um valor no lugar do #N/D."], AND: ["E", "VERDADEIRO se todas as condições forem verdadeiras."],
  OR: ["OU", "VERDADEIRO se alguma condição for verdadeira."], NOT: ["NÃO", "Inverte VERDADEIRO e FALSO."], XOR: ["OUEXCL", "VERDADEIRO se um número ímpar de condições for verdadeiro."],
  TRUE: ["VERDADEIRO", "O valor VERDADEIRO."], FALSE: ["FALSO", "O valor FALSO."], SWITCH: ["PARÂMETRO", "Compara com uma lista e devolve o valor correspondente."],
  // Texto
  CONCATENATE: ["CONCATENAR", "Junta textos."], CONCAT: ["CONCAT", "Junta dois textos."], TEXTJOIN: ["UNIRTEXTO", "Junta textos com um separador."],
  JOIN: ["UNIR", "Junta os valores com um separador."], LEFT: ["ESQUERDA", "Caracteres do começo do texto."], RIGHT: ["DIREITA", "Caracteres do fim do texto."],
  MID: ["EXT.TEXTO", "Caracteres do meio do texto."], LEN: ["NÚM.CARACT", "Quantos caracteres o texto tem."], LOWER: ["MINÚSCULA", "Texto em minúsculas."],
  UPPER: ["MAIÚSCULA", "Texto em maiúsculas."], PROPER: ["PRI.MAIÚSCULA", "Primeira letra de cada palavra em maiúscula."], TRIM: ["ARRUMAR", "Tira os espaços sobrando."],
  SUBSTITUTE: ["SUBSTITUIR", "Troca um texto por outro."], REPLACE: ["MUDAR", "Troca parte do texto pela posição."], FIND: ["PROCURAR", "Posição de um texto (diferencia maiúsculas)."],
  SEARCH: ["LOCALIZAR", "Posição de um texto (sem diferenciar maiúsculas)."], REPT: ["REPT", "Repete o texto."], TEXT: ["TEXTO", "Número formatado como texto."],
  VALUE: ["VALOR", "Texto em número."], EXACT: ["EXATO", "VERDADEIRO se os textos forem iguais."], CHAR: ["CARACT", "Caractere pelo código."], CODE: ["CÓDIGO", "Código do primeiro caractere."],
  CLEAN: ["TIRAR", "Tira os caracteres que não imprimem."], T: ["T", "O texto, ou vazio se não for texto."], FIXED: ["DEF.NÚM.DEC", "Número com casas decimais fixas, como texto."],
  DOLLAR: ["MOEDA", "Número em formato de moeda, como texto."], REGEXMATCH: ["REGEXMATCH", "VERDADEIRO se o texto combina com a expressão regular."],
  REGEXEXTRACT: ["REGEXEXTRACT", "Parte do texto que combina com a expressão regular."], REGEXREPLACE: ["REGEXREPLACE", "Troca o que combina com a expressão regular."],
  // Informação
  ISBLANK: ["ÉCÉL.VAZIA", "VERDADEIRO se a célula estiver vazia."], ISNUMBER: ["ÉNÚM", "VERDADEIRO se for número."], ISTEXT: ["ÉTEXTO", "VERDADEIRO se for texto."],
  ISERROR: ["ÉERROS", "VERDADEIRO se for qualquer erro."], ISERR: ["ÉERRO", "VERDADEIRO se for erro (menos #N/D)."], ISNA: ["É.NÃO.DISP", "VERDADEIRO se for #N/D."],
  ISLOGICAL: ["ÉLÓGICO", "VERDADEIRO se for VERDADEIRO ou FALSO."], ISNONTEXT: ["É.NÃO.TEXTO", "VERDADEIRO se não for texto."], ISREF: ["ÉREF", "VERDADEIRO se for referência."],
  ISFORMULA: ["ÉFÓRMULA", "VERDADEIRO se a célula tiver fórmula."], NA: ["NÃO.DISP", "O erro #N/D."], N: ["N", "O valor como número."], TYPE: ["TIPO", "Tipo do valor (1 número, 2 texto…)."],
  // Financeiro
  PMT: ["PGTO", "Parcela de um financiamento."], PV: ["VP", "Valor presente."], FV: ["VF", "Valor futuro."], NPV: ["VPL", "Valor presente líquido."], IRR: ["TIR", "Taxa interna de retorno."],
  XIRR: ["XTIR", "TIR com datas."], MIRR: ["MTIR", "TIR modificada."], RATE: ["TAXA", "Taxa de juros por período."], NPER: ["NPER", "Número de períodos."],
  IPMT: ["IPGTO", "Juros de uma parcela."], PPMT: ["PPGTO", "Amortização de uma parcela."], SLN: ["DPD", "Depreciação linear."], SYD: ["SDA", "Depreciação pela soma dos dígitos."],
  DB: ["BD", "Depreciação de saldo fixo."], DDB: ["BDD", "Depreciação de saldo duplo."], EFFECT: ["EFETIVA", "Taxa efetiva anual."], NOMINAL: ["NOMINAL", "Taxa nominal anual."],
  XNPV: ["XVPL", "VPL com datas."], CUMIPMT: ["PGTOJURACUM", "Juros acumulados entre parcelas."], CUMPRINC: ["PGTOCAPACUM", "Amortização acumulada entre parcelas."],
  FVSCHEDULE: ["VFPLANO", "Valor futuro com taxas variáveis."],
};

/**
 * Funções que devolvem várias células (ÚNICO, TRANSPOR, CLASSIFICAR, SEQUÊNCIA) ficam de fora: este editor não espalha
 * o resultado pelas células vizinhas.
 * Funções exóticas do editor que somem da lista (documentos chineses, ações chinesas, mineração de texto, minigráficos). */
export const ESCONDIDAS = /^(AGE_BY_IDCARD|SEX_BY_IDCARD|BIRTHDAY_BY_IDCARD|PROVINCE_BY_IDCARD|CITY_BY_IDCARD|STAR_BY_IDCARD|ANIMAL_BY_IDCARD|ISIDCARD|DM_TEXT_.*|DATA_CN_STOCK_.*|.*SPLINES|REMOTE|EVALUATE|GETPIVOTDATA|LINESPLINES)$/;

/** Nomes dos parâmetros da ajuda das funções. */
export const PARAMETROS: Record<string, string> = {
  value: "valor", value1: "valor1", value2: "valor2", number: "número", number1: "número1", number2: "número2", range: "intervalo", criterion: "critério",
  criteria: "critério", sum_range: "intervalo_soma", average_range: "intervalo_média", criteria_range1: "intervalo_critério1", criterion1: "critério1",
  criteria_range2: "intervalo_critério2", criterion2: "critério2", text: "texto", text1: "texto1", text2: "texto2", string: "texto", search_key: "chave",
  search_for: "procurar", text_to_search: "texto_onde_procurar", starting_at: "início", start: "início", length: "tamanho", num_chars: "quantidade",
  places: "casas", digits: "casas", factor: "fator", base: "base", exponent: "expoente", divisor: "divisor", dividend: "dividendo", logical_expression: "condição",
  value_if_true: "se_verdadeiro", value_if_false: "se_falso", value_if_error: "se_erro", logical_expression1: "condição1", logical_expression2: "condição2",
  index: "posição", row: "linha", column: "coluna", rows: "linhas", columns: "colunas", reference: "referência", is_sorted: "ordenado", search_type: "tipo",
  date: "data", start_date: "data_início", end_date: "data_fim", months: "meses", days: "dias", unit: "unidade", year: "ano", month: "mês", day: "dia",
  hour: "hora", minute: "minuto", second: "segundo", type: "tipo", holidays: "feriados", weekend: "fim_de_semana", rate: "taxa", number_of_periods: "períodos",
  payment_amount: "parcela", present_value: "valor_presente", future_value: "valor_futuro", end_or_beginning: "início_ou_fim", cashflow_amounts: "fluxos",
  delimiter: "separador", format: "formato", data: "dados", array: "matriz", array1: "matriz1", array2: "matriz2", n: "n", k: "k", x: "x", y: "y",
  regular_expression: "expressão_regular", replacement: "substituição", times: "vezes", old_text: "texto_antigo", new_text: "texto_novo", search_text: "procurar",
  occurrence_number: "ocorrência", number_of_places: "casas", decimals: "decimais", function_code: "código_função", percentile: "percentil", quartile: "quartil",
};


/** Item da lista de funções do editor (autocompletar e ajuda). */
export interface ItemLista {
  n: string; t: number; d: string; a: string; m: [number, number];
  p: { name: string; detail: string; example: string; require: "m" | "o"; repeat: "y" | "n"; type: string }[];
}

const param = (name: string, detail: string, example: string, opcional = false, repete = false, type = "rangeall"): ItemLista["p"][number] =>
  ({ name, detail, example, require: opcional ? "o" : "m", repeat: repete ? "y" : "n", type });

/** As funções novas (o motor não tinha), já com a ajuda em português. */
export const NOVAS: ItemLista[] = [
  { n: "XLOOKUP", t: 2, d: "", a: "", m: [3, 6], p: [
    param("chave", "O valor procurado.", "A2"), param("intervalo_busca", "Onde procurar (uma linha ou coluna).", "B2:B100", false, false, "range"),
    param("intervalo_resultado", "De onde vem a resposta, na mesma posição.", "C2:C100", false, false, "range"),
    param("se_não_encontrado", "O que mostrar quando não achar.", "\"não achei\"", true), param("tipo_corresp", "0 exato, -1 exato ou menor, 1 exato ou maior, 2 com * e ?.", "0", true),
    param("modo_busca", "1 do começo, -1 do fim.", "1", true)] },
  { n: "TEXTJOIN", t: 10, d: "", a: "", m: [3, 255], p: [
    param("separador", "O que vai entre os textos.", "\", \""), param("ignorar_vazios", "VERDADEIRO pula as células vazias.", "VERDADEIRO"),
    param("texto1", "Textos ou intervalos a juntar.", "A2:A10", false, true)] },
  { n: "MAXIFS", t: 1, d: "", a: "", m: [3, 255], p: [
    param("intervalo_máximo", "De onde sai o maior valor.", "C2:C100", false, false, "range"), param("intervalo_critério1", "Onde testar o critério.", "B2:B100", false, true, "range"),
    param("critério1", "O critério (ex.: \">10\" ou \"obra A\").", "\">10\"", false, true)] },
  { n: "MINIFS", t: 1, d: "", a: "", m: [3, 255], p: [
    param("intervalo_mínimo", "De onde sai o menor valor.", "C2:C100", false, false, "range"), param("intervalo_critério1", "Onde testar o critério.", "B2:B100", false, true, "range"),
    param("critério1", "O critério (ex.: \">10\" ou \"obra A\").", "\">10\"", false, true)] },
  { n: "ADDRESS", t: 2, d: "", a: "", m: [2, 5], p: [
    param("linha", "Número da linha.", "1"), param("coluna", "Número da coluna.", "2"), param("tipo", "1 $A$1, 2 A$1, 3 $A1, 4 A1.", "4", true),
    param("estilo_a1", "Deixe VERDADEIRO.", "VERDADEIRO", true), param("página", "Nome da página.", "\"Página1\"", true)] },
];

/**
 * A lista do editor em português: tira as exóticas e as que não têm nome em português, troca nome, descrição e o nome
 * dos parâmetros, e põe as funções novas. Em ordem alfabética do nome em português.
 */
export function listaEmPortugues(lista: ItemLista[]): ItemLista[] {
  const motor = (n: string) => (FUNCOES[n] ? n : n.replace(/_/g, "."));
  const vistas = new Set<string>();
  const saida: ItemLista[] = [];
  for (const f of [...lista.filter(x => !NOVAS.some(nv => nv.n === x.n)), ...NOVAS]) {
    const nome = motor(f.n);
    const pt = FUNCOES[nome];
    if (!pt || ESCONDIDAS.test(f.n) || vistas.has(pt[0])) continue;
    vistas.add(pt[0]);
    saida.push({
      ...f, n: pt[0], d: pt[1], a: pt[1],
      // A explicação de cada parâmetro do editor é em inglês: fica só o nome traduzido (as novas já vêm em português).
      p: f.p.map(p => ({ ...p, name: PARAMETROS[p.name] ?? p.name, detail: NOVAS.includes(f) ? p.detail : "" })),
    });
  }
  return saida.sort((a, b) => a.n.localeCompare(b.n, "pt-BR"));
}
