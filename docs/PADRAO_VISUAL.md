# Padrão visual do NordTool

Referência curta para manter as telas parecidas entre si. Na dúvida, copie uma tela que já segue o padrão (Configurações, Medições).

## Cores (Tailwind)

| Papel | Classe base | Uso |
|---|---|---|
| Primária | `blue-600` (hover `blue-700`) | botão principal, item ativo do menu, links |
| Neutros | `slate-800` texto, `slate-500` apoio, `slate-400` rótulos, `slate-200` bordas, `slate-50` fundo | todo o resto |
| Sucesso | `emerald-600` / fundo `emerald-50` | salvo, concluído |
| Atenção | `amber-600` / fundo `amber-50` | pendente, aviso |
| Erro | `red-600` / fundo `red-50` | erro, excluir, sair |

Cor nunca é a única informação: status sempre leva texto (e ícone quando couber).

## Formas e espaçamento

- Controles (botão, campo, select): `rounded-xl`, `px-3 py-2` ou `px-4 py-2`, `text-sm`.
- Cartões e seções: `rounded-2xl border border-slate-200 p-5 shadow-sm`.
- Painéis grandes e modais: `rounded-3xl` (modal no celular sobe de baixo: `rounded-t-3xl`).
- Alvo de toque mínimo de 40px de altura no celular.

## Tipografia

- Título da tela: componente `components/ui/CabecalhoPagina` (`text-2xl` no celular, `text-3xl` a partir de `sm`).
- Título de seção: `text-lg font-bold text-slate-800`.
- Rótulo de grupo: `text-[10px]`–`text-[11px] font-extrabold uppercase tracking-widest text-slate-400`.

## Animações

Definidas em `tailwind.config.js` e `src/react-app/index.css`. Curtas (200–260 ms) e só para dar contexto, nunca para enfeitar uma espera.

| Classe | Quando |
|---|---|
| `animate-entrada` | conteúdo que acabou de aparecer (troca de tela, grupo do menu aberto) |
| `animate-surgir` | destaque pontual (cartão vazio, confirmação) |
| `animate-aparecer` | só opacidade |
| `animate-da-esquerda` / `animate-da-direita` | troca de aba lateral |

- Toda janela com `role="dialog" aria-modal="true"` já surge sozinha (regra global); não repita a animação no modal.
- Cada troca de tela já entra com `animate-entrada` pelo `Layout`.
- `prefers-reduced-motion` desliga as animações em todo o app.
- Carregando: `Loader2` com `animate-spin`; nada de animação longa no lugar de dado.

## Acessibilidade

- Foco de teclado visível em tudo (`:focus-visible` global, contorno azul).
- Botão só com ícone leva `aria-label`.
- Grupos recolhíveis usam `aria-expanded` e `aria-controls`.
- Mensagens de erro em `role="alert"`, confirmações em `role="status"`.
