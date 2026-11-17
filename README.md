# Lista Fácil — site

Landing page, Política de Privacidade e Termos de Uso do app Lista Fácil, publicados no GitHub Pages
a partir da pasta `landing/`: https://vitoriano.github.io/listafacil-site/

- `landing/index.html` — landing do beta (HTML, CSS e JS puros, sem build)
- `landing/styles.css` e `landing/script.js` — estilos e formulário de inscrição no beta
- `landing/privacidade.html` — Política de Privacidade (URL usada na ficha do Google Play)
- `landing/termos.html` — Termos de Uso

Qualquer push em `main` que altere `landing/` republica o site (`.github/workflows/pages.yml`).
O código do app e da API fica em repositórios privados.

## Inscrições do beta

O formulário da landing envia para a constante `BETA_SIGNUP_ENDPOINT`, no topo de `landing/script.js`
(POST JSON `{ email, consent, source: 'landing-beta' }`). Enquanto ela estiver vazia, as inscrições
ficam só no navegador de quem se inscreveu e **não chegam a lugar nenhum**. Preencha com um endpoint
(API do Lista Fácil ou um serviço de formulário) para começar a receber os e-mails.
