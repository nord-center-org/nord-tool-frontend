/** Falas dos gatinhos quando alguém clica neles (cada um tem o seu jeitinho). */
export const FALAS: Record<string, string[]> = {
  mel: ["Miau! Cadê meu sachê?", "Sou tricolor, sou rara!", "Me faz carinho? 🧡", "Essa bolinha é minha!"],
  pretinho: ["Eu vejo tudo no escuro 👀", "Prrrr...", "Gato preto dá sorte, viu?", "Shhh, tô caçando."],
  laranjinha: ["MIAU! Hora do lanche!", "Eu caí da prateleira de propósito.", "Bora brincar?", "Laranja é a cor da energia!"],
  floquinho: ["Um olho azul, outro amarelo ✨", "Não me suja, tô branquinho!", "Miau delicado.", "Cadê o raio de sol?"],
  cinzento: ["Sou o mais sábio daqui.", "Zzz... ah, oi.", "Esse puleiro é meu escritório.", "Prrr prrr."],
  biscoito: ["Meow? (sotaque siamês)", "Fala mais baixo, por favor.", "Olhos azuis, charme total.", "Quero colo!"],
  frajola: ["Vou pegar esse rato!", "Terno e gravata, sempre elegante.", "Já viu o Piu-Piu por aí?", "Corre, rato, corre!"],
  pacoca: ["Docinho igual paçoca 🍬", "Afiei as unhas hoje!", "Cadê a cordinha?", "Miau, Davi!"],
};

export const FALAS_INTERACAO = {
  arranhar: ["Afiando as garras!", "Scratch scratch!", "Unhas prontas."],
  comer: ["Nhac nhac!", "Que delícia!", "Mais ração!"],
  bola: ["Minha!", "Pega!", "Ploft!"],
  rato: ["Peguei!", "Hehe, te peguei!", "Rato capturado!"],
};

export const sortear = <T,>(l: T[], r = Math.random) => l[Math.floor(r() * l.length) % l.length];
