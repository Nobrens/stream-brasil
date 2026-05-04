# Como colocar AdSense e apoio

## 1. AdSense

1. Entre em `https://www.google.com/adsense/`.
2. Adicione o site `https://stream-brasil-1.onrender.com`.
3. Aguarde a aprovacao do Google.
4. Crie blocos de anuncio responsivos.
5. Copie:
   - Publisher ID, exemplo `ca-pub-1234567890123456`
   - Ad slot ID, exemplo `1234567890`

No `site-config.js`, edite:

```js
adsense: {
  enabled: true,
  client: "ca-pub-4344183847710369",
  slots: {
    homeTop: "1234567890",
    support: "0987654321",
  },
},
```

No Render, em Environment Variables, adicione:

```text
ADSENSE_PUBLISHER_ID=pub-1234567890123456
```

Repare que no `site-config.js` usa `ca-pub-...`; no Render usa `pub-...`.

Depois faca deploy.

## 2. Apoio e doacao

Opcoes simples:

- Stripe Payment Links
- Mercado Pago Link de Pagamento
- Apoia.se
- Catarse
- Pix manual em uma pagina propria

Crie o link no servico escolhido e coloque em `site-config.js`:

```js
supportLink: "https://seu-link-de-apoio.com",
```

## 3. O que o publico ve

Se AdSense nao estiver configurado, o site nao mostra erro nem texto tecnico.

Se o link de apoio nao for trocado, o botao aponta para a propria secao de suporte. Troque `supportLink` antes de divulgar.

## 4. Atualizar no Render

1. Suba os arquivos alterados no GitHub.
2. Clique em `Commit changes`.
3. Abra o Render.
4. Clique em `Manual Deploy`.
5. Clique em `Deploy latest commit`.
