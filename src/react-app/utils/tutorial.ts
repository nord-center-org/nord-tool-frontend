/**
 * Tutorial em balõezinhos: o tour geral (página inicial) e o passo a passo de cada tela.
 * Os alvos são achados no DOM por seletor CSS (e, se preciso, pelo texto do elemento),
 * então as telas não precisam saber que existe um tutorial. Alvo que não aparece é pulado.
 */

export interface AlvoTutorial {
  css: string;
  /** Só elementos cujo texto contém isto (sem diferenciar maiúsculas e acentos). */
  texto?: string;
  /** Sobe N níveis a partir do elemento achado (para destacar o grupo inteiro). */
  pai?: number;
}

export interface PassoTutorial {
  titulo: string;
  texto: string;
  /** Itens mostrados em lista dentro do balão. */
  lista?: { nome: string; texto: string }[];
  /** Sem alvo, o balão fica no meio da tela. Com vários, vale o primeiro que existir. */
  alvo?: AlvoTutorial | AlvoTutorial[];
  /** O que o menu lateral precisa estar fazendo neste passo. */
  menu?: "abrir" | "fechar";
  /** Grupo do menu que precisa estar aberto. */
  grupo?: string;
}

export interface Tutorial {
  titulo: string;
  passos: PassoTutorial[];
}

export const alvosDoPasso = (p: PassoTutorial): AlvoTutorial[] => (p.alvo ? (Array.isArray(p.alvo) ? p.alvo : [p.alvo]) : []);

/** Compara textos sem maiúsculas, acentos e espaços repetidos. */
export const normalizarTexto = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const contemTexto = (conteudo: string | null | undefined, procurado: string): boolean =>
  normalizarTexto(conteudo ?? "").includes(normalizarTexto(procurado));

/** Id da lista de um grupo do menu lateral (o mesmo que o Layout usa). */
export const idGrupoMenu = (titulo: string) => `menu-${titulo.replace(/\s+/g, "-").toLowerCase()}`;

// ---------------------------------------------------------------- descrição das abas

const EM_BREVE = "Em construção: a tela já está no menu e vai ganhar funções em breve.";

/** O que cada aba faz, em uma frase (usado no tour geral). */
export const DESCRICAO_DAS_TELAS: Record<string, string> = {
  "/": "A página inicial: a equipe no canteiro, os atalhos dos módulos e este tour.",
  "/entregas": "A agenda de vistorias e entregas da semana, separada por dia.",
  "/apartamentos": "A base de todos os apartamentos: status, datas, filtros, planilhas e ações em massa.",
  "/dashboard": "Os números das entregas: liberadas, vistoriadas, aprovadas e reprovadas por período.",
  "/mapeamentos/conferencias": "Contagens de campo e quantitativos (projeto × medido × solicitado).",
  "/mapeamentos/pendencias": EM_BREVE,
  "/mapeamentos/relatorio-fotografico": "Fotos organizadas por item, com edição e PDF pronto no padrão da obra.",
  "/organizacional/rte": EM_BREVE,
  "/organizacional/diario-obras": EM_BREVE,
  "/organizacional/escadinha": EM_BREVE,
  "/organizacional/fluxograma": EM_BREVE,
  "/organizacional/controle-chaves": "Quem retirou cada chave ou ferramenta, o que está em campo e o histórico.",
  "/treinamentos": EM_BREVE,
  "/organizacional/fvs": EM_BREVE,
  "/organizacional/projetos": EM_BREVE,
  "/organizacional/cronograma": "As demandas da semana em kanban, lista e rotina, com compartilhamento.",
  "/organizacional/medicoes": "Os boletins de medição dos contratos, com status e valores.",
  "/gestao/financeiro": "Quanto sobra no mês, extrato, gráficos e investimentos.",
  "/gestao/treinos": "Fichas de treino, o treino do dia e o histórico do que você fez.",
  "/gestao/repertorio": EM_BREVE,
  "/gestao/academico": EM_BREVE,
  "/gestao/casamento": "Fornecedores, convidados e marcos do casamento, tudo num lugar só.",
  "/gestao/caixinha": "As despesas da caixinha: quem gastou, o que foi pago e os comprovantes.",
  "/configuracoes": "Sua conta, senha, avatar e, para quem administra, obras, equipes e acessos.",
};

const DESCRICAO_DOS_GRUPOS: Record<string, string> = {
  "Entrega": "Tudo sobre a entrega dos apartamentos: agenda, base e indicadores.",
  "Mapeamentos": "Levantamentos de campo: contagens, quantitativos e relatórios com fotos.",
  "Organizacional": "A rotina da obra: chaves, cronograma, medições e controles.",
  "Gestão Individual": "Ferramentas pessoais: finanças, treinos, casamento e caixinha.",
};

// ---------------------------------------------------------------- tour geral

export interface GrupoParaTutorial {
  title: string;
  items: { path: string; label: string }[];
}

interface OpcoesTourGeral {
  nome?: string | null;
  grupos: GrupoParaTutorial[];
  variasObras: boolean;
}

/** Tour da ferramenta inteira, montado só com as abas que a pessoa pode abrir. */
export function tutorialGeral({ nome, grupos, variasObras }: OpcoesTourGeral): Tutorial {
  const primeiroNome = nome?.trim().split(/\s+/)[0];
  const comAbas = grupos.filter(g => !(g.items.length === 1 && g.items[0].path === "/"));
  const totalAbas = comAbas.reduce((n, g) => n + g.items.length, 0);

  const passos: PassoTutorial[] = [
    {
      titulo: primeiroNome ? `Bem-vindo, ${primeiroNome}!` : "Bem-vindo ao NordTool!",
      texto: totalAbas > 0
        ? `Vou te mostrar a ferramenta inteira: onde fica cada coisa e as ${totalAbas} aba${totalAbas === 1 ? "" : "s"} que você pode usar. Use os botões ou as setas do teclado; Esc fecha.`
        : "Vou te mostrar onde fica cada coisa. Use os botões ou as setas do teclado; Esc fecha.",
      menu: "fechar",
    },
    {
      titulo: "O canteiro da equipe",
      texto: "Aqui aparece a equipe da obra com os avatares. A cena muda com o horário do dia e se veste nas datas comemorativas. Clique nos bonequinhos para ver quem é quem.",
      alvo: { css: '[aria-label="Canteiro de obras com a equipe"]' },
      menu: "fechar",
    },
    {
      titulo: "Atalhos dos módulos",
      texto: "Cada cartão é um módulo. Clique para abrir a lista das telas dele e ir direto para a que você quer.",
      alvo: { css: '[data-tutorial="modulos"]' },
      menu: "fechar",
    },
    {
      titulo: "O menu",
      texto: "Este botão abre o menu lateral, que tem todas as telas. No celular ele aparece por cima; toque fora dele para fechar.",
      alvo: { css: '[aria-label="Abrir menu"]' },
      menu: "fechar",
    },
    {
      titulo: "Você e a sua obra",
      texto: variasObras
        ? "Seu avatar (toque nele para editar), seu nome e a obra. Você participa de mais de uma obra: troque aqui e todas as telas passam a mostrar os dados da obra escolhida."
        : "Seu avatar (toque nele para editar), seu nome, a obra e as fases em que você está.",
      alvo: { css: '[aria-label="Usuário e obra"]' },
      menu: "abrir",
    },
  ];

  if (comAbas.length === 0) {
    passos.push({
      titulo: "Acesso em liberação",
      texto: "Você ainda não tem telas liberadas. Peça ao administrador da obra para liberar os módulos que você vai usar; eles aparecem aqui no menu.",
      alvo: { css: '[aria-label="Módulos"]' },
      menu: "abrir",
    });
  }

  for (const g of comAbas) {
    passos.push({
      titulo: g.title,
      texto: DESCRICAO_DOS_GRUPOS[g.title] ?? "As telas deste grupo:",
      lista: g.items.map(i => ({ nome: i.label, texto: DESCRICAO_DAS_TELAS[i.path] ?? "" })),
      // O grupo inteiro (título + telas); enquanto a lista abre, vale só o título.
      alvo: [{ css: `#${idGrupoMenu(g.title)}`, pai: 1 }, { css: `[aria-controls="${idGrupoMenu(g.title)}"]` }],
      menu: "abrir",
      grupo: g.title,
    });
  }

  passos.push(
    {
      titulo: "Configurações",
      texto: "Sua conta, senha, avatar e o botão de sair. Quem administra também cuida das obras, fases, equipes e de quem acessa cada tela.",
      alvo: { css: 'a[href="/configuracoes"]' },
      menu: "abrir",
    },
    {
      titulo: "Ajuda em cada tela",
      texto: "Em qualquer aba, toque neste ponto de interrogação para ver o passo a passo detalhado dela. Aqui no início ele repete este tour.",
      alvo: { css: '[data-tutorial="ajuda"]' },
      menu: "fechar",
    },
    {
      titulo: "Tudo pronto!",
      texto: "Agora é com você. Qualquer dúvida, o ? está sempre no canto da tela. Bom trabalho!",
      menu: "fechar",
    },
  );

  return { titulo: "Tour do NordTool", passos };
}

// ---------------------------------------------------------------- passo a passo de cada tela

const ajudaNoCanto = (tela: string): PassoTutorial => ({
  titulo: "Sempre que precisar",
  texto: `Esse passo a passo de ${tela} fica aqui no ? do canto. Pode rever quando quiser.`,
  alvo: { css: '[data-tutorial="ajuda"]' },
});

const cabecalho = (titulo: string, texto: string): PassoTutorial => ({
  titulo,
  texto,
  alvo: [{ css: "header", texto: titulo }, { css: "h1, h2", texto: titulo, pai: 1 }],
});

const EM_CONSTRUCAO: Tutorial = {
  titulo: "Tela em construção",
  passos: [{
    titulo: "Em construção",
    texto: "Esta tela ainda está sendo feita. Ela já aparece no menu para você saber que vem aí; quando ficar pronta, o passo a passo dela aparece aqui.",
    alvo: { css: "h2", texto: "fase de planejamento", pai: 1 },
  }],
};

export const TUTORIAIS_DAS_TELAS: Record<string, Tutorial> = {
  "/entregas": {
    titulo: "Agenda",
    passos: [
      {
        titulo: "Agenda de entregas",
        texto: "As vistorias e entregas agendadas, agrupadas por dia.",
        alvo: { css: "h2", texto: "Entregas" },
      },
      {
        titulo: "Qual semana",
        texto: "Escolha entre a semana vigente, a próxima ou tudo. Na semana vigente, os dias que já passaram ficam recolhidos e mais claros.",
        alvo: { css: "button", texto: "Semana Vigente", pai: 1 },
      },
      {
        titulo: "Filtrar pela fase",
        texto: "Os botões ao lado filtram por fase da obra. Clique de novo para voltar a mostrar todas.",
        alvo: { css: "button", texto: "Próxima Semana", pai: 2 },
      },
      {
        titulo: "Novo apartamento",
        texto: "Agende uma nova entrega: preencha o apartamento, a data e os dados da vistoria.",
        alvo: { css: "button", texto: "Novo Apartamento" },
      },
      {
        titulo: "Os dias",
        texto: "Clique no título do dia para recolher ou abrir. Cada cartão é um apartamento: clique para ver e editar tudo dele, inclusive termos e observações.",
        alvo: { css: "section" },
      },
      ajudaNoCanto("Agenda"),
    ],
  },
  "/apartamentos": {
    titulo: "Apartamentos",
    passos: [
      {
        titulo: "Base de apartamentos",
        texto: "Todos os apartamentos da obra numa tabela só. Os botões ao lado do título filtram por fase.",
        alvo: { css: "h2", texto: "Apartamentos", pai: 1 },
      },
      {
        titulo: "Busca global",
        texto: "Procura em todas as colunas de uma vez: nome, data (ex.: 18/02), status, observação…",
        alvo: { css: 'input[placeholder^="Busca global"]' },
      },
      {
        titulo: "Mostrar todos, limpar e planilhas",
        texto: "Mostrar Todos traz também os já finalizados. A seta vermelha limpa busca e filtros. O botão verde importa e exporta planilhas, baixa a planilha modelo e atualiza a agenda colando dados.",
        alvo: { css: '[aria-label="Limpar filtros"]', pai: 1 },
      },
      {
        titulo: "A tabela",
        texto: "Clique no título de uma coluna para filtrar ou ordenar. Clique numa linha para abrir o apartamento. Marque as caixinhas para selecionar vários e aparecem as ações em massa (mover datas, baixar termos…).",
        alvo: { css: "table" },
      },
      ajudaNoCanto("Apartamentos"),
    ],
  },
  "/dashboard": {
    titulo: "Dashboard",
    passos: [
      {
        titulo: "Dashboard das entregas",
        texto: "Os indicadores das entregas. Os botões ao lado do título mostram só uma fase.",
        alvo: { css: "h2", texto: "Dashboard", pai: 1 },
      },
      {
        titulo: "Período",
        texto: "Escolha a data inicial e a final. Hoje mostra só o dia; Limpar volta para tudo.",
        alvo: { css: 'input[type="date"]', pai: 3 },
      },
      {
        titulo: "Resumo geral",
        texto: "Quantas unidades a obra liberou, quantas foram vistoriadas, aprovadas e reprovadas no período.",
        alvo: { css: "h4", texto: "Resumo geral", pai: 1 },
      },
      {
        titulo: "Resumo detalhado",
        texto: "Cada indicador com quantidade e porcentagem, para copiar para relatórios.",
        alvo: { css: "h3", texto: "Resumo detalhado", pai: 2 },
      },
      ajudaNoCanto("Dashboard"),
    ],
  },
  "/mapeamentos/conferencias": {
    titulo: "Contagens e quantitativos",
    passos: [
      cabecalho("Mapeamentos", "Contagem é o que você conta em campo; quantitativo compara o projeto, o medido e o solicitado."),
      {
        titulo: "Novo mapeamento",
        texto: "Escolha o tipo, o local e a fase. Depois é só ir preenchendo as linhas; tudo salva sozinho.",
        alvo: { css: "button", texto: "Novo mapeamento" },
      },
      {
        titulo: "Buscar e filtrar",
        texto: "Procure pelo título, local ou fase e filtre por tipo.",
        alvo: { css: '[aria-label="Buscar mapeamento"]', pai: 2 },
      },
      {
        titulo: "Seus mapeamentos",
        texto: "Clique num mapeamento para abrir, editar as linhas, concluir e exportar.",
        alvo: { css: 'ul[aria-label="Mapeamentos"]' },
      },
      ajudaNoCanto("Mapeamentos"),
    ],
  },
  "/mapeamentos/relatorio-fotografico": {
    titulo: "Relatório fotográfico",
    passos: [
      cabecalho("Relatório fotográfico", "Fotos organizadas por item, prontas para virar PDF no padrão da obra."),
      {
        titulo: "Modelos",
        texto: "Para quem administra: monte os modelos com fonte, cabeçalho, ícone no canto e marca d'água. O cabeçalho repete em todas as páginas do PDF.",
        alvo: { css: "button", texto: "Modelos" },
      },
      {
        titulo: "Novo relatório",
        texto: "Escolha o modelo e o layout das fotos. No relatório, tire fotos em sequência: refazer, próxima, legenda, novo item e finalizar ficam todos num toque.",
        alvo: { css: "button", texto: "Novo relatório" },
      },
      {
        titulo: "Buscar e filtrar",
        texto: "Procure pelo título, local ou fase e filtre por rascunho ou concluído.",
        alvo: { css: '[aria-label="Buscar relatório"]', pai: 2 },
      },
      {
        titulo: "Seus relatórios",
        texto: "Abra um relatório para continuar. Toque numa foto para ampliar, cortar, girar e riscar (setas, círculos, quadrados e cores). Cada item começa numa página nova do PDF.",
        alvo: { css: 'ul[aria-label="Relatórios"]' },
      },
      ajudaNoCanto("Relatório fotográfico"),
    ],
  },
  "/organizacional/controle-chaves": {
    titulo: "Controle de chaves",
    passos: [
      cabecalho("Controle de Chaves", "Controle de quem retirou cada chave e ferramenta da obra."),
      {
        titulo: "Dashboard e histórico",
        texto: "No Dashboard você vê o que está em campo agora. No Histórico, todas as retiradas, com busca, status e páginas.",
        alvo: { css: "button", texto: "Histórico", pai: 1 },
      },
      {
        titulo: "Os números",
        texto: "Quantas chaves estão em campo, no quadro e já entregues.",
        alvo: { css: "p", texto: "Chaves em Campo", pai: 2 },
      },
      {
        titulo: "Nova retirada",
        texto: "Registre quem está levando chave ou ferramenta: a pessoa, a empresa e o que foi retirado.",
        alvo: { css: "button", texto: "Nova Retirada" },
      },
      {
        titulo: "Retiradas em aberto",
        texto: "O que ainda não voltou, separado em chaves e ferramentas. Quando devolverem, clique em receber.",
        alvo: { css: "h3", texto: "Retiradas em aberto", pai: 2 },
      },
      ajudaNoCanto("Controle de chaves"),
    ],
  },
  "/organizacional/cronograma": {
    titulo: "Cronograma semanal",
    passos: [
      cabecalho("Cronograma Semanal", "As demandas e a rotina da semana."),
      {
        titulo: "Três jeitos de ver",
        texto: "Kanban mostra as colunas por status; Lista mostra tudo em tabela; Rotina mostra as tarefas que se repetem.",
        alvo: { css: "button", texto: "Kanban", pai: 1 },
      },
      {
        titulo: "Buscar e filtrar",
        texto: "Procure pela demanda ou observação, filtre por categoria e por de quem é (as suas ou as compartilhadas com você).",
        alvo: { css: 'input[placeholder^="Buscar demanda"]', pai: 2 },
      },
      {
        titulo: "Nova demanda",
        texto: "Crie uma demanda com categoria, prazo e observação. Dá para compartilhar com outras pessoas da obra.",
        alvo: { css: "button", texto: "Nova demanda" },
      },
      {
        titulo: "O kanban",
        texto: "Arraste os cartões entre as colunas para mudar o status. Clique num cartão para editar. Os de outra pessoa aparecem com cadeado.",
        alvo: { css: "section" },
      },
      ajudaNoCanto("Cronograma"),
    ],
  },
  "/organizacional/medicoes": {
    titulo: "Medições",
    passos: [
      cabecalho("Medições", "Os boletins de medição dos contratos da obra."),
      {
        titulo: "Pendentes e nova medição",
        texto: "Quantas medições estão pendentes e quanto somam. Em Nova medição você lança contrato, empresa, memorial e valor.",
        alvo: { css: '[aria-label="Resumo"]' },
      },
      {
        titulo: "Filtros",
        texto: "Filtre pelo status (o número ao lado é quantas há) e busque por contrato, empresa ou memorial.",
        alvo: { css: 'section[aria-label="Filtros"]' },
      },
      {
        titulo: "Salva sozinho",
        texto: "As mudanças são salvas automaticamente; aqui aparece se está salvando ou se está tudo salvo.",
        alvo: { css: '[role="status"][aria-live="polite"]' },
      },
      ajudaNoCanto("Medições"),
    ],
  },
  "/gestao/financeiro": {
    titulo: "Gestão financeira",
    passos: [
      cabecalho("Financeiro", "Suas finanças: quanto entra, quanto sai e quanto sobra."),
      {
        titulo: "As seções",
        texto: "Resumo mostra o mês; Extrato lista e lança entradas e saídas; Dashboard tem os gráficos; Investimentos acompanha as aplicações.",
        alvo: { css: '[role="tablist"]' },
      },
      {
        titulo: "De quem",
        texto: "Veja tudo junto ou só de uma pessoa. As pessoas e categorias são cadastradas em Gerenciar cadastros.",
        alvo: { css: '[aria-label="De quem"]' },
      },
      ajudaNoCanto("Financeiro"),
    ],
  },
  "/gestao/treinos": {
    titulo: "Treinos",
    passos: [
      cabecalho("Treinos", "Suas fichas de treino e quantos treinos você fez nesta semana."),
      {
        titulo: "Nova ficha",
        texto: "Monte uma ficha com os exercícios, séries, repetições, carga e os dias da semana.",
        alvo: { css: "button", texto: "Nova ficha" },
      },
      {
        titulo: "Treino de hoje",
        texto: "As fichas marcadas para hoje aparecem aqui. Toque para começar: o modo treino marca cada série e conta o descanso.",
        alvo: { css: '[aria-label="Treino de hoje"]' },
      },
      {
        titulo: "Suas fichas",
        texto: "Cada ficha mostra os dias, os exercícios e quando foi a última vez. Use o lápis para editar e Treinar para começar.",
        alvo: { css: 'ul[aria-label="Fichas de treino"]' },
      },
      {
        titulo: "Histórico",
        texto: "Todo treino concluído fica registrado aqui, com a duração e o que foi feito.",
        alvo: { css: '[aria-label="Histórico"]' },
      },
      ajudaNoCanto("Treinos"),
    ],
  },
  "/gestao/casamento": {
    titulo: "Casamento",
    passos: [
      cabecalho("Casamento", "Organização do casamento em um lugar só."),
      {
        titulo: "As seções",
        texto: "Dashboard com o resumo, Fornecedores com orçamentos e pagamentos, Convidados com confirmações e Marcos com as datas importantes.",
        alvo: { css: '[role="tablist"]' },
      },
      {
        titulo: "Exportar tudo",
        texto: "Baixa uma planilha com fornecedores, convidados e marcos.",
        alvo: { css: "button", texto: "Exportar tudo" },
      },
      {
        titulo: "Salva sozinho",
        texto: "Não tem botão de salvar: aqui aparece quando está salvando e quando está tudo salvo.",
        alvo: { css: '[role="status"][aria-live="polite"]' },
      },
      ajudaNoCanto("Casamento"),
    ],
  },
  "/gestao/caixinha": {
    titulo: "Caixinha",
    passos: [
      cabecalho("Caixinha", "O controle das despesas pagas pela caixinha."),
      {
        titulo: "Novo lançamento",
        texto: "Lance a despesa com data, responsável, insumo, valor e os comprovantes (foto ou PDF).",
        alvo: { css: "button", texto: "Novo lançamento" },
      },
      {
        titulo: "Responsáveis, planilha e PDF",
        texto: "Responsáveis cadastra quem usa a caixinha. Exportar baixa a planilha da lista. PDF único junta o resumo e todos os comprovantes.",
        alvo: { css: "button", texto: "Responsáveis", pai: 1 },
      },
      {
        titulo: "Resumo",
        texto: "O total de despesas, o que já foi pago e o que ainda falta pagar.",
        alvo: { css: 'section[aria-label="Resumo"]' },
      },
      {
        titulo: "Filtros",
        texto: "Filtre por responsável, situação, período (ou Este mês) e busque pelo insumo.",
        alvo: { css: 'section[aria-label="Filtros"]' },
      },
      {
        titulo: "Os lançamentos",
        texto: "Clique no título da coluna para filtrar. Marque lançado e pago direto na linha; os comprovantes abrem com um clique.",
        alvo: [{ css: "table" }, { css: "p", texto: "lançamento(s)" }],
      },
      ajudaNoCanto("Caixinha"),
    ],
  },
  "/configuracoes": {
    titulo: "Configurações",
    passos: [
      cabecalho("Configurações", "Sua conta e os ajustes da ferramenta."),
      {
        titulo: "Sua conta",
        texto: "Edite seu avatar, troque a senha ou saia da conta.",
        alvo: { css: '[aria-labelledby="config-conta"]' },
      },
      {
        titulo: "Administração",
        texto: "Obras e fases cadastra as obras; Equipe e cargos monta a hierarquia; Acessos aprova cadastros novos (escolhendo a obra e as fases) e libera o que cada pessoa pode ver.",
        alvo: { css: '[aria-labelledby="config-administracao"]' },
      },
      {
        titulo: "Controle de chaves",
        texto: "A obra usada no Dashboard e no Histórico do Controle de chaves.",
        alvo: { css: '[aria-labelledby="config-controle-chaves"]' },
      },
      {
        titulo: "Cadastros e filtros",
        texto: "Mais abaixo: os cadastros do Controle de chaves, o pré-carregamento de filtros, a grade de horários e o mapeamento de unidades. Clique para abrir cada um.",
        alvo: { css: "h3", texto: "Cadastros", pai: 3 },
      },
      ajudaNoCanto("Configurações"),
    ],
  },
  "/conta/avatar": {
    titulo: "Meu avatar",
    passos: [
      cabecalho("Meu avatar", "Seu boneco em pixel: aparece no menu e no canteiro da home."),
      {
        titulo: "Prévia",
        texto: "Veja como está ficando. Sortear cria um aleatório, Desfazer volta ao salvo. Não esqueça de Salvar avatar.",
        alvo: { css: '[aria-label="Prévia"]' },
      },
      {
        titulo: "Monte do seu jeito",
        texto: "Escolha função, pele, cabelo, roupa e acessórios. Marque as datas comemorativas para o avatar se vestir no Natal, São João…",
        alvo: { css: "section[aria-label]:not([aria-label='Prévia'])" },
      },
      ajudaNoCanto("Meu avatar"),
    ],
  },
  "/conta/senha": {
    titulo: "Alterar senha",
    passos: [{
      titulo: "Alterar senha",
      texto: "Digite a senha atual e a nova duas vezes (mínimo de 10 caracteres). Depois de trocar, use a nova no próximo login.",
      alvo: { css: "form" },
    }],
  },
  "/gestao/davi-job": {
    titulo: "Davi Job",
    passos: [
      cabecalho("Parkour de gatinhos", "Uma tela de amostragem: prova de que dá para criar qualquer coisa no NordTool."),
      {
        titulo: "Como brincar",
        texto: "O jogo tem o próprio tutorial: toque neste ? para ver cada brinquedo, gato e o minigame Caça ao rato.",
        alvo: { css: '[aria-label="Como brincar"]' },
      },
    ],
  },
};

const ROTAS_EM_CONSTRUCAO = Object.entries(DESCRICAO_DAS_TELAS).filter(([, d]) => d === EM_BREVE).map(([r]) => r);

/** Passo a passo da tela do caminho (ou null quando ela não tem). */
export function tutorialDaTela(caminho: string): Tutorial | null {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho;
  if (TUTORIAIS_DAS_TELAS[limpo]) return TUTORIAIS_DAS_TELAS[limpo];
  return ROTAS_EM_CONSTRUCAO.includes(limpo) ? EM_CONSTRUCAO : null;
}

// ---------------------------------------------------------------- posição do balão

export interface Retangulo { x: number; y: number; largura: number; altura: number }

/**
 * Onde o balão fica: embaixo do alvo, se couber; senão em cima; senão ao lado;
 * e, sem alvo (ou alvo enorme), no meio da tela. Sempre dentro da tela.
 */
export function posicionarBalao(
  alvo: Retangulo | null,
  tela: { largura: number; altura: number },
  balao: { largura: number; altura: number },
  margem = 12,
): { x: number; y: number; lado: "baixo" | "cima" | "direita" | "esquerda" | "centro" } {
  const prender = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  const centro = {
    x: prender((tela.largura - balao.largura) / 2, margem, tela.largura - balao.largura - margem),
    y: prender((tela.altura - balao.altura) / 2, margem, tela.altura - balao.altura - margem),
  };
  if (!alvo) return { ...centro, lado: "centro" };

  const xCentrado = prender(alvo.x + alvo.largura / 2 - balao.largura / 2, margem, tela.largura - balao.largura - margem);
  const abaixo = alvo.y + alvo.altura + margem;
  if (abaixo + balao.altura <= tela.altura - margem) return { x: xCentrado, y: abaixo, lado: "baixo" };
  const acima = alvo.y - margem - balao.altura;
  if (acima >= margem) return { x: xCentrado, y: acima, lado: "cima" };

  const yCentrado = prender(alvo.y + alvo.altura / 2 - balao.altura / 2, margem, tela.altura - balao.altura - margem);
  const direita = alvo.x + alvo.largura + margem;
  if (direita + balao.largura <= tela.largura - margem) return { x: direita, y: yCentrado, lado: "direita" };
  const esquerda = alvo.x - margem - balao.largura;
  if (esquerda >= margem) return { x: esquerda, y: yCentrado, lado: "esquerda" };

  // Alvo que ocupa a tela toda: o balão vai para baixo, por cima dele.
  return { x: centro.x, y: prender(tela.altura - balao.altura - margem, margem, tela.altura), lado: "centro" };
}

// ---------------------------------------------------------------- já viu o tour?

const PREFIXO = "@NordTool:tutorial_visto:";
export const chaveTutorialVisto = (idUsuario: number | string) => `${PREFIXO}${idUsuario}`;

export function jaViuTutorial(storage: Pick<Storage, "getItem"> | undefined, idUsuario: number | string): boolean {
  try {
    return storage?.getItem(chaveTutorialVisto(idUsuario)) === "1";
  } catch {
    return true; // sem armazenamento: não insiste em abrir o tour toda vez
  }
}

export function marcarTutorialVisto(storage: Pick<Storage, "setItem"> | undefined, idUsuario: number | string): void {
  try {
    storage?.setItem(chaveTutorialVisto(idUsuario), "1");
  } catch {
    // modo privado: só não lembra
  }
}
