# ESTOPIM

Arena tática de explosivos jogável direto no navegador: campanha, multiplayer online e modos especiais.

## Estrutura

Monorepo com npm workspaces:

| Workspace | Descrição |
| --- | --- |
| `shared/` | Simulação determinística, tipos e regras compartilhadas entre client e server |
| `client/` | Jogo em Preact + Vite (render em canvas, áudio, telas e HUD) |
| `server/` | Servidor de partidas online (WebSocket + Postgres) |

## Desenvolvimento

```bash
npm install
npm run dev:client   # http://localhost:5173
npm run dev:server   # ws/http em :8787
```

## Scripts

```bash
npm run build       # build de client e server
npm run typecheck   # checagem de tipos dos três workspaces
npm test            # testes da simulação compartilhada
```

## Deploy

O client é publicado como site estático na Vercel (`vercel.json` na raiz: build `npm run build -w client`, saída `client/dist`).

O endereço do servidor online é resolvido em `client/src/net/client.ts`:

- `VITE_SERVER_URL` quando definida;
- `http://<host>:8787` em desenvolvimento local;
- caso contrário, o servidor de produção.

Defina `VITE_SERVER_URL` nas variáveis de ambiente do projeto na Vercel para apontar para outro backend.
