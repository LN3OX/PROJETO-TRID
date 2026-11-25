/* Projeto Trid · Impressoras e manutenção (aba "Impressoras" em Impressões).
   Horímetro: o valor informado + as horas dos pedidos registrados no histórico depois dele (só quando há uma
   impressora; com várias, cada uma é atualizada à mão). Tarefas com intervalo em horas avisam quando vencem.
   Núcleo puro (testado em tests/manutencao.test.cjs) + tela. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridManutencaoNucleo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // ponytail: intervalos de referência comuns em impressoras FDM; ajustáveis por impressora
  const TAREFAS_PADRAO = [
    { nome: 'Limpar e lubrificar os eixos', intervalo_h: 200 },
    { nome: 'Verificar tensão das correias', intervalo_h: 500 },
    { nome: 'Limpar ventoinhas e filtro', intervalo_h: 500 },
    { nome: 'Trocar o bico (hotend)', intervalo_h: 1000 },
  ];

  // horas dos pedidos registrados depois de "desde" (print_minutes × quantidade)
  function horasDesde(impressoes, desde) {
    const t = new Date(desde).getTime();
    let min = 0;
    for (const p of impressoes) for (const r of p.inventta3d_print_requests || []) if (new Date(r.requested_at).getTime() > t) min += (Number(p.print_minutes) || 0) * (Number(r.quantity) || 0);
    return min / 60;
  }
  const horimetro = (imp, impressoes, unica) => (Number(imp.hours) || 0) + (unica ? horasDesde(impressoes, imp.hours_at) : 0);

  function situacao(tarefa, horas) {
    const feitas = horas - (Number(tarefa.ultima_h) || 0), intervalo = Number(tarefa.intervalo_h) || 1;
    const faltam = intervalo - feitas;
    return { faltam, pct: Math.max(0, Math.min(100, (feitas / intervalo) * 100)), vencida: faltam <= 0, perto: faltam > 0 && faltam <= intervalo * 0.1 };
  }

  const novasTarefas = (horas) => TAREFAS_PADRAO.map((t) => ({ ...t, ultima_h: horas, ultima_em: null }));

  return { TAREFAS_PADRAO, horasDesde, horimetro, situacao, novasTarefas };
});

(() => {
  if (typeof document === 'undefined') return;
  const N = window.ProjetoTridManutencaoNucleo, $ = (id) => document.getElementById(id), app = () => window.ProjetoTridApp;
  if (!$('printerList')) return;
  const COLS = 'id,name,model,hours,hours_at,tasks,log,created_at';
  const h1 = (n) => `${(Math.round(n * 10) / 10).toLocaleString('pt-BR')} h`;
  const num = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));
  const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const hojeISO = () => new Date().toISOString().slice(0, 10);
  let maquinas = [], impressoes = [], carregado = false, editando = null;

  async function carregar() {
    if (!(app()?.client() && app()?.user())) { maquinas = []; carregado = false; return desenhar(); }
    const c = app().client();
    const [m, p] = await Promise.all([
      c.from('inventta3d_printers').select(COLS).limit(50),
      c.from('inventta3d_prints').select('id,print_minutes,inventta3d_print_requests(id,quantity,requested_at)').limit(1000),
    ]);
    if (m.error || p.error) { $('printerStatus').textContent = 'Não foi possível carregar as impressoras. Atualize a página para tentar novamente.'; return; }
    maquinas = m.data || []; impressoes = p.data || []; carregado = true; desenhar();
  }

  async function gravar(imp, campos, msg) {
    const r = await app().client().from('inventta3d_printers').update(campos).eq('id', imp.id).select(COLS).single();
    if (r.error) { app().status('Não foi possível salvar a impressora.', true); return null; }
    maquinas = maquinas.map((x) => (x.id === imp.id ? r.data : x)); desenhar();
    if (msg) app().status(msg);
    return r.data;
  }

  function desenhar() {
    const lista = $('printerList');
    lista.replaceChildren(); $('printerStatus').textContent = '';
    if (!carregado) return;
    if (!maquinas.length) {
      const v = el('div', 'saved-empty'), ic = el('div', 'saved-empty-icon');
      ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = '<svg class="icon"><use href="#i-cube"/></svg>';
      v.append(ic, el('h3', '', 'Nenhuma impressora cadastrada'), el('p', '', 'Cadastre sua impressora para acompanhar as horas de uso e ser avisado da manutenção.'));
      const b = el('button', 'btn btn-primary', 'Nova impressora'); b.type = 'button'; b.addEventListener('click', () => abrir());
      v.append(b); lista.append(v); return;
    }
    const unica = maquinas.length === 1;
    maquinas.forEach((imp) => {
      const horas = N.horimetro(imp, impressoes, unica);
      const card = el('article', 'printer-card'), topo = el('div', 'printer-head'), info = el('div');
      info.append(el('strong', '', imp.name), el('small', '', `${imp.model || 'Modelo não informado'} · ${h1(horas)} de impressão${unica ? '' : ' (informado)'}`));
      const acoes = el('div', 'saved-quote-actions');
      const hor = el('button', 'btn btn-sm btn-outline', 'Atualizar horas'), ed = el('button', 'btn btn-sm btn-outline', 'Editar'), del = el('button', 'btn btn-sm btn-danger delete', 'Excluir');
      hor.type = ed.type = del.type = 'button';
      hor.addEventListener('click', () => atualizarHoras(imp, horas));
      ed.addEventListener('click', () => abrir(imp));
      del.addEventListener('click', () => excluir(imp));
      acoes.append(hor, ed, del); topo.append(info, acoes); card.append(topo);
      const ul = el('ul', 'printer-tasks');
      (imp.tasks || []).forEach((t, i) => {
        const s = N.situacao(t, horas), li = el('li', s.vencida ? 'vencida' : s.perto ? 'perto' : '');
        const txt = el('div');
        txt.append(el('span', '', t.nome), el('small', '', s.vencida ? `Vencida há ${h1(-s.faltam)}` : `Faltam ${h1(s.faltam)} · a cada ${h1(t.intervalo_h)}`));
        const barra = el('div', 'spool-meter'), cheio = el('span');
        barra.setAttribute('role', 'meter'); barra.setAttribute('aria-valuemin', '0'); barra.setAttribute('aria-valuemax', '100'); barra.setAttribute('aria-valuenow', String(Math.round(s.pct))); barra.setAttribute('aria-label', `Uso desde a última vez: ${t.nome}`);
        cheio.style.width = `${s.pct}%`; barra.append(cheio); txt.append(barra);
        const feito = el('button', 'btn btn-sm ' + (s.vencida ? 'btn-solid' : 'btn-outline'), 'Feito');
        feito.type = 'button'; feito.setAttribute('aria-label', `Marcar como feito: ${t.nome}`);
        feito.addEventListener('click', () => marcarFeito(imp, i, horas));
        li.append(txt, feito); ul.append(li);
      });
      card.append(ul);
      const gasto = (imp.log || []).reduce((t, l) => t + (Number(l.custo) || 0), 0);
      if ((imp.log || []).length) card.append(el('p', 'printer-log', `${imp.log.length} manutenç${imp.log.length === 1 ? 'ão registrada' : 'ões registradas'} · ${real.format(gasto)} gastos · última em ${imp.log[imp.log.length - 1].em.split('-').reverse().join('/')}`));
      lista.append(card);
    });
  }

  async function marcarFeito(imp, i, horas) {
    const v = prompt(`Quanto custou "${imp.tasks[i].nome}"? (deixe em branco se não teve custo)`, '');
    if (v === null) return;
    const custo = num(v || 0);
    if (!(custo >= 0)) { app().status('Informe um valor em reais ou deixe em branco.', true); return; }
    const tasks = imp.tasks.map((t, k) => (k === i ? { ...t, ultima_h: Math.round(horas * 10) / 10, ultima_em: hojeISO() } : t));
    const log = [...(imp.log || []), { em: hojeISO(), tarefa: imp.tasks[i].nome, custo }].slice(-200);
    await gravar(imp, { tasks, log }, `${imp.tasks[i].nome}: registrado.`);
  }

  async function atualizarHoras(imp, atual) {
    const v = prompt('Horas de impressão mostradas na impressora (ex.: 1234,5):', String(Math.round(atual * 10) / 10).replace('.', ','));
    if (v === null) return;
    const horas = num(v);
    if (!(horas >= 0)) { app().status('Informe as horas como número.', true); return; }
    await gravar(imp, { hours: horas, hours_at: new Date().toISOString() }, 'Horas atualizadas.');
  }

  function abrir(imp) {
    editando = imp || null;
    $('printerDialogTitle').textContent = imp ? 'Editar impressora' : 'Nova impressora';
    $('printerName').value = imp?.name || '';
    $('printerModelSel').value = imp?.model || $('printerModel')?.value || 'Bambu Lab A1';
    $('printerHours').value = imp ? String(Number(imp.hours)).replace('.', ',') : '0';
    $('printerMsg').textContent = '';
    $('printerDialog').showModal();
    $('printerName').focus();
  }

  async function salvar(e) {
    e.preventDefault();
    const name = $('printerName').value.trim(), model = $('printerModelSel').value, hours = num($('printerHours').value || 0);
    if (!name) { $('printerMsg').textContent = 'Dê um nome à impressora (ex.: A1 da bancada).'; $('printerName').focus(); return; }
    if (!(hours >= 0)) { $('printerMsg').textContent = 'Informe as horas como número.'; return; }
    if (!confirm(editando ? 'Salvar as alterações desta impressora?' : 'Salvar esta nova impressora?')) return;
    const c = app().client().from('inventta3d_printers');
    const dados = editando ? { name, model, ...(Number(editando.hours) !== hours ? { hours, hours_at: new Date().toISOString() } : {}) } : { name, model, hours, hours_at: new Date().toISOString(), tasks: N.novasTarefas(hours), log: [] };
    const r = editando ? await c.update(dados).eq('id', editando.id).select(COLS).single() : await c.insert(dados).select(COLS).single();
    if (r.error) { $('printerMsg').textContent = 'Não foi possível salvar. Tente novamente.'; return; }
    maquinas = maquinas.filter((x) => x.id !== r.data.id).concat(r.data);
    $('printerDialog').close(); desenhar();
    app().status(editando ? 'Impressora atualizada.' : 'Impressora cadastrada com as tarefas de manutenção.');
  }

  async function excluir(imp) {
    if (!confirm(`Excluir ${imp.name} e o registro de manutenção?`)) return;
    const { error } = await app().client().from('inventta3d_printers').delete().eq('id', imp.id);
    if (error) { app().status('Não foi possível excluir a impressora.', true); return; }
    maquinas = maquinas.filter((x) => x.id !== imp.id); desenhar();
    app().status('Impressora excluída.');
  }

  $('newPrinterBtn').addEventListener('click', () => abrir());
  $('printerForm').addEventListener('submit', salvar);
  $('printerCancel').addEventListener('click', () => $('printerDialog').close());
  document.addEventListener('projetotrid:auth', () => { carregado = false; if (!$('panelMaquinas').hidden) carregar(); });
  document.addEventListener('projetotrid:aba', (e) => { if (e.detail === 'panelMaquinas') carregar(); });
})();
