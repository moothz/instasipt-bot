# instasipt-bot
Bot do Telegram que busca posts no Instagram Si PT usando a hashtag #siptxxxyyyy

Antes de usar, instale os programas necessários, abra o arquivo `configs.json` e preencha com seus dados!
Um arquivo `dados.xlsx` pode ser lido também que contém mais informações sobre os carros.

## ℹ️ Requisitos

* **Um servidor** para hospedar o bot, _Windows_ ou _Linux_, capaz de rodar _nodejs_. Ele não precisa de muito pra rodar, até um _Raspberry Pi_ serve!

## 💿 Instalação
1. **Instale o NodeJS**:
    >Acesse o site oficial do [nodejs](https://nodejs.org/), baixe e instale a versão LTS.
2. Instale os pacotes necessários
```
npm i sync-exec sync-fetch read-excel-file
```

## 🤖 Como criar um token do bot e pegar o  token

- Converse com o [@BotFather](https://t.me/BotFather)
    1. /newbot
    2. Siga as instruções e preencha um nome
    4. Copie o token recebido e cole na variável `telegram.token`
    5. /setprivacy -> DISABLE


## 🍪 Como pegar os Cookies do Instagram para colocar no configs.json

- Faça login to Instagram
- Acessa teu perfil https://instagram/usuario
- Abre o console do navegador (geralmente F12)
  1. Aba "Network"
  2. Busca por "timeline/" e clica (na que é POST); recarrega a página com o console aberto se não aparecer
  3. Vai na categoria "Headers"
  4. Vai na aba "Request Headers"
  5. Copia tudo que tem depois de _"cookie: "_ e cola na variável `instagram.cookie`
  6. Copia tudo que tem depois de _"user-agent: "_ e cola na variável `instagram.userAgent`
  7. Copia tudo que tem depois de _"x-ig-app-id: "_ e cola na variável `instagram.xIgAppId`

## 🖼 Como ativar o reconhecimento de placas em fotos (opcional)

É possível utilizar o [OpenALPR](https://github.com/openalpr/openalpr) para identificar placa dos carros nas fotos e pesquisar automaticamente.
Para isso, é necessário definir a variável `alpr` no `configs.json` com o caminho para o executável do openalpr.
Você pode treinar seu próprio modelo ou usar um pronto - para testes, recomendo o modelo treinado do [mauriciocordeiro](https://github.com/mauriciocordeiro/openalpr.br).