/* =================================================================== */
/* PANELS.JS V5.0 - FEED SORTING & PRESCRIPTION FIX
/* =================================================================== */

const AdminPanel = {
    state: {}, elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };
        const el = AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            form: document.getElementById('add-workout-form'),
            workouts: document.getElementById('workouts-list'),
            iaBtn: document.getElementById('analyze-athlete-btn-ia')
        };

        if(el.form) el.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        el.search.addEventListener('input', AdminPanel.renderList);
        if(el.iaBtn) el.iaBtn.addEventListener('click', AdminPanel.handleIA);

        // Aba Switch
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(x => x.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`admin-tab-${e.target.dataset.tab}`).classList.add('active');
            });
        });

        db.ref('users').orderByChild('name').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: () => {
        const list = AdminPanel.elements.list;
        list.innerHTML = "";
        const term = AdminPanel.elements.search.value.toLowerCase();
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            // PERMITE COACH VER A SI MESMO NA LISTA PARA PRESCREVER
            if (term && !data.name.toLowerCase().includes(term)) return;
            const div = document.createElement('div');
            div.className = 'athlete-list-item';
            div.textContent = data.name;
            div.onclick = () => AdminPanel.select(uid, data.name);
            list.appendChild(div);
        });
    },

    select: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.name.textContent = name;
        AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.loadWorkouts(uid);
    },

    loadWorkouts: (uid) => {
        const list = AdminPanel.elements.workouts;
        list.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if (!s.exists()) { list.innerHTML = "<p>Sem treinos agendados.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            // Ordena Data (Mais longe -> Mais perto)
            arr.sort((a, b) => new Date(b.v.date) - new Date(a.v.date));
            arr.forEach(i => list.appendChild(AdminPanel.card(i.k, i.v, uid)));
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if (!uid) return alert("Selecione um atleta");

        const date = document.getElementById('workout-date').value;
        const title = document.getElementById('workout-title').value;
        const warm = document.getElementById('workout-warmup').value;
        const main = document.getElementById('workout-main').value;
        const cool = document.getElementById('workout-cooldown').value;
        const intensity = document.getElementById('workout-intensidade').value;
        const volume = document.getElementById('workout-volume').value;

        // Monta Descrição Formatada (Visualização simples)
        let desc = "";
        if(warm) desc += `🔥 AQUECIMENTO:\n${warm}\n\n`;
        desc += `🏃 PRINCIPAL:\n${main}\n\n`;
        if(cool) desc += `❄️ DESAQUECIMENTO:\n${cool}\n\n`;
        desc += `📊 META: ${intensity} | ${volume}`;

        const data = {
            date, title, description: desc, status: 'planejado',
            createdAt: new Date().toISOString(),
            createdBy: AdminPanel.state.currentUser.uid,
            // Salva dados estruturados para futuro uso
            structure: { warm, main, cool, intensity, volume } 
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => { alert("Treino Agendado!"); e.target.reset(); })
            .catch(err => alert(err.message));
    },

    card: (id, data, uid) => {
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.innerHTML = `
            <div class="workout-card-header">
                <span>${data.date}</span> <strong>${data.title}</strong>
                <span class="status-tag ${data.status}">${data.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${data.description}</div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${uid}', '${data.title}')">Detalhes</button>
            </div>
        `;
        return div;
    },

    handleIA: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta");
        AppPrincipal.openIaAnalysisModal();
        document.getElementById('ia-analysis-output').textContent = "Gerando análise (simulação)... \nAtleta consistente.";
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            // Ordena data mais próxima no topo
            arr.sort((a, b) => new Date(a.v.date) - new Date(b.v.date));
            arr.forEach(i => list.appendChild(AtletaPanel.card(i.k, i.v, user.uid)));
        });
    },
    card: (id, v, uid) => {
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.onclick = () => AppPrincipal.openFeedbackModal(id, uid, v.title);
        div.innerHTML = `
            <div class="workout-card-header">
                <span>${v.date}</span> <strong>${v.title}</strong>
                <span class="status-tag ${v.status}">${v.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${v.description}</div>
        `;
        return div;
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Feed vazio.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            arr.reverse(); // Mais recente primeiro
            
            arr.forEach(i => {
                const d = i.v;
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.onclick = () => AppPrincipal.openFeedbackModal(i.k, d.ownerId, d.title);
                div.innerHTML = `
                    <div class="workout-card-header">
                        <strong>${d.ownerName}</strong> - ${d.date} <span class="status-tag ${d.status}">${d.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <h4>${d.title}</h4>
                        <p>${d.feedback || d.description}</p>
                    </div>
                    <div class="workout-card-footer"><button class="btn btn-nav">Comentar</button></div>
                `;
                list.appendChild(div);
            });
        });
    }
};
