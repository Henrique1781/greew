# GREEN — Análise Esportiva

App **Android** que roda o seu Agente de Apostas Inteligente: abre já com os **jogos do dia
carregados**, você marca os que interessam, toca em **PRONTO**, e ele entrega a análise jogo a jogo
e os 3 bilhetes do desafio 5 → 100.

- **Motor de IA:** DeepSeek (`deepseek-v4-pro`), com Claude como alternativa.
- **Dados:** API-Football — grade do dia (Brasil, Europa e Arábia Saudita), escudos, escalação,
  estatísticas, probabilidade, confronto direto e desfalques com motivo (lesão, suspensão, dúvida).
- **Placar ao vivo:** fonte separada, gratuita e sem cota, para não gastar as 100 consultas/dia.
- **Notícias:** ge.globo, ESPN, Gazeta Esportiva, UOL e Trivela por RSS.
- **Aprendizado:** você marca GREEN/RED, o app faz o post-mortem, vira lição e entra como critério
  obrigatório na próxima análise.

---

## 1. Chaves (uma vez só, dentro do app, em Ajustes)

| Chave | Onde pegar | Para quê |
|---|---|---|
| **DeepSeek** | platform.deepseek.com | O raciocínio. ~R$ 0,10 por rodada analisada |
| **API-Football** | dashboard.api-football.com | Grátis, 100 consultas/dia. Jogos, escalação, estatística, probabilidade e desfalques |

O placar ao vivo e as notícias **não precisam de chave** e não gastam cota.

As duas ficam salvas **só no aparelho** e vão apenas para o serviço de cada uma.

> Sem a chave da API-Football o app cai para uma grade aproximada e a IA analisa sem os números
> reais — a qualidade despenca. Ela é grátis e leva 2 minutos.

**Onde vão as 100 consultas por dia:** 1 para a grade do dia (com cache, uma vez só),
2 por jogo analisado (probabilidade + desfalques) e 1 cada vez que você abre Escalação,
Probabilidade ou Estatísticas de um jogo novo. Analisar 6 jogos gasta ~13. O contador fica
visível em Ajustes e zera às 21h (00:00 UTC).

## 2. Rodar no PC (para testar rápido)

```
node tools/serve.js
```
ou duplo clique em **`iniciar.bat`** → abre em `http://localhost:5173`.

> **Precisa ser por esse servidor.** A football-data.org responde sempre
> `Access-Control-Allow-Origin: http://localhost` (sem porta), então o navegador bloqueia a
> chamada direta. O `tools/serve.js` repassa em `/fd/*` e resolve — a chave vai no cabeçalho
> vinda do app e não fica guardada no servidor. Abrir o `index.html` direto (file://) não funciona.
> No app Android nada disso se aplica: o HTTP nativo ignora CORS.

## 3. Gerar o APK

### Na nuvem (recomendado — não precisa instalar nada)

O repositório já está configurado: <https://github.com/Henrique1781/greew>

A cada `git push` o build **Gerar APK (Android)** roda sozinho (~5 min):

```
git add .
git commit -m "o que mudou"
git push
```

Depois, no GitHub: aba **Actions** → clique no build mais recente → **Artifacts** →
baixe **GREEN-apk** → passe o `app-debug.apk` para o celular e instale (o Android vai pedir
para permitir "instalar de fontes desconhecidas").

Dá para rodar o build sem alterar nada: **Actions** → *Gerar APK (Android)* → **Run workflow**.

O `.gitignore` já impede que `node_modules/` e a pasta `android/` subam — o build da nuvem
recria tudo do zero.

### No PC (se preferir)

Precisa de Android Studio + JDK 17. Depois:
```
npm install
npm run android:add      # só na primeira vez
npm run android:sync
npm run android:apk      # gera android/app/build/outputs/apk/debug/app-debug.apk
```

## 4. Usar no dia a dia

| Passo | O que fazer |
|---|---|
| 1 | Abrir o app — a grade do dia carrega sozinha |
| 2 | Marcar os jogos (quadradinho âmbar) ou tocar em **Marcar todos** |
| 3 | **PRONTO — ANALISAR**. Leva alguns minutos; dá para acompanhar em tempo real |
| 4 | **Análise**: veredito, forma, H2H, desfalques, métricas e palpites de cada jogo |
| 5 | **Bilhetes**: os 3 prontos, com odd total e retorno sobre o seu stake |
| 6 | **Registrar no histórico** nos bilhetes que você realmente apostou |
| 7 | Depois dos jogos: **Placar** → GREEN/RED → **Aprender com a rodada** |

O passo 7 é o que faz o app melhorar. Ele analisa o motivo de cada red, gera lições
("não usar Over 2.5 em mata-mata fora de casa"), guarda na memória e passa a aplicá-las.
A memória fica visível e editável em Ajustes, e sua taxa de acerto **por mercado** também
entra no prompt — o agente aprende de quais mercados fugir no seu caso.

## 5. Como a análise funciona por dentro

```
1. API-Football  ->  probabilidade, forma real, H2H, médias de gols e desfalques com motivo
2. DeepSeek      ->  dossiê analítico em cima desses números + suas lições dos erros passados
3. DeepSeek json ->  estrutura para as telas e monta os 3 bilhetes
4. o app         ->  valida: 1 seleção por jogo em cada bilhete, odd recalculada
```

Duas regras de honestidade que ficaram no código:

- **A IA não inventa desfalque nem escalação.** Ela só recebe o que a API-Football entregou.
  Quando um dado não existe (a escalação, por exemplo, só sai ~40 min antes do apito), o app
  escreve "sem dado confiável" e derruba a confiança do palpite em vez de chutar.
- **Bilhete não repete jogo.** Duas seleções do mesmo jogo a casa recusa (e "Dupla Chance 1X"
  com "Empate Anula" é a mesma aposta duas vezes) — o app corta e recalcula a odd.

## 6. Estrutura

```
www/                     o app em si
  index.html
  css/styles.css         design preto/âmbar, mobile-first
  js/store.js            estado, memória de lições, estatísticas (fica no aparelho)
  js/motor.js            camada de IA: DeepSeek e Claude atrás da mesma interface
  js/apifootball.js      API-Football: grade, escalação, probabilidade, desfalques + cota e cache
  js/live.js             placar ao vivo (fonte gratuita separada, sem cota)
  js/news.js             notícias por RSS dos portais
  js/stats.js            monta o dossiê de números reais para a IA
  js/fixtures.js         grade do dia (API-Football -> reservas)
  js/api.js              prompts, pipeline e normalização das respostas
  js/native.js           ponte com o Android (HTTP nativo, status bar, botão voltar)
  js/app.js              telas e ações
capacitor.config.json    configuração do app Android
.github/workflows/       build do APK na nuvem
tools/serve.js           servidor local sem dependências
tools/gen-icons.js       gera ícones e splash
```

## 7. Custo

Uma rodada de 2 jogos custou **R$ 0,09** no teste real (DeepSeek V4 Flash, pior caso de preço).
Com V4 Pro e mais jogos, conte alguns centavos por análise. Para gastar menos: use o Flash e
profundidade Média. A API esportiva é gratuita.

---

**Nenhuma análise garante resultado.** O app trabalha com probabilidade, não com certeza —
aposte só o que você pode perder.
