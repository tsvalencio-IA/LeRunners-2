/* =================================================================== */
/* APP.JS V8.0 - BASE V3 CORRIGIDA (SEM LOOP, PERMISSÕES OK)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha', // Controle interno
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaData: null,
        stravaTokenData: null 
    },

    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return; // Erro config

        try {
            if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        } catch (e) { console.error(e); }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento Seguro (Sem Loop)
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        // Mapeamento
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.userDisplay = document.getElementById('userDisplay');
        el.logoutButton = document.getElementById('logoutButton');
        el.navPlanilhaBtn = document.getElementById('nav-planilha-btn');
        el.navFeedBtn = document.getElementById('nav-feed-btn');
        el.navProfileBtn = document.getElementById('nav-profile-btn');
        
        // Modais e Forms
        el.feedbackModal = document.getElementById('feedback-modal');
        el.profileModal = document.getElementById('profile-modal');
        el.feedbackForm = document.getElementById('feedback-form');
        el.commentForm = document.getElementById('comment-form');
        el.logActivityForm = document.getElementById('log-activity-form');
        el.profileForm = document.getElementById('profile-form');

        // Listeners
        if(el.logoutButton) el.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        if(el.navPlanilhaBtn) el.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        if(el.navFeedBtn) el.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        if(el.navProfileBtn) el.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);

        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));

        if(el.feedbackForm) el.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        if(el.commentForm) el.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        if(el.logActivityForm) el.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        if(el.profileForm) el.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);

        // Botão Salvar Avaliação (Coach)
        const btnEval = document.getElementById('save-coach-eval-btn');
        if(btnEval) btnEval.addEventListener('click', AppPrincipal.handleCoachEvaluationSubmit);

        // Uploads
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;

        // Strava URL
        const urlParams = new URLSearchParams(window.location.search);
        
        // MONITOR DE AUTH (SEM LOOP)
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if (!user) {
                // Se não logado, mostra aviso e botão, NÃO recarrega página
                if(el.loader) el.loader.classList.add('hidden');
                document.body.innerHTML = `<div style="text-align:center;padding:50px;"><h2>Sessão Finalizada</h2><a href="index.html" class="btn btn-primary" style="max-width:200px;margin:auto;">Ir para Login</a></div>`;
                return;
            }

            if (AppPrincipal.state.currentUser && AppPrincipal.state.currentUser.uid === user.uid) return;

            AppPrincipal.state.currentUser = user;
            
            if (urlParams.get('code')) {
                AppPrincipal.exchangeStravaCode(urlParams.get('code'));
                return;
            }

            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        // Carrega caches
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', s => AppPrincipal.state.stravaTokenData = s.val());

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
            const isAdmin = (adminSnap.exists() && adminSnap.val() === true);
            
            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnap => {
                let data = userSnap.val();
                if (!data && isAdmin) {
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' };
                    AppPrincipal.state.db.ref('users/' + uid).set(data);
                }

                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    if(AppPrincipal.elements.userDisplay) AppPrincipal.elements.userDisplay.textContent = data.name;

                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin';
                        // Adiciona classe admin ao container
                        document.getElementById('app-container').classList.add('admin-view');
                        document.getElementById('app-container').classList.remove('atleta-view');
                    } else {
                        // Adiciona classe atleta
                        document.getElementById('app-container').classList.add('atleta-view');
                        document.getElementById('app-container').classList.remove('admin-view');
                    }

                    AppPrincipal.navigateTo('planilha'); // Carrega o painel
                }
            });
        });
    },

    navigateTo: (page) => {
        // Não apaga o HTML principal aqui, deixa o panels.js gerenciar
        if(page === 'planilha') {
            if(AppPrincipal.state.userData.role === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            else AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else if (page === 'feed') {
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    handleLogout: () => {
        AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html');
    },

    // --- MODAIS ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        
        // Reset campos
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        
        const coachArea = document.getElementById('coach-evaluation-area');
        const coachText = document.getElementById('coach-evaluation-text');
        if(coachText) coachText.value = '';

        const isOwner = AppPrincipal.state.currentUser.uid === ownerId;
        const isAdmin = AppPrincipal.state.userData.role === 'admin';

        // Lógica visual: Coach vê área de avaliação, Aluno vê área de feedback
        if(isAdmin && !isOwner) {
            if(coachArea) coachArea.classList.remove('hidden');
            document.getElementById('save-feedback-btn').classList.add('hidden');
            document.getElementById('workout-feedback-text').disabled = true;
            document.getElementById('workout-status').disabled = true;
        } else {
            if(coachArea) coachArea.classList.add('hidden');
            document.getElementById('save-feedback-btn').classList.remove('hidden');
            document.getElementById('workout-feedback-text').disabled = false;
            document.getElementById('workout-status').disabled = false;
        }

        // Carrega dados
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

        // Carrega comentários
        const commRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        commRef.on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem comentários.</p>"; return; }
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
        const status = document.getElementById('workout-status').value;
        const feedback = document.getElementById('workout-feedback-text').value;
        
        // Simples update
        const updates = { status, feedback, realizadoAt: new Date().toISOString() };
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        
        // Atualiza Feed Público
        if(status !== 'planejado') {
            const fullData = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                ownerId: currentOwnerId,
                ownerName: AppPrincipal.state.userData.name,
                ...fullData
            });
        }
        
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    handleCoachEvaluationSubmit: async (e) => {
        e.preventDefault();
        const text = document.getElementById('coach-evaluation-text').value;
        await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.modal.currentOwnerId}/workouts/${AppPrincipal.state.modal.currentWorkoutId}`).update({
            coachEvaluation: text
        });
        alert("Avaliação salva!");
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    // CORREÇÃO: Envia NOME para não dar erro
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name, // ESSENCIAL
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },

    // --- Utilitários ---
    displayStravaData: (d) => {
        const div = document.getElementById('strava-data-display');
        div.innerHTML = `<p><strong>Strava:</strong> ${d.distancia} | ${d.tempo}</p>`;
        div.classList.remove('hidden');
    },
    
    openProfileModal: () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
    },
    
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name });
        AppPrincipal.state.userData.name = name;
        document.getElementById('profile-modal').classList.add('hidden');
        document.getElementById('userDisplay').textContent = name;
    },

    // Funções placeholder para não quebrar links
    handleLogActivitySubmit: () => {},
    handlePhotoUpload: () => {},
    handleStravaConnect: () => { window.location.href = window.STRAVA_PUBLIC_CONFIG.authUrl; }, 
    handleStravaSyncActivities: () => alert("Use o botão no perfil para sincronizar.")
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
