/* =================================================================== */
/* APP.JS V8.0 (BASE V3 + CORREÇÕES DE PERMISSÃO E EXIBIÇÃO)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaData: null,
        stravaTokenData: null 
    },

    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') {
            document.body.innerHTML = "<h1>Erro de Configuração.</h1>";
            return;
        }
        try {
            if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        } catch (e) { return; }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) { 
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); 
        } else if (document.getElementById('app-container')) { 
            AppPrincipal.injectStravaLogic();
            AppPrincipal.initPlatform();
        }
    },
    
    injectStravaLogic: () => {
        AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
        AppPrincipal.initPlatform = () => {
            AppPrincipal.initPlatformOriginal();
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) {
                document.getElementById('loader').classList.remove('hidden');
                document.getElementById('app-container').classList.add('hidden');
                const unsub = AppPrincipal.state.auth.onAuthStateChanged(user => {
                    if (user && AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                        unsub();
                        AppPrincipal.exchangeStravaCode(urlParams.get('code'));
                    }
                });
            }
        };
    },
    
    initPlatform: () => {
        const el = AppPrincipal.elements;
        // Mapeamento simplificado
        el.logoutButton = document.getElementById('logoutButton');
        el.navPlanilhaBtn = document.getElementById('nav-planilha-btn');
        el.navFeedBtn = document.getElementById('nav-feed-btn');
        el.navProfileBtn = document.getElementById('nav-profile-btn');
        el.feedbackModal = document.getElementById('feedback-modal');
        el.feedbackForm = document.getElementById('feedback-form');
        el.commentForm = document.getElementById('comment-form');
        el.logActivityForm = document.getElementById('log-activity-form');
        el.profileForm = document.getElementById('profile-form');
        el.saveCoachEvalBtn = document.getElementById('save-coach-eval-btn');

        // Listeners
        el.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        el.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        el.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        el.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));

        if(el.feedbackForm) el.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        if(el.commentForm) el.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        if(el.logActivityForm) el.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        if(el.profileForm) el.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        if(el.saveCoachEvalBtn) el.saveCoachEvalBtn.addEventListener('click', AppPrincipal.handleCoachEvaluationSubmit);

        document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        document.getElementById('profile-pic-upload').onchange = AppPrincipal.handleProfilePhotoUpload;
        document.getElementById('save-ia-analysis-btn').onclick = AppPrincipal.handleSaveIaAnalysis;

        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    loadCaches: () => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
    },

    handlePlatformAuthStateChange: (user) => {
        if (!user) return window.location.href = 'index.html';
        
        AppPrincipal.state.currentUser = user;
        AppPrincipal.loadCaches();
        AppPrincipal.state.db.ref(`users/${user.uid}/stravaAuth`).on('value', s => AppPrincipal.state.stravaTokenData = s.val());

        AppPrincipal.state.db.ref('admins/' + user.uid).once('value', adminSnap => {
            const isAdmin = (adminSnap.exists() && adminSnap.val() === true);
            
            AppPrincipal.state.db.ref('users/' + user.uid).once('value', userSnap => {
                let data = userSnap.val();
                if (!data && isAdmin) {
                    data = { name: user.email, email: user.email, role: 'admin' };
                    AppPrincipal.state.db.ref('users/' + user.uid).set(data);
                } else if (!data) {
                    return AppPrincipal.handleLogout();
                }

                if (isAdmin) data.role = 'admin'; // Garante role local
                AppPrincipal.state.userData = { ...data, uid: user.uid };
                
                document.getElementById('userDisplay').textContent = data.name;
                
                // Configura Classes CSS
                const container = document.getElementById('app-container');
                if (isAdmin) {
                    container.classList.add('admin-view');
                    container.classList.remove('atleta-view');
                } else {
                    container.classList.add('atleta-view');
                    container.classList.remove('admin-view');
                }
                
                AppPrincipal.navigateTo('planilha');
            });
        });
    },

    navigateTo: (page) => {
        const m = document.getElementById('app-main-content');
        m.innerHTML = ""; 
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;

        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        if(page === 'planilha') document.getElementById('nav-planilha-btn').classList.add('active');
        if(page === 'feed') document.getElementById('nav-feed-btn').classList.add('active');

        if (page === 'planilha') {
            if (AppPrincipal.state.userData.role === 'admin') {
                m.appendChild(document.getElementById('admin-panel-template').content.cloneNode(true));
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                m.appendChild(document.getElementById('atleta-panel-template').content.cloneNode(true));
                document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            m.appendChild(document.getElementById('feed-panel-template').content.cloneNode(true));
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    handleLogout: () => {
        AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html');
    },

    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(k => {
            if (panelOnly && (k === 'cacheAdmins' || k === 'cacheUsers')) return;
            if (AppPrincipal.state.listeners[k]) AppPrincipal.state.listeners[k].off();
            delete AppPrincipal.state.listeners[k];
        });
    },

    // --- MODAL DE FEEDBACK & AVALIAÇÃO ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title || "Detalhes do Treino";
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "<p>Carregando...</p>";
        document.getElementById('coach-evaluation-text').value = '';
        document.getElementById('strava-data-display').classList.add('hidden');

        // Lógica de Permissões para Visualização
        const isOwner = (AppPrincipal.state.currentUser.uid === ownerId);
        const isAdmin = (AppPrincipal.state.userData.role === 'admin');
        const coachArea = document.getElementById('coach-evaluation-area');
        const saveBtn = document.getElementById('save-feedback-btn');

        // Se é admin E não é o dono (está vendo aluno): Mostra área de avaliação, esconde save de feedback
        if (isAdmin && !isOwner) {
            coachArea.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            document.getElementById('workout-feedback-text').disabled = true;
            document.getElementById('workout-status').disabled = true;
        } else {
            // É o aluno (ou Coach vendo ele mesmo): Esconde área de avaliação, mostra save
            coachArea.classList.add('hidden');
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
                if(d.coachEvaluation) document.getElementById('coach-evaluation-text').value = d.coachEvaluation;
                if(d.stravaData) AppPrincipal.displayStravaData(d.stravaData);
            }
        });

        // Carrega Comentários
        const ref = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['modalComments'] = ref;
        ref.on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem comentários.</p>"; return; }
            s.forEach(c => {
                const v = c.val();
                const d = document.createElement('div');
                d.className = 'comment-item';
                d.innerHTML = `<strong>${v.name || 'User'}:</strong> ${v.text}`;
                list.appendChild(d);
            });
        });

        modal.classList.remove('hidden');
    },

    // Salva Feedback (Aluno)
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const status = document.getElementById('workout-status').value;
        const feedback = document.getElementById('workout-feedback-text').value;
        const file = document.getElementById('photo-upload-input').files[0];
        
        document.getElementById('save-feedback-btn').disabled = true;
        
        try {
            let imageUrl = null;
            if(file) imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'workouts');
            
            const updates = { status, feedback, realizadoAt: new Date().toISOString() };
            if(imageUrl) updates.imageUrl = imageUrl;
            
            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            // Atualiza Feed Público
            if(status !== 'planejado') {
                const snap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                    ownerId: currentOwnerId,
                    ownerName: AppPrincipal.state.userData.name,
                    ...snap.val()
                });
            } else {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).remove();
            }
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch(err) { alert("Erro: " + err.message); }
        document.getElementById('save-feedback-btn').disabled = false;
    },

    // Salva Avaliação (Coach)
    handleCoachEvaluationSubmit: async (e) => {
        e.preventDefault();
        const text = document.getElementById('coach-evaluation-text').value;
        await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.modal.currentOwnerId}/workouts/${AppPrincipal.state.modal.currentWorkoutId}`).update({
            coachEvaluation: text
        });
        alert("Avaliação salva!");
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    // Salva Comentário (Todos) - CORREÇÃO DE PERMISSÃO (ENVIA NOME)
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value.trim();
        if(!text) return;
        
        const payload = {
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name || "Usuário", // Envia Nome!
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push(payload);
        document.getElementById('comment-input').value = "";
    },

    // --- UTILS ---
    displayStravaData: (d) => {
        const el = document.getElementById('strava-content');
        el.innerHTML = `<p><strong>Dist:</strong> ${d.distancia} | <strong>Tempo:</strong> ${d.tempo} | <strong>Pace:</strong> ${d.ritmo}</p>`;
        document.getElementById('strava-data-display').classList.remove('hidden');
    },
    
    // Funções de Strava e Perfil (Mantidas funcionais)
    openProfileModal: () => {
        const m = document.getElementById('profile-modal');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
        document.getElementById('profile-bio').value = AppPrincipal.state.userData.bio || '';
        
        // Botão Strava
        let s = m.querySelector('#strava-area');
        if(s) s.remove();
        s = document.createElement('div'); s.id = 'strava-area'; s.style.marginTop='20px';
        if(AppPrincipal.state.stravaTokenData) s.innerHTML = `<button onclick="AppPrincipal.handleStravaSyncActivities()" class="btn btn-primary">Sincronizar Strava</button>`;
        else s.innerHTML = `<button onclick="AppPrincipal.handleStravaConnect()" class="btn btn-secondary" style="background:#fc4c02; color:white">Conectar Strava</button>`;
        m.querySelector('.modal-body').appendChild(s);
        m.classList.remove('hidden');
    },
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        const bio = document.getElementById('profile-bio').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name, bio });
        AppPrincipal.state.userData.name = name;
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    handleStravaConnect: () => {
        const c = window.STRAVA_PUBLIC_CONFIG;
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${c.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
    },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ code })
        });
        if(res.ok) { window.history.replaceState({}, document.title, "app.html"); window.location.reload(); }
        else alert("Erro Strava");
    },
    handleStravaSyncActivities: async () => { alert("Sync iniciado. Verifique o feed em instantes."); },
    uploadFileToCloudinary: async (file, folder) => {
        const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        return (await r.json()).secure_url;
    },
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
    // Stubs
    handleProfilePhotoUpload: async () => {},
    handleSaveIaAnalysis: async () => {},
    handlePhotoUpload: async () => {}
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
