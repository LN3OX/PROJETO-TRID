# Projeto Trid: estrutura e novos módulos

## Como o app está organizado

```
index.html              casca do app + páginas de cada módulo (<main data-page="...">)
css/
  tokens.css            cores, tipografia, forma, elevação e movimento (Material 3)
  components.css        botões, campos, chips, menu, diálogos, snackbar, ajuda
  shell.css             barra lateral (computador) / barras superior e inferior (celular)
  modules/auth.css      tela de acesso
  modules/orcamentos.css  novo orçamento + orçamentos salvos
  print.css             impressão / PDF
js/
  modules.js            registro de módulos (gera a navegação e as rotas)
  shell.js              roteador por hash, navegação, menu da conta, snackbar de status
  app.js                regras do módulo de orçamentos (cálculo, salvar, compartilhar)
  orcamentos-ui.js      ajustes de interface do módulo de orçamentos
```

Regra de ouro: módulos usam só **tokens** e **componentes**. Nada de cor ou tamanho solto dentro de `css/modules/`.

## Adicionar um módulo (exemplo: Estoque de filamentos)

1. **Página** no `index.html`, dentro de `.app-content`, antes do `<footer>`:
   ```html
   <main class="shell page" data-page="estoque" hidden aria-labelledby="estoqueTitle">
     <h1 id="estoqueTitle">Estoque</h1>
     ...
   </main>
   ```
2. **Registro** em `js/modules.js`:
   ```js
   { id: 'estoque', label: 'Estoque de filamentos', short: 'Estoque', route: '#/estoque', icon: 'i-inventory', iconActive: 'i-inventory-fill' }
   ```
3. **Ícones**: copie o `<path>` dos arquivos `inventory_2.svg` e `inventory_2-fill.svg` do pacote `@material-symbols/svg-400` (estilo *rounded*) para um `<symbol id="i-inventory" viewBox="0 -960 960 960">` no sprite do `index.html`.
4. **Estilos** em `css/modules/estoque.css` e **script** em `js/estoque.js`. Inclua os dois no `index.html` e na lista `APP_SHELL` do `sw.js`, e suba a versão do cache (`CACHE_NAME`).
5. **Dados**: crie uma tabela própria no Supabase (migração em `supabase/migrations/`) com a mesma política de acesso por usuário de `projetotrid_quotes`.

A navegação se ajusta sozinha: até 5 módulos cabem na barra inferior do celular. Acima disso, agrupe os menos usados em um módulo “Mais”. A barra lateral do computador comporta até 7.

## Princípios visuais

- Uma ação principal por tela (botão preenchido). O resto fica em botões de texto ou contorno.
- Superfícies planas, sem sombra: a elevação fica para menus, diálogos e snackbar.
- Vermelho só para ação principal e seleção, verde só para valores e sucesso.
- As dicas dos campos aparecem ao focar. O botão “?” mostra a explicação completa.
