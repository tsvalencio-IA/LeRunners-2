/* =================================================================== */
/* PANELS.JS V2.1 FINAL - RENDERIZAÇÃO SEGURA & DADOS COMPLETOS
/* =================================================================== */

const panels = {};

// --- 1. PAINEL DO COACH (ADMIN) ---
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V2.1: Iniciando...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapeia Elementos
        AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            workouts: document.getElementById('workouts-list'),
            form: document.getElementById('add-workout-form'),
            pendingList: document.getElementById('pending-list')
        };

        // Binds de Busca
        if(AdminPanel.elements.search) {
            AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        }
        
        // Listener seguro para o formulário (Resetando clone)
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        // Binds de Abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                const target = document.getElementById(`admin-tab-${btn.dataset.tab}`);
                if(target) target.classList.add('active');
            };
        });
        
        // Binds de Botões Admin
        const btnDelete = document.getElementById('delete-athlete-btn');
        if(btnDelete) btnDelete.onclick = AdminPanel.deleteAthlete;
        
        const btnAnalyze = document.getElementById('analyze-athlete-btn-ia');
        if(btnAnalyze) btnAnalyze.onclick = AdminPanel.runIA;

        // Carregamento Inicial
        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', snap => {
            AdminPanel.state.athletes = snap.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: (filter = "") => {
        const div = AdminPanel.elements.list;
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (data.role === 'admin') return;
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('div');
            row.className = 'athlete-list-item';
            if(uid === AdminPanel.state.selectedAthleteId) row.classList.add('selected');
            
            row.innerHTML = `<span>${data.name}</span>`;
            row.onclick = () => AdminPanel.selectAthlete(uid, data.name);
            div.appendChild(row);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        if(AdminPanel.elements.name) AdminPanel.elements.name.textContent = name;
        if(AdminPanel.elements.details) AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.renderList(); 
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadHistory(uid);
    },

    // --- CARREGAMENTO DE TREINOS (RENDERIZAÇÃO DOM SEGURA) ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = ""; // Limpa antes de redesenhar
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino agendado.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            // Ordenação: Data mais recente no topo
            list.sort((a,b) => new Date(b.date) - new Date(a.date));

            // CRIAÇÃO DE ELEMENTOS (Evita crash de innerHTML)
            list.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                // Cor da borda por status
                let border = "5px solid #ccc";
                if(w.status === 'realizado') border = "5px solid #28a745";
                else if(w.status === 'nao_realizado') border = "5px solid #dc3545";
                else if(w.status === 'realizado_parcial') border = "5px solid #ffc107";
                card.style.borderLeft = border;

                // 1. Cabeçalho
                let html = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="font-size:1.1em; color:var(--primary-color);">${new Date(w.date).toLocaleDateString('pt-BR')}</strong>
                        <span class="status-tag ${w.status || 'planejado'}">${w.status || 'planejado'}</span>
                    </div>
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${w.title}</div>
                    <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px; border:1px solid #eee;">${w.description}</div>
                `;

                // 2. Dados do Strava (Resumo + Detalhes)
                if(w.stravaData) {
                    html += `
                        <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                            <div style="display:flex; gap:10px; align-items:center; color:#fc4c02; font-weight:bold; font-size:0.9rem;">
                                <i class='bx bxl-strava'></i> Strava Sync
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:5px; background:#fff5eb; padding:8px; border-radius:4px; text-align:center; font-size:0.9rem;">
                                <div><small>Distância</small><br><strong>${w.stravaData.distancia}</strong></div>
                                <div><small>Tempo</small><br><strong>${w.stravaData.tempo}</strong></div>
                                <div><small>Pace</small><br><strong>${w.stravaData.ritmo}</strong></div>
                            </div>
                        </div>
                    `;
                    
                    // 3. Tabela de Splits (Se houver)
                    if(w.stravaData.splits && Array.isArray(w.stravaData.splits) && w.stravaData.splits.length > 0) {
                        let rows = "";
                        w.stravaData.splits.forEach(sp => {
                            rows += `<tr>
                                <td style="padding:4px;">${sp.km}</td>
                                <td style="padding:4px;">${sp.pace}</td>
                                <td style="padding:4px;">${sp.elev}m</td>
                            </tr>`;
                        });
                        
                        html += `
                            <details style="margin-top:8px; font-size:0.85rem; color:#666; cursor:pointer;">
                                <summary>Ver Parciais (Km a Km)</summary>
                                <table style="width:100%; margin-top:5px; border-collapse:collapse; text-align:center;">
                                    <thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </details>
                        `;
                    }
                }

                // 4. Rodapé e Ações
                html += `
                    <div style="text-align:right; margin-top:10px; padding-top:8px; border-top:1px dashed #ddd;">
                        <button class="btn-del btn btn-danger btn-small" style="padding:4px 10px; font-size:0.8rem;">Excluir</button>
                    </div>
                `;

                card.innerHTML = html;

                // Eventos Diretos (Sem usar string 'onclick', evita erros)
                card.addEventListener('click', (e) => {
                    // Evita abrir modal se clicar no botão excluir ou no details
                    if (!e.target.closest('button') && !e.target.closest('details')) {
                        AppPrincipal.openFeedbackModal(w.key, uid, w.title);
                    }
                });

                const delBtn = card.querySelector('.btn-del');
                if(delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if(confirm("Tem certeza que deseja apagar este treino permanentemente?")) {
                            const u={};
                            u[`/data/${uid}/workouts/${w.key}`]=null;
                            u[`/publicWorkouts/${w.key}`]=null;
                            AdminPanel.state.db.ref().update(u);
                        }
                    });
                }

                div.appendChild(card);
            });
        });
    },

    // --- HISTÓRICO DE IA ---
    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            
            const list = [];
            s.forEach(c => list.push(c.val()));
            list.reverse();
            
            list.forEach(h => {
                div.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; background:#f9f9f9; margin-bottom:5px; border-radius:4px;">
                    <b>${new Date(h.date).toLocaleDateString()}</b><br>
                    <div style="font-size:0.8rem; margin-top:5px; white-space:pre-wrap;">${h.text.substring(0, 150)}...</div>
                </div>`;
            });
        });
    },

    // --- APROVAÇÕES PENDENTES ---
    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Nenhuma pendência.</p>"; return; }
            s.forEach(c => {
                const row = document.createElement('div');
                row.className = 'pending-item';
                row.innerHTML = `<span>${c.val().name} (${c.val().email})</span> <button class="btn btn-success btn-small">Aprovar</button>`;
                
                row.querySelector('button').onclick = () => {
                    const u={};
                    u[`/users/${c.key}`] = { 
                        name: c.val().name, 
                        email: c.val().email, 
                        role: 'atleta', 
                        createdAt: new Date().toISOString() 
                    };
                    u[`/data/${c.key}`] = { workouts: {} };
                    u[`/pendingApprovals/${c.key}`] = null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(row);
            });
        });
    },

    // --- SALVAR PRESCRIÇÃO (FORMULÁRIO V17 DETALHADO) ---
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta primeiro.");

        const f = e.target;
        
        // Dados Obrigatórios
        const date = f.querySelector('#workout-date').value;
        const title = f.querySelector('#workout-title').value;
        if(!date || !title) return alert("Data e Título são obrigatórios.");

        // Dados do Formulário Detalhado
        const modalidade = f.querySelector('#workout-modalidade').value;
        const tipo = f.querySelector('#workout-tipo-treino').value;
        const intensidade = f.querySelector('#workout-intensidade').value;
        const percurso = f.querySelector('#workout-percurso').value;
        
        const dist = f.querySelector('#workout-distancia').value;
        const tempo = f.querySelector('#workout-tempo').value;
        const pace = f.querySelector('#workout-pace').value;
        const veloc = f.querySelector('#workout-velocidade').value;
        const obs = f.querySelector('#workout-observacoes').value;

        // Montagem da Descrição Formatada
        let desc = `[${modalidade}] - ${tipo}\n`;
        desc += `Intensidade: ${intensidade} | Percurso: ${percurso}\n`;
        
        if(dist) desc += `Distância: ${dist}km | `;
        if(tempo) desc += `Tempo: ${tempo} | `;
        if(pace) desc += `Pace: ${pace}`;
        if(veloc) desc += ` | Vel: ${veloc}`;
        
        if(obs) desc += `\n\nObs: ${obs}`;

        const data = {
            date: date,
            title: title,
            description: desc,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            // Dados estruturados para uso futuro
            structured: { modalidade, tipo, intensidade, dist, tempo, pace, obs }
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Treino prescrito com sucesso!");
            // Limpa título e obs, mas mantém a data para facilitar lançamentos em série
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },
    
    // --- INTELIGÊNCIA ARTIFICIAL (GEMINI) ---
    runIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        const name = AdminPanel.elements.name.textContent;
        const output = document.getElementById('ia-analysis-output');
        const modal = document.getElementById('ia-analysis-modal');
        const saveBtn = document.getElementById('save-ia-analysis-btn');
        
        modal.classList.remove('hidden');
        output.textContent = "Coletando dados e analisando com Gemini... (Isso pode levar alguns segundos)";
        saveBtn.classList.add('hidden');

        try {
            // Pega os últimos 15 treinos
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const workouts = snap.val();
            
            if(!workouts) throw new Error("Nenhum dado de treino disponível para analisar.");

            const prompt = `
                Analise os dados recentes de treinos do atleta ${name}.
                JSON: ${JSON.stringify(workouts)}
                
                Gere um relatório curto e direto em Markdown com:
                1. Análise de Consistência (está cumprindo o planejado?)
                2. Análise de Intensidade (comparar paces realizados com o tipo de treino)
                3. Sugestão de Foco para a próxima semana.
            `;
            
            const result = await AppPrincipal.callGeminiTextAPI(prompt);
            
            output.textContent = result;
            
            // Armazena para salvamento
            AppPrincipal.state.currentAnalysisData = {
                date: new Date().toISOString(),
                text: result,
                coachId: AdminPanel.state.currentUser.uid
            };
            saveBtn.classList.remove('hidden');

        } catch (err) {
            output.textContent = "Erro na Análise IA: " + err.message;
        }
    }
};

// --- 2. PAINEL DO ATLETA ---
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel: Init");
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        
        if(welcome) welcome.textContent = AppPrincipal.state.userData.name;

        const btnLog = document.getElementById('log-manual-activity-btn');
        if(btnLog) btnLog.onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');

        if(!list) return;

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Você não tem treinos agendados.</p>"; return; }

            const items = [];
            snap.forEach(c => items.push({key:c.key, ...c.val()}));
            items.sort((a,b) => new Date(b.date) - new Date(a.date));

            items.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                
                let extra = "";
                if(w.stravaData) {
                    extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px; font-weight:bold;">
                        <i class='bx bxl-strava'></i> ${w.stravaData.distancia} | ${w.stravaData.ritmo}
                    </div>`;
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <b>${new Date(w.date).toLocaleDateString('pt-BR')}</b>
                        <span class="status-tag ${w.status || 'planejado'}">${w.status || 'planejado'}</span>
                    </div>
                    <div style="font-weight:bold; margin:5px 0;">${w.title}</div>
                    <div style="font-size:0.9rem; color:#666;">${w.description.substring(0, 100)}...</div>
                    ${extra}
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn btn-primary btn-small">Ver Detalhes</button>
                    </div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                list.appendChild(card);
            });
        });
    }
};

// --- 3. FEED PANEL ---
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        if(!list) return;
        
        db.ref('publicWorkouts').limitToLast(30).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>O feed está vazio.</p>"; return; }

            const items = [];
            snap.forEach(c => items.push({key:c.key, ...c.val()}));
            items.reverse();

            items.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                let icon = w.stravaData ? "<i class='bx bxl-strava' style='color:#fc4c02'></i>" : "";

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="width:35px; height:35px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#555;">
                            ${w.ownerName ? w.ownerName.charAt(0) : "U"}
                        </div>
                        <div>
                            <div style="font-weight:bold; font-size:0.9rem;">${w.ownerName || "Atleta"}</div>
                            <div style="font-size:0.75rem; color:#777;">${new Date(w.date).toLocaleDateString()} ${icon}</div>
                        </div>
                    </div>
                    <div style="font-weight:bold;">${w.title}</div>
                    <div style="font-size:0.9rem; color:#444; margin-top:5px;">${w.feedback || w.description}</div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                list.appendChild(card);
            });
        });
    }
};

// EXPORT
window.panels = {
    init: () => {},
    cleanup: () => {
        if(AdminPanel.state.db) AdminPanel.state.db.ref().off();
    }
};
