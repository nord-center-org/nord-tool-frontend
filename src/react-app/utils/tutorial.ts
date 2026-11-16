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
  "/sac": "Peça mudanças no sistema para os administradores: escreva, tire prints de qualquer tela, marque com seta e círculo e acompanhe a resposta.",
  "/entregas": "A agenda de vistorias e entregas da semana, separada por dia.",
  "/apartamentos": "A base de todos os apartamentos: status, datas, filtros, planilhas e ações em massa.",
  "/dashboard": "Os números das entregas: liberadas, vistoriadas, aprovadas e reprovadas por período.",
  "/mapeamentos/conferencias": "Contagens de campo e quantitativos (projeto × medido × solicitado).",
  "/mapeamentos/pendencias": EM_BREVE,
  "/mapeamentos/bloco-notas": "Cadernos à mão, planilhas como no Google Sheets e documentos como no Word, num lugar só; abre PDF, Word e Excel.",
  "/mapeamentos/cubicagem": "Volume de concreto (m³) das peças de um projeto em PDF: busque a peça pelo código, meça no desenho e veja os totais por tipo, com descontos e perda.",
  "/mapeamentos/placas": "Placas de aviso da obra a partir de modelos (fundo com marca d'água, logo, texto e rodapé), em PNG ou PDF para imprimir.",
  "/mapeamentos/relatorio-fotografico": "Fotos organizadas por item, com edição e PDF pronto no padrão da obra.",
  "/organizacional/rte": EM_BREVE,
  "/organizacional/diario-obras": EM_BREVE,
  "/organizacional/escadinha": "O prédio 3D da torre montado a partir da prancha: gire, toque num pavimento para ver a planta 2D e acompanhe os ciclos da escadinha.",
  "/organizacional/fluxograma": EM_BREVE,
  "/organizacional/controle-chaves": "Quem retirou cada chave ou ferramenta, o que está em campo e o histórico.",
  "/treinamentos": EM_BREVE,
  "/organizacional/fvs": EM_BREVE,
  "/organizacional/projetos": EM_BREVE,
  "/organizacional/cronograma": "As demandas da semana em kanban, lista e rotina, com compartilhamento.",
  "/organizacional/medicoes": "Os boletins de medição dos contratos, com status e valores.",
  "/gestao/financeiro": "Quanto sobra no mês, extrato, gráficos e investimentos.",
  "/gestao/treinos": "Fichas de treino, o treino do dia e o histórico do que você fez.",
  "/gestao/repertorio": "Envie uma música: tom, BPM, acordes e o baixo reconhecidos; mude o tom e o andamento, separe as faixas e toque junto com a cifra rolando e o instrumento ao lado (ou escreva a cifra tocando). Em Criar, monte músicas faixa por faixa; o instrumento online toca na tela.",
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
      titulo: "Claro ou escuro",
      texto: "No sol/lua do canto você troca o tema: só desta tela ou de todas. As escolhas ficam em Configurações → Aparência.",
      alvo: { css: '[aria-label$="Trocar tema"]' },
      menu: "fechar",
    },
    {
      titulo: "Ajuda em cada tela",
      texto: "Em qualquer aba, toque neste ponto de interrogação para ver o passo a passo detalhado dela. Aqui no início ele repete este tour.",
      alvo: { css: '[data-tutorial="ajuda"]' },
      menu: "fechar",
    },
    {
      titulo: "Falar com o SAC",
      texto: "Este botãozinho no canto fica em todas as telas: toque nele para abrir um chamado ali mesmo (a tela em que você está vai junto), com quantos prints quiser (até 6), desta tela ou de outra. O número vermelho avisa quando responderam.",
      alvo: { css: '[data-tutorial="sac-flutuante"]' },
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
  "/mapeamentos/bloco-notas": {
    titulo: "Bloco de notas",
    passos: [
      {
        titulo: "Tudo num lugar só",
        texto: "O bloco de notas junta cadernos à mão, planilhas e documentos. Em “Criar” você começa um arquivo novo; embaixo ficam os seus. Só você vê o que é seu, e tudo é salvo sozinho.",
        alvo: { css: "h2", texto: "Criar" },
      },
      {
        titulo: "Caderno",
        texto: "Para escrever à mão (caneta que sente a pressão, marca-texto, borracha, formas, texto, imagens e laço) e anotar por cima de PDFs (o botão de PDF fica na barra de ferramentas). Escolha o papel: pautado, quadriculado, pontilhado ou em branco. Dentro dele, a rodinha do mouse dá zoom onde está o cursor (até 1600%, para ler detalhes de projeto; Shift + rodinha vai para os lados) e arrastar com a rodinha apertada move a folha. No tablet, como no Xodo: pinça dá zoom no ponto entre os dedos, dois dedos arrastam e um dedo arrasta com a Mão, com \"Só caneta\" ou fora da folha. O texto também tem zoom (botões, Ctrl + rodinha e pinça).",
        alvo: { css: "button", texto: "Escreva à mão" },
      },
      {
        titulo: "Planilha",
        texto: "Igual ao Google Sheets em português: várias páginas (abas embaixo), mais de 200 fórmulas com o nome em português (=SOMA, =SE, =PROCV, =PROCX, =CONT.SE, =UNIRTEXTO…), com ; entre os argumentos e vírgula nos números, datas dd/mm/aaaa, negrito, cores, bordas, mesclar, congelar linhas, filtro, classificar, comentários e links. No fim, “Baixar Excel” gera o .xlsx.",
        alvo: { css: "button", texto: "como no Google Sheets" },
      },
      {
        titulo: "Documento",
        texto: "Texto como no Word: títulos, negrito, listas, cores, alinhamento, tabelas e imagens, em páginas A4 ou contínuo. “Baixar PDF” gera o arquivo pronto.",
        alvo: { css: "button", texto: "como no Word" },
      },
      {
        titulo: "Abrir arquivo",
        texto: "Excel ou CSV abre como planilha; Word (.docx) abre como documento; PDF, imagem e texto viram um caderno para anotar por cima.",
        alvo: { css: "button", texto: "PDF, imagem, Word" },
      },
      {
        titulo: "Converter arquivos",
        texto: "Como no ILovePDF: juntar, dividir e organizar PDFs, imagem/Word/Excel para PDF, PDF para imagem, comprimir, numerar páginas, marca d'água e trocar o formato de imagens. Tudo acontece no seu aparelho; o PDF pronto pode virar um caderno.",
        alvo: { css: "button", texto: "Juntar, dividir, comprimir" },
      },
      {
        titulo: "Perguntar à Lugia",
        texto: "Abre o chat dos cadernos: pergunte o que você anotou (“onde escrevi da concretagem?”), mande foto de um quadro ou de uma nota e peça para virar planilha, documento ou página nova. A Lugia mostra o que vai fazer e só faz quando você toca em “Fazer”. Ela lê as caixas de texto, os documentos e as planilhas; o escrito à mão ainda não.",
        alvo: { css: "button", texto: "Perguntar à Lugia" },
      },
      {
        titulo: "Editar imagem",
        texto: "Um editor como o Paint.net: camadas, pincel, borracha, formas, texto, balde de tinta, conta-gotas, seleção para recortar, varinha mágica (toque no fundo e em Apagar para tirar o fundo; baixe em PNG), girar, espelhar, redimensionar e ajustes (brilho, contraste, saturação, desfoque, preto e branco…). Solte a imagem no botão ou cole com Ctrl+V. Fotos do relatório e imagens das placas também abrem nele.",
        alvo: { css: "button", texto: "solte a imagem aqui" },
      },
      {
        titulo: "Meus arquivos",
        texto: "Tudo o que você tem, do mais recente para o mais antigo. Filtre por cadernos, planilhas ou documentos e busque pelo nome. O lápis renomeia e a lixeira exclui.",
        alvo: { css: "h2", texto: "Meus arquivos" },
      },
      {
        titulo: "Fórmulas na planilha",
        texto: "Comece com “=”. Dá para escrever como no Sheets em português: =SOMA(A1:A10), =MÉDIA(B2:B9), =SE(C2>100;\"alto\";\"ok\"), =PROCV(A2;D:E;2;0). Na célula a fórmula aparece com o nome em inglês (SUM, AVERAGE, IF…), que também vale digitar.",
      },
      {
        titulo: "Atalhos da planilha",
        texto: "Ctrl+C / Ctrl+V copiam e colam (também do Excel e do Sheets), Ctrl+Z desfaz, Ctrl+B negrito. Arraste o quadradinho do canto da célula para repetir ou continuar uma sequência. Botão direito: inserir e excluir linhas e colunas, classificar e filtrar. Em “Mover” (ou Alt+Shift+setas) a linha ou coluna selecionada troca de lugar com a vizinha; dois cliques na borda do cabeçalho ajustam a largura da coluna ao texto; Shift + rodinha do mouse rola para os lados.",
      },
      {
        titulo: "Dentro do caderno",
        texto: "Caneta, marca-texto, borracha de traço ou de parte, formas, texto, imagem e o laço para selecionar, mover e redimensionar. “Só caneta” deixa o dedo rolar a página; tocar de novo na ferramenta solta o lápis. O botão de girar vira a página.",
      },
      {
        titulo: "Texto no caderno",
        texto: "Na caixa de texto, a barra de cima formata o que estiver selecionado e a alça da direita muda a largura. Em “Texto” fica o documento do caderno; “Lado a lado” mostra o documento e o desenho juntos.",
      },
    ],
  },
  "/mapeamentos/cubicagem": {
    titulo: "Cubicagem",
    passos: [
      {
        titulo: "Suas cubicagens",
        texto: "Crie uma cubicagem por projeto ou pavimento. Só você vê as suas, e tudo é salvo sozinho.",
        alvo: { css: "button", texto: "Nova cubicagem" },
      },
      {
        titulo: "Busque a peça pelo código",
        texto: "Abra o PDF do projeto (ele fica só no seu aparelho) e escreva o código: V12, P5, L3… A peça é achada no desenho com a seção (14x50, Ø40, h=12); confira e toque em “Adicionar”.",
      },
      {
        titulo: "Comprimento e área",
        texto: "Digite o comprimento ou a área, ou toque na régua ao lado do campo e marque no desenho. A escala da folha é lida do PDF (ESC. 1:50); se não tiver, informe ou calibre por uma cota conhecida.",
      },
      {
        titulo: "Volume, descontos e perda",
        texto: "Cada peça mostra o volume em m³. “Descontar” abate trechos (ex.: viga dentro do pilar). Os totais saem por tipo de peça, com a perda em % por cima, e “Baixar planilha” gera o Excel.",
      },
    ],
  },
  "/mapeamentos/placas": {
    titulo: "Placas",
    passos: [
      {
        titulo: "Placas da obra",
        texto: "Cada placa sai de um modelo: escolha o modelo, escreva a obra e uma linha por item e baixe em PNG ou PDF A4 para imprimir.",
        alvo: { css: "button", texto: "Nova placa" },
      },
      {
        titulo: "Modelos",
        texto: "Quem é admin de Placas monta os modelos: foto de fundo com marca d'água, logo, caixa “OBRA:”, quadro de texto (fonte, tamanho, alinhamento) e rodapé.",
        alvo: { css: "[role=tab]", texto: "Modelos" },
      },
      {
        titulo: "Imagens na folha",
        texto: "Na placa e no modelo, “Adicionar imagem” põe qualquer imagem na folha. Na prévia, arraste para mover (aparecem linhas-guia no centro), puxe os cantos para redimensionar, gire pela bolinha de baixo e use a barra para mudar a ordem, pôr atrás do painel, duplicar ou apagar.",
      },
    ],
  },
  "/sac": {
    titulo: "SAC",
    passos: [
      {
        titulo: "Peça mudanças no sistema",
        texto: "Aqui você abre um chamado para os administradores: escreva o que precisa e como deveria ficar.",
        alvo: { css: "#sac-titulo" },
      },
      {
        titulo: "Mostre com um print",
        texto: "“Tirar print de uma tela” deixa você ir até a tela, marcar a área e voltar com o print; toque no print para marcar com seta, círculo ou rabisco.",
        alvo: { css: "button", texto: "Tirar print" },
      },
      {
        titulo: "Acompanhe",
        texto: "Em Meus chamados ficam os que estão na esteira (aberto ou em andamento), com a resposta dos administradores; quando um é resolvido ou recusado, ele sai da esteira e vai para \"Concluídos\". Quando alguém responde, o avatar dele aparece no Início avisando. Marque chamados e exporte um PDF caprichado: o texto de cada chamado à esquerda e os prints ao lado.",
        alvo: { css: "[role=tab]", texto: "Meus chamados" },
      },
    ],
  },
  "/organizacional/escadinha": {
    titulo: "Escadinha",
    passos: [
      {
        titulo: "Torres da obra",
        texto: "Cada aba é uma torre. Use + Torre para adicionar outra; o lápis renomeia. Tudo fica salvo para a equipe toda.",
        alvo: { css: "[role=tablist]" },
      },
      {
        titulo: "Prédio 3D",
        texto: "O croqui da torre gira como apresentação. Arraste para girar, botão direito (ou Shift) para mover, a roda aproxima onde o mouse aponta e o duplo clique gira em volta de um ponto; W A S D andam. Toque no número do pavimento para ele sair como fatia: cada atividade feita na escadinha aparece no 3D do pavimento e do apartamento.",
        alvo: { css: "section", texto: "pavimentos" },
      },
      {
        titulo: "Apartamentos e lados A/B",
        texto: "Na planta 2D, toque num apartamento para ver o nome e trocar o lado. Desenhe apartamentos, a divisão dos lados (o lado A é o da junta) ou inverta A/B.",
        alvo: { css: "section", texto: "pavimentos" },
      },
      {
        titulo: "Anexar o projeto",
        texto: "Envie o PDF da planta chave: o NordTool acha o contorno da torre, os pavimentos, os apartamentos e a junta.",
        alvo: { css: "button", texto: "Anexar projeto" },
      },
      {
        titulo: "Ciclos e atividades",
        texto: "Toque no status para mudar. No lápis do painel, edite nomes, datas e atividades de cada ciclo; em Modelo, defina as atividades padrão da obra.",
        alvo: { css: "aside" },
      },
    ],
  },
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
        texto: "Abra um relatório para continuar. Toque numa foto para ampliar, cortar, girar e riscar (setas, círculos, quadrados e cores). Cada item começa numa página nova do PDF. Para trocar o modelo depois, toque no nome do modelo (com o lápis) no alto do relatório: nada do que já foi preenchido se perde.",
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
        texto: "Crie uma demanda com categoria, prazo e observação. Dá para compartilhar com outras pessoas da obra. Uma demanda pode durar vários dias: preencha “Começa em” e “Termina em”, ou na Rotina toque em “Selecionar dias” e depois no primeiro e no último dia no calendário.",
        alvo: { css: "button", texto: "Nova demanda" },
      },
      {
        titulo: "Criar pelo chat",
        texto: "Escreva do seu jeito e a demanda sai montada na hora, sem IA: “Reunião de obra toda segunda e quarta às 9h”, “Ligar para o fornecedor amanhã às 14h”, “Pagar a conta até dia 15”, “Férias de 15 a 20/12”. Uma por linha; detalhes entre parênteses e #tag. Depois é só Criar, Revisar ou escrever um ajuste (“muda para quinta às 10h”).",
        alvo: { css: "button", texto: "Criar pelo chat" },
      },
      {
        titulo: "O kanban",
        texto: "Arraste os cartões entre as colunas para mudar o status. Clique num cartão para editar. Os de outra pessoa aparecem com cadeado.",
        alvo: { css: "section" },
      },
      {
        titulo: "Exportar imagem",
        texto: "Na Lista e na Rotina (semana ou mês), Exportar imagem monta uma imagem caprichada com as demandas filtradas e as observações, pronta para baixar ou mandar no WhatsApp. Os filtros que você deixa ficam guardados para a próxima vez.",
        alvo: { css: "button", texto: "Exportar imagem" },
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
  "/gestao/repertorio": {
    titulo: "Repertório",
    passos: [
      cabecalho("Repertório", "As músicas de todos do NordTool, para tocar junto."),
      {
        titulo: "Enviar uma música",
        texto: "Escolha ou arraste um MP3, WAV, M4A, OGG ou FLAC. Ao abrir, reconheço o tom, o BPM, os acordes e as notas do baixo. A música vai para o NordTool (até 15 MB cada) e abre em qualquer aparelho, com a cifra e os ajustes; a nuvem verde mostra o que já está lá. A aba é aberta a todos: qualquer pessoa toca e edita as músicas e as criações, cada uma mostra quem criou (e quem editou por último) e só quem criou exclui.",
        alvo: { css: "button", texto: "Enviar uma música" },
      },
      {
        titulo: "No player",
        texto: "Mude o tom (− e +) e o andamento sem um mexer no outro; em \"Separar faixas\" (no ícone de ajustes) saem voz, baixo, bateria e outros, com volume, mudo e solo. Escolha o instrumento: as notas descem com o nome (C, G, F#… ou Dó, Sol, Fá#…) e a casa, e acendem no braço (ou no teclado) na hora de tocar; a próxima já aparece marcada. Em \"Todas as notas\", o braço mostra todas em cinza e só a que toca muda de cor. No baixo e no violão, \"Mapa do braço\" mostra o braço em pé com todas as notas coloridas pela letra (C verde, D vermelho, E amarelo…), e a que toca acende com um anel. \"Sintetizador\" toca essas notas com som do instrumento escolhido junto com a música (no tom e no andamento escolhidos), com volume próprio.",
      },
      {
        titulo: "Letra e cifra",
        texto: "Cole a cifra como no Cifra Club: a linha atual fica em destaque e a letra rola sozinha. Se a hora de alguma linha não bater, use \"Marcar linhas\" e toque Enter quando cada uma começar. Em \"Mostrar\", escolha ver a cifra e o instrumento juntos, só a cifra ou só o instrumento.",
      },
      {
        titulo: "Linha do tempo dos acordes",
        texto: "Em \"Linha do tempo\", cada acorde da cifra vira um bloco na hora em que entra, com a forma de onda da música e a letra embaixo. Arraste um acorde: os que vêm depois vão junto (ou escolha \"Só este\"). Clique num acorde para ouvir e ir até ele; com a música tocando, \"Pôr aqui\" (Enter) leva o escolhido para aquele ponto e já passa para o próximo. ←/→ ajustam o escolhido; \"Automático\" volta às horas das linhas. O instrumento e a letra seguem essas horas.",
      },
      {
        titulo: "Ajustes",
        texto: "O ícone de ajustes, no canto de cima, guarda as opções menos usadas: ver as notas como C, D, E ou Dó, Ré, Mi, com sustenido (C#, o padrão) ou bemol (Db); o que mostrar; o tamanho da letra, o tom da cifra, rolar sozinha e marcar linhas; se o instrumento segue a cifra ou o áudio, todas as notas, a queda e o volume e o timbre do sintetizador; separar faixas e refazer a análise. Esc ou um clique fora fecha.",
        alvo: { css: '[aria-label="Ajustes"]' },
      },
      {
        titulo: "Escrever a cifra",
        texto: "Em \"Escrever cifra\", cole a letra ou toque em \"Identificar letra\" e depois em \"Escrever os acordes\". A letra fica numa área grande e os acordes em pads embaixo, como na aba Criar: arraste um pad (ou um acorde já posto) e solte em cima da sílaba — uma marca mostra onde ele vai cair. Também dá para clicar na sílaba e tocar no pad (teclas 1 a 8). O tempo de cada linha eu acho sozinho, e a cifra rola com a música. Escolhendo uma linha: \"Ouvir\" toca só ela e \"Cifra da linha\" escreve os acordes daquele trecho.",
      },
      {
        titulo: "Instrumento online",
        texto: "Toque baixo, teclado, violão, sintetizador ou bateria na tela (várias notas de uma vez) ou pelo teclado do computador: A S D F… são as teclas brancas, W E T Y U as pretas, Z/X mudam a oitava e Shift segurado sustenta; na bateria, A é o bumbo e S a caixa. Escolha o timbre (baixo slap, piano, órgão, guitarra distorcida, pad…), toque no braço do baixo ou do violão e, em \"Mais ferramentas\", transponha, destaque uma escala, toque um acorde inteiro com uma tecla e ajuste a força. Tem metrônomo.",
        alvo: { css: "button", texto: "Instrumento online" },
      },
      {
        titulo: "Ouvir os acordes e as notas",
        texto: "Clique no nome de um acorde na cifra para ouvir como o instrumento escolhido toca e ver as notas acesas no braço ou no teclado. Clicar numa nota do braço, do mapa do braço ou do teclado também toca o som dela. \"Instrumento online\", na barra de cima, abre o instrumento para tocar junto com a música, e ao lado do tempo fica o volume da música (o alto-falante tira o som). Quando algo está carregando (análise, separar faixas, identificar letra), aparece um aviso no canto com \"Cancelar\" e a tela continua livre.",
      },
      {
        titulo: "Compartilhar a cifra",
        texto: "No player, \"Compartilhar\" manda a cifra (no tom que você está vendo, sem o áudio) para pessoas do NordTool, com um recado se quiser, e gera uma imagem bonita da cifra para baixar ou mandar pelo celular. O que mandam para você aparece na aba \"Recebidas\": dá para mudar o tom, baixar a imagem e pôr a cifra numa música sua.",
        alvo: { css: '[role="tab"]', texto: "Recebidas" },
      },
      {
        titulo: "Criar",
        texto: "Monte uma música faixa por faixa: escolha o BPM e os compassos, adicione bateria, baixo, teclado, violão ou sintetizador e escreva as notas na grade (no modo \"Pôr notas\", um clique marca um quadradinho e arrastar estica; no modo \"Selecionar\", arraste um retângulo para copiar, colar em qualquer faixa, duplicar, apagar ou mover com as setas), ou toque em \"Gravar\" e toque o instrumento com o metrônomo (um compasso de contagem antes). Cada faixa tem volume, mudo e solo; \"Dobrar\" repete a música, \"WAV\" baixa o áudio e \"Mandar para Músicas\" abre no player.",
        alvo: { css: '[role="tab"]', texto: "Criar" },
      },
      ajudaNoCanto("Repertório"),
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
        texto: "Edite seu avatar, troque o e-mail de login ou a senha, ou saia da conta.",
        alvo: { css: '[aria-labelledby="config-conta"]' },
      },
      {
        titulo: "Aparência",
        texto: "Escolha o tema claro, escuro ou igual ao do aparelho para todas as telas, e veja quais telas têm tema próprio.",
        alvo: { css: '[aria-labelledby="config-aparencia"]' },
      },
      {
        titulo: "Administração",
        texto: "Obras e fases cadastra as obras; Equipe e cargos monta a hierarquia; Acessos aprova cadastros novos (escolhendo a obra e as fases) e libera o que cada pessoa pode ver. Lá você também troca o e-mail de alguém e reseta a senha de quem esqueceu.",
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
  "/conta/email": {
    titulo: "Alterar e-mail",
    passos: [{
      titulo: "Alterar e-mail",
      texto: "Digite o e-mail novo e a sua senha atual para confirmar. Depois da troca, você entra com o e-mail novo.",
      alvo: { css: "form" },
    }],
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
