/* Registro de módulos da Projeto Trid.
   Cada entrada gera um item de navegação (barra lateral no computador, barra inferior no celular)
   e liga uma rota (hash) a uma página <main data-page="id">.
   Para adicionar um módulo: crie a página no index.html, os estilos em css/modules/ e uma entrada aqui.
   Campos:
     id          identificador; deve ser igual ao data-page da página
     label       nome completo (leitores de tela, dica ao passar o mouse, título da aba)
     short       rótulo curto exibido na navegação (até ~12 caracteres)
     route       hash da rota; o módulo com default:true responde a qualquer hash desconhecido
     icon        símbolo do sprite (#i-...) e iconActive para o estado selecionado
     hidden      true para registrar a rota sem mostrar na navegação */
window.PROJETOTRID_MODULES = [
  { id: 'novo-orcamento', label: 'Novo orçamento', short: 'Novo', route: '#top', icon: 'i-calc', iconActive: 'i-calc-fill', default: true },
  { id: 'orcamentos-salvos', label: 'Orçamentos salvos', short: 'Salvos', route: '#/orcamentos-salvos', icon: 'i-list', iconActive: 'i-list-fill' },
  { id: 'clientes', label: 'Clientes', short: 'Clientes', route: '#/clientes', icon: 'i-group', iconActive: 'i-group-fill' },
  { id: 'painel', label: 'Painel do mês', short: 'Painel', route: '#/painel', icon: 'i-chart' },
  { id: 'impressoes', label: 'Impressões', short: 'Impressões', route: '#/impressoes', icon: 'i-cube', iconActive: 'i-cube-fill' }
];
