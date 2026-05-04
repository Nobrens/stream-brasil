# Como publicar o Stream Brasil

## 1. Criar app na Twitch

1. Acesse `https://dev.twitch.tv/console/apps`.
2. Crie uma aplicacao.
3. Copie o `Client ID`.
4. Gere/copiei o `Client Secret`.

Esses valores nao podem ficar no `app.js` nem no navegador. Eles entram como variaveis privadas no servidor.

## 2. Rodar local com API

Copie `.env.example` para `.env` e preencha:

```text
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_client_secret
```

Depois rode:

```powershell
node server.js
```

Abra:

```text
http://localhost:5500
```

## 3. Publicar para todos

Opcao simples: Render.

1. Crie um repositorio no GitHub e envie estes arquivos.
2. No Render, clique em `New` > `Web Service`.
3. Conecte o repositorio.
4. Se ele detectar o `render.yaml`, confirme o Blueprint. Se for manual, use:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Em `Environment`, adicione como secrets:
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
   - `TWITCH_USER_ACCESS_TOKEN` opcional
6. Publique. O Render vai gerar uma URL publica.

## 3.1. Comandos para GitHub

Dentro desta pasta:

```powershell
git init
git add .
git commit -m "Publica Stream Brasil"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/stream-brasil.git
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuario do GitHub e crie o repositorio `stream-brasil` no GitHub antes do `git push`.

## 3.2. Se nao conseguir publicar

- Se o player abrir mas o chat nao: confira se voce abriu pela URL publica ou `http://localhost:5500`, nao por arquivo.
- Se o Render mostrar erro de porta: o app usa `process.env.PORT`, entao confira se o Start Command e `npm start`.
- Se viewers/categoria nao aparecem: confira `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`.
- Se seguidores aparecem como `Sem acesso`: crie um token de usuario com permissao adequada ou deixe sem seguidores detalhados; a Twitch limita esse dado.
- Se o deploy falhar no GitHub: envie o erro exato que aparece no terminal ou no Render.

## 4. Sobre seguidores

A Twitch Helix exige autenticacao para seguidores. O backend ja tenta buscar o total em `channels/followers`.

Se viewers/categoria funcionarem e seguidores aparecerem como sem acesso, adicione um `TWITCH_USER_ACCESS_TOKEN`. Para lista detalhada de seguidores, a Twitch exige permissao do broadcaster ou de moderador com escopo `moderator:read:followers`; para o painel, o site tenta usar apenas o total.
