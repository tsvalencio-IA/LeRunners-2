/* =================================================================== */
/* APP.JS V9.0 - CORREÇÃO DE PERMISSÃO E LOOP
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        modal: { isOpen: false },
        stravaTokenData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        else if (document.getElementById('app-container')) AppPrincipal.initPlatform();
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        
        // Botões de navegação
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;

        // Modais
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;
        document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        
        const evalBtn = document.getElementById('save-coach-eval-btn');
        if(evalBtn) evalBtn.onclick = AppPrincipal.handleCoachEvaluationSubmit;

        // AUTH (SEM LOOP)
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) {
                if(el.loader) el.loader.classList.add('hidden');
                // Não redireciona, mostra aviso
                return;
            }
            if(AppPrincipal.state.currentUser && AppPrincipal.state.currentUser.uid === user.uid) return;
            
            AppPrincipal.state.currentUser = user;
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users/' + uid).on('value', s => {
            const data = s.val();
            if(!data) return; // Aguarda criação
            
            AppPrincipal.state.userData = { ...data, uid: uid };
            document.getElementById('userDisplay').textContent = data.name;
            
            // Verifica se é Admin
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                if(isAdmin) {
                    AppPrincipal.state.userData.role = 'admin';
                    document.getElementById('app-container').classList.add('admin-view');
                    AppPrincipal.setupAdminToggle(true);
                } else {
                    document.getElementById('app-container').classList.add('atleta-view');
                }
                
                // Carrega Token Strava
                AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                
                AppPrincipal.navigateTo('planilha');
            });
        });
    },

    navigateTo: (page) => {
        const m = document.getElementById('app-main-content');
        m.innerHTML = "";
        
        // Atualiza botões
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        document.getElementById(`nav-${page}-btn`).classList.add('active');

        if(page === 'planilha') {
            if(AppPrincipal.state.userData.role === 'admin' && !AppPrincipal.state.viewModeAtleta) {
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else {
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
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
            AppPrincipal.state.viewModeAtleta = !AppPrincipal.state.viewModeAtleta;
            btn.innerHTML = AppPrincipal.state.viewModeAtleta ? "<i class='bx bx-shield-quarter'></i> Modo Coach" : "<i class='bx bx-run'></i> Modo Atleta";
            btn.style.background = AppPrincipal.state.viewModeAtleta ? "#00008B" : "white";
            btn.style.color = AppPrincipal.state.viewModeAtleta ? "white" : "#00008B";
            AppPrincipal.navigateTo('planilha');
        };
        nav.insertBefore(btn, document.getElementById('logoutButton'));
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- MODAIS ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        
        // Verifica permissões para campos
        const isOwner = AppPrincipal.state.currentUser.uid === ownerId;
        const isAdmin = AppPrincipal.state.userData.role === 'admin';
        
        const coachArea = document.getElementById('coach-evaluation-area');
        if(isAdmin && !isOwner) {
            if(coachArea) coachArea.classList.remove('hidden');
            document.getElementById('save-feedback-btn').classList.add('hidden');
        } else {
            if(coachArea) coachArea.classList.add('hidden');
            document.getElementById('save-feedback-btn').classList.remove('hidden');
        }

        // Carrega dados
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                document.getElementById('workout-status').value = d.status || 'planejado';
                document.getElementById('workout-feedback-text').value = d.feedback || '';
                if(d.coachEvaluation && document.getElementById('coach-evaluation-text')) 
                    document.getElementById('coach-evaluation-text').value = d.coachEvaluation;
            }
        });

        // Comentários
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<small>Seja o primeiro a comentar.</small>"; return; }
            s.forEach(c => {
                const d = document.createElement('div');
                d.className = 'comment-item';
                d.innerHTML = `<strong>${c.val().name || 'Usuário'}:</strong> ${c.val().text}`;
                list.appendChild(d);
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
        
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        
        // Atualiza público
        if(updates.status !== 'planejado') {
            const full = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ ownerId: currentOwnerId, ownerName: AppPrincipal.state.userData.name, ...full });
        }
        
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    handleCoachEvaluationSubmit: async () => {
        const text = document.getElementById('coach-evaluation-text').value;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update({ coachEvaluation: text });
        alert("Avaliação salva!");
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name, // Correção do Nome
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },

    // Funções auxiliares (Mantidas)
    openProfileModal: () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
    },
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name });
        document.getElementById('profile-modal').classList.add('hidden');
    },
    // Stubs
    handleLogActivitySubmit: () => {}, handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {}
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
