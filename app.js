// --- 1. ENREGISTREMENT DU SERVICE WORKER ---
// Indispensable pour l'installation sur téléphone et le mode hors-ligne
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker enregistré !'))
            .catch(err => console.log('Erreur SW:', err));
    });
}

// --- 2. VARIABLES GLOBALES ---
let audioCtx, analyser, dataArray, mediaRecorder;
let isMonitoring = false;
let nightReport = [];
let silenceStartTime = null;
let wakeLock = null;

const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const mainCard = document.getElementById('mainCard');
const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const logZone = document.getElementById('log');

// Ajustement de la résolution du canvas
canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// --- 3. FONCTIONS VISUELLES ---
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); }
    for(let i=0; i<canvas.height; i+=20) { ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();
}
drawGrid();

// --- 4. GESTION DU MATÉRIEL (MICRO & ÉCRAN) ---
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error("WakeLock failed:", err);
    }
}

startBtn.onclick = async function() {
    try {
        // Demande d'accès micro
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Configuration Audio
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Configuration Enregistreur
        mediaRecorder = new MediaRecorder(stream);
        let chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            createAudioEntry(blob);
            chunks = [];
        };

        // Activation des fonctions mobiles
        await requestWakeLock();
        
        isMonitoring = true;
        this.disabled = true;
        this.innerText = "ANALYSE EN COURS...";
        this.style.background = "#1e293b";
        this.style.color = "#475569";
        
        renderLoop();
    } catch (err) {
        alert("L'accès au micro est requis pour le suivi.");
    }
};

// --- 5. BOUCLE D'ANALYSE ET RENDU ---
function renderLoop() {
    if (!isMonitoring) return;
    requestAnimationFrame(renderLoop);

    analyser.getByteTimeDomainData(dataArray);

    // Dessin de l'onde
    drawGrid();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    let sliceWidth = canvas.width / dataArray.length;
    let x = 0;

    let sumRms = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let v = dataArray[i] / 128.0;
        let y = v * canvas.height / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
        
        let val = (dataArray[i] - 128) / 128;
        sumRms += val * val;
    }
    ctx.stroke();

    // Logique de détection d'apnée
    let rms = Math.sqrt(sumRms / dataArray.length);
    if (rms < 0.015) { // SEUIL DE SILENCE
        if (!silenceStartTime) silenceStartTime = Date.now();
        let seconds = (Date.now() - silenceStartTime) / 1000;
        if (seconds > 10 && mediaRecorder.state === "inactive") {
            triggerAlert();
        }
    } else {
        if (mediaRecorder.state === "inactive") silenceStartTime = null;
    }
}

// --- 6. GESTION DES ALERTES ---
function triggerAlert() {
    mediaRecorder.start();
    mainCard.style.borderColor = "#f43f5e"; // Rouge alerte
    addLogText("⚠️ APNÉE SUSPECTÉE - Enregistrement...");
    
    setTimeout(() => {
        if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            mainCard.style.borderColor = "#1e293b"; // Retour bleu nuit
            silenceStartTime = null;
        }
    }, 15000); // Enregistre 15 secondes
}

function addLogText(msg) {
    const time = new Date().toLocaleTimeString();
    nightReport.push(`[${time}] ${msg}`);
    downloadBtn.disabled = false;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `<small style="color:#64748b">${time}</small><br>${msg}`;
    logZone.prepend(div);
}

function createAudioEntry(blob) {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    logZone.prepend(audio);
}

// --- 7. EXPORT ET RÉACTIVATION ---
downloadBtn.onclick = () => {
    const blob = new Blob([nightReport.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ZenSleep_Rapport_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
};

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});