# GREEN — Análise Esportiva

App **Android** que roda o seu Agente de Apostas Inteligente: abre já com os **jogos do dia
carregados**, você marca os que interessam, toca em **PRONTO**, e ele entrega a análise jogo a jogo
e os 3 bilhetes do desafio 5 → 100.

- **Motor de IA:** DeepSeek (`deepseek-v4-pro`), com Claude como alternativa.
- **Dados:** football-data.org — grade do dia, escudos, classificação, últimos jogos com placares
  e confronto direto. São números reais, não memória de modelo.
- **Aprendizado:** você marca GREEN/RED, o app faz o post-mortem, vira lição e entra como critério
  obrigatório na próxima análise.

---

## 1. Chaves (uma vez só, dentro do app, em Ajustes)

| Chave | Onde pegar | Para quê |
|---|---|---|
| **DeepSeek** | platform.deepseek.com | O raciocínio. ~R$ 0,10 por rodada analisada |
| **football-data.org** | football-data.org/client/register | Grátis. Os jogos do dia e as estatísticas reais |

As duas ficam salvas **só no aparelho** e vão apenas para o serviço de cada uma.

> Sem a chave do football-data o app ainda funciona, mas cai para uma grade aproximada e a IA
> analisa sem os números reais — a qualidade despenca. Pegue essa chave, é grátis e leva 2 minutos.

## 2. Rodar no PC (para testar rápido)

```
node tools/serve.js
```
ou duplo clique em **`iniciar.bat`** → abre em `http://localhost:5173`.

No PC a busca da grade oficial pode ser bloqueada pelo navegador (CORS); no celular, como app
nativo, isso não acontece.

## 3. Gerar o APK

### Na nuvem (recomendado — não precisa instalar nada)

1. Crie um repositório no GitHub e suba esta pasta:
   ```
   git init
   git add .
   git commit -m "GREEN v1"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/green-apostas.git
   git push -u origin main
   ```
2. No GitHub, aba **Actions** → o build **Gerar APK (Android)** roda sozinho (~5 min).
3. Terminou: clique no build → **Artifacts** → baixe **GREEN-apk** → transfira o
   `app-debug.apk` para o celular e instale (o Android vai pedir para permitir
   "instalar de fontes desconhecidas").

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
1. football-data.org  ->  forma dos últimos 50 dias com placares, tabela, H2H
2. DeepSeek           ->  dossiê analítico em cima desses números + suas lições
3. DeepSeek (json)    ->  estrutura para as telas e monta os 3 bilhetes
4. o app              ->  valida: 1 seleção por jogo em cada bilhete, odd recalculada
```

Duas regras de honestidade que ficaram no código:

- **Desfalque e escalação a IA não inventa.** A API do DeepSeek não tem busca na web; nesses
  campos o app escreve "sem dado confiável" e derruba a confiança do palpite. Se quiser esses
  dados, troque o motor para Claude em Ajustes e ligue a pesquisa web.
- **Bilhete não repete jogo.** Duas seleções do mesmo jogo a casa recusa (e "Dupla Chance 1X"
  com "Empate Anula" é a mesma aposta duas vezes) — o app corta e recalcula a odd.

## 6. Estrutura

```
www/                     o app em si
  index.html
  css/styles.css         design preto/âmbar, mobile-first
  js/store.js            estado, memória de lições, estatísticas (fica no aparelho)
  js/motor.js            camada de IA: DeepSeek e Claude atrás da mesma interface
  js/stats.js            dados reais da API esportiva (com limite de 10 req/min respeitado)
  js/fixtures.js         grade do dia (API esportiva -> IA como reserva)
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
