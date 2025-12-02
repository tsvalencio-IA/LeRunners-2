/* =================================================================== */
/* PANELS.JS V17 - SISRUN COMPLETO
/* =================================================================== */

const AdminPanel = {
    state: {}, elements: {},

    init: (user, db) => {
        console.log("AdminPanel V17 Carregado"); // Para verificar no console
        AdminPanel.state = { db, currentUser: user, athletes: {} };
        
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
            let h=0, n=0, sa=0;
            s.forEach(c => { const w=c.val(); if(w.status==='nao_realizado') sa++; else if(w.stravaData) h++; else n++; });
            if(document.getElementById('count-happy')) document.getElementById('count-happy').textContent = h;
            if(document.getElementById('count-sad')) document.getElementById('count-sad').textContent = sa;
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
                <p>Selecione um aluno:</p>
                <select id="ia-select" class="search-input"><option value="">Selecione...</option></select>
                <button class="btn btn-primary" style="margin-top:10px" onclick="AdminPanel.runGlobalIA()">Gerar Relatório</button>
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
            let html = `<table class="sisrun-table"><thead><tr><th>Aluno</th><th>Treino</th><th>Status</th><th>Ver</th></tr></thead><tbody>`;
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
            const res = await AppPrincipal.callGeminiTextAPI(`Analise: ${JSON.stringify(snap.val())}`);
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

    // --- FORMULÁRIO DETALHADO (IGUAL SISRUN) ---
    openWS: (uid, name) => {
        document.getElementById('list').classList.add('hidden');
        const ws = document.getElementById('ws');
        ws.classList.remove('hidden');
        
        ws.innerHTML = `
            <h3>${name}</h3>
            <button class="btn btn-secondary" onclick="document.getElementById('ws').classList.add('hidden');document.getElementById('list').classList.remove('hidden')">Voltar</button>
            
            <div class="prescription-box">
                <h4 style="border-bottom:1px solid #eee; padding-bottom:10px;">Adicionar Treino</h4>
                <form id="ws-add-form">
                    <div class="form-grid-2col">
                        <div class="form-group"><label>Data</label><input type="date" id="w-date" required></div>
                        <div class="form-group"><label>Título</label><input type="text" id="w-title" required></div>
                    </div>
                    <div class="form-grid-2col">
                        <div class="form-group">
                            <label>Modalidade</label>
                            <select id="w-mod"><option>Corrida</option><option>Caminhada</option><option>Bike</option></select>
                        </div>
                        <div class="form-group">
                            <label>Tipo</label>
                            <select id="w-type"><option>Rodagem</option><option>Intervalado</option><option>Longo</option><option>Fartlek</option></select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Descrição Detalhada</label>
                        <textarea id="w-obs" rows="4" placeholder="Aquecimento, Principal, Desaquecimento..."></textarea>
                    </div>
                    <button type="submit" class="btn btn-success" style="width:100%">Salvar</button>
                </form>
            </div>
            
            <div id="timeline" style="margin-top:20px;">Carregando...</div>`;
        
        document.getElementById('ws-add-form').onsubmit = (e) => {
            e.preventDefault();
            const fullDesc = `[${document.getElementById('w-mod').value}] ${document.getElementById('w-type').value}\n\n${document.getElementById('w-obs').value}`;
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('w-date').value,
                title: document.getElementById('w-title').value,
                description: fullDesc,
                status: 'planejado',
                createdBy: AdminPanel.state.currentUser.uid,
                createdAt: new Date().toISOString()
            });
            alert("Salvo!");
            AdminPanel.loadWorkspaceWorkouts(uid);
        };
        
        AdminPanel.loadWorkspaceWorkouts(uid);
    },
    
    // Lista segura que não trava com dados antigos
    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('timeline');
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const list = [];
            snap.forEach(c => list.push({k:c.key, ...c.val()}));
            // Ordenação segura
            list.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
            
            list.forEach(w => {
                const s = w.stravaData ? `<br><small style='color:orange'><b>Strava:</b> ${w.stravaData.distancia}</small>` : '';
                const statusColor = w.status === 'realizado' ? 'green' : '#999';
                
                div.innerHTML += `
                    <div class="timeline-item" style="border:1px solid #ccc; margin:5px; padding:15px; border-radius:8px; background:#fff; position:relative; border-left:5px solid ${statusColor}">
                        <div style="display:flex; justify-content:space-between;">
                            <b>${new Date(w.date).toLocaleDateString()} - ${w.title}</b>
                            <span class="status-tag" style="background:${statusColor}; color:white; padding:2px 5px; border-radius:4px;">${w.status}</span>
                        </div>
                        <p style="white-space:pre-wrap; font-size:0.9rem; margin:10px 0;">${w.description}</p>
                        ${s}
                        <div style="text-align:right;">
                            <button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}','${uid}','${w.title}')">Ver</button>
                            <button class="btn btn-small btn-danger" onclick="AdminPanel.deleteWorkout('${uid}','${w.k}')">X</button>
                        </div>
                    </div>`;
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
