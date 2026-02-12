# Quiz dos Países do Mundo

Quiz interativo para descobrir os nomes dos países do mundo. Digite o nome do país em português e veja o mapa ficar verde à medida que acerta.

## Funcionalidades

- **Mapa mundial**: cada país fica verde quando você acerta o nome
- **Temporizador**: 15 minutos para descobrir o máximo de países
- **Tooltip**: passe o mouse sobre o mapa para ver o nome do país e se já foi descoberto
- **Lista por continente**: países acertados organizados por continente
- **Tudo em português**: interface e nomes dos países em português

## Tecnologias

- TypeScript
- Vite
- D3 (d3-geo, d3-selection) + TopoJSON para o mapa

## Desenvolvimento

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build

```bash
npm run build
```

A pasta `dist/` contém os ficheiros estáticos.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. No repositório, vá a **Settings → Pages**.
3. Em **Source**, escolha **GitHub Actions** (ou **Deploy from a branch**).
4. Se usar **branch**:
   - Em **Branch** escolha `main` (ou `gh-pages`) e pasta `/ (root)` ou `docs`.
   - Se usar pasta `docs`, altere em `vite.config.ts`: `outDir: 'docs'` e faça build. Envie a pasta `docs` para o repositório.
   - Se usar **root**: faça build, copie o conteúdo de `dist/` para a raiz da branch (por exemplo numa branch `gh-pages`) ou use uma GitHub Action para fazer deploy da pasta `dist/`.

### Deploy com GitHub Actions (recomendado)

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Com isso, cada push em `main` gera o site e publica em GitHub Pages. O site ficará em `https://<seu-usuario>.github.io/<nome-do-repo>/`. O projeto já está configurado com `base: './'` no Vite para funcionar nesse subcaminho.
