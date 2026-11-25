// O aplicativo agora fica em /app/ (com o próprio service worker). Este arquivo só existe para
// remover o service worker antigo que controlava a raiz do site e apagar os caches dele.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^(projetotrid|inventta3d|precifica3d)-/.test(k)) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
