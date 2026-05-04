# Segurança do Stream Brasil

## Corrigido no codigo

- O servidor agora bloqueia arquivos internos como `server.js`, `.env`, `package.json` e subpastas espelho.
- O servidor serve publicamente apenas `index.html`, `styles.css`, `app.js`, `site-config.js`, `/assets/*` e `ads.txt`.
- Foram adicionados headers de seguranca:
  - `Content-Security-Policy`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- Dados vindos de Twitch, BTTV, configuracao e navegador agora sao escapados antes de entrar no HTML.
- A API `/api/twitch/stats` tem cache curto de 30 segundos para reduzir abuso e chamadas repetidas na Twitch.
- A entrada de canais continua limitada a logins Twitch validos.

## Cuidados importantes

- Nunca coloque `TWITCH_CLIENT_SECRET` no `site-config.js`, `app.js` ou GitHub.
- Se o `TWITCH_CLIENT_SECRET` apareceu em algum print publico, gere um novo secret na Twitch e atualize o Render.
- O `ADSENSE_PUBLISHER_ID` e `ca-pub-...` nao sao segredo; podem aparecer no codigo.
- Favoritos e streamers adicionados ficam no navegador do usuario, nao em conta/login.
- Para favoritos em conta, use um backend com login e banco de dados, como Supabase/Firebase.

## Render

As variaveis privadas devem ficar apenas em Environment Variables:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_USER_ACCESS_TOKEN` opcional
- `ADSENSE_PUBLISHER_ID`
