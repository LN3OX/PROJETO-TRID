/* Projeto Trid · aprovação de acesso. Quem entra pelo Google fica "pendente" até o dono aprovar (tabela inventta3d_access no Supabase).
   O bloqueio de verdade está no banco (as regras das tabelas exigem aprovação); esta tela só explica o que está acontecendo. */
(function () {
  const app = () => window.ProjetoTridApp;
  let tela = null, verificando = 0;

  function montar() {
    if (tela) return tela;
    tela = document.createElement('div');
    tela.className = 'acesso'; tela.id = 'acessoPendente'; tela.hidden = true;
    tela.setAttribute('role', 'alertdialog'); tela.setAttribute('aria-modal', 'true'); tela.setAttribute('aria-labelledby', 'acessoTitulo');
    tela.innerHTML = '<div class="acesso-card"><img class="logo-light" src="./img/logo-projeto-trid-colorido.svg" alt="Projeto Trid"><img class="logo-dark" src="./img/logo-projeto-trid-escuro.svg" alt="Projeto Trid">' +
      '<h1 id="acessoTitulo"></h1><p class="acesso-texto" id="acessoTexto"></p>' +
      '<div class="acesso-botoes"><button type="button" class="btn btn-primary" id="acessoVerificar">Verificar de novo</button><button type="button" class="btn btn-outline" id="acessoSair">Sair</button></div></div>';
    document.body.append(tela);
    tela.querySelector('#acessoVerificar').addEventListener('click', verificar);
    tela.querySelector('#acessoSair').addEventListener('click', async () => { try { await app().client().auth.signOut(); } catch { /* sem rede: a tela some quando a sessão acabar */ } esconder(); });
    return tela;
  }
  function mostrar(titulo, texto) {
    const t = montar();
    t.querySelector('#acessoTitulo').textContent = titulo; t.querySelector('#acessoTexto').textContent = texto;
    t.hidden = false;
    const shell = document.getElementById('appShell'); if (shell) shell.inert = true;
    t.querySelector('#acessoVerificar').focus({ preventScroll: true });
  }
  function esconder() { if (tela) tela.hidden = true; }

  async function verificar() {
    const a = app(), usuario = a?.user();
    if (!a?.client() || !usuario) { esconder(); return; }
    const vez = ++verificando;
    try {
      const { data, error } = await a.client().rpc('inventta3d_request_access');
      if (vez !== verificando) return;
      if (error) throw error;
      if (data === 'approved') {
        const aberto = tela && !tela.hidden; esconder();
        const shell = document.getElementById('appShell'); if (shell) shell.inert = false;
        if (aberto) location.reload(); // recarrega para buscar os dados agora que o acesso foi liberado
        return;
      }
      if (data === 'blocked') mostrar('Acesso não liberado', `A conta ${usuario.email} não tem acesso ao Projeto Trid. Entre em contato com o responsável.`);
      else mostrar('Aguardando aprovação', `Pedimos o acesso para ${usuario.email}. Assim que for aprovado, toque em "Verificar de novo". Se precisar de pressa, chame o responsável pelo Projeto Trid.`);
    } catch {
      if (vez !== verificando) return;
      mostrar('Não foi possível verificar o acesso', 'Confira a conexão e tente de novo.');
    }
  }

  // o evento pode ter passado antes deste arquivo carregar: confere também ao terminar de abrir a página
  const inicial = () => { if (app()?.user()) verificar(); };
  if (document.readyState === 'complete') setTimeout(inicial, 0); else window.addEventListener('load', () => setTimeout(inicial, 0));
  // tela de login: a peça de demonstração gira ao lado do preço (só no computador, onde a coluna aparece; carrega sob demanda)
  const pecaLogin = document.querySelector('[data-login-peca]');
  if (pecaLogin && matchMedia('(min-width: 900px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const montarPeca = () => { if (getComputedStyle(pecaLogin).display === 'none' || pecaLogin.dataset.pronta) return; pecaLogin.dataset.pronta = '1'; import('/assets/logo3d.js').then((m) => m.criarPeca(pecaLogin, { paleta: 'marca', velocidade: 1.4 })).catch(() => { /* sem a peça, o quadro continua com o preço */ }); };
    if (document.readyState === 'complete') setTimeout(montarPeca, 300); else window.addEventListener('load', () => setTimeout(montarPeca, 300));
  }
  document.addEventListener('projetotrid:auth', () => { if (app()?.user()) verificar(); else { verificando++; esconder(); } });
})();
