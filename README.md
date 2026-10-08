## Nord Tool (frontend)

React 19 · Vite · Tailwind · TypeScript. Módulos: Apartamentos (termos de reprova, fotos, PDF lado a lado), Controle de chaves,
Cronograma semanal, Casamento, Caixinha e Financeiro (Gestão Individual: dashboard do mês, extrato e investimentos).

### Rodando
```
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # tsc -b && vite build
npm run lint
npm test         # testes das funções puras (node --test)
```

### Configuração da API

A URL base da API vem de `VITE_API_BASE_URL`. Sem a variável, o app usa o backend publicado no Railway (fallback em `src/react-app/config/api.ts`).

Para desenvolvimento local, crie `.env.local` (não commitado):
```
VITE_API_BASE_URL=http://localhost:8081/api/v1/nord-tool
```

Todas as chamadas à API passam por `src/react-app/services/apiClient.ts` (`apiFetch` / `apiBlob`), que envia o token JWT e
lança `ApiError` (com `status`, ex.: 409 = conflito de versão).

### Convenções
- Serviços em `src/react-app/services`, regras puras em `src/react-app/utils` (cada uma com `*.test.ts`, listado no script `test` do `package.json`).
- Tabelas usam o filtro padrão `ColumnFilter` + `useFiltrosColuna`.
- Financeiro: `pages/Financeiro.tsx` (abas Dashboard, Extrato e Investimentos em `components/financeiro/`); regras puras em `utils/financeiro*.ts` e `utils/investimentos.ts`. Gráfico da fatura é SVG próprio (sem biblioteca). Atalhos: `N` novo lançamento (Extrato), `←`/`→`/`T` meses (Dashboard). Exige o módulo `FINANCEIRO` no perfil (403 mostra aviso).
- Casamento e Caixinha usam atualização otimista com rollback (`useSincronizacao` / `executarOtimista`).
- Arquivos protegidos (PDF/imagem) são baixados com token e abertos via `abrirArquivoAutenticado` ou `ImagemAutenticada`.

### Documentos
- `docs/QA_E_VIRADA.md`: roteiro de QA, inventário do que ainda vive só no Lugia e plano de virada.
- Banco de dados e migrações de dados: repositório `nord-tool-scripts-sql`. Backend: `nord-tool-backend` (README com variáveis de ambiente).
