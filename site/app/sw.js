const CACHE_NAME='projetotrid-v109';
const KIRI_CACHE='projetotrid-kiri-4.7.3'; // motor de fatiamento (~9 MB): baixado só no primeiro uso e mantido entre versões do site
const APP_SHELL=[
  './',
  './index.html',
  './manifest.json',
  './pwa.css',
  './css/tokens.css',
  './css/components.css',
  './css/shell.css',
  './css/modules/auth.css',
  './css/modules/orcamentos.css',
  './css/modules/clientes.css',
  './css/modules/impressoes.css',
  './css/modules/calculadora.css',
  './css/modules/painel.css',
  './css/print.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './fonts/outfit-latin-wght-normal.woff2',
  './img/projeto-trid-mark.png',
  './img/logo-trid-claro.png',
  './img/logo-trid-escuro.png',
  './img/logo-trid-simbolo.png',
  './icons/favicon.png',
  './img/qrcode-instagram.png',
  './img/qrcode-pix.png',
  './templates/whatsapp-template.html',
  './config.js',
  './js/calculations.js',
  './js/modules.js',
  './js/shell.js',
  './js/app.js',
  './js/acessos.js',
  './js/orcamentos-ui.js',
  './js/clientes.js',
  './js/impressoes.js',
  './js/envio.js',
  './js/calculadora-nucleo.js',
  './js/calculadora.js',
  './js/fatiador.js',
  './js/visualizador.js',
  './js/painel.js',
  './js/marketplace.js',
  './js/abas.js',
  './js/estoque.js',
  './js/pedidos.js',
  './js/manutencao.js',
  './js/vitrine.js',
  './js/vitrine-dono.js',
  './js/recap.js',
  './js/theme.js',
  './js/acesso.js',
  './js/context-help.js',
  './js/qrcode-generator.js',
  './vendor/supabase.js'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('precifica3d-')||key.startsWith('inventta3d-')||key.startsWith('projetotrid-'))&&key!==CACHE_NAME&&key!==KIRI_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      // só a página do app vira o index em cache (aprovar.html e outras páginas públicas não)
      if(response.ok&&/\/(index\.html)?$/.test(new URL(request.url).pathname)){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  const cacheName=/\/(lib\/kiri|wasm)\//.test(new URL(request.url).pathname)?KIRI_CACHE:CACHE_NAME;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(cacheName).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
