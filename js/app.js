/* =================================================================== */
/* APP.JS - VERSÃO 4.2 + CORREÇÃO SYNC E SPLITS (MERGE INTELIGENTE)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        viewMode: 'admin', 
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaTokenData: null,
        currentAnalysisData: null
    },
    elements: {},

    // ===================================================================
    // 1. INICIALIZAÇÃO
    // ===================================================================
    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            console.error("Erro Firebase:", e);
        }

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
            const stravaCode = urlParams.get('code');
            const stravaError = urlParams.get('error');

            if (stravaCode && !stravaError) {
                AppPrincipal.elements.loader.classList.remove('hidden');
                AppPrincipal.elements.appContainer.classList.add('hidden');
                
                const unsubscribe = AppPrincipal.state.auth.onAuthStateChanged(user => {
                    if (user) { 
                        if (AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                            unsubscribe();
                            AppPrincipal.exchangeStravaCode(stravaCode);
                        }
                    }
                });
            } else if (stravaError) {
                alert(`Conexão Strava Falhou: ${stravaError}.`);
                window.history.replaceState({}, document.title, "app.html");
            }
        };
    },
    
    initPlatform: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            mainContent: document.getElementById('app-main-content'),
            
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            navProfileBtn: document.getElementById('nav-profile-btn'),
            navFinanceBtn: document.getElementById('nav-finance-btn'), 
            
            feedbackModal: document.getElementById('feedback-modal'),
            closeFeedbackModal: document.getElementById('close-feedback-modal'),
            feedbackModalTitle: document.getElementById('feedback-modal-title'),
            feedbackForm: document.getElementById('feedback-form'),
            workoutStatusSelect: document.getElementById('workout-status'),
            workoutFeedbackText: document.getElementById('workout-feedback-text'),
            photoUploadInput: document.getElementById('photo-upload-input'),
            photoUploadFeedback: document.getElementById('photo-upload-feedback'),
            stravaDataDisplay: document.getElementById('strava-data-display'),
            saveFeedbackBtn: document.getElementById('save-feedback-btn'),
            
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            commentsList: document.getElementById('comments-list'),

            logActivityModal: document.getElementById('log-activity-modal'),
            closeLogActivityModal: document.getElementById('close-log-activity-modal'),
            logActivityForm: document.getElementById('log-activity-form'),

            whoLikedModal: document.getElementById('who-liked-modal'),
            closeWhoLikedModal: document.getElementById('close-who-liked-modal'),
            whoLikedList: document.getElementById('who-liked-list'),

            iaAnalysisModal: document.getElementById('ia-analysis-modal'),
            closeIaAnalysisModal: document.getElementById('close-ia-analysis-modal'),
            iaAnalysisOutput: document.getElementById('ia-analysis-output'),
            saveIaAnalysisBtn: document.getElementById('save-ia-analysis-btn'),

            profileModal: document.getElementById('profile-modal'),
            closeProfileModal: document.getElementById('close-profile-modal'),
            profileForm: document.getElementById('profile-form'),
            profilePicPreview: document.getElementById('profile-pic-preview'),
            profilePicUpload: document.getElementById('profile-pic-upload'),
            profileUploadFeedback: document.getElementById('profile-upload-feedback'),
            profileName: document.getElementById('profile-name'),
            profileBio: document.getElementById('profile-bio'),
            saveProfileBtn: document.getElementById('save-profile-btn'),

            viewProfileModal: document.getElementById('view-profile-modal'),
            closeViewProfileModal: document.getElementById('close-view-profile-modal'),
            viewProfilePic: document.getElementById('view-profile-pic'),
            viewProfileName: document.getElementById('view-profile-name'),
            viewProfileBio: document.getElementById('view-profile-bio'),
        };
        
        // Listeners
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        AppPrincipal.elements.navFinanceBtn.addEventListener('click', () => AppPrincipal.navigateTo('finance'));
        
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);

        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', AppPrincipal.closeLogActivityModal);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);

        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);

        AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModal.addEventListener('click', AppPrincipal.closeProfileModal);
        AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        AppPrincipal.elements.profilePicUpload.addEventListener('change', AppPrincipal.handleProfilePhotoUpload);

        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', AppPrincipal.closeViewProfileModal);

        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    loadCaches: () => {
        const adminsRef = AppPrincipal.state.db.ref('admins');
        AppPrincipal.state.listeners['cacheAdmins'] = adminsRef;
        adminsRef.on('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
        });

        const usersRef = AppPrincipal.state.db.ref('users');
        AppPrincipal.state.listeners['cacheUsers'] = usersRef;
        usersRef.on('value', snapshot => {
            AppPrincipal.state.userCache = snapshot.val() || {};
        });
    },

    // ===================================================================
    // 2. AUTH & DADOS
    // ===================================================================
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            AppPrincipal.cleanupListeners(false);
            window.location.href = 'index.html';
            return;
        }

        const { appContainer, navFinanceBtn } = AppPrincipal.elements;
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        
        AppPrincipal.loadCaches();

        AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', snapshot => {
            AppPrincipal.state.stravaTokenData = snapshot.val();
        });

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                // É ADMIN
                navFinanceBtn.classList.remove('hidden'); 

                AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                    let adminName;
                    if (userSnapshot.exists()) {
                        adminName = userSnapshot.val().name;
                        AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    } else {
                        adminName = user.email;
                        const adminProfile = {
                            name: adminName,
                            email: user.email,
                            role: "admin",
                            createdAt: new Date().toISOString()
                        };
                        AppPrincipal.state.db.ref('users/' + uid).set(adminProfile);
                        AppPrincipal.state.userData = adminProfile;
                    }
                    AppPrincipal.state.userData.role = 'admin';
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    
                    // --- BOTÃO "MODO ATLETA" ---
                    const nav = document.querySelector('.app-header nav');
                    if(!document.getElementById('admin-toggle')) {
                        const btn = document.createElement('button');
                        btn.id = 'admin-toggle'; 
                        btn.className = 'btn btn-nav'; 
                        btn.innerHTML = "Modo Atleta"; 
                        btn.style.border = "1px solid #ccc"; 
                        btn.style.marginLeft = "10px";
                        
                        btn.onclick = () => {
                            if (AppPrincipal.state.viewMode === 'admin') {
                                AppPrincipal.state.viewMode = 'atleta';
                                btn.innerHTML = "Modo Coach";
                                appContainer.classList.add('atleta-view');
                                appContainer.classList.remove('admin-view');
                                navFinanceBtn.classList.add('hidden'); 
                            } else {
                                AppPrincipal.state.viewMode = 'admin';
                                btn.innerHTML = "Modo Atleta";
                                appContainer.classList.add('admin-view');
                                appContainer.classList.remove('atleta-view');
                                navFinanceBtn.classList.remove('hidden'); 
                            }
                            AppPrincipal.navigateTo('planilha');
                        };
                        
                        const logoutBtn = document.getElementById('logoutButton');
                        nav.insertBefore(btn, logoutBtn);
                    }
                    // ---------------------------------------------

                    appContainer.classList.add('admin-view');
                    appContainer.classList.remove('atleta-view');
                    AppPrincipal.navigateTo('planilha');
                });
                return;
            }

            // NÃO É ADMIN (Atleta comum)
            navFinanceBtn.classList.add('hidden'); 

            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${AppPrincipal.state.userData.name}`;
                    appContainer.classList.add('atleta-view');
                    appContainer.classList.remove('admin-view');
                    AppPrincipal.navigateTo('planilha');
                } else {
                    AppPrincipal.handleLogout(); 
                }
            });
        });
    },

    // ===================================================================
    // 3. ROTEAMENTO
    // ===================================================================
    navigateTo: (page) => {
        const { mainContent, loader, appContainer, navPlanilhaBtn, navFeedBtn, navFinanceBtn } = AppPrincipal.elements;
        mainContent.innerHTML = ""; 
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;

        navPlanilhaBtn.classList.toggle('active', page === 'planilha');
        navFeedBtn.classList.toggle('active', page === 'feed');
        navFinanceBtn.classList.toggle('active', page === 'finance');

        if (typeof AdminPanel === 'undefined' || typeof AtletaPanel === 'undefined' || typeof FeedPanel === 'undefined' || typeof FinancePanel === 'undefined') {
            mainContent.innerHTML = "<h1>Erro ao carregar módulos. Recarregue a página.</h1>";
            return;
        }

        if (page === 'planilha') {
            if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') {
                const adminTemplate = document.getElementById('admin-panel-template').content.cloneNode(true);
                mainContent.appendChild(adminTemplate);
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                const atletaTemplate = document.getElementById('atleta-panel-template').content.cloneNode(true);
                mainContent.appendChild(atletaTemplate);
                const welcomeEl = document.getElementById('atleta-welcome-name');
                if (welcomeEl) {
                    welcomeEl.textContent = AppPrincipal.state.userData.name;
                }
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } 
        else if (page === 'feed') {
            const feedTemplate = document.getElementById('feed-panel-template').content.cloneNode(true);
            mainContent.appendChild(feedTemplate);
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        else if (page === 'finance') {
            if (AppPrincipal.state.userData.role === 'admin') {
                const financeTemplate = document.getElementById('finance-panel-template').content.cloneNode(true);
                mainContent.appendChild(financeTemplate);
                FinancePanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                alert("Acesso negado.");
                AppPrincipal.navigateTo('planilha');
            }
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => {
        AppPrincipal.cleanupListeners(false);
        AppPrincipal.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
    },

    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(key => {
            const listenerRef = AppPrincipal.state.listeners[key];
            if (panelOnly && (key === 'cacheAdmins' || key === 'cacheUsers')) return; 
            if (listenerRef && typeof listenerRef.off === 'function') listenerRef.off();
            delete AppPrincipal.state.listeners[key];
        });
    },

    // ===================================================================
    // 4. PERFIL E STRAVA
    // ===================================================================
    openProfileModal: () => {
        const { profileModal, profileName, profileBio, profilePicPreview, profileUploadFeedback, saveProfileBtn } = AppPrincipal.elements;
        const { userData, stravaTokenData } = AppPrincipal.state;
        
        if (!userData) return;

        AppPrincipal.state.modal.newPhotoUrl = null;
        profileUploadFeedback.textContent = "";
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Salvar Perfil";

        profileName.value = userData.name || '';
        profileBio.value = userData.bio || '';
        profilePicPreview.src = userData.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';

        const modalBody = profileModal.querySelector('.modal-body');
        let stravaSection = modalBody.querySelector('#strava-connect-section');
        
        if (stravaSection) stravaSection.remove();

        stravaSection = document.createElement('div');
        stravaSection.id = 'strava-connect-section';
        stravaSection.style.marginTop = "2rem";
        stravaSection.style.paddingTop = "1rem";
        stravaSection.style.borderTop = "1px solid #e0e0e0";

        // VERIFICAÇÃO VISUAL DE EXPIRAÇÃO (Opcional, mas útil)
        const now = Math.floor(Date.now() / 1000);
        const isExpired = stravaTokenData && stravaTokenData.expiresAt && now > stravaTokenData.expiresAt;
        const statusText = isExpired ? " (Token expirado - renovação automática no sync)" : " (Ativo)";

        if (stravaTokenData && stravaTokenData.accessToken) {
            stravaSection.innerHTML = `
                <fieldset style="border-color: var(--success-color);">
                    <legend style="color: var(--success-color);"><i class='bx bxl-strava'></i> Strava Conectado</legend>
                    <p style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--success-color);">
                        <i class='bx bx-check-circle'></i> Conta vinculada${statusText}.
                    </p>
                    <button id="btn-sync-strava" class="btn btn-primary" style="background-color: var(--strava-orange); color: white;">
                        <i class='bx bx-cloud-download'></i> Sincronizar Tudo
                    </button>
                    <p id="strava-sync-status" style="font-size: 0.85rem; margin-top: 0.5rem; font-weight: bold; color: var(--primary-color);"></p>
                </fieldset>
            `;
        } else {
            stravaSection.innerHTML = `
                <fieldset>
                    <legend><i class='bx bxl-strava'></i> Integração Strava</legend>
                    <p style="margin-bottom: 1rem; font-size: 0.9rem;">Conecte sua conta para importar atividades.</p>
                    <button id="btn-connect-strava" class="btn btn-secondary" style="background-color: var(--strava-orange); color: white;">
                        <i class='bx bxl-strava'></i> Conectar Strava
                    </button>
                </fieldset>
            `;
        }

        modalBody.appendChild(stravaSection);

        const btnConnect = stravaSection.querySelector('#btn-connect-strava');
        const btnSync = stravaSection.querySelector('#btn-sync-strava');

        if (btnConnect) btnConnect.addEventListener('click', AppPrincipal.handleStravaConnect);
        if (btnSync) btnSync.addEventListener('click', AppPrincipal.handleStravaSyncActivities);

        profileModal.classList.remove('hidden');
    },

    closeProfileModal: () => {
        AppPrincipal.elements.profileModal.classList.add('hidden');
    },

    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const { saveProfileBtn, profileName, profileBio } = AppPrincipal.elements;
        const { currentUser } = AppPrincipal.state;
        
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Salvando...";

        try {
            const newName = profileName.value.trim();
            const newBio = profileBio.value.trim();
            const newPhotoUrl = AppPrincipal.state.modal.newPhotoUrl;

            if (!newName) throw new Error("O nome não pode ficar em branco.");

            const updates = {};
            updates[`/users/${currentUser.uid}/name`] = newName;
            updates[`/users/${currentUser.uid}/bio`] = newBio;
            if (newPhotoUrl) updates[`/users/${currentUser.uid}/photoUrl`] = newPhotoUrl;
            
            await AppPrincipal.state.db.ref().update(updates);

            AppPrincipal.state.userData.name = newName;
            AppPrincipal.state.userData.bio = newBio;
            if (newPhotoUrl) AppPrincipal.state.userData.photoUrl = newPhotoUrl;
            
            AppPrincipal.elements.userDisplay.textContent = newName;
            AppPrincipal.closeProfileModal();

        } catch (err) {
            alert("Erro: " + err.message);
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = "Salvar Perfil";
        }
    },
    
    handleProfilePhotoUpload: async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const { profileUploadFeedback, saveProfileBtn, profilePicPreview } = AppPrincipal.elements;
        profileUploadFeedback.textContent = "Enviando foto...";
        saveProfileBtn.disabled = true;
        try {
            const imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'profile');
            AppPrincipal.state.modal.newPhotoUrl = imageUrl;
            profilePicPreview.src = imageUrl;
            profileUploadFeedback.textContent = "Sucesso!";
        } catch (err) {
            profileUploadFeedback.textContent = "Falha no upload.";
        } finally {
            saveProfileBtn.disabled = false;
        }
    },

    // --- STRAVA AUTH ---
    handleStravaConnect: () => {
        if (typeof window.STRAVA_PUBLIC_CONFIG === 'undefined') {
            alert("Erro: Configuração do Strava ausente.");
            return;
        }
        const config = window.STRAVA_PUBLIC_CONFIG;
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientID}&response_type=code&redirect_uri=${config.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
        window.location.href = stravaAuthUrl;
    },

    exchangeStravaCode: async (stravaCode) => {
        const VERCEL_API_URL = window.STRAVA_PUBLIC_CONFIG.vercelAPI;
        const user = AppPrincipal.state.currentUser;

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(VERCEL_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ code: stravaCode })
            });

            const result = await response.json();
            if (response.ok) {
                alert("Strava conectado com sucesso!");
                window.history.replaceState({}, document.title, "app.html");
                window.location.reload();
            } else {
                alert(`Falha: ${result.details || result.error}`);
                window.location.href = 'app.html';
            }
        } catch (error) {
            alert("Erro de rede ao conectar Strava.");
            window.location.href = 'app.html';
        }
    },

    // --- FUNÇÃO DE RENOVAÇÃO (REFRESH) ---
    refreshStravaToken: async () => {
        const VERCEL_REFRESH_URL = window.STRAVA_PUBLIC_CONFIG.vercelRefreshAPI;
        const user = AppPrincipal.state.currentUser;
        
        console.log("Tentando renovar token Strava...");
        
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(VERCEL_REFRESH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
            });
            
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Falha na renovação");
            
            // O Backend já atualizou o Firebase, mas atualizamos o state local para garantir
            console.log("Token renovado com sucesso!");
            AppPrincipal.state.stravaTokenData.accessToken = result.accessToken;
            return result.accessToken;

        } catch (error) {
            console.error("Erro ao renovar token:", error);
            throw error; // Propaga erro para parar a sincronização
        }
    },

    // --- STRAVA SYNC (V2 Pura + Refresh Automático + CORREÇÃO MERGE & SPLITS) ---
    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        const btn = document.getElementById('btn-sync-strava');
        const statusEl = document.getElementById('strava-sync-status');
        
        if (!stravaTokenData || !stravaTokenData.accessToken) {
            alert("Erro: Token não encontrado. Tente reconectar.");
            return;
        }

        btn.disabled = true;
        statusEl.textContent = "Verificando conexão...";

        try {
            // 1. VERIFICAÇÃO DE VALIDADE DO TOKEN
            let accessToken = stravaTokenData.accessToken;
            const nowSeconds = Math.floor(Date.now() / 1000);
            const expiresAt = stravaTokenData.expiresAt || 0;

            if (nowSeconds >= (expiresAt - 300)) { 
                statusEl.textContent = "Renovando token de segurança...";
                accessToken = await AppPrincipal.refreshStravaToken();
            }

            // 2. BUSCA ATIVIDADES
            statusEl.textContent = "Buscando atividades no Strava...";
            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error("Erro Strava API (401/403).");

            const activities = await response.json();
            statusEl.textContent = "Processando dados...";
            
            const existingWorkoutsRef = AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`);
            const snapshot = await existingWorkoutsRef.once('value');
            const existingWorkouts = snapshot.val() || {};
            
            const updates = {};
            let count = 0;

            activities.forEach(act => {
                // VERIFICA SE JÁ EXISTE ESTE TREINO PELO ID DO STRAVA
                let alreadyImported = false;
                for (const key in existingWorkouts) {
                    if (String(existingWorkouts[key].stravaActivityId) === String(act.id)) {
                        alreadyImported = true;
                        break;
                    }
                }

                if (!alreadyImported) {
                    // --- PREPARAÇÃO DOS DADOS ---
                    const distKm = (act.distance / 1000).toFixed(2) + " km";
                    let ritmoStr = "0:00 /km";
                    if (act.distance > 0 && act.moving_time > 0) {
                        const paceMin = Math.floor((act.moving_time / 60) / (act.distance / 1000));
                        const paceSec = Math.floor(((act.moving_time / 60) / (act.distance / 1000) - paceMin) * 60);
                        ritmoStr = `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
                    }

                    // CORREÇÃO: Extração de Splits (Parciais) para exibir na tabela
                    let formattedSplits = [];
                    if (act.splits_metric && act.splits_metric.length > 0) {
                        formattedSplits = act.splits_metric.map((split, index) => {
                            // Cálculo do pace da volta (min/km)
                            // split.moving_time está em segundos
                            const splitPaceMin = Math.floor(split.moving_time / 60);
                            const splitPaceSec = (split.moving_time % 60).toString().padStart(2, '0');
                            
                            return {
                                km: (index + 1) + ' km',
                                pace: `${splitPaceMin}:${splitPaceSec}`,
                                ele: (split.elevation_difference || 0).toFixed(0) + 'm'
                            };
                        });
                    }

                    const stravaDataPayload = {
                        distancia: distKm,
                        tempo: new Date(act.moving_time * 1000).toISOString().substr(11, 8),
                        ritmo: ritmoStr,
                        mapLink: act.map && act.map.summary_polyline 
                            ? `https://www.strava.com/activities/${act.id}` 
                            : null,
                        splits: formattedSplits // SALVANDO OS SPLITS
                    };

                    const actDate = act.start_date.split('T')[0];
                    
                    // --- LÓGICA DE MERGE (VINCULAR COM PLANEJADO) ---
                    // Procura se existe um treino PLANEJADO na mesma data
                    let plannedKey = null;
                    for (const key in existingWorkouts) {
                        const workout = existingWorkouts[key];
                        if (workout.date === actDate && workout.status === 'planejado') {
                            plannedKey = key;
                            break; // Encontrou, vincula com o primeiro que achar
                        }
                    }

                    if (plannedKey) {
                        // ATUALIZA TREINO EXISTENTE
                        updates[`/data/${currentUser.uid}/workouts/${plannedKey}/status`] = "realizado";
                        updates[`/data/${currentUser.uid}/workouts/${plannedKey}/realizadoAt`] = new Date().toISOString();
                        updates[`/data/${currentUser.uid}/workouts/${plannedKey}/stravaActivityId`] = String(act.id);
                        updates[`/data/${currentUser.uid}/workouts/${plannedKey}/stravaData`] = stravaDataPayload;
                        updates[`/data/${currentUser.uid}/workouts/${plannedKey}/description`] = 
                            (existingWorkouts[plannedKey].description || "") + `\n\n[Importado do Strava]: ${act.name}`;
                        
                        // Atualiza feed público também
                        const publicData = {
                            ...existingWorkouts[plannedKey],
                            ownerId: currentUser.uid,
                            ownerName: AppPrincipal.state.userData.name,
                            status: "realizado",
                            stravaData: stravaDataPayload
                        };
                        updates[`/publicWorkouts/${plannedKey}`] = publicData;

                    } else {
                        // CRIA NOVO TREINO (Se não houver planejado)
                        const newKey = AppPrincipal.state.db.ref().push().key;
                        const workoutData = {
                            title: act.name,
                            date: actDate,
                            description: `[Importado]: ${act.type}`,
                            status: "realizado",
                            realizadoAt: new Date().toISOString(),
                            createdBy: currentUser.uid,
                            createdAt: new Date().toISOString(),
                            feedback: "Treino importado do Strava.",
                            stravaActivityId: String(act.id),
                            stravaData: stravaDataPayload
                        };

                        updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                        updates[`/publicWorkouts/${newKey}`] = {
                            ownerId: currentUser.uid,
                            ownerName: AppPrincipal.state.userData.name,
                            ...workoutData
                        };
                    }
                    count++;
                }
            });

            if (Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sincronização concluída! ${count} atividades processadas.`);
            } else {
                alert("Nenhuma atividade nova encontrada.");
            }
            AppPrincipal.closeProfileModal();

        } catch (err) {
            console.error(err);
            alert("Erro na sincronização: " + err.message);
        } finally {
            btn.disabled = false;
            statusEl.textContent = "";
        }
    },

    // ===================================================================
    // FUNÇÕES AUXILIARES
    // ===================================================================
    openFeedbackModal: (workoutId, ownerId, workoutTitle) => {
        const { feedbackModal, feedbackModalTitle, workoutStatusSelect, workoutFeedbackText, commentsList, commentInput, photoUploadInput, saveFeedbackBtn, photoUploadFeedback, stravaDataDisplay } = AppPrincipal.elements;
        AppPrincipal.state.modal.isOpen = true;
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        
        feedbackModalTitle.textContent = workoutTitle || "Feedback do Treino";
        workoutStatusSelect.value = 'planejado';
        workoutFeedbackText.value = '';
        photoUploadInput.value = null;
        photoUploadFeedback.textContent = "";
        if(stravaDataDisplay) stravaDataDisplay.classList.add('hidden');
        commentsList.innerHTML = "<p>Carregando...</p>";
        commentInput.value = '';
        saveFeedbackBtn.disabled = false;
        saveFeedbackBtn.textContent = "Salvar Feedback";
        
        const workoutRef = AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`);
        workoutRef.once('value', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                workoutStatusSelect.value = data.status || 'planejado';
                workoutFeedbackText.value = data.feedback || '';
                // Exibe Strava simples se existir
                if (data.stravaData && stravaDataDisplay) {
                    stravaDataDisplay.classList.remove('hidden');
                    stravaDataDisplay.innerHTML = `<legend>Strava</legend><p>${data.stravaData.distancia} | ${data.stravaData.ritmo}</p>`;
                }
            }
        });
        
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['modalComments'] = commentsRef;
        commentsRef.orderByChild('timestamp').on('value', snapshot => {
            commentsList.innerHTML = "";
            if (!snapshot.exists()) { commentsList.innerHTML = "<p>Nenhum comentário.</p>"; return; }
            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'comment-item';
                const commenterName = AppPrincipal.state.userCache[data.uid]?.name || "Usuário";
                item.innerHTML = `<p><strong>${commenterName}:</strong> ${data.text}</p>`;
                commentsList.appendChild(item);
            });
        });
        feedbackModal.classList.remove('hidden');
    },

    closeFeedbackModal: () => {
        AppPrincipal.elements.feedbackModal.classList.add('hidden');
        if (AppPrincipal.state.listeners['modalComments']) {
            AppPrincipal.state.listeners['modalComments'].off();
            delete AppPrincipal.state.listeners['modalComments'];
        }
    },
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { workoutStatusSelect, workoutFeedbackText, photoUploadInput, saveFeedbackBtn } = AppPrincipal.elements;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        
        saveFeedbackBtn.disabled = true;
        saveFeedbackBtn.textContent = "Salvando...";

        try {
            let imageUrl = null;
            const file = photoUploadInput.files[0];
            if (file) imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'workouts');

            const updates = {
                status: workoutStatusSelect.value,
                feedback: workoutFeedbackText.value,
                realizadoAt: new Date().toISOString()
            };
            if (imageUrl) updates.imageUrl = imageUrl;

            const workoutRef = AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`);
            await workoutRef.update(updates);
            
            const snapshot = await workoutRef.once('value');
            const workoutData = snapshot.val();
            const publicData = {
                ownerId: currentOwnerId,
                ownerName: AppPrincipal.state.userData.name,
                ...workoutData
            };
            
            if (updates.status !== 'planejado') {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set(publicData);
            } else {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).remove();
            }

            AppPrincipal.closeFeedbackModal();
        } catch (err) {
            alert("Erro: " + err.message);
        } finally {
            saveFeedbackBtn.disabled = false;
        }
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = AppPrincipal.elements.commentInput.value.trim();
        if (!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        AppPrincipal.elements.commentInput.value = "";
    },

    openLogActivityModal: () => {
        AppPrincipal.elements.logActivityForm.reset();
        AppPrincipal.elements.logActivityModal.classList.remove('hidden');
        document.getElementById('log-activity-date').value = new Date().toISOString().split('T')[0];
    },
    closeLogActivityModal: () => AppPrincipal.elements.logActivityModal.classList.add('hidden'),
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const btn = AppPrincipal.elements.logActivityForm.querySelector('button');
        btn.disabled = true;
        try {
            const workoutData = {
                date: document.getElementById('log-activity-date').value,
                title: document.getElementById('log-activity-title').value,
                description: `(${document.getElementById('log-activity-type').value})`,
                feedback: document.getElementById('log-activity-feedback').value,
                createdBy: AppPrincipal.state.currentUser.uid,
                createdAt: new Date().toISOString(),
                status: "realizado",
                realizadoAt: new Date().toISOString()
            };
            const ref = await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.currentUser.uid}/workouts`).push(workoutData);
            await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({
                ownerId: AppPrincipal.state.currentUser.uid,
                ownerName: AppPrincipal.state.userData.name,
                ...workoutData
            });
            AppPrincipal.closeLogActivityModal();
        } catch(err) { alert(err.message); } finally { btn.disabled = false; }
    },

    openWhoLikedModal: (workoutId) => {
        const { whoLikedModal, whoLikedList } = AppPrincipal.elements;
        whoLikedList.innerHTML = "<li>Carregando...</li>";
        whoLikedModal.classList.remove('hidden');
        AppPrincipal.state.db.ref(`workoutLikes/${workoutId}`).once('value', async (snapshot) => {
            whoLikedList.innerHTML = "";
            if (!snapshot.exists()) return whoLikedList.innerHTML = "<li>Ninguém curtiu ainda.</li>";
            const uids = Object.keys(snapshot.val());
            for (const uid of uids) {
                const name = AppPrincipal.state.userCache[uid]?.name || "Usuário";
                const li = document.createElement('li'); li.textContent = name; whoLikedList.appendChild(li);
            }
        });
    },
    closeWhoLikedModal: () => AppPrincipal.elements.whoLikedModal.classList.add('hidden'),

    openIaAnalysisModal: (data) => {
        const { iaAnalysisModal, iaAnalysisOutput, saveIaAnalysisBtn } = AppPrincipal.elements;
        iaAnalysisModal.classList.remove('hidden');
        if (data) {
            iaAnalysisOutput.textContent = data.analysisResult;
            saveIaAnalysisBtn.classList.add('hidden');
        } else {
            iaAnalysisOutput.textContent = "Coletando dados...";
            saveIaAnalysisBtn.classList.add('hidden');
            AppPrincipal.state.currentAnalysisData = null;
        }
    },
    closeIaAnalysisModal: () => AppPrincipal.elements.iaAnalysisModal.classList.add('hidden'),
    handleSaveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        const athleteId = AdminPanel.state.selectedAthleteId;
        await AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`).push(AppPrincipal.state.currentAnalysisData);
        alert("Salvo!");
        AppPrincipal.closeIaAnalysisModal();
    },

    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        AppPrincipal.elements.photoUploadFeedback.textContent = "Analisando...";
        try {
            const base64 = await AppPrincipal.fileToBase64(file);
            const prompt = `Analise a imagem. Retorne JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
            const json = await AppPrincipal.callGeminiVisionAPI(prompt, base64, file.type);
            const data = JSON.parse(json);
            AppPrincipal.state.stravaData = data; 
            
            const display = document.getElementById('strava-data-display');
            if(display) {
                display.classList.remove('hidden');
                display.innerHTML = `<legend>IA Vision</legend><p>${data.distancia} | ${data.ritmo}</p>`;
            }
            AppPrincipal.elements.photoUploadFeedback.textContent = "Dados extraídos!";
        } catch (err) {
            console.error(err);
            AppPrincipal.elements.photoUploadFeedback.textContent = "Falha na leitura IA.";
        }
    },
    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),
    
    callGeminiTextAPI: async (prompt) => {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    },
    callGeminiVisionAPI: async (prompt, base64, mime) => {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: base64 } }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    },
    uploadFileToCloudinary: async (file, folder) => {
        const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); f.append('folder', `lerunners/${AppPrincipal.state.currentUser.uid}/${folder}`);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        const d = await r.json(); return d.secure_url;
    },
    openViewProfileModal: (uid) => {
        const u = AppPrincipal.state.userCache[uid];
        if(!u) return;
        AppPrincipal.elements.viewProfilePic.src = u.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';
        AppPrincipal.elements.viewProfileName.textContent = u.name;
        AppPrincipal.elements.viewProfileBio.textContent = u.bio || "Sem bio.";
        AppPrincipal.elements.viewProfileModal.classList.remove('hidden');
    },
    closeViewProfileModal: () => AppPrincipal.elements.viewProfileModal.classList.add('hidden')
};

// ===================================================================
// 2. AuthLogic (Lógica da index.html)
// ===================================================================
const AuthLogic = {
    auth: null, db: null, elements: {},
    init: (auth, db) => {
        AuthLogic.auth = auth; AuthLogic.db = db;
        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'), registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'), btnLogoutPending: document.getElementById('btn-logout-pending'),
            loginErrorMsg: document.getElementById('login-error'), registerErrorMsg: document.getElementById('register-error'),
            toggleToRegister: document.getElementById('toggleToRegister'), toggleToLogin: document.getElementById('toggleToLogin'),
            pendingEmailDisplay: document.getElementById('pending-email-display')
        };
        AuthLogic.elements.toggleToRegister.addEventListener('click', e => { e.preventDefault(); AuthLogic.showView('register'); });
        AuthLogic.elements.toggleToLogin.addEventListener('click', e => { e.preventDefault(); AuthLogic.showView('login'); });
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        if(AuthLogic.elements.loginForm) AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        if(AuthLogic.elements.registerForm) AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    showView: (view) => {
        const { loginForm, registerForm, pendingView, toggleToRegister, toggleToLogin, loginErrorMsg, registerErrorMsg } = AuthLogic.elements;
        loginForm.classList.add('hidden'); registerForm.classList.add('hidden'); pendingView.classList.add('hidden');
        toggleToRegister.parentElement.classList.add('hidden'); toggleToLogin.parentElement.classList.add('hidden');
        loginErrorMsg.textContent = ""; registerErrorMsg.textContent = "";
        if (view === 'login') { loginForm.classList.remove('hidden'); toggleToRegister.parentElement.classList.remove('hidden'); }
        else if (view === 'register') { registerForm.classList.remove('hidden'); toggleToLogin.parentElement.classList.remove('hidden'); }
        else if (view === 'pending') { pendingView.classList.remove('hidden'); }
    },
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value; const password = document.getElementById('loginPassword').value;
        AuthLogic.auth.signInWithEmailAndPassword(email, password).catch(() => AuthLogic.elements.loginErrorMsg.textContent = "Email ou senha incorretos.");
    },
    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value; const email = document.getElementById('registerEmail').value; const password = document.getElementById('registerPassword').value;
        if(password.length<6) return AuthLogic.elements.registerErrorMsg.textContent = "Senha mínima 6 caracteres.";
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((c) => AuthLogic.db.ref('pendingApprovals/'+c.user.uid).set({ name, email, requestDate: new Date().toISOString() }))
            .catch(e => AuthLogic.elements.registerErrorMsg.textContent = e.code === 'auth/email-already-in-use' ? "Email já existe." : "Erro ao criar conta.");
    },
    handleLoginGuard: (user) => {
        if (!user) return AuthLogic.showView('login');
        AuthLogic.db.ref('admins/' + user.uid).once('value', s => {
            if (s.exists() && s.val()) return window.location.href = 'app.html';
            AuthLogic.db.ref('users/' + user.uid).once('value', s2 => {
                if (s2.exists()) return window.location.href = 'app.html';
                AuthLogic.db.ref('pendingApprovals/' + user.uid).once('value', s3 => {
                    if (s3.exists()) { if(AuthLogic.elements.pendingEmailDisplay) AuthLogic.elements.pendingEmailDisplay.textContent = user.email; AuthLogic.showView('pending'); }
                    else { AuthLogic.auth.signOut(); AuthLogic.showView('login'); }
                });
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
