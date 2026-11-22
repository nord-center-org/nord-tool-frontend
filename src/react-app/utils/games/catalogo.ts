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
    categoria: "Cartas", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 5, disponivel: false,
    modos: ["Clássico", "Empilhamento Caótico", "Modo Rápido"],
    regras: ["Jogue uma carta da mesma cor, número ou símbolo.", "+2 e +4 acumulam no modo Empilhamento.", "Bloqueio, Inverter, Troca de Mãos e Coringa.", "Esqueceu de avisar a última carta? Compra 2.", "Sozinho, joga contra bots que completam a mesa."],
    controles: ["Toque/Setas: escolher carta", "Espaço: jogar", "X: avisar última carta"], cores: ["#1e1b4b", "#e11d48", "#facc15"], motivo: "cartas",
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
    categoria: "Cooperativo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: false, modos: ["Ondas", "Resgate", "Chefe"],
    regras: ["Sobreviva às ondas.", "Compre melhorias entre ondas.", "Barricadas seguram a horda.", "Resgate aliados caídos."],
    controles: CONTROLES_PADRAO, cores: ["#052e16", "#16a34a", "#d9f99d"], motivo: "zumbi",
  },
  {
    id: "masmorra", nome: "Fuga da Masmorra", resumo: "Roguelite rápido: salas aleatórias, chaves, armadilhas e chefe.",
    categoria: "Aventura", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: false, modos: ["Fuga", "Desafio Diário"],
    regras: ["Salas geradas a cada partida.", "Chaves abrem portas e baús.", "Armadilhas e padrões de inimigos.", "Derrote o chefe para escapar.", "Até 8 na mesma masmorra: as salas crescem com o grupo."],
    controles: CONTROLES_PADRAO, cores: ["#1c1917", "#a8a29e", "#f59e0b"], motivo: "masmorra",
  },
  {
    id: "coroa", nome: "Coroa Maldita", resumo: "Pique-pega vertical: fique com a coroa até o tempo acabar.",
    categoria: "Arena", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: false, modos: ["Coroa", "Pega-Pega"],
    regras: ["Encoste em quem está com a coroa para roubá-la.", "Molas, tirolesas, portais e plataformas móveis.", "Vence quem ficar mais tempo com a coroa.", "Sozinho, os bots disputam a coroa com você."],
    controles: CONTROLES_PADRAO, cores: ["#4a044e", "#c026d3", "#fde68a"], motivo: "coroa",
  },
  {
    id: "espacial", nome: "Corrida Espacial", resumo: "Inércia, propulsores, lasers e a gravidade dos planetas.",
    categoria: "Corrida", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 6, disponivel: false, modos: ["Corrida", "Asteroides", "Coleta"],
    regras: ["A nave mantém o embalo (inércia).", "Planetas puxam a nave.", "Lasers quebram asteroides.", "Núcleos de energia dão pontos."],
    controles: CONTROLES_PADRAO, cores: ["#020617", "#6366f1", "#f0abfc"], motivo: "estrelas",
  },
  {
    id: "torres", nome: "Torres em Colapso", resumo: "Construa e derrube: balística com vento e materiais.",
    categoria: "Estratégia", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: false, modos: ["Duelo", "Desafio"],
    regras: ["Mire com trajetória e vento.", "Madeira, pedra e aço resistem diferente.", "A torre desaba com física."],
    controles: CONTROLES_PADRAO, cores: ["#422006", "#ca8a04", "#fef9c3"], motivo: "torre",
  },
  {
    id: "defesa", nome: "Defesa de Base", resumo: "Engenheiros coletam, constroem torres e atiram juntos.",
    categoria: "Cooperativo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: false, modos: ["Cooperativo", "Infinito"],
    regras: ["Colete recursos no mapa.", "Erga torres nos pontos livres.", "Atire manualmente nas ondas."],
    controles: CONTROLES_PADRAO, cores: ["#172554", "#3b82f6", "#bfdbfe"], motivo: "muralha",
  },
  {
    id: "pescaria", nome: "Pescaria & Submarino", resumo: "Oxigênio, linha, arpão, criaturas e tesouros.",
    categoria: "Aventura", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: false, modos: ["Pescaria", "Mergulho"],
    regras: ["Controle o oxigênio.", "Física de linha e arpão.", "Tesouros no fundo."], controles: CONTROLES_PADRAO,
    cores: ["#083344", "#14b8a6", "#ccfbf1"], motivo: "bolhas",
  },
  {
    id: "mineracao", nome: "Corrida do Ouro", resumo: "Cave, use dinamite, cuide da carga e entregue no carrinho.",
    categoria: "Estratégia", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 7, disponivel: false, modos: ["Corrida", "Sobrevivência"],
    regras: ["Picareta e dinamite.", "Carga pesada deixa lento.", "Desmoronamentos."], controles: CONTROLES_PADRAO,
    cores: ["#292524", "#eab308", "#fef08a"], motivo: "picareta",
  },
  {
    id: "kart", nome: "Kart Turbo & Balões", resumo: "Pistas 3D com drift em faíscas, itens e arena de balões.",
    categoria: "Corrida", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: false, modos: ["Grande Prêmio", "Arena de Balões"],
    regras: ["Drift carrega turbo em níveis.", "Itens: míssil, escudo, óleo, turbo.", "Balões: perde quem estourar todos."],
    controles: CONTROLES_PADRAO, cores: ["#1e3a8a", "#ef4444", "#fbbf24"], motivo: "pista",
  },
  {
    id: "tanques", nome: "Tanques de Aço", resumo: "Arena 3D: muros destrutíveis, ricochete e minas.",
    categoria: "Arena", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: false, modos: ["Mata-Mata", "Times"],
    regras: ["Torre gira separada do chassi.", "Tiros ricocheteiam.", "Minas e muros destrutíveis."], controles: CONTROLES_PADRAO,
    cores: ["#1a2e05", "#65a30d", "#ecfccb"], motivo: "tanque",
  },
  {
    id: "caos", nome: "Caos Urbano", resumo: "Cidade 3D procedural: fuga, entregas, derby e corrida de rua.",
    categoria: "Corrida", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 8, disponivel: false,
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
    categoria: "Ação", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: false,
    modos: ["Mata-Mata", "Captura de Bandeira", "Rei da Colina", "Contra Bots"],
    regras: ["Rifle, escopeta, sniper e pistola.", "Slide e bunny hop.", "Recuo e recarga."], controles: ["WASD: mover", "Mouse: mirar e atirar", "Espaço: pular", "Shift: slide", "R: recarregar"],
    cores: ["#0f172a", "#38bdf8", "#f472b6"], motivo: "mira",
  },
  {
    id: "cozinha", nome: "Cozinha Caótica", resumo: "Corte, cozinhe, lave pratos e entregue no tempo, sem incêndio.",
    categoria: "Cooperativo", dimensao: "3D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: false, modos: ["Cooperativo", "Duelo de Cozinhas", "Desafio Solo"],
    regras: ["Pedidos com tempo e combo.", "Fogão sem atenção pega fogo.", "Esteiras e pratos para lavar."], controles: CONTROLES_PADRAO,
    cores: ["#450a0a", "#f97316", "#fef3c7"], motivo: "panela",
  },
  {
    id: "ritmo", nome: "Batalha de Banda", resumo: "Notas no tempo, combos e duelo que manda obstáculos.",
    categoria: "Ritmo", dimensao: "2D", minJogadores: 1, maxJogadores: 8, fase: 9, disponivel: false, modos: ["Solo", "Duelo", "Banda"],
    regras: ["Acerte as notas no tempo.", "Combos multiplicam.", "BPM ajustável.", "Duelo envia obstáculos."], controles: ["Teclas D F J K: trilhas", "Toque nas trilhas"],
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
