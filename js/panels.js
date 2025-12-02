/* =================================================================== */
/* PANELS.JS V8.0 (FIX UNIVERSAL DE EXIBIÇÃO)
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
            workouts: document.getElementById('workouts-list')
        };

        if(el.form) el.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        el.search.addEventListener('input', AdminPanel.renderList);

        // Aba Switch
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.onclick = (e) => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`admin-tab-${e.target.dataset.tab}`).classList.add('active');
            };
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
            // Mostra TODOS, inclusive o Coach se ele tiver perfil de atleta (que foi o que o vídeo mostrou)
            if (term && !data.name.toLowerCase().includes(term)) return;
            const d = document.createElement('div');
            d.className = 'athlete-list-item';
            d.textContent = data.name;
            if(uid === AdminPanel.state.selectedAthleteId) d.classList.add('selected');
            d.onclick = () => AdminPanel.select(uid, data.name);
            list.appendChild(d);
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
        const obs = document.getElementById('workout-observacoes').value;
        
        // Dados SisRUN v3
        const modalidade = document.getElementById('workout-modalidade').value;
        const tipo = document.getElementById('workout-tipo-treino').value;
        const intens = document.getElementById('workout-intensidade').value;
        const percurso = document.getElementById('workout-percurso').value;

        // Monta Descrição Formatada
        let desc = `[${modalidade}] ${tipo} - ${intens}\n${percurso}\n\n${obs}`;

        const data = {
            date, title, description: desc, status: 'planejado',
            createdAt: new Date().toISOString(),
            createdBy: AdminPanel.state.currentUser.uid
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => { alert("Treino Agendado!"); e.target.reset(); })
            .catch(err => alert(err.message));
    },

    // CARD UNIVERSAL (Lê formatos antigos e novos)
    card: (id, data, uid) => {
        const d = document.createElement('div');
        d.className = 'workout-card';
        
        // Se tem descrição direta, usa. Se não, tenta montar.
        let displayDesc = data.description || "Sem descrição.";
        
        // Status cor
        let statusStyle = "";
        if(data.status === 'realizado') statusStyle = "background-color: var(--success-color);";
        else if(data.status === 'nao_realizado') statusStyle = "background-color: var(--danger-color);";

        d.innerHTML = `
            <div class="workout-card-header">
                <span>${data.date}</span> <strong>${data.title}</strong>
                <span class="status-tag" style="${statusStyle}">${data.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${displayDesc}</div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${uid}', '${data.title}')">
                    <i class='bx bx-edit-alt'></i> Detalhes / Avaliar
                </button>
            </div>
        `;
        return d;
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
        const d = document.createElement('div');
        d.className = 'workout-card';
        
        let statusStyle = "";
        if(v.status === 'realizado') statusStyle = "background-color: var(--success-color);";
        
        d.onclick = () => AppPrincipal.openFeedbackModal(id, uid, v.title);
        d.innerHTML = `
            <div class="workout-card-header">
                <span>${v.date}</span> <strong>${v.title}</strong>
                <span class="status-tag" style="${statusStyle}">${v.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${v.description || "Sem descrição"}</div>
        `;
        return d;
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
                        <strong>${d.ownerName}</strong> - ${d.date} <span class="status-tag" style="background-color: var(--success-color)">${d.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <h4>${d.title}</h4>
                        <p>${d.feedback || d.description}</p>
                    </div>
                    <div class="workout-card-footer"><button class="btn btn-nav"><i class='bx bx-comment'></i> Comentar</button></div>
                `;
                list.appendChild(div);
            });
        });
    }
};
