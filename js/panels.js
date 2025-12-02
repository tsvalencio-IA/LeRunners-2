/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V9.0 - VISUAL ORIGINAL + CORREÇÃO DE LEITURA)
/* =================================================================== */

// ===================================================================
// 1. ADMIN PANEL - O DASHBOARD BONITO
// ===================================================================
const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V9.0: Restaurando Visual...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // RECUPERAÇÃO DO DASHBOARD DE ÍCONES (ORIGINAL DO ZIP V3)
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
        AdminPanel.showSection('alunos'); // Começa na lista de alunos
    },

    loadData: () => {
        // Carrega Alunos
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = Object.keys(AdminPanel.state.athletes).length;
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });
        
        // Carrega Pendentes
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            const count = s.exists() ? s.numChildren() : 0;
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = count;
        });

        // Carrega Feedbacks (Treinos realizados recentemente)
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            if(s.exists() && document.getElementById('badge-feed'))
                document.getElementById('badge-feed').textContent = s.numChildren();
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'alunos') {
            // Renderiza a estrutura da lista de alunos
            area.innerHTML = `
                <h3><i class='bx bx-list-ul'></i> Gestão de Alunos</h3>
                <input type="text" id="athlete-search" class="search-input" placeholder="Buscar aluno..." onkeyup="AdminPanel.renderAthleteList(this.value)">
                <div id="athlete-list-container"></div>
                
                <div id="athlete-workspace" class="hidden" style="margin-top:20px; border-top:1px solid #eee; padding-top:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 id="workspace-title" style="color:var(--primary-color); margin:0;">Nome do Aluno</h3>
                        <button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">Fechar</button>
                    </div>

                    <div class="admin-tabs">
                        <button class="tab-btn active" onclick="AdminPanel.switchWorkspaceTab('prescrever')">Prescrever</button>
                        <button class="tab-btn" onclick="AdminPanel.switchWorkspaceTab('kpis')">IA & KPIs</button>
                    </div>

                    <div id="tab-prescrever" class="ws-tab-content active">
                        <div id="prescription-area" style="background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #ddd; margin-bottom:20px;">
                            <h4 style="margin-bottom:10px; color:#555;">Nova Sessão de Treino</h4>
                            <form id="quick-add-form" class="form-minimal">
                                <div class="form-grid-2col">
                                    <div class="form-group"><label>Data</label><input type="date" id="qa-date" required></div>
                                    <div class="form-group"><label>Título</label><input type="text" id="qa-title" placeholder="Ex: Longão 15k" required></div>
                                </div>
                                <div class="form-group"><label>Descrição Detalhada (SisRUN)</label><textarea id="qa-desc" rows="3" placeholder="Ex: 10' Aq + 5x1000m + 10' Des..."></textarea></div>
                                <button type="submit" class="btn btn-secondary" style="width:100%;">Agendar Treino</button>
                            </form>
                        </div>
                        <div id="workspace-workouts"></div>
                    </div>

                    <div id="tab-kpis" class="ws-tab-content hidden">
                        <button class="btn btn-primary" onclick="AdminPanel.handleAnalyzeAthleteIA()" style="width:100%;">Gerar Análise de Performance (IA)</button>
                        <div id="ia-output" style="margin-top:15px; white-space:pre-wrap; background:#f0f8ff; padding:15px; border-radius:8px; border:1px solid #bda0fd;"></div>
                    </div>
                </div>
            `;
            AdminPanel.renderAthleteList();
            
            // Ativa o submit do formulário
            setTimeout(() => {
                const form = document.getElementById('quick-add-form');
                if(form) form.onsubmit = AdminPanel.handleQuickAdd;
            }, 100);
        } 
        else if (section === 'aprovacoes') {
            area.innerHTML = `<h3>Aprovações Pendentes</h3><div id="pending-list"></div>`;
            AdminPanel.renderPendingList();
        }
        else if (section === 'feedbacks') {
            area.innerHTML = `<h3>Central de Feedbacks</h3><div id="feedback-central-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        }
        else {
            area.innerHTML = `<div style="padding:30px; text-align:center; color:#999;">Módulo <b>${section}</b> em breve.</div>`;
        }
    },

    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if(!div) return;
        div.innerHTML = "";

        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            // Filtro para não mostrar o próprio coach na lista principal
            if (uid === AdminPanel.state.currentUser.uid) return;
            
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

            const item = document.createElement('div');
            item.className = 'athlete-list-item';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${data.photoUrl || 'https://placehold.co/40x40/ccc/fff'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    <span style="font-weight:bold; font-size:1rem;">${data.name}</span>
                </div>
                <i class='bx bx-chevron-right' style="font-size:1.5rem; color:#999;"></i>
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
        AdminPanel.loadWorkspace
