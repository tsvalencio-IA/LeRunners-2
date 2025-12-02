/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V5.1 - COMPLETO E INTEGRADO)
/* Contém: Dashboard Admin SisRun + Painel Atleta + Feed Social
/* =================================================================== */

// ===================================================================
// 1. ADMIN PANEL - GESTÃO PROFISSIONAL (ESTILO SISRUN)
// ===================================================================
const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V5.1: Inicializando Dashboard Profissional...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // RENDERIZA O LAYOUT DO DASHBOARD (Grade de Ícones)
        const mainContent = document.getElementById('app-main-content');
        mainContent.innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <span class="user-display" style="font-size:0.9rem; color:#666;">Olá, Coach!</span>
                </div>
                
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.showSection('feedbacks')">
                        <i class='bx bx-message-square-check'></i>
                        <span>Feedbacks <span id="badge-feed" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('alunos')">
                        <i class='bx bx-group'></i>
                        <span>Meus Alunos <span id="badge-alunos" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('aprovacoes')">
                        <i class='bx bx-user-plus'></i>
                        <span>Aprovações <span id="badge-aprovacoes" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('planilhas')">
                        <i class='bx bx-spreadsheet'></i>
                        <span>Modelos</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('financeiro')">
                        <i class='bx bx-dollar-circle'></i>
                        <span>Financeiro</span>
                    </div>
                </div>

                <div id="admin-content-area" class="panel" style="min-height: 400px;">
                    <div style="text-align:center; padding: 2rem; color:#999;">
                        <i class='bx bx-mouse-alt' style="font-size: 3rem;"></i>
                        <p>Selecione uma opção acima para começar.</p>
                    </div>
                </div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('feedbacks'); // Inicia na aba mais importante
    },

    loadData: () => {
        // Carrega Lista de Alunos para Memória
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            const count = Object.keys(AdminPanel.state.athletes).length;
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = count;
            
            // Se estiver na tela de alunos, atualiza a lista em tempo real
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });

        // Carrega Contagem de Feedbacks (Treinos realizados recentemente)
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            if(s.exists() && document.getElementById('badge-feed')) 
                document.getElementById('badge-feed').textContent = s.numChildren();
            
            // Se estiver na tela de feedbacks, atualiza
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });

        // Carrega Pendentes
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            const count = s.exists() ? s.numChildren() : 0;
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = count;
        });
    },

    // Roteador de Seções do Admin
    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `<h3><i class='bx bx-check-double'></i> Central de Feedbacks</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } 
        else if (section === 'alunos') {
            area.innerHTML = `
                <h3><i class='bx bx-list-ul'></i> Gestão de Alunos</h3>
                <input type="text" id="athlete-search" class="search-input" placeholder="Buscar aluno..." onkeyup="AdminPanel.renderAthleteList(this.value)">
                <div id="athlete-list-container"></div>
                
                <div id="athlete-workspace" class="hidden" style="margin-top:2rem; border-top:1px solid #eee; padding-top:1rem;">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 id="workspace-title" style="color:var(--primary-color)">Aluno</h3>
                        <button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">Fechar</button>
                    </div>
                    <div class="admin-tabs">
                        <button class="tab-btn active" onclick="AdminPanel.switchWorkspaceTab('prescrever')">Prescrever</button>
                        <button class="tab-btn" onclick="AdminPanel.switchWorkspaceTab('kpis')">IA & KPIs</button>
                    </div>
                    <div id="tab-prescrever" class="ws-tab-content active">
                        <div id="form-container"></div>
                        <div id="workspace-workouts"></div>
                    </div>
                    <div id="tab-kpis" class="ws-tab-content hidden">
                        <button class="btn btn-primary" onclick="AdminPanel.handleAnalyzeAthleteIA()">Gerar Análise IA</button>
                        <div id="ia-output" style="margin-top:10px; white-space:pre-wrap; background:#f4f4f4; padding:10px;"></div>
                    </div>
                </div>
            `;
            AdminPanel.renderAthleteList();
            AdminPanel.renderPrescriptionForm();
        } 
        else if (section === 'aprovacoes') {
            area.innerHTML = `<h3>Aprovações Pendentes</h3><div id="pending-list"></div>`;
            AdminPanel.renderPendingList();
        }
        else {
            area.innerHTML = `<div style="padding:2rem; text-align:center;">Módulo <b>${section}</b> em desenvolvimento.</div>`;
        }
    },

    // --- 1. TABELA DE FEEDBACK (O "CORAÇÃO" DO ACOMPANHAMENTO) ---
    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(50).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if (!div) return;

            if (!snap.exists()) {
                div.innerHTML = "<p>Nenhum treino realizado recentemente.</p>";
                return;
            }
            
            let html = `
                <div class="feedback-table-container">
                <table class="feedback-table">
                    <thead><tr><th>Aluno</th><th>Treino / Data</th><th>Feedback</th><th>Ações</th></tr></thead>
                    <tbody>
            `;
            
            const list = [];
            snap.forEach(c => list.push({ k: c.key, ...c.val() }));
            list.reverse(); // Mais recente primeiro

            list.forEach(w => {
                // Tenta pegar nome do cache ou usa o nome salvo no treino
                const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName };
                const foto = atleta.photoUrl || 'https://placehold.co/40x40/4169E1/FFFFFF?text=AT';
                const stravaIcon = w.stravaData ? `<span style="color:#fc4c02; font-size:0.8rem;"><i class='bx bxl-strava'></i> Sync</span>` : '';
                const dateStr = new Date(w.realizadoAt).toLocaleDateString('pt-BR');

                html += `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <img src="${foto}" class="user-avatar-small">
                                <strong>${atleta.name}</strong>
                            </div>
                        </td>
                        <td>
                            <div style="font-weight:bold; color:var(--primary-color);">${w.title}</div>
                            <small>${dateStr} ${stravaIcon}</small>
                        </td>
                        <td style="max-width:300px;">
                            <div style="font-size:0.9rem; color:#555; font-style:italic;">"${w.feedback || '...'}"</div>
                        </td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')">
                                <i class='bx bx-search'></i> Ver
                            </button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
            div.innerHTML = html;
        });
    },

    // --- 2. GESTÃO DE ALUNOS & WORKSPACE ---
    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if (!div) return;
        div.innerHTML = "";

        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;
            
            const isMe = uid === AdminPanel.state.currentUser.uid;
            
            const item = document.createElement('div');
            item.className = 'athlete-list-item';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${data.photoUrl || 'https://placehold.co/30x30/ccc/fff'}" style="width:30px; height:30px; border-radius:50%;">
                    <span>${data.name} ${isMe ? '<small>(Eu)</small>' : ''}</span>
                </div>
                <i class='bx bx-chevron-right'></i>
            `;
            item.onclick = () => AdminPanel.openWorkspace(uid, data.name);
            div.appendChild(item);
        });
    },

    openWorkspace: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        document.getElementById('athlete-list-container').classList.add('hidden');
        document.getElementById('athlete-search').classList.add('hidden');
        document.getElementById('athlete-workspace').classList.remove('hidden');
        document.getElementById('workspace-title').textContent = name;
        AdminPanel.loadWorkspaceWorkouts(uid);
    },

    closeWorkspace: () => {
        AdminPanel.state.selectedAthleteId = null;
        document.getElementById('athlete-workspace').classList.add('hidden');
        document.getElementById('athlete-list-container').classList.remove('hidden');
        document.getElementById('athlete-search').classList.remove('hidden');
    },

    switchWorkspaceTab: (tabName) => {
        document.querySelectorAll('.ws-tab-content').forEach(e => e.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
        // Lógica simples para ativar botão visualmente seria aqui
    },

    renderPrescriptionForm: () => {
        const container = document.getElementById('form-container');
        if(!container) return;
        
        container.innerHTML = `
            <form id="add-workout-form" class="form-minimal" style="background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #ddd;">
                <h4 style="margin-bottom:10px; color:var(--primary-color);">Agendar Novo Treino</h4>
                <div class="form-grid-2col">
                    <div class="form-group"><label>Data</label><input type="date" id="w-date" required></div>
                    <div class="form-group"><label>Título</label><input type="text" id="w-title" placeholder="Ex: Longo 12k" required></div>
                </div>
                <div class="form-grid-2col">
                    <div class="form-group"><label>Modalidade</label><select id="w-mod"><option>Corrida</option><option>Caminhada</option><option>Bike</option><option>Fortalecimento</option></select></div>
                    <div class="form-group"><label>Tipo</label><select id="w-type"><option>Rodagem</option><option>Intervalado</option><option>Longo</option><option>Fartlek</option><option>Regenerativo</option></select></div>
                </div>
                <div class="form-group"><label>Descrição / Estrutura</label><textarea id="w-obs" rows="3" placeholder="Detalhes do treino..."></textarea></div>
                <button type="submit" class="btn btn-secondary" style="width:100%;">Salvar na Planilha</button>
            </form>
        `;

        document.getElementById('add-workout-form').onsubmit = (e) => {
            e.preventDefault();
            const uid = AdminPanel.state.selectedAthleteId;
            const data = {
                date: document.getElementById('w-date').value,
                title: document.getElementById('w-title').value,
                description: `[${document.getElementById('w-mod').value}] - ${document.getElementById('w-type').value}\n\n${document.getElementById('w-obs').value}`,
                status: 'planejado',
                createdBy: AdminPanel.state.currentUser.uid,
                createdAt: new Date().toISOString()
            };
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
                alert("Treino agendado!");
                document.getElementById('w-title').value = "";
                document.getElementById('w-obs').value = "";
            });
        };
    },

    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('workspace-workouts');
        div.innerHTML = "Carregando planilha...";
        
        // Listener específico para o workspace
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const workouts = [];
            snap.forEach(c => workouts.push({ k: c.key, ...c.val() }));
            workouts.sort((a,b) => new Date(b.date) - new Date(a.date)); // Decrescente

            workouts.forEach(w => {
                const card = AdminPanel.createWorkoutCard(w.k, w, uid);
                div.appendChild(card);
            });
        });
    },

    // Card Generator (Reutilizável)
    createWorkoutCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        const statusColor = data.status === 'realizado' ? 'var(--success-color)' : '#999';
        
        // Renderiza Strava se existir
        let stravaHTML = "";
        if(data.stravaData) {
            stravaHTML = `
                <div class="strava-data-display" style="margin-top:10px;">
                    <strong style="color:#fc4c02"><i class='bx bxl-strava'></i> Dados Strava</strong><br>
                    Dist: ${data.stravaData.distancia} | Tempo: ${data.stravaData.tempo} | Pace: ${data.stravaData.ritmo}
                    ${data.stravaData.elevacao ? `<br>Elev: ${data.stravaData.elevacao}` : ''}
                </div>
            `;
        }

        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${new Date(data.date).toLocaleDateString('pt-BR')}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag" style="background:${statusColor}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                <p style="white-space:pre-wrap;">${data.description}</p>
                ${data.feedback ? `<div class="feedback-text"><strong>Feedback:</strong> ${data.feedback}</div>` : ''}
                ${stravaHTML}
            </div>
            <div class="workout-card-footer">
                <button class="action-btn" onclick="AppPrincipal.openFeedbackModal('${id}', '${ownerId}', '${data.title}')"><i class='bx bx-comment'></i> Comentar</button>
                <button class="btn btn-danger btn-small" onclick="AdminPanel.deleteWorkout('${ownerId}', '${id}')"><i class='bx bx-trash'></i></button>
            </div>
        `;
        return el;
    },

    deleteWorkout: (uid, wid) => {
        if(confirm("Tem certeza?")) {
            const updates = {};
            updates[`/data/${uid}/workouts/${wid}`] = null;
            updates[`/publicWorkouts/${wid}`] = null;
            AdminPanel.state.db.ref().update(updates);
        }
    },

    handleAnalyzeAthleteIA: async () => {
        const out = document.getElementById('ia-output');
        out.textContent = "IA analisando...";
        try {
            const uid = AdminPanel.state.selectedAthleteId;
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(10).once('value');
            const data = snap.val();
            const prompt = `Analise os treinos deste atleta. Dados JSON: ${JSON.stringify(data)}. Resuma performance e consistência.`;
            const res = await AppPrincipal.callGeminiTextAPI(prompt);
            out.textContent = res;
        } catch(e) { out.textContent = "Erro: " + e.message; }
    },

    renderPendingList: () => {
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            if(!s.exists()) { div.innerHTML = "<p>Nada pendente.</p>"; return; }
            div.innerHTML = "";
            s.forEach(c => {
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <span><b>${c.val().name}</b> (${c.val().email})</span>
                    <div>
                        <button class="btn btn-success btn-small" onclick="AdminPanel.approve('${c.key}', '${c.val().name}', '${c.val().email}')">Aceitar</button>
                        <button class="btn btn-danger btn-small" onclick="AdminPanel.reject('${c.key}')">Recusar</button>
                    </div>
                `;
                div.appendChild(item);
            });
        });
    },

    approve: (uid, name, email) => {
        const u = {};
        u[`/users/${uid}`] = { name, email, role: 'atleta', createdAt: new Date().toISOString() };
        u[`/data/${uid}`] = { workouts: {} };
        u[`/pendingApprovals/${uid}`] = null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    },
    reject: (uid) => { AdminPanel.state.db.ref(`pendingApprovals/${uid}`).remove().then(() => AdminPanel.showSection('aprovacoes')); }
};

// ===================================================================
// 2. ATLETA PANEL - VISÃO DO ALUNO (COMPLETO)
// ===================================================================
const AtletaPanel = {
    state: { db: null, currentUser: null },
    elements: {},

    init: (user, db) => {
        console.log("AtletaPanel V5.1: Inicializando...");
        AtletaPanel.state.db = db;
        AtletaPanel.state.currentUser = user;
        AtletaPanel.elements = {
            workoutsList: document.getElementById('atleta-workouts-list'),
            logBtn: document.getElementById('log-manual-activity-btn')
        };
        
        if(AtletaPanel.elements.logBtn) {
            AtletaPanel.elements.logBtn.addEventListener('click', AppPrincipal.openLogActivityModal);
        }
        
        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (uid) => {
        const list = AtletaPanel.elements.workoutsList;
        list.innerHTML = "<p>Carregando sua planilha...</p>";
        
        AtletaPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', snapshot => {
            list.innerHTML = "";
            if (!snapshot.exists()) {
                list.innerHTML = "<p>Nenhum treino encontrado. Aguarde seu treinador.</p>";
                return;
            }
            
            const workouts = [];
            snapshot.forEach(c => workouts.push({ key: c.key, ...c.val() }));
            // Ordena Data Decrescente (Hoje primeiro)
            workouts.sort((a,b) => new Date(b.date) - new Date(a.date));

            workouts.forEach(w => {
                // Reutiliza o gerador de cards do Admin para consistência visual
                // Mas ajusta para permitir clique do atleta
                const card = AdminPanel.createWorkoutCard(w.key, w, uid);
                
                // Remove botão de deletar do card para o aluno (segurança visual)
                const delBtn = card.querySelector('.btn-danger');
                if(delBtn) delBtn.remove();

                // Adiciona clique para feedback
                card.addEventListener('click', (e) => {
                    if(!e.target.closest('button')) {
                        AppPrincipal.openFeedbackModal(w.key, uid, w.title);
                    }
                });

                list.appendChild(card);
            });
        });
    }
};

// ===================================================================
// 3. FEED PANEL - SOCIAL (COMPLETO)
// ===================================================================
const FeedPanel = {
    state: { db: null, currentUser: null },
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V5.1: Inicializando...");
        FeedPanel.state.db = db;
        FeedPanel.state.currentUser = user;
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const list = FeedPanel.elements.feedList;
        list.innerHTML = "<p>Carregando feed da equipe...</p>";
        
        FeedPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', snapshot => {
            list.innerHTML = "";
            if (!snapshot.exists()) {
                list.innerHTML = "<p>O feed está silencioso hoje.</p>";
                return;
            }

            const items = [];
            snapshot.forEach(c => items.push({ key: c.key, ...c.val() }));
            items.reverse();

            items.forEach(item => {
                const card = FeedPanel.createFeedCard(item.key, item);
                list.appendChild(card);
            });
        });
    },

    createFeedCard: (id, data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        // Tenta buscar dados atualizados do usuário (foto/nome)
        const userCache = AppPrincipal.state.userCache || {};
        const athleteData = userCache[data.ownerId];
        const name = athleteData ? athleteData.name : data.ownerName;
        const avatar = athleteData && athleteData.photoUrl ? athleteData.photoUrl : 'https://placehold.co/40x40/4169E1/FFFFFF?text=RUN';

        // Renderiza Strava se houver
        let stravaContent = "";
        if (data.stravaData) {
            stravaContent = `
                <div class="strava-data-display" style="background:#fff5f0; border:1px solid #fc4c02; border-radius:5px; padding:5px; margin-top:5px;">
                    <i class='bx bxl-strava' style="color:#fc4c02"></i> 
                    <b>${data.stravaData.distancia}</b> em <b>${data.stravaData.tempo}</b> (${data.stravaData.ritmo})
                </div>
            `;
        }

        el.innerHTML = `
            <div class="workout-card-header" style="justify-content:flex-start; gap:10px;">
                <img src="${avatar}" class="athlete-avatar" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #eee;">
                <div>
                    <span class="athlete-name" style="font-weight:bold; display:block;">${name}</span>
                    <span class="date" style="font-size:0.8rem; color:#777;">${new Date(data.date).toLocaleDateString('pt-BR')} - ${data.title}</span>
                </div>
            </div>
            <div class="workout-card-body">
                <p>${data.description}</p>
                <div style="font-style:italic; background:#f9f9f9; padding:5px; border-left:3px solid var(--secondary-color); margin-top:5px;">
                    "${data.feedback || 'Treino realizado.'}"
                </div>
                ${stravaContent}
                ${data.imageUrl ? `<img src="${data.imageUrl}" class="workout-image" style="margin-top:10px; width:100%; border-radius:8px;">` : ''}
            </div>
            <div class="workout-card-footer">
                <button class="action-btn btn-like" id="like-${id}"><i class='bx bx-heart'></i> <span class="count">0</span></button>
                <button class="action-btn btn-comment" id="comment-${id}"><i class='bx bx-comment'></i> <span class="count">0</span></button>
            </div>
        `;

        // Listeners
        el.querySelector('.athlete-avatar').onclick = (e) => { e.stopPropagation(); AppPrincipal.openViewProfileModal(data.ownerId); };
        
        // Abre modal de comentários
        el.onclick = (e) => {
            if (!e.target.closest('button')) AppPrincipal.openFeedbackModal(id, data.ownerId, data.title);
        };

        // Carrega Likes/Comments (Simplificado para o Feed)
        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${id}`);
        likesRef.on('value', s => {
            const btn = el.querySelector(`#like-${id}`);
            if(btn) {
                btn.querySelector('.count').textContent = s.numChildren();
                if(s.hasChild(FeedPanel.state.currentUser.uid)) btn.classList.add('liked');
                else btn.classList.remove('liked');
                
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if(s.hasChild(FeedPanel.state.currentUser.uid)) likesRef.child(FeedPanel.state.currentUser.uid).remove();
                    else likesRef.child(FeedPanel.state.currentUser.uid).set(true);
                };
            }
        });

        return el;
    }
};
