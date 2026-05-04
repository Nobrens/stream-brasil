# Como conseguir as chaves da Twitch

## 1. Client ID e Client Secret

1. Entre em `https://dev.twitch.tv/console/apps`.
2. Faca login com sua conta Twitch.
3. Clique em `Register Your Application`.
4. Preencha:
   - Name: `Stream Brasil`
   - OAuth Redirect URLs: `http://localhost:5500`
   - Category: `Website Integration`
5. Clique em `Create`.
6. Copie o `Client ID`.
7. Clique em `New Secret` e copie o `Client Secret`.

No Render, coloque:

```text
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_client_secret
```

No seu PC, copie `.env.example` para `.env` e preencha os mesmos valores.

## 2. Access Token opcional para seguidores

O site ja gera token de app automaticamente usando `Client ID` e `Client Secret`.

Voce so precisa de `TWITCH_USER_ACCESS_TOKEN` se os seguidores aparecerem como `Sem acesso`.

Para gerar:

1. No app da Twitch, confirme que `http://localhost:5500` esta em OAuth Redirect URLs.
2. Troque `SEU_CLIENT_ID` no link abaixo pelo seu Client ID.
3. Abra no navegador:

```text
https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=SEU_CLIENT_ID&redirect_uri=http://localhost:5500&scope=moderator%3Aread%3Afollowers
```

4. Autorize.
5. A URL vai ficar parecida com:

```text
http://localhost:5500/#access_token=TOKEN_AQUI&scope=moderator%3Aread%3Afollowers&token_type=bearer
```

6. Copie somente o valor depois de `access_token=` e antes do proximo `&`.
7. Coloque no Render:

```text
TWITCH_USER_ACCESS_TOKEN=token_copiado
```

Importante: nao publique esse token no GitHub e nao mande para outras pessoas.

## 3. Limite importante da Twitch

Para lista detalhada de seguidores, a Twitch exige que a conta do token seja o broadcaster ou moderador do canal. Quando essa permissao nao existe, o endpoint pode retornar apenas o total ou bloquear o dado.
