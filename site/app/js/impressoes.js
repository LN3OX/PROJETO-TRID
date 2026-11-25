/* Projeto Trid · módulo Impressões: histórico do que foi orçado/impresso.
   Salva peça, material, peso, tempo e custos de impressão (por peça), os clientes e as datas dos pedidos,
   e opcionalmente o arquivo STL/3MF. Usa window.ProjetoTridApp (app.js) e window.ProjetoTridCustomers (clientes.js). */
(()=>{
  const $=id=>document.getElementById(id),app=()=>window.ProjetoTridApp;
  const BUCKET='projetotrid-models',MAX_FILE=50*1024*1024,EXT=/\.(stl|3mf)$/i;
  const COLS='id,name,material,color,weight_g,print_minutes,material_cost,energy_cost,machine_cost,print_cost,file_path,file_name,file_size,showcase,showcase_price,showcase_text,photo_path,created_at,updated_at,projetotrid_print_requests(id,customer_id,customer_name,quantity,unit_print_cost,requested_at,quote_id)';
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const digits=s=>String(s||'').replace(/\D/g,'');
  const p2=n=>String(n).padStart(2,'0');
  const fmtTime=m=>`${p2(Math.floor(m/60))}:${p2(m%60)}`;
  const fmtG=g=>`${Number(g).toLocaleString('pt-BR',{maximumFractionDigits:2})} g`;
  const fmtDate=d=>new Date(d).toLocaleDateString('pt-BR');
  const fmtSize=b=>b>=1048576?`${(b/1048576).toFixed(1).replace('.',',')} MB`:`${Math.max(1,Math.round(b/1024))} KB`;
  const ready=()=>!!(app()&&app().client()&&app().user());
  const r2=n=>Math.round((Number(n)||0)*100)/100;
  let prints=[],loaded=false,current=null,pending=[];
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
  const lastDate=p=>p.projetotrid_print_requests.reduce((m,r)=>r.requested_at>m?r.requested_at:m,p.created_at);

  async function load(force){
    if(!ready()){prints=[];loaded=false;render();return}
    if(loaded&&!force)return;
    $('printStatus').textContent='Carregando seu histórico…';
    const{data,error}=await app().client().from('projetotrid_prints').select(COLS).limit(500);
    if(error){$('printStatus').textContent='Não foi possível carregar o histórico. Atualize a página para tentar novamente.';return}
    prints=(data||[]).map(p=>({...p,projetotrid_print_requests:p.projetotrid_print_requests||[]}));loaded=true;render();
  }

  /* ---------- lista ---------- */
  function render(){
    const list=$('printList'),raw=$('printSearch').value.trim(),q=norm(raw),sort=$('printSort').value||'recent';
    const rows=prints.filter(p=>!q||norm([p.name,p.material,p.color,...p.projetotrid_print_requests.map(r=>r.customer_name)].join(' ')).includes(q));
    const by={recent:(a,b)=>lastDate(b).localeCompare(lastDate(a)),name:(a,b)=>a.name.localeCompare(b.name,'pt-BR'),orders:(a,b)=>b.projetotrid_print_requests.length-a.projetotrid_print_requests.length};
    rows.sort(by[sort]||by.recent);list.replaceChildren();
    if(!rows.length){
      const empty=el('div','saved-empty'),icon=el('div','saved-empty-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg class="icon"><use href="#i-cube"/></svg>';
      empty.append(icon,el('h3','',prints.length?'Nenhum resultado encontrado':'Nenhuma impressão salva ainda'),el('p','',prints.length?'Tente outro termo ou limpe a busca.':'Ao final de um orçamento, use “Salvar no histórico” para registrar o que foi impresso.'));
      if(prints.length){const b=el('button','btn btn-outline','Limpar busca');b.type='button';b.addEventListener('click',()=>{$('printSearch').value='';render();$('printSearch').focus()});empty.append(b)}
      else{const a=el('a','btn btn-primary','Criar orçamento');a.href='#top';empty.append(a)}
      list.append(empty);
    }
    rows.forEach(p=>{
      const reqs=p.projetotrid_print_requests,names=[...new Set(reqs.map(r=>r.customer_name).filter(Boolean))];
      const row=el('article','saved-quote-row'),info=el('div'),acts=el('div','saved-quote-actions');
      info.append(el('strong','',p.name),el('small','',[p.material+(p.color?` · ${p.color}`:''),fmtG(p.weight_g),fmtTime(p.print_minutes),`${money.format(Number(p.print_cost))} de impressão por peça`].join(' · ')));
      info.append(el('small','',`${reqs.length} pedido${reqs.length===1?'':'s'} · último em ${fmtDate(lastDate(p))}${names.length?' · '+names.join(', '):''}`));
      if(p.file_name)info.append(el('small','',`Arquivo: ${p.file_name}`));
      const again=el('button','btn btn-sm btn-solid','Orçar de novo'),open=el('button','btn btn-sm btn-outline','Detalhes'),del=el('button','btn btn-sm btn-danger delete','Excluir');again.type=open.type=del.type='button';
      again.setAttribute('aria-label',`Orçar de novo: ${p.name}`);
      again.addEventListener('click',()=>orcarDeNovo(p));open.addEventListener('click',()=>openDetail(p.id));del.addEventListener('click',()=>removePrint(p));
      acts.append(again,open,del);row.append(info,acts);list.append(row);
    });
    const total=prints.length;
    $('printStatus').textContent=!total?'Nenhuma impressão salva ainda.':!rows.length?`Nenhuma impressão encontrada para “${raw}”.`:q?`${rows.length} de ${total} impressões.`:`${total} impressão${total===1?'':'ões'} salva${total===1?'':'s'}.`;
  }

  /* ---------- salvar a partir do orçamento ---------- */
  function itemsFromQuote(){
    const calc=window.ProjetoTridCalculations;
    return (app().quotes()||[]).map(it=>{
      const d=it.data||{},r=it.result||{},q=Math.max(1,Math.floor(Number(r.q)||Number(d.quantity)||1));
      const material=d.filamentType==='Outro tipo (especificar)'?(d.customFilament?.trim()||'Outro filamento'):(d.filamentType||'');
      const mat=r2((Number(r.material)||0)/q),en=r2((Number(r.energy)||0)/q),mc=r2((Number(r.machine)||0)/q);
      return{name:(d.product||'').trim()||'Peça sem nome',material,color:(d.filamentColor||'').trim(),weight_g:r2(d.amount),print_minutes:Math.round((calc.printDurationHours(d.printHours)||0)*60),material_cost:mat,energy_cost:en,machine_cost:mc,print_cost:r2(mat+en+mc),quantity:q};
    });
  }

  function openSave(){
    if(!ready()){app().status('Entre na sua conta para salvar no histórico.',true);return}
    const items=itemsFromQuote();if(!items.length)return;
    pending=items;const box=$('printSaveList');box.replaceChildren();
    items.forEach((it,i)=>{
      const wrap=el('div','print-save-item'),lab=el('label','print-save-check'),cb=el('input');cb.type='checkbox';cb.checked=true;cb.dataset.i=i;
      lab.append(cb,el('span','',it.name));
      const meta=el('small','',[it.material+(it.color?` · ${it.color}`:''),fmtG(it.weight_g),fmtTime(it.print_minutes),`${money.format(it.print_cost)} de impressão por peça`].join(' · '));
      const fl=el('label','print-file-label','Quer anexar o arquivo da impressão (STL ou 3MF)? Opcional.');fl.setAttribute('for','printFile'+i);
      const f=el('input','control print-file');f.type='file';f.id='printFile'+i;f.accept='.stl,.3mf';f.dataset.i=i;
      wrap.append(lab,meta,fl,f);box.append(wrap);
    });
    $('printSaveMsg').textContent='';$('printSaveDialog').showModal();
  }

  async function ensureCustomerId(){
    const d=(app().quotes()[0]||{}).data||{},name=(d.clientName||'').trim();
    const list=window.ProjetoTridCustomers?window.ProjetoTridCustomers.list():[];
    const email=(d.clientEmail||'').trim().toLowerCase(),phone=digits(d.clientPhone);
    const found=list.find(c=>(email&&c.email.toLowerCase()===email)||(phone&&digits(c.phone)===phone)||(name&&norm(c.name)===norm(name)));
    return{id:found?.id||null,name:name||found?.name||''};
  }

  async function savePrints(){
    const msg=$('printSaveMsg'),boxes=[...$('printSaveList').querySelectorAll('input[type=checkbox]')].filter(c=>c.checked);
    if(!boxes.length){msg.textContent='Escolha ao menos uma peça para salvar.';return}
    for(const c of boxes){const f=$('printFile'+c.dataset.i).files[0];if(!f)continue;
      if(!EXT.test(f.name)){msg.textContent=`“${f.name}” não é um arquivo STL ou 3MF.`;return}
      if(f.size>MAX_FILE){msg.textContent=`“${f.name}” passa de 50 MB.`;return}}
    if(!window.confirm('Salvar no histórico de impressões?'))return;
    const btn=$('printSaveBtn');btn.disabled=true;msg.textContent='Salvando…';
    const c=app().client(),uid=app().user().id,quoteId=app().quoteId()||null;let saved=0,dup=0,fileFail=0,estoqueMsg='';
    try{
      await load();const cust=await ensureCustomerId();
      for(const cb of boxes){
        const it=pending[cb.dataset.i],file=$('printFile'+cb.dataset.i).files[0];
        const base={name:it.name,material:it.material,color:it.color,weight_g:it.weight_g,print_minutes:it.print_minutes,material_cost:it.material_cost,energy_cost:it.energy_cost,machine_cost:it.machine_cost,print_cost:it.print_cost,updated_at:new Date().toISOString()};
        let print=prints.find(p=>norm(p.name)===norm(it.name)&&norm(p.material)===norm(it.material));
        const res=print?await c.from('projetotrid_prints').update(base).eq('id',print.id).select(COLS).single():await c.from('projetotrid_prints').insert(base).select(COLS).single();
        if(res.error)throw res.error;
        print={...res.data,projetotrid_print_requests:res.data.projetotrid_print_requests||[]};
        const recent=Date.now()-10*60*1000;if(print.projetotrid_print_requests.some(r=>(quoteId&&r.quote_id===quoteId)||(r.customer_name===cust.name&&r.quantity===it.quantity&&new Date(r.requested_at).getTime()>recent))){dup++}
        else{
          const rq=await c.from('projetotrid_print_requests').insert({print_id:print.id,customer_id:cust.id,customer_name:cust.name,quote_id:quoteId,quantity:it.quantity,unit_print_cost:it.print_cost}).select('id,customer_id,customer_name,quantity,unit_print_cost,requested_at,quote_id').single();
          if(rq.error)throw rq.error;
          print.projetotrid_print_requests=[...print.projetotrid_print_requests,rq.data];saved++;
          // ponytail: desconta peso × quantidade, sem a margem de perdas (o histórico guarda o peso por peça)
          if(window.ProjetoTridEstoque)estoqueMsg+=await window.ProjetoTridEstoque.descontar(it.material,it.color,Number(it.weight_g)*it.quantity);
        }
        if(file){
          const up=await uploadFile(print,file,uid);
          if(up)print=up;else fileFail++;
        }
        prints=prints.filter(p=>p.id!==print.id);prints.push(print);
      }
      render();$('printSaveDialog').close();
      app().status(fileFail?'Salvo no histórico, mas o arquivo não foi enviado. Tente anexar de novo em Detalhes.':dup&&!saved?'Esta peça já estava no histórico para este orçamento.':'Salvo no histórico de impressões.'+estoqueMsg,!!fileFail);
    }catch(e){msg.textContent='Não foi possível salvar. Confira sua conexão e tente novamente.'}
    finally{btn.disabled=false}
  }

  /* ---------- arquivo STL/3MF ---------- */
  async function uploadFile(print,file,uid){
    const c=app().client(),safe=file.name.replace(/[^\w.\-]+/g,'_'),path=`${uid}/${print.id}/${Date.now()}-${safe}`;
    const up=await c.storage.from(BUCKET).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(up.error)return null;
    const old=print.file_path;
    const r=await c.from('projetotrid_prints').update({file_path:path,file_name:file.name,file_size:file.size,updated_at:new Date().toISOString()}).eq('id',print.id).select(COLS).single();
    if(r.error){await c.storage.from(BUCKET).remove([path]);return null}
    if(old)await c.storage.from(BUCKET).remove([old]);
    return{...r.data,projetotrid_print_requests:r.data.projetotrid_print_requests||print.projetotrid_print_requests};
  }
  async function download(p){
    const{data,error}=await app().client().storage.from(BUCKET).createSignedUrl(p.file_path,60,{download:p.file_name});
    if(error||!data?.signedUrl){$('printDetailMsg').textContent='Não foi possível baixar o arquivo agora.';return}
    const a=document.createElement('a');a.href=data.signedUrl;a.download=p.file_name||'';document.body.append(a);a.click();a.remove();
  }
  async function removeFile(p){
    if(!window.confirm(`Remover o arquivo “${p.file_name}”?`))return;
    const c=app().client(),r=await c.from('projetotrid_prints').update({file_path:null,file_name:null,file_size:null,updated_at:new Date().toISOString()}).eq('id',p.id).select(COLS).single();
    if(r.error){$('printDetailMsg').textContent='Não foi possível remover o arquivo.';return}
    await c.storage.from(BUCKET).remove([p.file_path]);
    replace({...r.data,projetotrid_print_requests:r.data.projetotrid_print_requests||p.projetotrid_print_requests});
  }
  /* ---------- biblioteca: orçar de novo uma peça já feita (nome, material, cor, peso e tempo) ---------- */
  function orcarDeNovo(p){
    const pre=(id,v,ev='input')=>{const e=$(id);if(!e)return;e.value=v;e.dispatchEvent(new Event(ev,{bubbles:true}));e.dispatchEvent(new Event('blur'))};
    const outro='Outro tipo (especificar)',ops=[...$('filamentType').options].map(o=>o.value),mat=ops.includes(p.material)?p.material:outro;
    pre('product',p.name);pre('filamentType',mat,'change');if(mat===outro)pre('customFilament',p.material);
    pre('filamentColor',p.color||'');pre('amount',String(Number(p.weight_g)).replace('.',','));
    const m=Math.min(5999,Number(p.print_minutes)||0),dois=n=>String(n).padStart(2,'0');pre('printHours',`${dois(Math.floor(m/60))}:${dois(m%60)}`);
    location.hash='#top';app().status(`${p.name} pronto para orçar: confira a quantidade e o cliente.`);
  }

  /* ---------- ver o arquivo anexado em 3D ---------- */
  let vis=null;const fecharVis=()=>{vis?.fechar();vis=null};
  async function ver3d(p,depois){
    const F=window.ProjetoTridFatiador,V=window.ProjetoTridVisualizador;if(!F||!V)return;
    $('printDetailMsg').textContent='Carregando o modelo…';
    try{const{data,error}=await app().client().storage.from(BUCKET).createSignedUrl(p.file_path,60);if(error||!data?.signedUrl)throw error;
      const bytes=new Uint8Array(await (await fetch(data.signedUrl)).arrayBuffer());
      let tri;if(/\.3mf$/i.test(p.file_name||'')){const pl=await F.lerMalha3mf(bytes);tri=new Float32Array(pl.reduce((t,x)=>t+x.tri.length,0));let o=0;for(const x of pl){tri.set(x.tri,o);o+=x.tri.length}}else tri=F.lerSTL(bytes);
      if(!tri.length)throw new Error('vazio');
      fecharVis();let box=$('printView');if(!box){box=el('div','model-view print-view');box.id='printView';depois.after(box)}
      vis=await V.mostrar(box,tri,{cor:p.color,nome:p.name});$('printDetailMsg').textContent=''}
    catch(e){console.warn('3D:',e);$('printDetailMsg').textContent='Não foi possível mostrar o modelo em 3D.'}
  }
  function replace(p){prints=prints.map(x=>x.id===p.id?p:x);render();if(current===p.id)openDetail(p.id,true)}

  /* ---------- detalhes e exclusão ---------- */
  function openDetail(id,keepOpen){
    const p=prints.find(x=>x.id===id);if(!p)return;current=id;fecharVis();
    $('printDetailTitle').textContent=p.name;$('printDetailMsg').textContent='';
    const body=$('printDetailBody');body.replaceChildren();
    const dl=el('dl','print-facts');
    [['Filamento',p.material+(p.color?` · ${p.color}`:'')],['Peso por peça',fmtG(p.weight_g)],['Tempo por peça',fmtTime(p.print_minutes)],['Material',money.format(Number(p.material_cost))],['Energia',money.format(Number(p.energy_cost))],['Máquina',money.format(Number(p.machine_cost))],['Custo de impressão por peça',money.format(Number(p.print_cost))]].forEach(([k,v],i)=>{const d=el('div');d.append(el('dt','',i>=3&&i<6?k+' (por peça)':k),el('dd','',v));dl.append(d)});
    body.append(dl);
    const fh=el('h3','','Arquivo da impressão'),fbox=el('div','print-file-box');
    if(p.file_name){fbox.append(el('span','',`${p.file_name} · ${fmtSize(p.file_size||0)}`));const g=el('button','btn btn-sm btn-solid','Baixar'),rm=el('button','btn btn-sm btn-danger delete','Remover');g.type=rm.type='button';g.addEventListener('click',()=>download(p));rm.addEventListener('click',()=>removeFile(p));const v3=el('button','btn btn-sm btn-outline','Ver em 3D');v3.type='button';v3.addEventListener('click',()=>ver3d(p,fbox));fbox.append(g,v3,rm)}
    else fbox.append(el('span','','Nenhum arquivo anexado.'));
    const lab=el('label','btn btn-sm btn-outline print-attach',p.file_name?'Substituir arquivo':'Anexar STL ou 3MF'),inp=el('input');inp.type='file';inp.accept='.stl,.3mf';inp.hidden=true;lab.append(inp);fbox.append(lab);
    inp.addEventListener('change',async()=>{const f=inp.files[0];if(!f)return;
      if(!EXT.test(f.name)){$('printDetailMsg').textContent='Use um arquivo STL ou 3MF.';return}
      if(f.size>MAX_FILE){$('printDetailMsg').textContent='O arquivo passa de 50 MB.';return}
      $('printDetailMsg').textContent='Enviando arquivo…';const up=await uploadFile(p,f,app().user().id);
      if(!up){$('printDetailMsg').textContent='Não foi possível enviar o arquivo. Tente novamente.';return}replace(up)});
    body.append(fh,fbox);
    if(window.ProjetoTridVitrine)body.append(window.ProjetoTridVitrine.secao(p,replace));
    const reqs=[...p.projetotrid_print_requests].sort((a,b)=>b.requested_at.localeCompare(a.requested_at));
    body.append(el('h3','',`Pedidos (${reqs.length})`));
    const ul=el('ul','print-requests');
    reqs.forEach(r=>{const li=el('li');li.append(el('strong','',fmtDate(r.requested_at)),el('span','',r.customer_name||'Sem cliente informado'),el('span','',`${r.quantity} un · ${money.format(Number(r.unit_print_cost))} de impressão por peça`));ul.append(li)});
    if(!reqs.length)ul.append(el('li','','Nenhum pedido registrado.'));
    body.append(ul);
    if(!keepOpen)$('printDetailDialog').showModal();
  }

  async function removePrint(p){
    if(!window.confirm(`Excluir “${p.name}” do histórico? Os pedidos registrados nela também serão removidos.`))return;
    const c=app().client(),{error}=await c.from('projetotrid_prints').delete().eq('id',p.id);
    if(error){$('printStatus').textContent='Não foi possível excluir esta impressão.';return}
    if(p.file_path)await c.storage.from(BUCKET).remove([p.file_path]);
    prints=prints.filter(x=>x.id!==p.id);render();if($('printDetailDialog').open)$('printDetailDialog').close();app().status('Impressão excluída do histórico.');
  }

  $('printSearch').addEventListener('input',render);$('printSort').addEventListener('change',render);
  $('savePrintBtn').addEventListener('click',openSave);
  $('printSaveBtn').addEventListener('click',savePrints);
  $('printSaveCancel').addEventListener('click',()=>$('printSaveDialog').close());$('printSaveClose').addEventListener('click',()=>$('printSaveDialog').close());
  $('printDetailClose').addEventListener('click',()=>$('printDetailDialog').close());$('printDetailDialog').addEventListener('close',fecharVis);$('printDetailDone').addEventListener('click',()=>$('printDetailDialog').close());
  $('printDetailDelete').addEventListener('click',()=>{const p=prints.find(x=>x.id===current);if(p)removePrint(p)});
  document.addEventListener('projetotrid:auth',()=>{loaded=false;load()});
  window.addEventListener('hashchange',()=>{if(location.hash==='#/impressoes')load(true)});
  load();
})();
