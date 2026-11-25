/* Projeto Trid · Estoque de filamento (aba "Filamentos" em Impressões): um registro por rolo.
   Desconta o consumo ao salvar no histórico (impressoes.js chama ProjetoTridEstoque.descontar) e mostra na etapa 2
   quanto há do material escolhido. Núcleo puro (testado em tests/estoque.test.cjs) + tela. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ProjetoTridEstoqueNucleo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const mesmo = (r, material, cor) => norm(r.material) === norm(material) && (!norm(cor) || norm(r.color) === norm(cor));
  const restante = (r) => Number(r.remaining_g) || 0;

  // Rolo para descontar: do mesmo material e cor; o que já está aberto (menos restante) e ainda basta; senão o maior
  function escolherRolo(rolos, material, cor, gramas) {
    const c = rolos.filter((r) => mesmo(r, material, cor) && restante(r) > 0);
    if (!c.length) return null;
    const bastam = c.filter((r) => restante(r) >= gramas).sort((a, b) => restante(a) - restante(b));
    return bastam[0] || c.sort((a, b) => restante(b) - restante(a))[0];
  }
  const disponivel = (rolos, material, cor) => rolos.filter((r) => mesmo(r, material, cor)).reduce((t, r) => t + restante(r), 0);
  const situacao = (r) => { const pct = Math.max(0, Math.min(100, (restante(r) / (Number(r.weight_g) || 1)) * 100)); return { pct, baixo: pct < 20 }; };

  return { escolherRolo, disponivel, situacao, norm };
});

(() => {
  if (typeof document === 'undefined') return;
  const N = window.ProjetoTridEstoqueNucleo, $ = (id) => document.getElementById(id), app = () => window.ProjetoTridApp;
  if (!$('spoolList')) return;
  const COLS = 'id,material,color,brand,weight_g,remaining_g,price,notes,created_at';
  const g = (n) => `${Math.round(Number(n) || 0).toLocaleString('pt-BR')} g`;
  const num = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  let rolos = [], carregado = false, editando = null;
  const pronto = () => !!(app()?.client() && app()?.user());

  async function carregar(forcar) {
    if (!pronto()) { rolos = []; carregado = false; desenhar(); dicaOrcamento(); return; }
    if (carregado && !forcar) return;
    const { data, error } = await app().client().from('projetotrid_spools').select(COLS).limit(500);
    if (error) { $('spoolStatus').textContent = 'Não foi possível carregar o estoque. Atualize a página para tentar novamente.'; return; }
    rolos = data || []; carregado = true; desenhar(); dicaOrcamento();
  }

  function desenhar() {
    const lista = $('spoolList');
    lista.replaceChildren();
    $('spoolStatus').textContent = '';
    if (!rolos.length) {
      const v = el('div', 'saved-empty'), ic = el('div', 'saved-empty-icon');
      ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = '<svg class="icon"><use href="#i-spool"/></svg>';
      v.append(ic, el('h3', '', 'Nenhum rolo cadastrado'), el('p', '', 'Cadastre seus rolos para o app descontar o consumo de cada impressão e avisar antes de faltar.'));
      const b = el('button', 'btn btn-primary', 'Novo rolo'); b.type = 'button'; b.addEventListener('click', () => abrir());
      v.append(b); lista.append(v); return;
    }
    [...rolos].sort((a, b) => a.material.localeCompare(b.material, 'pt-BR') || a.color.localeCompare(b.color, 'pt-BR')).forEach((r) => {
      const { pct, baixo } = N.situacao(r);
      const linha = el('article', 'saved-quote-row spool-row' + (baixo ? ' baixo' : '')), info = el('div'), acts = el('div', 'saved-quote-actions');
      const titulo = el('strong', '', [r.material, r.color, r.brand].filter(Boolean).join(' · '));
      info.append(titulo);
      const barra = el('div', 'spool-meter'), cheio = el('span');
      barra.setAttribute('role', 'meter'); barra.setAttribute('aria-valuemin', '0'); barra.setAttribute('aria-valuemax', '100'); barra.setAttribute('aria-valuenow', String(Math.round(pct)));
      barra.setAttribute('aria-label', `Restante de ${titulo.textContent}`);
      cheio.style.width = `${pct}%`; barra.append(cheio);
      info.append(barra, el('small', '', `${g(r.remaining_g)} de ${g(r.weight_g)} (${Math.round(pct)}%)${baixo ? ' · acabando' : ''}`));
      const usar = el('button', 'btn btn-sm btn-solid', 'Descontar'), editar = el('button', 'btn btn-sm btn-outline', 'Editar'), apagar = el('button', 'btn btn-sm btn-danger delete', 'Excluir');
      usar.type = editar.type = apagar.type = 'button';
      usar.setAttribute('aria-label', `Descontar uso de ${titulo.textContent}`);
      usar.addEventListener('click', () => descontarManual(r));
      editar.addEventListener('click', () => abrir(r));
      apagar.addEventListener('click', () => excluir(r));
      acts.append(usar, editar, apagar); linha.append(info, acts); lista.append(linha);
    });
  }

  function abrir(r) {
    editando = r || null;
    $('spoolDialogTitle').textContent = r ? 'Editar rolo' : 'Novo rolo';
    $('spoolMaterial').value = r?.material || $('filamentType')?.value || 'PLA';
    $('spoolColor').value = r?.color || '';
    $('spoolBrand').value = r?.brand || '';
    $('spoolWeight').value = r ? Number(r.weight_g) : 1000;
    $('spoolRemaining').value = r ? Number(r.remaining_g) : 1000;
    $('spoolPrice').value = r ? String(Number(r.price).toFixed(2)).replace('.', ',') : '';
    $('spoolMsg').textContent = '';
    $('spoolDialog').showModal();
    $('spoolMaterial').focus();
  }

  async function salvar(e) {
    e.preventDefault();
    const dados = { material: $('spoolMaterial').value.trim(), color: $('spoolColor').value.trim(), brand: $('spoolBrand').value.trim(), weight_g: num($('spoolWeight').value), remaining_g: num($('spoolRemaining').value), price: num($('spoolPrice').value || 0) };
    if (!dados.material) { $('spoolMsg').textContent = 'Informe o material.'; $('spoolMaterial').focus(); return; }
    if (!(dados.weight_g > 0) || !(dados.remaining_g >= 0) || dados.remaining_g > dados.weight_g || !(dados.price >= 0)) { $('spoolMsg').textContent = 'Confira os pesos: o restante não pode passar do peso do rolo.'; return; }
    if (!confirm(editando ? 'Salvar as alterações deste rolo?' : 'Salvar este novo rolo?')) return;
    const c = app().client().from('projetotrid_spools');
    const r = editando ? await c.update(dados).eq('id', editando.id).select(COLS).single() : await c.insert(dados).select(COLS).single();
    if (r.error) { $('spoolMsg').textContent = 'Não foi possível salvar. Tente novamente.'; return; }
    rolos = rolos.filter((x) => x.id !== r.data.id).concat(r.data);
    $('spoolDialog').close(); desenhar(); dicaOrcamento();
    app().status(editando ? 'Rolo atualizado.' : 'Rolo cadastrado no estoque.');
  }

  async function gravarRestante(r, novo) {
    const res = await app().client().from('projetotrid_spools').update({ remaining_g: Math.max(0, Math.round(novo * 100) / 100) }).eq('id', r.id).select(COLS).single();
    if (res.error) return null;
    rolos = rolos.map((x) => (x.id === r.id ? res.data : x)); desenhar(); dicaOrcamento();
    return res.data;
  }

  async function descontarManual(r) {
    const v = prompt(`Quantos gramas descontar de ${[r.material, r.color].filter(Boolean).join(' ')}?`, '');
    if (v === null) return;
    const gramas = num(v);
    if (!(gramas > 0)) { app().status('Informe um número de gramas maior que zero.', true); return; }
    const novo = await gravarRestante(r, Number(r.remaining_g) - gramas);
    app().status(novo ? `Restam ${g(novo.remaining_g)}.` : 'Não foi possível atualizar o rolo.', !novo);
  }

  async function excluir(r) {
    if (!confirm(`Excluir o rolo ${[r.material, r.color].filter(Boolean).join(' ')}?`)) return;
    const { error } = await app().client().from('projetotrid_spools').delete().eq('id', r.id);
    if (error) { app().status('Não foi possível excluir o rolo.', true); return; }
    rolos = rolos.filter((x) => x.id !== r.id); desenhar(); dicaOrcamento();
    app().status('Rolo excluído do estoque.');
  }

  // chamado pelo histórico ao registrar um pedido; devolve um texto para a mensagem de status (ou '')
  async function descontar(material, cor, gramas) {
    await carregar();
    const r = N.escolherRolo(rolos, material, cor, gramas);
    if (!r || !(gramas > 0)) return '';
    const novo = await gravarRestante(r, Number(r.remaining_g) - gramas);
    if (!novo) return ' Não foi possível descontar do estoque.';
    return ` Estoque: ${[novo.material, novo.color].filter(Boolean).join(' ')} ficou com ${g(novo.remaining_g)}${N.situacao(novo).baixo ? ' (acabando)' : ''}.`;
  }

  // etapa 2 do orçamento: quanto há do material e cor escolhidos e se basta para o pedido
  function dicaOrcamento() {
    const dica = $('stockHint');
    if (!dica) return;
    const mat = $('filamentType').value === 'Outro tipo (especificar)' ? $('customFilament').value : $('filamentType').value;
    const cor = $('filamentColor').value, temRolo = rolos.some((r) => N.norm(r.material) === N.norm(mat));
    dica.hidden = !carregado || !temRolo;
    if (dica.hidden) return;
    const tem = N.disponivel(rolos, mat, cor);
    const precisa = (num($('amount').value) || 0) * (Number($('quantity').value) || 1) * (1 + (num($('waste').value) || 0) / 100);
    dica.classList.toggle('falta', precisa > tem);
    dica.textContent = `Em estoque: ${g(tem)} de ${[mat, cor].filter(Boolean).join(' ')}` + (precisa > tem ? `. Este pedido usa cerca de ${g(precisa)}: não basta.` : '.');
  }

  $('newSpoolBtn').addEventListener('click', () => abrir());
  $('spoolForm').addEventListener('submit', salvar);
  $('spoolCancel').addEventListener('click', () => $('spoolDialog').close());
  for (const id of ['filamentType', 'customFilament', 'filamentColor', 'amount', 'quantity', 'waste']) $(id)?.addEventListener('input', dicaOrcamento);
  $('filamentType')?.addEventListener('change', dicaOrcamento);
  document.addEventListener('projetotrid:auth', () => { carregado = false; carregar(); });
  document.addEventListener('projetotrid:aba', (e) => { if (e.detail === 'panelRolos') carregar(true); });
  window.addEventListener('hashchange', () => { if (location.hash === '#/impressoes' && !$('panelRolos').hidden) carregar(true); });
  carregar();
  window.ProjetoTridEstoque = { descontar, recarregar: () => carregar(true) };
})();
