/* =================================================================== */
/* PANELS.JS V13.0 - BASE V2 + SISRUN FEATURES + IA
/* =================================================================== */

const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };
        
        // INJETA DASHBOARD SISRUN
        const main = document.getElementById('app-main-content');
        if(main) {
            main.innerHTML = `
                <div class="sisrun-dashboard">
                    <div class="dashboard-header">
                        <h2>Painel do Treinador</h2>
                        <div class="feedback-stats">
                            <div class="stat-face happy"><i class='bx bxs-happy-heart-eyes'></i> <span id="count-happy">0</span></div>
                            <div class="stat-face neutral"><i class='bx bxs-meh'></i> <span id="count-neutral">0</span></div>
                            <div class="stat-face sad"><i class='bx bxs-sad'></i> <span id="count-sad">0</span></div>
                        </div>
                    </div>
                    <div class="actions-grid">
                        <div class="action-card" onclick="AdminPanel.showSection('alunos')"><i class='bx bxs-group'></i><span>Alunos</span></div>
                        <div class="action-card" onclick="AdminPanel.showSection('feedbacks')"><i class='bx bx-list-check'></i><span>Feedbacks</span></div>
                        <div class="action-card" onclick="AdminPanel.showSection('planilhas')"><i class='bx bxs-calendar'></i><span>Planilhas</span></div>
                        <div class="action-card" onclick="AdminPanel.showSection('aprovacoes')"><i class='bx bxs-user-plus'></i><span>Aprovações</span></div>
                        <div class="action-card" onclick="AdminPanel.showSection('ia')"><i class='bx bxs-brain'></i><span>IA Analysis</span></div>
                    </div>
                    <div id="admin-content-area" class="content-panel"></div>
                </div>
            `;
            AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
            AdminPanel.loadData();
            AdminPanel.showSection('feedbacks');
        }
    },

    loadData: () => {
        AdminPanel.state.db.ref('users').on('value', s => AdminPanel.state.athletes = s.val() || {});
        
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(100).on('value', s => {
            if(!s.exists()) return;
            let happy=0, neutral=0, sad=0;
            s.forEach(c => {
                const w = c.val();
                if(w.status === 'nao_realizado') sad++; else if(w.stravaData) happy++; else neutral++;
            });
            if(document.getElementById('count-happy')) document.getElementById('count-happy').textContent = happy;
            if(document.getElementById('count-sad')) document.getElementById('count-sad').textContent = sad;
            
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });
        
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = s.exists() ? s.numChildren() : 0;
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `<h3>Últimos Feedbacks</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } 
        else if (section === 'alunos') {
            area.innerHTML = `<h3>Meus Alunos</h3><input type="text" class="search-input" placeholder="Buscar..." onkeyup="AdminPanel.renderList(this.value)"><div id="list" class="athlete-grid"></div><div id="ws" class="hidden"></div>`;
            AdminPanel.renderList();
        }
        else if (section === 'ia') {
            area.innerHTML = `
                <h3>Central de Inteligência (KPIs)</h3>
                <p>Selecione um aluno para análise:</p>
                <select id="ia-select" class="search-input"><option value="">Selecione...</option></select>
                <button class="btn btn-primary" style="margin-top:10px" onclick="AdminPanel.runGlobalIA()">Gerar Relatório Gemini</button>
                <div id="ia-output" style="margin-top:20px; white-space:pre-wrap; background:#fff; padding:10px;"></div>
            `;
            AdminPanel.populateIA();
        }
        else if (section === 'aprovacoes') {
            area.innerHTML = `<h3>Aprovações</h3><div id="pending-list"></div>`;
            AdminPanel.renderPendingList();
        }
    },

    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(50).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if(!snap.exists()) { div.innerHTML = "Sem dados."; return; }
            let html = `<table class="sisrun-table"><thead><tr><th>Aluno</th><th>Treino</th><th>Detalhes</th><th>Ver</th></tr></thead><tbody>`;
            const list = []; snap.forEach(c => list.push({k:c.key, ...c.val()})); list.reverse();
            
            list.forEach(w => {
                let det = w.stravaData ? `<span class="strava-pill">Strava: ${w.stravaData.distancia}</span>` : "Manual";
                html += `<tr><td>${w.ownerName}</td><td>${w.title}</td><td>${det}</td><td><button class="btn-icon" onclick="AppPrincipal.openFeedbackModal('${w.k}','${w.ownerId}','${w.title}')">👁️</button></td></tr>`;
            });
            div.innerHTML = html + "</tbody></table>";
        });
    },

    populateIA: () => {
        const sel = document.getElementById('ia-select');
        Object.entries(AdminPanel.state.athletes).forEach(([uid, d]) => {
            sel.innerHTML += `<option value="${uid}">${d.name}</option>`;
        });
    },

    runGlobalIA: async () => {
        const uid = document.getElementById('ia-select').value;
        if(!uid) return alert("Selecione um aluno");
        const out = document.getElementById('ia-output');
        out.textContent = "Analisando...";
        
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            if(!snap.exists()) throw new Error("Sem dados.");
            const res = await AppPrincipal.callGeminiTextAPI(`Analise os treinos: ${JSON.stringify(snap.val())}. Fale sobre Pace e Volume.`);
            out.textContent = res;
        } catch(e) { out.textContent = e.message; }
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
        document.getElementById('list').classList.add('hidden');
        const ws = document.getElementById('ws');
        ws.classList.remove('hidden');
        ws.innerHTML = `
            <h3>${name}</h3>
            <button class="btn btn-secondary" onclick="document.getElementById('ws').classList.add('hidden');document.getElementById('list').classList.remove('hidden')">Voltar</button>
            <div class="prescription-box">
                <h4>Adicionar Treino</h4>
                <form id="ws-add-form">
                    <div class="row"><input type="date" id="w-date" required><input type="text" id="w-title" placeholder="Título" required></div>
                    <textarea id="w-obs" placeholder="Detalhes..." style="width:100%"></textarea>
                    <button type="submit" class="btn btn-success">Salvar</button>
                </form>
            </div>
            <div id="timeline"></div>`;
        
        document.getElementById('ws-add-form').onsubmit = (e) => {
            e.preventDefault();
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('w-date').value, title: document.getElementById('w-title').value, description: document.getElementById('w-obs').value,
                status: 'planejado', createdBy: AdminPanel.state.currentUser.uid
            });
            alert("Salvo!"); AdminPanel.loadWorkspaceWorkouts(uid);
        };
        
        AdminPanel.loadWorkspaceWorkouts(uid);
    },
    
    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('timeline');
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            div.innerHTML = ""; if(!snap.exists()) { div.innerHTML = "Sem treinos."; return; }
            const l = []; snap.forEach(c => l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                const s = w.stravaData ? `<br><small style='color:orange'>Strava: ${w.stravaData.distancia}</small>` : '';
                div.innerHTML += `<div class="timeline-item" style="border:1px solid #ccc; margin:5px; padding:10px;"><b>${w.date} - ${w.title}</b><br>${w.description}${s} <button onclick="AppPrincipal.openFeedbackModal('${w.k}','${uid}','${w.title}')">Ver</button> <button onclick="AdminPanel.deleteWorkout('${uid}','${w.k}')" style="color:red">X</button></div>`;
            });
        });
    },
    
    deleteWorkout: (uid, wid) => { if(confirm("Apagar?")) { const u={}; u[`/data/${uid}/workouts/${wid}`]=null; u[`/publicWorkouts/${wid}`]=null; AdminPanel.state.db.ref().update(u); }},
    
    renderPendingList: () => {
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            div.innerHTML = ""; if(!s.exists()) { div.innerHTML = "Nada."; return; }
            s.forEach(c => div.innerHTML += `<div><b>${c.val().name}</b> <button onclick="AdminPanel.approve('${c.key}','${c.val().name}','${c.val().email}')">OK</button></div>`);
        });
    },
    approve: (uid, n, e) => {
        const u={}; u[`/users/${uid}`]={name:n, email:e, role:'atleta'}; u[`/data/${uid}`]={workouts:{}}; u[`/pendingApprovals/${uid}`]=null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
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
