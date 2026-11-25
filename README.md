# Projeto Trid: orçamentos de impressão 3D

Site, feito como PWA (Progressive Web App): o visitante instala direto do navegador (Chrome/Edge: menu ⋮ "Instalar app"; Safari no iPhone: Compartilhar → "Adicionar à Tela de Início"), sem APK e sem loja de aplicativos. Toda atualização do site chega ao app instalado sozinha.

```
site/        o que vai para o GitHub Pages
  index.html, assets/   site de apresentação (raiz do domínio: botão para o app e contato por WhatsApp)
  app/                  o aplicativo (PWA) em /app/: login, orçamentos, aprovar.html, vitrine.html
  sw.js                 só remove o service worker antigo que controlava a raiz
tests/       testes do cálculo de orçamento  (npm test)
supabase/    migrações do banco
.github/workflows/
  site.yml     publica site/ no GitHub Pages a cada push na main
MODULOS.md   como a interface é organizada e como criar módulos
```

## Configuração (uma vez só)

1. **GitHub Pages:** em *Settings > Pages > Source*, escolha **GitHub Actions**.
2. **Supabase:** em *Authentication > URL Configuration*, coloque o endereço do site em **Site URL** e também em **Redirect URLs**. Sem isso, o login com Google, a confirmação de cadastro e a troca de senha voltam para o endereço antigo.

## Banco de dados próprio (Supabase)

Este projeto usa um banco só dele, separado do banco do Inventta3D. Para montar um banco novo:

1. Crie um projeto no [Supabase](https://supabase.com/dashboard).
2. Aplique as migrações de `supabase/migrations/` em ordem (pelo Supabase CLI, `supabase db push`, ou colando cada arquivo no *SQL Editor*). Elas criam as tabelas `projetotrid_*`, as funções e as pastas de arquivos `projetotrid-models` e `projetotrid-vitrine`.
3. Em `site/app/config.js`, coloque o *Project URL* e a chave *publishable* do projeto (*Settings > API*).
4. Em *Authentication > Providers*, ative o login com Google, se for usar.
5. Faça o primeiro login no site. A conta fica "Aguardando aprovação"; libere-a no *SQL Editor*:

   ```sql
   update public.projetotrid_access set status = 'approved', decided_at = now() where email = 'seu-email@exemplo.com';
   ```
