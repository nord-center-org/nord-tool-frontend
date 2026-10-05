## Nord Tool

To run the devserver:
```
npm install
npm run dev
```

### Configuração da API

A URL base da API vem de `VITE_API_BASE_URL`. Sem a variável, o app usa o backend publicado no Railway (fallback em `src/react-app/config/api.ts`).

Para desenvolvimento local, crie `.env.local` (não commitado):
```
VITE_API_BASE_URL=http://localhost:8081/api/v1/nord-tool
```

Todas as chamadas à API passam por `src/react-app/services/apiClient.ts` (`apiFetch` / `apiBlob`).
