// --- Riferimenti DOM ---
const classesGrid = document.getElementById('classesGrid');
const addClassBtn = document.getElementById('addClassBtn');
const modalOverlay = document.getElementById('modalOverlay'); // Modal creazione classe
const newClassNameInput = document.getElementById('newClassName');
const createClassBtn = document.getElementById('createClassBtn');

const classDetail = document.getElementById('classDetail');
const classNameEl = document.getElementById('className');
const backToClassesBtn = document.getElementById('backToClasses');

// Riferimenti per le sottoviste, introdotti nel DOM
const studentsViewBtn = document.getElementById('studentsViewBtn');
const lectionsViewBtn = document.getElementById('lectionsViewBtn');
const studentsView = document.getElementById('studentsView'); // Nuova sezione Studenti
const lectionsView = document.getElementById('lectionsView'); // Nuova sezione Lezioni
const backToClassBtns = document.querySelectorAll('.backToClass'); // Pulsanti per tornare alla vista principale del dettaglio classe

const addStudentBtn = document.getElementById('addStudentBtn');
const studentList = document.getElementById('studentList');

const studentModalOverlay = document.getElementById('studentModalOverlay'); // Modal aggiunta studente
const studentMatricolaInput = document.getElementById('studentMatricola');
const studentNameInput = document.getElementById('studentName');
const studentSurnameInput = document.getElementById('studentSurname');
const createStudentBtn = document.getElementById('createStudentBtn');

const lezioniList = document.getElementById('lezioniList');
const createLessonBtn = document.getElementById('createLessonBtn');
const lessonModalOverlay = document.getElementById('lessonModalOverlay'); // Modal creazione lezione
const lessonDateTimeInput = document.getElementById('lessonDateTime');
const confirmLessonBtn = document.getElementById('confirmLessonBtn');

const attendanceModalOverlay = document.getElementById('attendanceModalOverlay'); // Modal presenze
const attendanceModal = document.getElementById('attendanceModal');
const attendanceList = document.getElementById('attendanceList');
const attendanceClassName = document.getElementById('attendanceTitle');
const closeAttendanceBtn = document.getElementById('closeAttendanceBtn');

const scanQRBtn = document.getElementById('scanQRBtn');
const qrTokenOverlay = document.getElementById('qrTokenOverlay'); // Overlay QR Token
const closeQRBtn = document.getElementById('closeQRBtn');
const qrTokenElement = document.getElementById('qrToken');
const qrStatusElement = document.getElementById('qrStatus');
const qrCodeElement = document.getElementById('qrCode');
const qrTimerEl = document.getElementById('qrTimer');


let currentClassId = null;
let currentLezioneId = null;

const classCards = new Map();
let qrInterval = null;
let countdownInterval = null;

// --- Funzioni di Controllo Vista (Solo Display) ---

/** Imposta la vista principale (griglia classi) */
function showClassesGrid() {
    classesGrid.style.display = 'grid';
    addClassBtn.style.display = 'inline-block';
    classDetail.style.display = 'none';
    attendanceModalOverlay.style.display = 'none';
    qrTokenOverlay.style.display = 'none';
    currentClassId = null;
}

/** Nasconde tutte le sottoviste, mostra solo i bottoni Studenti/Lezioni */
function showClassDetailMain() {
    // Nascondi le sezioni specifiche
    studentsView.style.display = 'none';
    lectionsView.style.display = 'none';

    // Mostra i bottoni di navigazione Studenti/Lezioni
    studentsViewBtn.style.display = 'inline-block';
    lectionsViewBtn.style.display = 'inline-block';

    // Nascondi i bottoni "Torna alla classe" (li mostriamo solo nelle sottoviste)
    backToClassBtns.forEach(btn => btn.style.display = 'none');

    // Assicura che i bottoni principali "Torna alle classi" e le viste siano visibili
    backToClassesBtn.style.display = 'inline-block';
}

/** Apre la vista studenti. */
function showStudentsView() {
    studentsView.style.display = 'block';
    lectionsView.style.display = 'none';

    studentsViewBtn.style.display = 'none'; // Nasconde il proprio bottone
    lectionsViewBtn.style.display = 'none';

    // Mostra il pulsante "Torna alla classe" all'interno di questa vista
    document.querySelector('#studentsView .backToClass').style.display = 'inline-block';
}

/** Apre la vista lezioni. */
function showLectionsView() {
    studentsView.style.display = 'none';
    lectionsView.style.display = 'block';

    studentsViewBtn.style.display = 'none'; // Nasconde il proprio bottone
    lectionsViewBtn.style.display = 'none';

    // Mostra il pulsante "Torna alla classe" all'interno di questa vista
    document.querySelector('#lectionsView .backToClass').style.display = 'inline-block';
}


/** Apre il dettaglio classe */
function openClassDetail(classeId, classeNome) {
    currentClassId = classeId;
    classesGrid.style.display = 'none';
    addClassBtn.style.display = 'none';
    classDetail.style.display = 'block';
    classNameEl.textContent = classeNome;

    showClassDetailMain(); // Inizializza alla vista principale

    // Carica gli studenti (con presenze) e le lezioni
    fetchStudenti(classeId);
    fetchLezioni(classeId);
}

function closeClassDetail(){
    classDetail.style.display='none';
    showClassesGrid(); // Torna alla griglia classi
}

// --- Classi (CRUD) ---

function createClassCard(classe){
    const div = document.createElement('div');
    div.classList.add('class-card');

    const nome = document.createElement('h3');
    nome.textContent = classe.nome;
    div.appendChild(nome);

    const badge = document.createElement('span');
    badge.classList.add('badge');
    badge.textContent = `${classe.studenti || 0} studenti`;
    div.appendChild(badge);

    // Pulsante elimina classe
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✖';
    deleteBtn.classList.add('delete-btn');
    // Manteniamo lo stile interno perché non gestiamo il CSS esterno, ma è preferibile farlo nel CSS
    deleteBtn.style.position = 'absolute'; 
    deleteBtn.style.left = '8px';
    deleteBtn.style.bottom = '8px';
    
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if(!confirm(`Vuoi eliminare la classe "${classe.nome}"?`)) return;
        try{
            const res = await fetch(`http://localhost:3000/classi/${classe.id}`, {method:'DELETE'});
            if(!res.ok) throw new Error();
            fetchClassi();
        }catch(err){
            console.error(err);
            alert('Errore eliminazione classe');
        }
    };
    div.appendChild(deleteBtn);

    div.onclick = () => openClassDetail(classe.id, classe.nome);
    classCards.set(classe.id, div);
    return div;
}

function loadClasses(classi){
    classesGrid.innerHTML = '';
    // Assicurati che classesGrid usi il display corretto (grid)
    classesGrid.style.display = 'grid'; 
    classi.forEach(c => classesGrid.appendChild(createClassCard(c)));
}

async function fetchClassi(){
    try{
        const res = await fetch('http://localhost:3000/classi-con-numero-studenti');
        if(!res.ok) throw new Error();
        const data = await res.json();
        loadClasses(data);
        addClassBtn.style.display = 'inline-block';
    }catch(err){
        console.error(err);
        classesGrid.textContent = 'Errore caricamento classi';
    }
}

async function creaClasse(nome){
    if(!nome) return alert('Inserisci un nome valido');
    try{
        const res = await fetch('http://localhost:3000/classi',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({nome})
        });
        if(!res.ok) throw new Error();
        modalOverlay.style.display='none'; // Nasconde il modale
        fetchClassi();
    }catch(err){
        console.error(err);
        alert('Errore creazione classe');
    }
}

// --- Studenti (CRUD) ---
async function fetchStudenti(classeId){
    try{
        // NUOVA API: studenti-con-presenze (Supponiamo che questa API fornisca un campo 'presenze' e l'elenco completo)
        const res = await fetch(`http://localhost:3000/classi/${classeId}/studenti-con-presenze`);
        if(!res.ok) throw new Error();

        const studenti = await res.json();
        loadStudentList(studenti);

        // Aggiorna badge della card (usa la lunghezza totale degli studenti)
        const card = classCards.get(classeId);
        if(card){
            const badge = card.querySelector('.badge');
            badge.textContent = `${studenti.length} studenti`;
        }
    }catch(err){
        console.error(err);
        studentList.innerHTML = '<li>Errore caricamento studenti</li>';
    }
}

function loadStudentList(studenti){
    studentList.innerHTML = '';
    // Ordina studenti per cognome
    studenti.sort((a, b) => a.cognome.localeCompare(b.cognome));

    studenti.forEach(s=>{
        const li = document.createElement('li');
        
        // Contenuto: Matricola - Nome Cognome (Presenze: N)
        const presenzeCount = s.presenze !== undefined ? s.presenze : 0;
        li.innerHTML = `
            ${s.matricola} - ${s.nome} ${s.cognome} 
            <span class="presenze-count"> (Presenze: ${presenzeCount})</span>
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent='✖';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick=async()=>{
            if(!confirm(`Vuoi eliminare lo studente "${s.nome} ${s.cognome}"?`)) return;
            try{
                const res = await fetch(`http://localhost:3000/studenti/${s.matricola}/${currentClassId}`, { method:'DELETE' });
                if(!res.ok) throw new Error();
                fetchStudenti(currentClassId);
            }catch(err){
                console.error(err);
                alert('Errore eliminazione studente');
            }
        };
        li.appendChild(deleteBtn);
        studentList.appendChild(li);
    });
}

async function creaStudente(matricola, nome, cognome) {
    if (!matricola || !nome || !cognome) {
        return alert('Inserisci tutti i dati: Matricola, Nome e Cognome.');
    }

    if (!/^\d{6}$/.test(matricola)) {
        return alert('La Matricola deve essere composta esattamente da 6 cifre numeriche.');
    }

    const trimmedMatricola = matricola.trim(); 
    const trimmedNome = nome.trim();
    const trimmedCognome = cognome.trim();

    try {
        // Usiamo l'API originale POST per la creazione
        const res = await fetch(`http://localhost:3000/classi/${currentClassId}/studenti`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricola: trimmedMatricola, nome: trimmedNome, cognome: trimmedCognome })
        });

        if (res.status === 500) {
            const errorData = await res.json();
            if (errorData.error && errorData.error.includes('UNIQUE constraint failed')) {
                return alert('Errore: Matricola già esistente in questa classe.');
            }
            throw new Error('Errore server sconosciuto.');
        }

        if (!res.ok) throw new Error();
        
        studentModalOverlay.style.display = 'none'; // Nasconde il modale
        fetchStudenti(currentClassId); // Ricarica con la nuova API
    } catch (err) {
        console.error(err);
        alert('Errore aggiunta studente. Controlla la console per i dettagli.');
    }
}

// --- Lezioni (CRUD) ---
async function fetchLezioni(classeId){
    try{
        const res = await fetch(`http://localhost:3000/classi/${classeId}/lezioni`);
        const lezioni = await res.json();
        loadLezioni(lezioni);
    }catch(err){
        console.error(err);
        lezioniList.innerHTML='<li>Errore caricamento lezioni</li>';
    }
}

function loadLezioni(lezioni){
    lezioniList.innerHTML='';
    lezioni.sort((a, b) => new Date(b.data) - new Date(a.data)); // Ordina dalla più recente

    lezioni.forEach(l=>{
        const li = document.createElement('li');

        const rawDate = l.data; 

        const dateObj = new Date(rawDate);

        const formattedDate = dateObj.toLocaleString('it-IT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false 
        });

        li.textContent = `${formattedDate}`;

        const deleteBtn=document.createElement('button');
        deleteBtn.textContent='✖';

        deleteBtn.classList.add('delete-btn');
        deleteBtn.onclick=async()=>{
            if(!confirm('Vuoi eliminare questa lezione?')) return;
            try{
                const res=await fetch(`http://localhost:3000/lezioni/${l.id}`,{method:'DELETE'});
                if(!res.ok) throw new Error();
                fetchLezioni(currentClassId);
            }catch(err){
                console.error(err);
                alert('Errore eliminazione lezione');
            }
        };
        li.appendChild(deleteBtn);

        li.onclick = (e)=>{
            if(e.target !== deleteBtn) openAttendance(l.id, classNameEl.textContent, formattedDate);
        };

        lezioniList.appendChild(li);
    });
}

// --- Presenze (Gestione Manuale e QR) ---

async function openAttendance(lezioneId, className, formattedDate) {
    currentLezioneId = lezioneId;
    
    // Gestione Vista: Mostra l'overlay del modale
    classesGrid.style.display = 'none';
    classDetail.style.display = 'none';
    addClassBtn.style.display = 'none';
    attendanceModalOverlay.style.display = 'flex'; // Modale presenze

    attendanceClassName.textContent = `Presenze - ${className} (${formattedDate})`;
    attendanceList.innerHTML = '<li>Caricamento presenze...</li>';

    try {
        // Sincronizzazione presenze (popola la tabella presenze)
        await fetch(`http://localhost:3000/lezioni/${lezioneId}/sincronizza-presenze`, { method: 'POST' });

        const res = await fetch(`http://localhost:3000/lezioni/${lezioneId}/presenze`);
        if (!res.ok) throw new Error('Errore caricamento dati presenze');
        const studenti = await res.json();
        
        attendanceList.innerHTML = ''; // Pulisce il messaggio di caricamento

        studenti.forEach(studente => {
            const li = document.createElement('li');
            li.textContent = `${studente.nome} ${studente.cognome} (${studente.matricola})`;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = studente.presente === 1;

            checkbox.onchange = async () => {
                try {
                    await fetch(`http://localhost:3000/presenze/${lezioneId}/${studente.matricola}`, { 
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ presente: checkbox.checked ? 1 : 0 })
                    });
                    // Ricarica la lista studenti in background per aggiornare il conteggio delle presenze
                    fetchStudenti(currentClassId); 
                } catch (err) {
                    console.error("Errore aggiornamento presenza:", err);
                    alert("Errore nell'aggiornare la presenza.");
                    checkbox.checked = !checkbox.checked; // Ritorna allo stato precedente
                }
            };

            li.appendChild(checkbox);
            attendanceList.appendChild(li);
        });
    } catch (err) {
        console.error(err);
        attendanceList.innerHTML = '<li>Errore caricamento presenze</li>';
    }
}


closeAttendanceBtn.onclick = () => {
    // Gestione Vista: Chiudi il modale presenze
    attendanceModalOverlay.style.display = 'none';
    
    // Torna al dettaglio classe se l'ID è noto, altrimenti torna alla griglia principale
    if (currentClassId) {
        classDetail.style.display = 'block';
        showClassDetailMain();
    } else {
        showClassesGrid();
    }
};

// --- Gestione QR Code (Token Dinamico) ---

const fetchTokenAndDisplayQR = async () => {
    try {
        const res = await fetch(`http://localhost:3000/lezioni/${currentLezioneId}/token`, {
            method: 'POST'
        });

        if (!res.ok) throw new Error('Errore generazione token (API).');
        const data = await res.json();

        const ip = data.ip_server;
        const token = data.token;
        
        // Aggiornamento interfaccia
        qrTokenElement.textContent = token;
        qrStatusElement.textContent = `Connettiti a http://${ip}:3000`;

        qrCodeElement.innerHTML = '';

        // Dati da codificare nel QR
        const qrContent = `http://${ip}:3000/?token=${token}&lezione=${currentLezioneId}`;
        new QRCode(qrCodeElement, {
            text: qrContent,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        // Avvia il Countdown (25 secondi)
        let countdown = 25;
        clearInterval(countdownInterval);
        
        countdownInterval = setInterval(() => {
            countdown--;
            if (countdown < 0) {
                countdown = 0; 
            }
            qrTimerEl.textContent = countdown + 's';

        }, 1000);

    } catch (e) {
        console.error(e);
        qrStatusElement.textContent = 'Errore nel caricamento del token. Verifica che il server sia attivo.';
        qrTokenElement.textContent = '---';
        qrCodeElement.innerHTML = '';
        qrTimerEl.textContent = '--s';
        if (qrInterval) clearInterval(qrInterval);
        if (countdownInterval) clearInterval(countdownInterval);
    }
};

scanQRBtn.onclick = () => {
    if (!currentLezioneId) { 
        alert("Errore: ID Lezione non disponibile. Apri prima il registro presenze per una lezione.");
        return;
    }

    // Gestione Vista: QR
    qrTokenOverlay.style.display = 'flex';
    
    qrStatusElement.textContent = 'Generazione in corso...';
    qrTokenElement.textContent = '---';
    qrCodeElement.innerHTML = '';

    // Pulisce gli intervalli precedenti
    if (qrInterval) clearInterval(qrInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    // Avvia la generazione del token e l'intervallo di refresh
    fetchTokenAndDisplayQR();
    qrInterval = setInterval(fetchTokenAndDisplayQR, 25000); // Aggiorna ogni 25 secondi
};

closeQRBtn.onclick = async () => {
    // Gestione Vista: Chiudi QR
    qrTokenOverlay.style.display = 'none';

    // Pulisce gli intervalli
    if (qrInterval) clearInterval(qrInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    qrInterval = null;
    countdownInterval = null;

    try {
        await fetch(`http://localhost:3000/lezioni/${currentLezioneId}/tokens`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.error("Errore durante l'eliminazione del token:", err);
    }
};


// --- Gestione Eventi Principali ---

// Eventi Griglia Classi
addClassBtn.onclick = () => {
    modalOverlay.style.display = 'flex'; // Mostra il modal creazione classe
    newClassNameInput.value = '';
    newClassNameInput.focus();
};
createClassBtn.onclick = () => creaClasse(newClassNameInput.value.trim());
modalOverlay.onclick = e => { if (e.target === modalOverlay) modalOverlay.style.display = 'none'; };


// Eventi Navigazione Dettaglio Classe
backToClassesBtn.onclick = closeClassDetail; // Torna alla griglia principale

// Navigazione tra le sottoviste
studentsViewBtn.onclick = showStudentsView;
lectionsViewBtn.onclick = showLectionsView;
// Assegna l'evento Torna alla classe (mostra la vista principale del dettaglio) a tutti i bottoni '.backToClass'
backToClassBtns.forEach(btn => {
    btn.onclick = showClassDetailMain;
});


// Eventi Studenti
addStudentBtn.onclick = () => {
    studentModalOverlay.style.display = 'flex'; // Mostra il modal aggiunta studente
    studentMatricolaInput.value = '';
    studentNameInput.value = '';
    studentSurnameInput.value = '';
    studentMatricolaInput.focus();
};
createStudentBtn.onclick = () => creaStudente(
    studentMatricolaInput.value,
    studentNameInput.value,
    studentSurnameInput.value
);
studentModalOverlay.onclick = e => { if (e.target === studentModalOverlay) studentModalOverlay.style.display = 'none'; };

// Eventi Lezioni
createLessonBtn.onclick = () => {
    lessonModalOverlay.style.display = 'flex'; // Mostra il modal creazione lezione
    // Imposta il valore di default all'ora corrente
    const now = new Date();
    const isoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    lessonDateTimeInput.value = isoString;
    lessonDateTimeInput.focus();
};
confirmLessonBtn.onclick=async()=>{
    const dataOra=lessonDateTimeInput.value;
    if(!dataOra) return alert('Inserisci data e ora');
    try{
        const res=await fetch(`http://localhost:3000/classi/${currentClassId}/lezioni`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({data:dataOra})
        });
        if(!res.ok) throw new Error();
        lessonModalOverlay.style.display='none'; // Nasconde il modale
        fetchLezioni(currentClassId);
    }catch(err){
        console.error(err);
        alert('Errore creazione lezione');
    }
};
lessonModalOverlay.onclick=e=>{if(e.target===lessonModalOverlay) lessonModalOverlay.style.display='none';};

// --- Avvio ---

// Inizializza la vista e carica i dati
showClassesGrid();
fetchClassi();