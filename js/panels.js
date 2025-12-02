/* =================================================================== */
/* PANELS.JS V8.0 - LÓGICA V2 (QUE FUNCIONAVA) + VISUAL SISRUN
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        const mainContent = document.getElementById('app-main-content');
        mainContent.innerHTML = `
            <div class="sisrun-dashboard">
                <div class="dashboard-header">
                    <h2>Painel do Treinador</h2>
                    <div class="feedback-stats">
                        <div class="stat-face happy"><i class='bx bxs-happy-heart-eyes'></i> <span>OK</span></div>
                    </div>
                </div>
                <div class="actions-grid">
                    <div class="action-card" onclick="AdminPanel.showSection('alunos')"><i class='bx bxs-group'></i><span>Alunos</span></div>
                    <div class="action-card" onclick="AdminPanel.showSection('feedbacks')"><i class='bx bx-list-check'></i><span>Feedbacks</span></div>
                    <div class="action-card" onclick="AdminPanel.showSection('ia')"><i class='bx bxs-brain'></i><span>IA Analysis</span></div>
                </div>
                <div id="admin-content-area" class="content-panel"></div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('feedbacks'); 
    },

    loadData: () => {
        AdminPanel.state.db.ref('users').on('value', s => AdminPanel.state.athletes = s.val() || {});
    },

    showSection: (section) => {
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `<h3>Feedbacks</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } 
        else if (section === 'alunos') {
            area.innerHTML = `<h3>Alunos</h3><input type="text" id="search" placeholder="Buscar..." onkeyup="AdminPanel.renderList(this.value)"><div id="list"></div><div id="ws" class="hidden"></div>`;
            AdminPanel.renderList();
        }
        else if (section === 'ia') {
            area.innerHTML = `<h3>IA Analysis</h3><button class="btn btn-primary" onclick="AdminPanel.runIA()">Analisar (Gemini)</button><div id="ia-res"></div>`;
        }
    },

    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(50).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if(!snap.exists()) { div.innerHTML = "Sem dados."; return; }
            let html = `<table class="sisrun-table"><thead><tr><th>Aluno</th><th>Treino</th><th>Detalhes</th></tr></thead><tbody>`;
            const list = []; snap.forEach(c => list.push({k:c.key, ...c.val()})); list.reverse();
            
            list.forEach(w => {
                let det = "Manual";
                if(w.stravaData) det = `<span class="strava-pill">Strava: ${w.stravaData.distancia}</span>`;
                html += `<tr><td>${w.ownerName}</td><td>${w.title}</td><td>${det} <button onclick="AppPrincipal.openFeedbackModal('${w.k}','${w.ownerId}','${w.title}')">Ver</button></td></tr>`;
            });
            div.innerHTML = html + "</tbody></table>";
        });
    },

    renderList: (filter="") => {
        const div = document.getElementById('list');
        div.innerHTML = "";
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if(filter && !data.name.toLowerCase().includes(filter)) return;
            div.innerHTML += `<div class="athlete-card-mini" onclick="AdminPanel.openWS('${uid}','${data.name}')"><b>${data.name}</b></div>`;
        });
    },

    openWS: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        document.getElementById('list').classList.add('hidden');
        const ws = document.getElementById('ws');
        ws.classList.remove('hidden');
        ws.innerHTML = `
            <h3>${name}</h3><button onclick="document.getElementById('ws').classList.add('hidden');document.getElementById('list').classList.remove('hidden')">Voltar</button>
            <div id="timeline">Carregando...</div>
        `;
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            const tl = document.getElementById('timeline');
            tl.innerHTML = "";
            if(!snap.exists()) { tl.innerHTML = "Sem treinos."; return; }
            const l = []; snap.forEach(c => l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            
            l.forEach(w => {
                const s = w.stravaData ? `<br><small style='color:orange'>${w.stravaData.distancia}</small>` : '';
                tl.innerHTML += `<div class="timeline-item" style="border:1px solid #ccc; margin:5px; padding:10px;"><b>${w.date} - ${w.title}</b><br>${w.description}${s}</div>`;
            });
        });
    },

    runIA: async () => {
        if(!AdminPanel.state.selectedAthleteId) return alert("Selecione um aluno na aba Alunos primeiro.");
        const out = document.getElementById('ia-res');
        out.textContent = "Analisando...";
        try {
            const snap = await AdminPanel.state.db.ref(`data/${AdminPanel.state.selectedAthleteId}/workouts`).limitToLast(10).once('value');
            const res = await AppPrincipal.callGeminiTextAPI(`Analise: ${JSON.stringify(snap.val())}`);
            out.textContent = res;
        } catch(e) { out.textContent = "Erro: " + e.message; }
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = ""; if(!s.exists()) { list.innerHTML = "Sem treinos."; return; }
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                list.innerHTML += `<div class="workout-card" onclick="AppPrincipal.openFeedbackModal('${w.k}','${user.uid}','${w.title}')"><b>${w.date}</b> - ${w.title}<br>${w.status}</div>`;
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            list.innerHTML = ""; if(!s.exists()) return;
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()})); l.reverse();
            l.forEach(w => {
                list.innerHTML += `<div class="workout-card" onclick="AppPrincipal.openFeedbackModal('${w.k}','${w.ownerId}','${w.title}')"><b>${w.ownerName}</b>: ${w.title}</div>`;
            });
        });
    }
};