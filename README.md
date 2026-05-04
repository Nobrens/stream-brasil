# Stream Brasil

Site para assistir streamers brasileiros com player real da Twitch, chat real da Twitch e dados oficiais via backend Node.js.

## Rodar local

```powershell
node server.js
```

Abra:

```text
http://localhost:5500
```

## Rodar local com Twitch API

Copie `.env.example` para `.env` e preencha:

```text
TWITCH_CLIENT_ID=seu_client_id
TWITCH_CLIENT_SECRET=seu_client_secret
```

Depois rode `node server.js`.

## Publicar para todos

Este projeto precisa ser publicado como app Node.js, nao apenas HTML estatico, porque as chaves da Twitch ficam privadas no servidor.

Veja o passo a passo em `DEPLOY.md`.

## Variaveis privadas

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_USER_ACCESS_TOKEN` opcional para seguidores quando necessario

## Streamers no site

Edite a lista `streamers` em `site-config.js`. Veja `COMO-MUDAR-O-SITE.md`.

Visitantes tambem podem adicionar streamers e favoritar canais pelo proprio site. Esses dados ficam no navegador da pessoa.

O backend busca dados para todos os streamers que estao nessa lista chamando:

```text
/api/twitch/stats?channels=gaules,alanzoka,loud_coringa,casimito,cellbit,baiano
```
