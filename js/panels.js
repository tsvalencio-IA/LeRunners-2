/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V11.0 - CLONE SISRUN FIEL)
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V11.0: SisRun Layout.");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        const main = document.getElementById('app-main-content');
        main.innerHTML = `
            <div class="admin-dashboard">
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.showSection('feedbacks')">
                        <div class="icon-box"><i class='bx bx-message-check'></i></div>
                        <span>Feedbacks</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('alunos')">
                        <div class="icon-box"><i class='bx bx-group'></i></div>
                        <span>Alunos</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('financeiro')">
                        <div class="icon-box"><i class='bx bx-dollar-circle'></i></div>
                        <span>Financeiro</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('relatorios')">
                        <div class="icon-box"><i class='bx bx-bar-chart-alt-2'></i></div>
                        <span>Relatórios</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('config')">
                        <div class="icon-box"><i class='bx bx-cog'></i></div>
                        <span>Config</span>
                    </div>
                </div>

                <div id="stats-bar-container" class="stats-bar">
                    </div>

                <div id="admin-content-area" class="panel" style="min-height: 500px;">
                    </div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData(); // Carrega dados e popula carinhas
        AdminPanel.showSection('feedbacks');
    },

    loadData: () => {
        const db = AdminPanel.state.db;
        
        // Carrega Alunos
        db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });

        // Carrega Feedbacks para Tabela e Carinhas
        db.ref('publicWorkouts').orderByChild('realizadoAt').on('value', s => {
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable(s);
            AdminPanel.renderStatsBar(s);
        });
    },

    // Renderiza as "Carinhas" de Status (Fake data for now, logic ready)
    renderStatsBar: (snapshot) => {
        const container = document.getElementById('stats-bar-container');
        if(!container) return;
        
        const stats = { excelente: 0, bom: 0, normal: 0, ruim: 0, pessimo: 0 };
        // Aqui você pode ligar a lógica real de "Percepção de Esforço" no futuro
        // Por enquanto, conta totais para visual
        const total = snapshot.exists() ? snapshot.numChildren() : 0;

        container.innerHTML = `
            <div class="stat-box"><i class='bx bxs-happy-heart-eyes face-icon face-excelente'></i><span class="stat-value">${total}</span><span class="stat-label">Total</span></div>
            <div class="stat-box"><i class='bx bxs-happy face-icon face-bom'></i><span class="stat-value">0</span><span class="stat-label">Vistos</span></div>
            <div class="stat-box"><i class='bx bxs-meh face-icon face-normal'></i><span class="stat-value">0</span><span class="stat-label">Pendentes</span></div>
        `;
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "<p style='text-align:center; padding:20px;'>Carregando...</p>";

        if (section === 'feedbacks') {
            // Força recarregamento dos dados para a tabela
            AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').once('value', AdminPanel.renderFeedbackTable);
        } else if (section === 'alunos') {
            area.innerHTML = `<h3><i class='bx bx-user'></i> Gestão de Alunos</h3><div id="athlete-list-container"></div>`;
            AdminPanel.renderAthleteList();
        } else {
            area.innerHTML = `<div style="text-align:center; padding:50px; color:#999;"><i class='bx bx-cone' style="font-size:40px;"></i><br>Módulo em construção</div>`;
        }
    },

    // --- A TABELA PODEROSA (SISRUN STYLE) ---
    renderFeedbackTable: (snapshot) => {
        const div = document.getElementById('admin-content-area');
        if(!div) return;

        if(!snapshot.exists()) { div.innerHTML = "<p>Nenhum treino encontrado.</p>"; return; }

        let html = `
            <div class="section-header" style="margin-bottom:15px; display:flex; justify-content:space-between;">
                <h3>Acompanhamento de Feedbacks</h3>
                <input type="text" placeholder="Filtrar..." style="padding:5px; border:1px solid #ccc; border-radius:4px;">
            </div>
            <div class="feedback-table-container">
            <table class="feedback-table">
                <thead>
                    <tr>
                        <th>Aluno</th>
                        <th>Treino Proposto</th>
                        <th>Feedback do Aluno</th>
                        <th style="text-align:center">Visto</th>
                        <th style="text-align:center">Comentado</th>
                        <th style="text-align:center">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const list = [];
        snapshot.forEach(c => list.push({ k: c.key, ...c.val() }));
        list.reverse(); // Mais recente no topo

        list.forEach(w => {
            const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName || "Aluno" };
            const foto = atleta.photoUrl || 'https://placehold.co/30x30/ccc/fff?text=A';
            
            // Formatação dos dados
            const date = new Date(w.date).toLocaleDateString('pt-BR');
            const stravaIcon = w.stravaData ? `<i class='bx bxl-strava' style="color:#fc4c02; font-size:16px; vertical-align:middle;"></i>` : '';
            
            // Dados Propostos vs Realizados
            const proposto = `<div class="col-proposto">${date}<br>${w.title}</div>`;
            
            let realizado = w.feedback || 'Sem feedback';
            if(w.stravaData) {
                realizado += `<br><small style="color:#666;">${stravaIcon} ${w.stravaData.distancia} | ${w.stravaData.tempo}</small>`;
            }
            
            // Checkboxes Visuais
            const checkVisto = `<div class="check-box checked"><i class='bx bx-check'></i></div>`; // Simulação visual
            const checkComent = w.comments ? `<div class="check-box checked"><i class='bx bx-check'></i></div>` : `<div class="check-box"></div>`;

            html += `
                <tr>
                    <td>
                        <div class="col-aluno">
                            <img src="${foto}" class="avatar-small">
                            <span>${atleta.name}</span>
                        </div>
                    </td>
                    <td>${proposto}</td>
                    <td><div class="col-feedback">${realizado}</div></td>
                    <td style="text-align:center">${checkVisto}</td>
                    <td style="text-align:center">${checkComent}</td>
                    <td style="text-align:center">
                        <button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')">
                            <i class='bx bx-search-alt'></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        div.innerHTML = html + `</tbody></table></div>`;
    },

    // --- LISTA DE ALUNOS (VOCÊ APARECE AQUI) ---
    renderAthleteList: () => {
        const div = document.getElementById('athlete-list-container');
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            const isMe = uid === AdminPanel.state.currentUser.uid;
            const bg = isMe ? '#eef' : '#fff'; // Destaque para o Coach
            
            div.innerHTML += `
                <div class="athlete-list-item" style="background:${bg}; padding:10px; border:1px solid #ddd; margin-bottom:5px; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;"
                     onclick="AdminPanel.openWorkspace('${uid}', '${data.name}')">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${data.photoUrl||'https://placehold.co/30x30/ccc/fff'}" style="width:30px; height:30px; border-radius:50%;">
                        <strong>${data.name} ${isMe ? '(Eu)' : ''}</strong>
                    </div>
                    <i class='bx bx-chevron-right'></i>
                </div>
            `;
        });
    },

    openWorkspace: (uid, name) => {
        // Abre o painel individual (Mantido simples para não quebrar)
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = `
            <div style="margin-bottom:15px; display:flex; justify-content:space-between;">
                <h3><i class='bx bx-user'></i> ${name}</h3>
                <button class="btn btn-secondary" onclick="AdminPanel.showSection('alunos')">Voltar</button>
            </div>
            <div id="student-plan">Carregando planilha...</div>
        `;
        // Carrega lista simples do aluno
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            const d = document.getElementById('student-plan');
            if(!d) return;
            d.innerHTML = "";
            const l = []; s.forEach(c=>l.push(c.val())); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                const st = w.status === 'realizado' ? '✅' : '📅';
                d.innerHTML += `<div style="background:#fff; padding:10px; border:1px solid #eee; margin-bottom:5px;">
                    <b>${st} ${new Date(w.date).toLocaleDateString()}</b> - ${w.title}
                </div>`;
            });
        });
    }
};

// MÓDULOS DE ATLETA E FEED (Mantidos intactos para segurança)
const AtletaPanel = {
    init: (u, db) => {
        const l = document.getElementById('atleta-workouts-list');
        if(document.getElementById('log-manual-activity-btn')) document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        l.innerHTML = "Carregando...";
        db.ref(`data/${u.uid}/workouts`).orderByChild('date').on('value', s => {
            l.innerHTML = ""; const a = []; s.forEach(c=>a.push({k:c.key, ...c.val()})); a.sort((x,y)=>new Date(y.date)-new Date(x.date));
            a.forEach(w => {
                l.innerHTML += `<div class="workout-card" onclick="AppPrincipal.openFeedbackModal('${w.k}','${u.uid}','${w.title}')">
                    <div class="workout-card-header"><b>${w.title}</b> <span>${new Date(w.date).toLocaleDateString()}</span></div>
                    <div class="workout-card-body">${w.description}</div>
                </div>`;
            });
        });
    }
};
const FeedPanel = {
    init: (u, db) => {
        const l = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(50).on('value', s => {
            l.innerHTML = ""; const a = []; s.forEach(c=>a.push(c.val())); a.reverse();
            a.forEach(w => {
                l.innerHTML += `<div class="workout-card"><div class="workout-card-header"><b>${w.ownerName}</b></div><div class="workout-card-body">${w.feedback || 'Treino feito!'}</div></div>`;
            });
        });
    }
};
