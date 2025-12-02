/* =================================================================== */
/* PANELS.JS V2.0 + SISRUN FEATURES
/* =================================================================== */

const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, athletes: {} };
        
        // Elementos que JÁ EXISTEM no template clonado
        AdminPanel.elements = {
            contentArea: document.getElementById('admin-content-area')
        };
        
        // Se a div content area existir (significa que o template carregou)
        if(AdminPanel.elements.contentArea) {
            AdminPanel.loadData();
            AdminPanel.showSection('feedbacks');
        }
    },

    loadData: () => {
        // Carrega dados para os contadores (Happy/Sad faces)
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(50).on('value', s => {
            if(!s.exists()) return;
            let h=0, n=0, sa=0;
            s.forEach(c => { const w=c.val(); if(w.status==='nao_realizado') sa++; else if(w.stravaData) h++; else n++; });
            if(document.getElementById('count-happy')) document.getElementById('count-happy').textContent = h;
            if(document.getElementById('count-sad')) document.getElementById('count-sad').textContent = sa;
            
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if(section === 'feedbacks') {
            area.innerHTML = `<h3>Feedbacks</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } else if (section === 'alunos') {
            area.innerHTML = `<h3>Alunos</h3><input type="text" class="search-input" onkeyup="AdminPanel.renderList(this.value)"><div id="list"></div>`;
            AdminPanel.renderList();
        } else if (section === 'ia') {
            area.innerHTML = `<h3>IA</h3><button class="btn btn-primary" onclick="alert('IA em manutenção (Erro 429)')">Gerar</button>`;
        }
    },

    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(50).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if(!snap.exists()) { div.innerHTML="Vazio"; return; }
            let html = "<table class='sisrun-table'><thead><tr><th>Aluno</th><th>Treino</th><th>Ver</th></tr></thead><tbody>";
            snap.forEach(c => {
                const w = c.val();
                html += `<tr><td>${w.ownerName}</td><td>${w.title}</td><td><button onclick="AppPrincipal.openFeedbackModal('${c.key}','${w.ownerId}','${w.title}')">Ver</button></td></tr>`;
            });
            div.innerHTML = html + "</tbody></table>";
        });
    },

    renderList: (f="") => {
        const div = document.getElementById('list');
        div.innerHTML = "";
        AdminPanel.state.db.ref('users').once('value', s => {
            s.forEach(c => {
                const u = c.val();
                if(f && !u.name.toLowerCase().includes(f)) return;
                div.innerHTML += `<div class="athlete-card-mini"><b>${u.name}</b></div>`;
            });
        });
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        list.innerHTML = "Carregando...";
        db.ref(`data/${user.uid}/workouts`).limitToLast(20).on('value', s => {
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                list.innerHTML += `<div class="workout-card" onclick="AppPrincipal.openFeedbackModal('${c.key}','${user.uid}','${w.title}')"><b>${w.title}</b></div>`;
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                list.innerHTML += `<div class="workout-card"><b>${w.ownerName}</b>: ${w.title}</div>`;
            });
        });
    }
};