(()=>{
  const descriptions={
    product:'Escolha um nome que ajude você e o cliente a identificar a peça, como “Suporte de headset”. Esse nome aparece no orçamento compartilhado.',
    quantity:'Informe quantas unidades iguais serão produzidas. O total do pedido considera essa quantidade; use “Adicionar item” para incluir uma peça diferente.',
    clientName:'Opcional. Identifica o cliente no orçamento enviado. Deixe em branco se preferir não incluir o nome.',
    clientEmail:'Opcional. Incluído nos dados do cliente no orçamento compartilhado. Confira a grafia antes de gerar o material.',
    clientPhone:'Opcional. Incluído no orçamento compartilhado. Informe o DDD para facilitar o contato.',
    filamentType:'Selecione o material realmente usado. PLA e PETG atendem a muitos usos gerais; materiais técnicos podem exigir parâmetros e condições específicas de impressão.',
    customFilament:'Use este campo quando o material não estiver na lista. Informe o nome que deseja identificar no orçamento, por exemplo “PET com fibra de carbono”.',
    filamentColor:'Opcional. Registre a cor escolhida para o cliente distinguir esta versão da peça.',
    amount:'Informe o consumo de filamento de uma unidade, conforme o fatiador. Se a estimativa estiver em gramas, mantenha a unidade “g” selecionada.',
    packPrice:'Digite o preço pago pelo rolo ou pacote do material. O sistema divide esse valor pelo peso informado para estimar o custo consumido.',
    packQty:'Informe o peso líquido do rolo ou pacote na mesma unidade do consumo por peça. Para um rolo de 1 kg, use 1000 g.',
    waste:'Acrescente uma margem para suportes, purga e sobras que não viram produto. Use uma estimativa do seu processo; esse percentual aumenta o material calculado.',
    printHours:'Tempo estimado pelo fatiador para uma unidade. Digite horas e minutos em HH:MM: por exemplo, 0130 representa 01:30, ou uma hora e meia.',
    energyRate:'Informe o preço de 1 kWh indicado na conta de luz. A estimativa usa esse valor junto com a potência média e o tempo de impressão.',
    power:'Use a potência média consumida durante a impressão, em watts. A potência nominal da etiqueta é uma referência; um medidor de tomada pode dar uma estimativa mais próxima do uso real.',
    printerCost:'Informe o custo de compra da impressora. O sistema distribui esse valor pelas horas de vida útil para estimar o desgaste por impressão.',
    lifeHours:'Estimativa de horas de impressão ao longo da vida útil da máquina. Quanto menor esse total, maior será a parcela de desgaste atribuída a cada hora.',
    maintenance:'Valor médio reservado por hora para bicos, mesa, correias, reparos e revisões. Use seu histórico de manutenção como referência.',
    setupMin:'Tempo gasto uma vez por pedido para fatiar, preparar a máquina e iniciar a impressão. Não é multiplicado pela quantidade de unidades.',
    finishMin:'Tempo de trabalho aplicado a cada unidade depois da impressão, como retirar suportes, limpar, lixar ou montar. O sistema considera a quantidade do pedido.',
    laborRate:'Defina quanto vale uma hora do seu trabalho. Esse valor é usado para estimar o custo das tarefas de preparação e acabamento.',
    packaging:'Informe o custo total da embalagem de todo o pedido, não o custo por unidade. Se cada peça exigir uma embalagem própria, some os materiais usados.',
    failure:'Estimativa de retrabalhos por falhas de impressão. Use seus resultados anteriores; a reserva calculada aumenta os custos de produção para cobrir peças refeitas.',
    margin:'Percentual de lucro aplicado sobre os custos de produção antes das taxas de venda e dos tributos. Exemplo: 100% acrescenta ao custo o mesmo valor do custo.',
    salesFee:'Some as taxas que incidem sobre a venda, como marketplace, cartão ou plataforma de pagamento. Informe a soma percentual; use 0 quando não houver cobrança.',
    taxRate:'Informe a alíquota de tributos que incide sobre a venda, conforme o enquadramento do seu negócio. Em caso de dúvida, confirme com sua contabilidade.',
    discountValue:'O modo escolhido define se o valor será uma porcentagem ou reais. O desconto é aplicado ao pedido e não pode superar o subtotal.',
    validityDays:'Opcional. Define por quantos dias o preço e as condições deste orçamento ficam válidos. A data final é incluída nos materiais compartilhados.',
    savedSearch:'Filtra a lista enquanto você digita. A busca considera o nome da peça, o cliente, o e-mail e o telefone salvos.',
    savedSort:'Muda a ordem da lista sem alterar os orçamentos: por data, valor ou nome do cliente.',
    installApp:'Abre as instruções para adicionar a Projeto Trid à tela inicial do dispositivo.',
    themeToggle:'Alterna entre o tema claro e o escuro. A preferência é aplicada à interface, sem alterar os orçamentos.'
  };
  const HOVER_DELAY=700,FOCUS_DELAY=250,HIDE_DELAY=1500;
  let active=null,nextId=0;

  function clearTimers(entry){
    window.clearTimeout(entry.showTimer);
    window.clearTimeout(entry.hideTimer);
    entry.showTimer=entry.hideTimer=null;
  }
  function place(entry){
    const {trigger,bubble}=entry,rect=trigger.getBoundingClientRect(),pad=12,gap=8;
    const width=Math.min(320,window.innerWidth-pad*2);
    bubble.style.width=`${width}px`;
    bubble.style.maxHeight=`${Math.max(120,Math.min(300,window.innerHeight-pad*2))}px`;
    const left=Math.max(pad,Math.min(rect.left,window.innerWidth-width-pad));
    bubble.style.left=`${left}px`;
    const height=bubble.getBoundingClientRect().height;
    let top=rect.bottom+gap;
    if(top+height>window.innerHeight-pad)top=rect.top-height-gap;
    bubble.style.top=`${Math.max(pad,Math.min(top,window.innerHeight-height-pad))}px`;
  }
  function close(entry=active){
    if(!entry)return;
    clearTimers(entry);
    entry.bubble.hidden=true;
    entry.trigger.setAttribute('aria-expanded','false');
    entry.pinned=false;
    if(active===entry)active=null;
  }
  function open(entry,pinned=false){
    if(active&&active!==entry)close(active);
    clearTimers(entry);
    active=entry;
    entry.pinned=entry.pinned||pinned;
    entry.bubble.hidden=false;
    entry.trigger.setAttribute('aria-expanded','true');
    requestAnimationFrame(()=>place(entry));
  }
  function scheduleOpen(entry,delay){
    if(active===entry&&!entry.bubble.hidden)return;
    window.clearTimeout(entry.showTimer);
    entry.showTimer=window.setTimeout(()=>open(entry),delay);
  }
  function scheduleClose(entry){
    window.clearTimeout(entry.showTimer);
    window.clearTimeout(entry.hideTimer);
    entry.hideTimer=window.setTimeout(()=>{
      const stillInRegion=entry.trigger.matches(':hover,:focus')||entry.bubble.matches(':hover');
      if(!entry.pinned&&!stillInRegion)close(entry);
    },HIDE_DELAY);
  }
  function findLabel(control){
    return [...document.querySelectorAll('label[for]')].find(label=>label.htmlFor===control.id)||null;
  }
  function addHelp(control){
    const id=control.id,text=descriptions[id];
    if(!text||control.dataset.contextHelpReady)return;
    const label=findLabel(control);
    if(!label||label.classList.contains('sr-only'))return;
    const container=control.closest('.field')||control.closest('.login-card')||control.parentElement;
    if(!container||container.querySelector(`.field-help-trigger[data-for="${id}"]`))return;
    control.dataset.contextHelpReady='true';
    const row=document.createElement('span');row.className='field-label-row';
    label.parentNode.insertBefore(row,label);row.append(label);
    const trigger=document.createElement('button');
    trigger.type='button';trigger.className='field-help-trigger';trigger.tabIndex=-1;
    const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');mark.textContent='?';trigger.append(mark);
    trigger.dataset.for=id;trigger.setAttribute('aria-label',`Explicação do campo: ${label.textContent.trim()}`);
    trigger.setAttribute('aria-expanded','false');
    const bubble=document.createElement('span');
    bubble.className='field-help-bubble';bubble.id=`context-help-${++nextId}`;
    bubble.setAttribute('role','tooltip');bubble.textContent=text;bubble.hidden=true;
    trigger.setAttribute('aria-describedby',bubble.id);
    document.body.append(bubble);row.append(trigger);
    const entry={trigger,bubble,pinned:false,showTimer:null,hideTimer:null};
    trigger.addEventListener('pointerenter',()=>{window.clearTimeout(entry.hideTimer);scheduleOpen(entry,HOVER_DELAY)});
    trigger.addEventListener('pointerleave',()=>scheduleClose(entry));
    trigger.addEventListener('focus',()=>scheduleOpen(entry,FOCUS_DELAY));
    trigger.addEventListener('blur',()=>scheduleClose(entry));
    trigger.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(active===entry&&entry.pinned)close(entry);
      else open(entry,true);
    });
    trigger.addEventListener('keydown',event=>{if(event.key==='Escape')close(entry)});
    bubble.addEventListener('pointerenter',()=>window.clearTimeout(entry.hideTimer));
    bubble.addEventListener('pointerleave',()=>scheduleClose(entry));
  }
  function removeRedundantHints(root=document){
    const hints=[];
    if(root.matches?.('.field .hint,.discount-field .hint'))hints.push(root);
    root.querySelectorAll?.('.field .hint,.discount-field .hint').forEach(hint=>hints.push(hint));
    hints.forEach(hint=>{
      if(hint.id){
        document.querySelectorAll('[aria-describedby]').forEach(element=>{
          const ids=(element.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==hint.id);
          if(ids.length)element.setAttribute('aria-describedby',ids.join(' '));
          else element.removeAttribute('aria-describedby');
        });
      }
      hint.remove();
    });
  }
  function enhance(root=document){
    if(root.matches?.('input,select,textarea'))addHelp(root);
    root.querySelectorAll?.('input,select,textarea').forEach(addHelp);
    removeRedundantHints(root);
  }
  enhance();
  const syncSkipTarget=()=>{const skip=document.querySelector('.skip-link');if(skip)skip.href=document.getElementById('appShell')?.hidden?'#loginTitle':'#quotePage'};
  syncSkipTarget();
  const observer=new MutationObserver(records=>records.forEach(record=>{
    if(record.type==='childList')record.addedNodes.forEach(node=>{if(node.nodeType===1)enhance(node)});
    if(record.type==='attributes')syncSkipTarget();
  }));
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  document.querySelectorAll('.message').forEach((message,index)=>{message.id=message.id||`stage-message-${index+1}`;message.setAttribute('aria-atomic','true')});
  document.addEventListener('pointerdown',event=>{
    if(active&&!event.target.closest('.field-help-trigger')&&!event.target.closest('.field-help-bubble'))close(active);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close(active)});
  window.addEventListener('resize',()=>{if(active&&!active.bubble.hidden)place(active)});
  window.addEventListener('scroll',()=>{if(active&&!active.bubble.hidden)place(active)},true);
})();
