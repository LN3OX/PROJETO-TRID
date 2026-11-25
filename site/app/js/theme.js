(()=>{
    const root=document.documentElement,meta=document.querySelector('meta[name="theme-color"]'),mq=window.matchMedia('(prefers-color-scheme: dark)');
    const effective=()=>root.dataset.theme||(mq.matches?'dark':'light');
    function paint(){const d=effective()==='dark';if(meta)meta.content=d?'#16130B':'#FFF8EF';document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.setAttribute('aria-pressed',String(d));if(!b.classList.contains('menu-item'))b.setAttribute('aria-label',d?'Mudar para o modo claro':'Mudar para o modo escuro')})}
    document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.addEventListener('click',()=>{const next=effective()==='dark'?'light':'dark';root.dataset.theme=next;try{localStorage.setItem('projetotrid-theme',next)}catch{}paint()}));
    (mq.addEventListener?mq.addEventListener('change',paint):mq.addListener(paint));paint();
  })();
