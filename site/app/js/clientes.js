/* Projeto Trid · módulo Clientes: cadastro, consulta, edição e uso nos orçamentos.
   Usa o cliente Supabase e o usuário expostos por app.js (window.ProjetoTridApp). */
(()=>{
  const $=id=>document.getElementById(id),app=()=>window.ProjetoTridApp;
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const digits=s=>String(s||'').replace(/\D/g,'');
  const fmtPhone=v=>{const d=digits(v).slice(0,11);if(d.length<=2)return d;const s=d.slice(2),p=d.length>10?5:4;return `(${d.slice(0,2)}) ${s.length>p?s.slice(0,p)+'-'+s.slice(p):s}`};
  const COLS='id,name,email,phone,notes,created_at';
  let customers=[],loaded=false,editingId=null;
  const ready=()=>!!(app()&&app().client()&&app().user());
  const sortByName=()=>customers.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));

  async function load(force){
    if(!ready()){customers=[];loaded=false;render();fillPicker();return}
    if(loaded&&!force)return;
    $('customerStatus').textContent='Carregando seus clientes…';
    const{data,error}=await app().client().from('inventta3d_customers').select(COLS).limit(500);
    if(error){$('customerStatus').textContent='Não foi possível carregar seus clientes. Atualize a página para tentar novamente.';return}
    customers=data||[];sortByName();loaded=true;render();fillPicker();
  }

  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}

  function render(){
    const list=$('customerList'),status=$('customerStatus'),raw=$('customerSearch').value.trim(),q=norm(raw);
    const rows=customers.filter(c=>!q||norm([c.name,c.email,c.phone,c.notes].join(' ')).includes(q));
    list.replaceChildren();
    if(!rows.length){
      const empty=el('div','saved-empty'),icon=el('div','saved-empty-icon');
      icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg class="icon"><use href="#i-group"/></svg>';
      empty.append(icon,el('h3','',customers.length?'Nenhum resultado encontrado':'Nenhum cliente salvo ainda'),el('p','',customers.length?'Tente outro termo ou limpe a busca para ver seus clientes.':'Cadastre um cliente para preencher os orçamentos com um toque.'));
      const b=el('button','btn '+(customers.length?'btn-outline':'btn-primary'),customers.length?'Limpar busca':'Novo cliente');b.type='button';
      b.addEventListener('click',()=>{if(customers.length){$('customerSearch').value='';render();$('customerSearch').focus()}else openDialog()});
      empty.append(b);list.append(empty);
    }
    rows.forEach(c=>{
      const row=el('article','saved-quote-row'),info=el('div'),acts=el('div','saved-quote-actions customer-row-actions');
      info.append(el('strong','',c.name),el('small','',[c.email,c.phone].filter(Boolean).join(' · ')||'Sem e-mail ou telefone'));
      if(c.notes)info.append(el('small','',c.notes));
      const use=el('button','btn btn-sm btn-solid','Orçar'),edit=el('button','btn btn-sm btn-outline','Editar'),del=el('button','btn btn-sm btn-danger delete','Excluir');
      use.type=edit.type=del.type='button';
      use.addEventListener('click',()=>{fillQuote(c);location.hash='#top';app().status(`${c.name} adicionado ao novo orçamento.`)});
      edit.addEventListener('click',()=>openDialog(c));
      del.addEventListener('click',()=>remove(c));
      acts.append(use,edit,del);row.append(info,acts);list.append(row);
    });
    const total=customers.length;
    status.textContent=!total?'Nenhum cliente salvo ainda.':!rows.length?`Nenhum cliente encontrado para “${raw}”.`:q?`${rows.length} de ${total} clientes.`:`${total} cliente${total===1?'':'s'} salvo${total===1?'':'s'}.`;
  }

  function fillQuote(c){
    [['clientName',c.name],['clientEmail',c.email],['clientPhone',c.phone]].forEach(([id,v])=>{const e=$(id);if(!e)return;e.value=v||'';e.dispatchEvent(new Event('input',{bubbles:true}))});
  }

  function fillPicker(){
    const field=$('customerPickField'),sel=$('customerPick');if(!field||!sel)return;
    sel.replaceChildren(new Option('Escolher cliente salvo…',''));
    customers.forEach(c=>sel.append(new Option(c.name,c.id)));
    field.hidden=!customers.length;
  }

  async function remove(c){
    if(!window.confirm(`Excluir “${c.name}”? Os orçamentos já salvos não são alterados.`))return;
    const{error}=await app().client().from('inventta3d_customers').delete().eq('id',c.id);
    if(error){$('customerStatus').textContent='Não foi possível excluir este cliente.';return}
    customers=customers.filter(x=>x.id!==c.id);render();fillPicker();app().status('Cliente excluído.');
  }

  /* diálogo de cadastro/edição */
  function openDialog(c){
    editingId=c?c.id:null;
    $('customerDialogTitle').textContent=c?'Editar cliente':'Novo cliente';
    $('customerName').value=c?.name||'';$('customerEmail').value=c?.email||'';$('customerPhone').value=c?.phone||'';$('customerNotes').value=c?.notes||'';
    $('customerMsg').textContent='';
    $('customerDialog').showModal();$('customerName').focus();
  }
  const closeDialog=()=>$('customerDialog').close();

  async function upsert(fields,id){
    const c=app().client(),payload={name:fields.name,email:fields.email,phone:fields.phone,notes:fields.notes,updated_at:new Date().toISOString()};
    const res=id?await c.from('inventta3d_customers').update(payload).eq('id',id).select(COLS).single():await c.from('inventta3d_customers').insert(payload).select(COLS).single();
    if(res.error)throw res.error;
    customers=customers.filter(x=>x.id!==res.data.id);customers.push(res.data);sortByName();render();fillPicker();
    return res.data;
  }

  $('customerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const msg=$('customerMsg'),name=$('customerName').value.trim(),email=$('customerEmail');
    if(!name){msg.textContent='Informe o nome do cliente.';$('customerName').focus();return}
    if(email.value&&!email.validity.valid){msg.textContent='Informe um e-mail válido, por exemplo nome@exemplo.com.';email.focus();return}
    if(!ready()){msg.textContent='Entre na sua conta para salvar clientes.';return}
    if(!window.confirm(editingId?'Salvar as alterações deste cliente?':'Salvar este novo cliente?'))return;
    const btn=$('customerSave');btn.disabled=true;
    try{await upsert({name,email:email.value.trim(),phone:$('customerPhone').value,notes:$('customerNotes').value.trim()},editingId);closeDialog();app().status('Cliente salvo.')}
    catch{msg.textContent='Não foi possível salvar. Confira sua conexão e tente novamente.'}
    finally{btn.disabled=false}
  });
  $('customerPhone').addEventListener('input',()=>{$('customerPhone').value=fmtPhone($('customerPhone').value)});
  $('customerClose').addEventListener('click',closeDialog);$('customerCancel').addEventListener('click',closeDialog);
  $('newCustomerBtn').addEventListener('click',()=>openDialog());
  $('customerSearch').addEventListener('input',render);

  /* no orçamento: escolher cliente salvo e salvar o cliente digitado */
  $('customerPick').addEventListener('change',()=>{const c=customers.find(x=>x.id===$('customerPick').value);if(c)fillQuote(c);$('customerPick').value=''});
  $('saveCustomerBtn').addEventListener('click',async()=>{
    const name=$('clientName').value.trim(),email=$('clientEmail').value.trim(),phone=$('clientPhone').value;
    if(!ready()){app().status('Entre na sua conta para salvar clientes.',true);return}
    if(!name){app().status('Informe o nome do cliente para salvar.',true);$('clientName').focus();return}
    if(email&&!$('clientEmail').validity.valid){app().status('Informe um e-mail válido para salvar o cliente.',true);$('clientEmail').focus();return}
    if(!window.confirm('Salvar este cliente?'))return;
    const btn=$('saveCustomerBtn');btn.disabled=true;
    try{
      await load();
      const found=customers.find(c=>(email&&c.email.toLowerCase()===email.toLowerCase())||(digits(phone)&&digits(c.phone)===digits(phone)));
      await upsert({name,email,phone,notes:found?.notes||''},found?.id);
      app().status(found?'Dados do cliente atualizados.':'Cliente salvo.');
    }catch{app().status('Não foi possível salvar o cliente. Confira sua conexão e tente novamente.',true)}
    finally{btn.disabled=false}
  });

  window.ProjetoTridCustomers={list:()=>customers};
  document.addEventListener('projetotrid:auth',()=>{loaded=false;load()});
  window.addEventListener('hashchange',()=>{if(location.hash==='#/clientes')load(true)});
  load();
})();
