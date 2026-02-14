# 🌙 ZenSleep - Tracker de Sommeil Personnel

ZenSleep est une Progressive Web App (PWA) conçue en Vanilla JavaScript pour le suivi respiratoire nocturne. L'application analyse le volume sonore en temps réel et enregistre des échantillons audio uniquement lorsqu'un silence prolongé (apnée potentielle) est détecté.

## 🛠 Paramètres de Sensibilité (app.js)

Si tu trouves que l'application est trop ou pas assez sensible, modifie ces variables en haut du fichier `app.js` :

* **`SILENCE_THRESHOLD` (actuellement 0.015) :** C'est le seuil en dessous duquel l'app considère qu'il n'y a plus de bruit. 
    * *Trop d'alertes ?* Baisse la valeur (ex: 0.010).
    * *Aucune alerte ?* Augmente la valeur (ex: 0.020).
* **`APNEA_DURATION_SEC` (10s) :** Durée de silence nécessaire avant de déclencher l'enregistrement.
* **`RECORD_DURATION_MS` (15000ms) :** Temps d'enregistrement après la détection pour capturer la reprise respiratoire.

## 📱 Utilisation sur Mobile

1.  Ouvrir le lien via Safari (iOS) ou Chrome (Android).
2.  "Ajouter à l'écran d'accueil" pour installer la PWA.
3.  **Important :** Brancher le téléphone sur secteur pour la nuit.
4.  Placer le téléphone sur la table de chevet, micro orienté vers le dormeur.
5.  Appuyer sur **DÉMARRER** (le WakeLock empêchera l'écran de s'éteindre).

## 🔒 Confidentialité
Cette application fonctionne à 100% localement. Aucun flux audio n'est envoyé vers un serveur. Les rapports et fichiers audio restent dans la mémoire temporaire de ton navigateur.