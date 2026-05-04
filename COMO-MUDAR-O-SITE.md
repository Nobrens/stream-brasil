# Como mudar o site

Quase tudo que voce quer trocar fica em `site-config.js`.

## Mudar nome e capa

Abra `site-config.js` e edite:

```js
brandName: "Stream Brasil",
brandMark: "SB",
heroTitle: "Multi Stream BR",
heroSubtitle: "Texto principal do site",
```

## Mudar streamers

Edite a lista:

```js
streamers: [
  { login: "gaules", name: "Gaules", category: "Counter-Strike 2" },
]
```

O `login` precisa ser exatamente o nome do canal na Twitch.

## Adicionar streamers pelo site

No site, use o campo `login do canal` na secao `Canais e favoritos`.

Isso salva no navegador do visitante usando `localStorage`. Ou seja:

- Cada pessoa pode adicionar seus proprios canais.
- Para adicionar um canal fixo para todo mundo, edite `site-config.js`.

## Favoritos

Clique em `Favoritar` no card do streamer.

Favoritos tambem ficam salvos no navegador de cada visitante.

## Emotes BTTV

A secao `Emotes da comunidade` carrega:

- Emotes BTTV globais.
- Emotes BTTV do canal atual, quando a API da Twitch ja retornou o ID do canal.

O chat oficial da Twitch fica dentro de iframe. Por seguranca do navegador, o site nao consegue alterar as mensagens desse iframe. Para renderizar emotes dentro das mensagens, o proximo passo seria criar um chat proprio usando IRC/EventSub.

## Mudar o link de dinheiro

Crie um link de pagamento no Stripe, Mercado Pago, Apoia.se ou outro servico e coloque:

```js
supportLink: "https://seu-link-de-pagamento.com",
```

## Mudar ideias de monetizacao

Edite:

```js
monetizationCards: [
  { title: "Apoio VIP", text: "Seu texto aqui" },
]
```

## Publicar mudancas

1. Edite os arquivos.
2. Envie os arquivos atualizados para o GitHub.
3. No Render, faca `Manual Deploy > Deploy latest commit`.

Se voce estiver usando upload manual no GitHub:

1. Abra o repositorio.
2. Clique em `Add file` > `Upload files`.
3. Envie `index.html`, `styles.css`, `app.js`, `site-config.js` e os outros arquivos alterados.
4. Clique em `Commit changes`.
5. Volte no Render e rode o deploy manual.

## Como ganhar dinheiro com acessos

- Google AdSense: anuncios no site quando houver conteudo original e trafego.
- Stripe Payment Links ou Mercado Pago: apoio, assinatura VIP, doacao e planos premium.
- Patrocinadores: vender espaco fixo para marcas gamer.
- Afiliados: links de produtos, cupons e equipamentos.

Importante: os anuncios que aparecem dentro do player da Twitch pertencem ao ecossistema da Twitch/canal. Para monetizar seu site, use areas do proprio site fora do iframe.
