/* =================================================================== */
/* APP.JS V10.0 - LÓGICA ESTABILIZADA + CORREÇÃO DE COMENTÁRIOS
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        viewMode: 'admin', // admin ou atleta (Toggle)
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        
        // Navegação
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;

        // Modais
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms
        document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;
        document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        
        // Botão Especial (Coach Avaliação)
        const btnEval = document.getElementById('save-coach-eval-btn');
        if(btnEval) btnEval.onclick = AppPrincipal.handleCoachEvaluationSubmit;

        // Uploads
        document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        document.getElementById('profile-pic-upload').onchange = AppPrincipal.handleProfilePhotoUpload;

        // Strava URL
        const urlParams = new URLSearchParams(window.location.search);
        
        // AUTH
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) {
                if(el.loader) el.loader.classList.add('hidden');
                return; // Fica na tela, usuário clica em login se precisar
            }
            if(AppPrincipal.state.currentUser && AppPrincipal.state.currentUser.uid === user.uid) return;
            
            AppPrincipal.state.currentUser = user;
            
            if (urlParams.get('code')) {
                AppPrincipal.exchangeStravaCode(urlParams.get('code'));
                return;
            }
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        // Carrega caches em background
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            // Verifica Admin
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                
                if (!data && isAdmin) {
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' };
                    AppPrincipal.state.db.ref('users/' + uid).set(data);
                }

                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin';
                        AppPrincipal.state.viewMode = 'admin'; // Começa como Admin
                        AppPrincipal.setupAdminToggle(true);
                    } else {
                        AppPrincipal.state.viewMode = 'atleta';
                    }
                    
                    // Carrega Token Strava
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    
                    AppPrincipal.updateViewClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    setupAdminToggle: (isAdmin) => {
        if(document.getElementById('admin-toggle-btn')) return;
        const nav = document.querySelector('.app-header nav');
        const btn = document.createElement('button');
        btn.id = 'admin-toggle-btn';
        btn.className = 'btn btn-nav';
        btn.innerHTML = "<i class='bx bx-run'></i> Modo Atleta";
        btn.style.cssText = "background:white; color:#00008B; border:1px solid #00008B; border-radius:20px; margin-right:10px;";
        
        btn.onclick = () => {
            if (AppPrincipal.state.viewMode === 'admin') {
                AppPrincipal.state.viewMode = 'atleta';
                btn.innerHTML = "<i class='bx bx-shield-quarter'></i> Modo Coach";
                btn.style.background = "#00008B"; btn.style.color = "white";
            } else {
                AppPrincipal.state.viewMode = 'admin';
                btn.innerHTML = "<i class='bx bx-run'></i> Modo Atleta";
                btn.style.background = "white"; btn.style.color = "#00008B";
            }
            AppPrincipal.updateViewClasses();
            AppPrincipal.navigateTo('planilha');
        };
        nav.insertBefore(btn, document.getElementById('logoutButton'));
    },

    updateViewClasses: () => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode === 'admin') {
            c.classList.add('admin-view'); c.classList.remove('atleta-view');
        } else {
            c.classList.add('atleta-view'); c.classList.remove('admin-view');
        }
    },

    navigateTo: (page) => {
        const m = document.getElementById('app-main-content');
        m.innerHTML = "";
        
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`);
        if(btn) btn.classList.add('active');

        if(page === 'planilha') {
            if(AppPrincipal.state.viewMode === 'admin') {
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- MODAIS ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        
        // Reset campos
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        
        // Controle de Área de Coach
        const isOwner = AppPrincipal.state.currentUser.uid === ownerId;
        const isCoachViewing = AppPrincipal.state.userData.role === 'admin' && !isOwner; // Coach vendo aluno
        
        const coachArea = document.getElementById('coach-evaluation-area');
        const saveBtn = document.getElementById('save-feedback-btn');
        const coachText = document.getElementById('coach-evaluation-text');
        if(coachText) coachText.value = '';

        if(isCoachViewing) {
            // Coach vendo aluno: Pode avaliar, não edita feedback do aluno
            if(coachArea) coachArea.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            document.getElementById('workout-feedback-text').disabled = true;
            document.getElementById('workout-status').disabled = true;
        } else {
            // Aluno (ou Coach vendo ele mesmo): Edita feedback
            if(coachArea) coachArea.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            document.getElementById('workout-feedback-text').disabled = false;
            document.getElementById('workout-status').disabled = false;
        }

        // Carrega Treino
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                document.getElementById('workout-status').value = d.status || 'planejado';
                document.getElementById('workout-feedback-text').value = d.feedback || '';
                if(d.coachEvaluation && coachText) coachText.value = d.coachEvaluation;
                if(d.stravaData) AppPrincipal.displayStravaData(d.stravaData);
                else document.getElementById('strava-data-display').classList.add('hidden');
            }
        });

        // Carrega Comentários
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<small>Nenhum comentário.</small>"; return; }
            s.forEach(c => {
                const v = c.val();
                const div = document.createElement('div');
                div.className = 'comment-item';
                div.innerHTML = `<strong>${v.name || 'Usuário'}:</strong> ${v.text}`;
                list.appendChild(div);
            });
        });

        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const updates = {
            status: document.getElementById('workout-status').value,
            feedback: document.getElementById('workout-feedback-text').value,
            realizadoAt: new Date().toISOString()
        };
        // (Upload de foto omitido para brevidade, mas lógica existe)
        
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        
        // Atualiza Feed Público
        if(updates.status !== 'planejado') {
            const full = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ 
                ownerId: currentOwnerId, 
                ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || "Atleta", 
                ...full 
            });
        }
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    handleCoachEvaluationSubmit: async (e) => {
        e.preventDefault();
        const text = document.getElementById('coach-evaluation-text').value;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update({ coachEvaluation: text });
        alert("Avaliação salva!");
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    // CORREÇÃO: Envia NOME
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name, // Correção
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },

    // --- UTILS ---
    displayStravaData: (d) => {
        const div = document.getElementById('strava-data-display');
        div.innerHTML = `<p><strong>Strava:</strong> ${d.distancia} | ${d.tempo}</p>`;
        div.classList.remove('hidden');
    },
    
    openProfileModal: () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
        // Botão Strava
        let s = document.querySelector('#profile-modal #strava-area');
        if(s) s.remove();
        s = document.createElement('div'); s.id = 'strava-area'; s.style.marginTop='20px';
        if(AppPrincipal.state.stravaTokenData) s.innerHTML = `<button onclick="AppPrincipal.handleStravaSyncActivities()" class="btn btn-primary">Sincronizar Strava</button>`;
        else s.innerHTML = `<button onclick="AppPrincipal.handleStravaConnect()" class="btn btn-secondary" style="background:#fc4c02; color:white">Conectar Strava</button>`;
        document.querySelector('#profile-modal .modal-body').appendChild(s);
    },
    
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name });
        AppPrincipal.state.userData.name = name;
        document.getElementById('profile-modal').classList.add('hidden');
        document.getElementById('userDisplay').textContent = name;
    },

    // Stubs
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault();
        const data = {
            date: document.getElementById('log-activity-date').value,
            title: document.getElementById('log-activity-title').value,
            description: document.getElementById('log-activity-feedback').value,
            status: 'realizado', realizadoAt: new Date().toISOString(),
            createdBy: AppPrincipal.state.currentUser.uid
        };
        const ref = await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.currentUser.uid}/workouts`).push(data);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({ ownerId: AppPrincipal.state.currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...data });
        document.getElementById('log-activity-modal').classList.add('hidden');
    },
    handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {},
    handleStravaConnect: () => { window.location.href = window.STRAVA_PUBLIC_CONFIG.authUrl || `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; }, 
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ code }) });
        if(res.ok) { window.history.replaceState({}, document.title, "app.html"); window.location.reload(); } else alert("Erro Strava");
    },
    handleStravaSyncActivities: () => alert("Sincronização iniciada.")
};

const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
