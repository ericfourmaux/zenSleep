// --- 1. SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Error:', err));
    });
}

// --- 2. VARIABLES ---
let audioCtx, analyser, dataArray, mediaRecorder;
let isMonitoring = false;
let nightReport = [];
let silenceStartTime = null;
let wakeLock = null;
let streamReference = null; // Pour couper le micro proprement

const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const mainCard = document.getElementById('mainCard');
const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadBtn');
const logZone = document.getElementById('log');
const statusText = document.getElementById('statusText');

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;

// --- 3. GRAPHISME ---
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<canvas.width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i, canvas.height); }
    for(let i=0; i<canvas.height; i+=20) { ctx.moveTo(0,i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();
}
drawGrid();

// --- 4. LOGIQUE DE SUIVI ---
startBtn.onclick = async function() {
    if (!isMonitoring) {
        await startTracking();
    } else {
        stopTracking();
    }
};

async function startTracking() {
    try {
        streamReference = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(streamReference);
        source.connect(analyser);
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Configuration Recorder
        mediaRecorder = new MediaRecorder(streamReference);
        let chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                createAudioEntry(blob);
                chunks = [];
            }
        };

        if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
        
        isMonitoring = true;
        startBtn.innerText = "ARRÊTER LE SUIVI";
        startBtn.style.background = "var(--danger)";
        startBtn.style.color = "white";
        statusText.innerText = "🔴 Analyse en cours...";
        
        renderLoop();
    } catch (err) {
        alert("Accès micro refusé.");
    }
}

function stopTracking() {
    isMonitoring = false;
    
    // SÉCURITÉ : Si un enregistrement est en cours, on l'arrête d'abord
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }

    // On coupe les pistes du micro
    if (streamReference) {
        streamReference.getTracks().forEach(track => track.stop());
    }

    if (audioCtx) audioCtx.close();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }

    startBtn.innerText = "DÉMARRER";
    startBtn.style.background = "var(--accent)";
    startBtn.style.color = "var(--bg)";
    statusText.innerText = "Analyse terminée.";
    addLogText("✅ Session terminée.");
}

// --- 5. ANALYSE ET RENDU ---
function renderLoop() {
    if (!isMonitoring) return;
    requestAnimationFrame(renderLoop);

    analyser.getByteTimeDomainData(dataArray);
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

    let rms = Math.sqrt(sumRms / dataArray.length);
    if (rms < 0.015) { 
        if (!silenceStartTime) silenceStartTime = Date.now();
        let seconds = (Date.now() - silenceStartTime) / 1000;
        if (seconds > 10 && mediaRecorder.state === "inactive") {
            triggerAlert();
        }
    } else {
        if (mediaRecorder.state === "inactive") silenceStartTime = null;
    }

    // Dessiner la ligne de seuil de silence
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)'; // Rouge danger transparent
    ctx.setLineDash([5, 5]); // Pointillés
    ctx.beginPath();
    let thresholdY = canvas.height / 2 + (0.015 * canvas.height / 2); // Ajuste selon ton seuil
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(canvas.width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset les pointillés
}

function triggerAlert() {
    if (mediaRecorder.state === "inactive") {
        mediaRecorder.start();
        mainCard.style.borderColor = "var(--danger)";
        addLogText("⚠️ APNÉE SUSPECTÉE - Enregistrement...");
        
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                mainCard.style.borderColor = "#1e293b";
                silenceStartTime = null;
            }
        }, 15000);
    }
}

// --- 6. LOGS ET AUDIO ---
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
    const container = document.createElement('div');
    container.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    container.innerHTML = `<small style="color:var(--danger)">Enregistrement alerte (${time})</small>`;
    
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = url;
    container.appendChild(audio);
    logZone.prepend(container);
}

downloadBtn.onclick = () => {
    const blob = new Blob([nightReport.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ZenSleep_Rapport.txt`;
    a.click();
};

// Demande confirmation avant de quitter pour ne pas perdre la session de nuit
window.onbeforeunload = function() {
    if (isMonitoring) {
        return "Le suivi est en cours. Es-tu sûr de vouloir quitter ?";
    }
};

// Réactive le verrouillage de l'écran si tu reviens sur l'app après l'avoir quittée des yeux
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isMonitoring) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("WakeLock réactivé");
        } catch (err) {
            console.error("Erreur réactivation WakeLock:", err);
        }
    }
});