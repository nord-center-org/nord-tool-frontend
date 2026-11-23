/**
 * Catálogo da Central de Jogos: os 21 títulos, com categoria, jogadores, 2D/3D, regras, controles e modos.
 * Regras e jogabilidade seguem as do gênero de referência; nomes, personagens, arte e sons são próprios do NordTool.
 */

export type Categoria = "Ação" | "Arena" | "Corrida" | "Estratégia" | "Cartas" | "Cooperativo" | "Puzzle" | "Ritmo" | "Aventura";
export type Dimensao = "2D" | "3D";

export interface Jogo {
  id: string;
  nome: string;
  resumo: string;
  categoria: Categoria;
  dimensao: Dimensao;
  minJogadores: number;
  maxJogadores: number;
  /** Fase do plano em que o jogo chega; disponível = já dá para jogar. */
  fase: number;
  disponivel: boolean;
  modos: string[];
  regras: string[];
  controles: string[];
  /** Cores da capa (gerada por código) e o desenho de fundo. */
  cores: [string, string, string];
  motivo: Motivo;
}

export type Motivo = "grade" | "cartas" | "mira" | "estrada" | "pista" | "panela" | "hexagono" | "tanque" | "zumbi" | "masmorra" | "mar"
  | "torre" | "coroa" | "muralha" | "estrelas" | "sol" | "notas" | "blocos" | "bolhas" | "picareta" | "chefao";

const CONTROLES_PADRAO = ["Setas/WASD: mover", "Espaço/Z: ação principal", "X/Shift: ação secundária", "Esc/P: pausa"];

export const JOGOS: Jogo[] = [
  {
    id: "bombas", nome: "Bombas Táticas", resumo: "Arena em grade: exploda caixas, pegue power-ups e seja o último de pé.",
    categoria: "Arena", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 1, disponivel: true,
    modos: ["Sobrevivência", "Times", "Caça às Moedas"],
    regras: [
      "A bomba explode em cruz depois de 2,5 s; a chama para nos pilares e na primeira caixa.",
      "Uma explosão que alcança outra bomba a detona na hora (reação em cadeia).",
      "Caixas podem esconder power-ups: +bomba, +fogo, patins, chute, luva, detonador, escudo, fogo total e caveira (maldição de 10 s).",
      "No último minuto vem a morte súbita: blocos fecham a arena em espiral.",
      "Sobrevivência: o último vivo vence. Times: P1, P3, P5, P7 contra P2, P4, P6, P8. Moedas: quem tiver mais moedas em 2 min (morrer derruba moedas).",
    ],
    controles: ["Setas/WASD: andar", "Espaço/Z/Enter: soltar bomba", "X/Shift: detonar (detonador) ou arremessar a bomba aos pés (luva)", "Andar contra a bomba com o chute a empurra"],
    cores: ["#7c2d12", "#f97316", "#fde047"], motivo: "grade",
  },
  {
    id: "cartas", nome: "Cartas da Virada", resumo: "Descarte por cor ou número, acumule castigos e avise a última carta.",
    categoria: "Cartas", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 5, disponivel: true,
    modos: ["Clássico", "Empilhamento Caótico", "Modo Rápido"],
    regras: ["Descarte uma carta da mesma cor, número ou símbolo; Coringa troca a cor e o +4 só vale sem carta da cor da mesa.", "Sem jogada, compre uma: se servir, pode jogá-la na hora.", "Pular, Inverter e +2/+4 (o próximo compra e perde a vez).", "Ficou com 1 carta? Avise VIRADA! (↑) a tempo ou compre 2.", "Caótico: +2/+4 acumulam, 7 troca a mão com quem tem menos e 0 gira as mãos. Rápido: 5 cartas e 8 s.", "No celular, a sua mão aparece só para você; sozinho, contra 3 bots."],
    controles: ["←/→: escolher carta (ou cor)", "Espaço/Z: jogar", "X: comprar ou passar", "↑: avisar VIRADA!"], cores: ["#1e1b4b", "#e11d48", "#facc15"], motivo: "cartas",
  },
  {
    id: "duelo", nome: "Duelo ao Meio-Dia", resumo: "Reflexo puro: finta, cobertura e o tiro no tempo exato.",
    categoria: "Ação", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 5, disponivel: true, modos: ["Duelo", "Torneio"],
    regras: ["Espere o FOGO!: atirar antes queima a largada e você está fora do duelo.", "Fintas: pássaro, \"FO… FOGUETE!\" e o sino tentam te enganar.", "Vento: segure a seta contra o vento ao atirar; errar faz recarregar.", "Duelo: todos juntos, vence o mais rápido. Torneio: 1 × 1 até a final.", "Câmera lenta no tiro decisivo; sozinho, treino de 5 sinais."],
    controles: ["Espaço/Z: atirar", "←/→: compensar o vento (segure contra o vento)", "Esc/P: pausa"], cores: ["#451a03", "#d97706", "#fef3c7"], motivo: "sol",
  },
  {
    id: "encaixe", nome: "Encaixe Versus", resumo: "Puzzle de queda: combos mandam lixo para os rivais.",
    categoria: "Puzzle", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 5, disponivel: true, modos: ["Versus", "Maratona", "Sprint"],
    regras: ["Complete linhas para limpar; as 7 peças vêm em sacos de 7, iguais para todos.", "Versus: 2 linhas mandam 1 de lixo, 3 mandam 2, 4 mandam 4 (mais combo e seguida); limpar linha cancela o lixo que vinha.", "Sprint: 40 linhas, quem chegar primeiro. Maratona (sozinho): chegue a 50 linhas.", "Topo cheio: fim de jogo."],
    controles: ["←/→: mover · ↓: descer · ↑: cair de vez", "Espaço/Z: girar", "X/Shift: guardar peça", "Esc/P: pausa"], cores: ["#082f49", "#06b6d4", "#a3e635"], motivo: "blocos",
  },
  {
    id: "naval", nome: "Guerra Naval", resumo: "Esconda a frota, use o radar e afunde os navios rivais.",
    categoria: "Estratégia", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 5, disponivel: true, modos: ["Clássico", "Salva", "Especiais"],
    regras: ["Cada frota tem 5 navios (5, 4, 3, 3 e 2) escondidos numa grade 10 × 10.", "Na sua vez, mire numa frota rival e atire: água, acerto ou afundou (o navio afundado é anunciado).", "Clássico: um tiro por vez. Salva: um tiro por navio seu de pé.", "Especiais: sonar (conta partes de navio num 3 × 3) e bombardeio em cruz, uma vez cada.", "Perdeu a frota inteira, está fora; vence a última frota. Sozinho: Caçada em até 60 tiros."],
    controles: ["Setas: mirar (na borda, passa para a próxima frota)", "Espaço/Z: atirar", "X: trocar arma (Especiais) ou frota"], cores: ["#0c4a6e", "#0ea5e9", "#e0f2fe"], motivo: "mar",
  },
  {
    id: "horda", nome: "Horda Zumbi", resumo: "Visão de cima: lanterna, barricadas e ondas cada vez maiores.",
    categoria: "Cooperativo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: true, modos: ["Ondas", "Resgate", "Chefe"],
    regras: ["Todos juntos contra ondas de zumbis cada vez maiores; a casa tem 4 portas com barricadas.", "Zumbis quebram as tábuas; segure B na porta para repor (cada tábua dá dinheiro).", "Abates dão dinheiro: compre arma, vida e dano nas bancadas da casa.", "Caiu? Um aliado segura B perto por 2 s para levantar; sem ajuda em 30 s, volta na próxima onda.", "Ondas: até a 10ª (sozinho, 5ª). Resgate: leve 3 sobreviventes ao centro. Chefão: 3 ondas e o gigante."],
    controles: ["Setas: andar e mirar", "Espaço/Z: atirar (com mira assistida)", "X segurado: consertar, levantar aliado, comprar"], cores: ["#052e16", "#16a34a", "#d9f99d"], motivo: "zumbi",
  },
  {
    id: "masmorra", nome: "Fuga da Masmorra", resumo: "Roguelite rápido: salas aleatórias, chaves, armadilhas e chefe.",
    categoria: "Aventura", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: true, modos: ["Fuga", "Desafio Diário"],
    regras: ["Masmorra sorteada: salas ligadas por portas, do início até o guardião.", "Entrou em sala com monstros, as portas trancam até todos caírem.", "A sala do guardião só abre com a chave, que fica fora do caminho principal.", "Baús dão melhorias (vida, dano, velocidade); espinhos sobem e descem.", "Quem zera vira fantasma e volta quando a sala for limpa; todos fantasmas = fim.", "Desafio Diário: a mesma masmorra para todo mundo no dia."],
    controles: ["Setas: andar", "Espaço/Z: espada", "X: esquiva"], cores: ["#1c1917", "#a8a29e", "#f59e0b"], motivo: "masmorra",
  },
  {
    id: "coroa", nome: "Coroa Maldita", resumo: "Pique-pega vertical: fique com a coroa até o tempo acabar.",
    categoria: "Arena", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: true, modos: ["Coroa", "Pega-Pega"],
    regras: ["Plataformas: pulo com pulo duplo, investida e pisão (cair na cabeça atordoa).", "Coroa: encoste em quem está com ela para roubar; quem pega fica protegido 1 s.", "Com a coroa se anda um pouco mais devagar; vence quem somar mais tempo em 90 s.", "Pega-Pega: passe a bomba encostando; a cada 20 s ela explode e quem estiver com ela sai.", "Sozinho: pegue 20 moedas em 60 s."],
    controles: ["←/→: andar", "Espaço/Z ou ↑: pular", "↓: descer da plataforma", "X: investida"], cores: ["#4a044e", "#c026d3", "#fde68a"], motivo: "coroa",
  },
  {
    id: "espacial", nome: "Corrida Espacial", resumo: "Inércia, propulsores, lasers e a gravidade dos planetas.",
    categoria: "Corrida", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: true, modos: ["Corrida", "Asteroides", "Coleta"],
    regras: ["Naves com inércia: girar, acelerar e frear; o espaço dá a volta nas bordas.", "Planetas puxam pela gravidade; bater num planeta explode a nave (volta em 2 s).", "Laser atordoa outra nave por 1 s e quebra asteroides.", "Corrida: anéis na ordem, 2 voltas. Asteroides: mais pontos em 90 s. Coleta: mais cristais em 90 s.", "Sozinho: contra o relógio, meta de pontos ou de cristais."],
    controles: ["←/→: girar", "Espaço/Z ou ↑: acelerar", "↓: frear", "X: laser"], cores: ["#020617", "#6366f1", "#f0abfc"], motivo: "estrelas",
  },
  {
    id: "torres", nome: "Torres em Colapso", resumo: "Construa e derrube: balística com vento e materiais.",
    categoria: "Estratégia", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: true, modos: ["Duelo", "Desafio"],
    regras: ["Cada um tem uma torre de blocos (madeira, pedra e aço) com o rei no topo.", "Na sua vez: ajuste ângulo e força e atire; o vento muda a cada vez.", "A explosão enfraquece os blocos; bloco sem apoio cai e a torre desaba.", "Rei atingido (ou esmagado por bloco) está fora; o último rei de pé vence.", "Bomba pesada: raio maior, uma por partida. Sozinho: 5 alvos em 12 tiros."],
    controles: ["←/→: ângulo", "↑/↓: força", "Espaço/Z: atirar", "X: bomba pesada"], cores: ["#422006", "#ca8a04", "#fef9c3"], motivo: "torre",
  },
  {
    id: "defesa", nome: "Defesa de Base", resumo: "Engenheiros coletam, constroem torres e atiram juntos.",
    categoria: "Cooperativo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: true, modos: ["Cooperativo", "Infinito"],
    regras: ["Colete recursos no mapa.", "Erga torres nos pontos livres.", "Atire manualmente nas ondas."],
    controles: CONTROLES_PADRAO, cores: ["#172554", "#3b82f6", "#bfdbfe"], motivo: "muralha",
  },
  {
    id: "pescaria", nome: "Pescaria & Submarino", resumo: "Oxigênio, linha, arpão, criaturas e tesouros.",
    categoria: "Aventura", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: true, modos: ["Pescaria", "Mergulho"],
    regras: ["Controle o oxigênio.", "Física de linha e arpão.", "Tesouros no fundo."], controles: CONTROLES_PADRAO,
    cores: ["#083344", "#14b8a6", "#ccfbf1"], motivo: "bolhas",
  },
  {
    id: "mineracao", nome: "Corrida do Ouro", resumo: "Cave, use dinamite, cuide da carga e entregue no carrinho.",
    categoria: "Estratégia", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: true, modos: ["Corrida", "Sobrevivência"],
    regras: ["Picareta e dinamite.", "Carga pesada deixa lento.", "Desmoronamentos."], controles: CONTROLES_PADRAO,
    cores: ["#292524", "#eab308", "#fef08a"], motivo: "picareta",
  },
  {
    id: "kart", nome: "Kart Turbo & Balões", resumo: "Pistas 3D com drift em faíscas, itens e arena de balões.",
    categoria: "Corrida", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: true, modos: ["Grande Prêmio", "Arena de Balões"],
    regras: ["Drift carrega turbo em níveis.", "Itens: míssil, escudo, óleo, turbo.", "Balões: perde quem estourar todos."],
    controles: CONTROLES_PADRAO, cores: ["#1e3a8a", "#ef4444", "#fbbf24"], motivo: "pista",
  },
  {
    id: "tanques", nome: "Tanques de Aço", resumo: "Arena 3D: muros destrutíveis, ricochete e minas.",
    categoria: "Arena", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: true, modos: ["Mata-Mata", "Times"],
    regras: ["Torre gira separada do chassi.", "Tiros ricocheteiam.", "Minas e muros destrutíveis."], controles: CONTROLES_PADRAO,
    cores: ["#1a2e05", "#65a30d", "#ecfccb"], motivo: "tanque",
  },
  {
    id: "caos", nome: "Caos Urbano", resumo: "Cidade 3D procedural: fuga, entregas, derby e corrida de rua.",
    categoria: "Corrida", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: true,
    modos: ["Fuga Policial", "Entrega Expressa", "Derby de Demolição", "Corrida de Rua"],
    regras: ["Drift com marcas e fumaça.", "Nitro.", "Níveis de procurado.", "Física de colisão."], controles: CONTROLES_PADRAO,
    cores: ["#18181b", "#f43f5e", "#22d3ee"], motivo: "estrada",
  },
  {
    id: "hexagonos", nome: "Sumô dos Hexágonos", resumo: "Pisos que racham e caem: empurre os rivais com o dash.",
    categoria: "Arena", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 4, disponivel: true, modos: ["Queda", "Sumô"],
    regras: ["O piso pisado brilha, racha e cai.", "Três camadas: quem cai vai para a de baixo; caiu da última, está fora.", "Dash empurra (com recarga) e o pulo atravessa buracos.", "Sumô: a borda desmorona com o tempo; empurre os rivais para fora.", "Último em pé vence; sozinho, sobreviva 60 s."], controles: ["Setas/WASD: andar", "Espaço/Z: dash", "X/Shift: pular", "Esc/P: pausa"],
    cores: ["#312e81", "#a855f7", "#f9a8d4"], motivo: "hexagono",
  },
  {
    id: "fps", nome: "Arena Voxel", resumo: "Tiro em primeira pessoa rápido: slide, bunny hop e quatro armas.",
    categoria: "Ação", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: true,
    modos: ["Mata-Mata", "Captura de Bandeira", "Rei da Colina", "Contra Bots"],
    regras: ["Rifle, escopeta, sniper e pistola.", "Slide e bunny hop.", "Recuo e recarga."], controles: ["↑/↓: andar · ←/→: girar a visão", "Espaço/Z: atirar (mira assistida)", "X/Shift: pular; segure ao cair para deslizar", "Esc/P: pausa"],
    cores: ["#0f172a", "#38bdf8", "#f472b6"], motivo: "mira",
  },
  {
    id: "cozinha", nome: "Cozinha Caótica", resumo: "Corte, cozinhe, lave pratos e entregue no tempo, sem incêndio.",
    categoria: "Cooperativo", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: true, modos: ["Cooperativo", "Duelo de Cozinhas", "Desafio Solo"],
    regras: ["Pedidos com tempo e combo.", "Fogão sem atenção pega fogo.", "Pratos voltam sujos para lavar."], controles: ["Setas/WASD: andar", "Espaço/Z: pegar, soltar e juntar", "X/Shift: usar (cortar, lavar, apagar)", "Esc/P: pausa"],
    cores: ["#450a0a", "#f97316", "#fef3c7"], motivo: "panela",
  },
  {
    id: "ritmo", nome: "Batalha de Banda", resumo: "Notas no tempo, combos e duelo que manda obstáculos.",
    categoria: "Ritmo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: true, modos: ["Solo", "Duelo", "Banda"],
    regras: ["Acerte as notas no tempo.", "Combos multiplicam.", "BPM ajustável.", "Duelo envia obstáculos."], controles: ["←/↓/↑/→: as 4 trilhas", "X/Shift: Show (pontos em dobro)", "Espaço/Z: obstáculo no Duelo", "Esc/P: pausa"],
    cores: ["#3b0764", "#ec4899", "#22d3ee"], motivo: "notas",
  },
  {
    id: "chefao", nome: "Chefão Colossal", resumo: "Chefe gigante em várias fases, de 1 a 8 jogadores.",
    categoria: "Cooperativo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: false, modos: ["Cooperativo", "Competitivo", "Boss Rush"],
    regras: ["Ataques telegrafados.", "Escudos quebráveis.", "Fases com padrões novos."], controles: CONTROLES_PADRAO,
    cores: ["#450a0a", "#dc2626", "#fca5a5"], motivo: "chefao",
  },
];

export interface FiltrosCentral { busca: string; categoria: string; jogadores: number | null; dimensao: "" | Dimensao; soFavoritos: boolean; soDisponiveis: boolean }

export const FILTROS_CENTRAL: FiltrosCentral = { busca: "", categoria: "", jogadores: null, dimensao: "", soFavoritos: false, soDisponiveis: false };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarJogos(lista: Jogo[], f: FiltrosCentral, favoritos: Set<string>): Jogo[] {
  const t = semAcento(f.busca.trim());
  return lista
    .filter(j => !t || semAcento(`${j.nome} ${j.resumo} ${j.categoria} ${j.modos.join(" ")}`).includes(t))
    .filter(j => !f.categoria || j.categoria === f.categoria)
    .filter(j => f.jogadores === null || (j.minJogadores <= f.jogadores && j.maxJogadores >= f.jogadores))
    .filter(j => !f.dimensao || j.dimensao === f.dimensao)
    .filter(j => !f.soFavoritos || favoritos.has(j.id))
    .filter(j => !f.soDisponiveis || j.disponivel)
    // Disponíveis primeiro, depois favoritos, depois pela fase.
    .sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || Number(favoritos.has(b.id)) - Number(favoritos.has(a.id)) || a.fase - b.fase || a.nome.localeCompare(b.nome, "pt-BR"));
}

export const CATEGORIAS = [...new Set(JOGOS.map(j => j.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR"));
