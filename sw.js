const CACHE_NAME = 'zensleep-v1.1'; // Change la version ici (ex: v1.2) quand tu modifies ton code
const ASSETS = [
    './',
    'index.html',
    'app.js',
    'manifest.json',
    'https://via.placeholder.com/192x192/0f172a/ffffff?text=Zz' // Ton icône
];

// 1. Installation : On met en cache tous les fichiers essentiels
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('ZenSleep: Mise en cache des fichiers système');
            return cache.addAll(ASSETS);
        })
    );
    // Force le service worker à devenir actif immédiatement
    self.skipWaiting();
});

// 2. Activation : On supprime les anciens caches pour libérer de l'espace
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('ZenSleep: Suppression de l\'ancien cache', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// 3. Stratégie Fetch : Cache-First (priorité au cache pour la rapidité et le mode hors-ligne)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            // Retourne le fichier du cache s'il existe, sinon fait une requête réseau
            return response || fetch(e.request);
        })
    );
});