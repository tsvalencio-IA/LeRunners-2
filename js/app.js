/* =================================================================== */
/* ARQUIVO DE LÓGICA UNIFICADO (V3.3.3 - FIX FINAL DO REFERENCE ERROR)
/* CÓDIGO COMPLETO 100% NA ÍNTEGRA.
/* =================================================================== */

// ===================================================================
// 1. AppPrincipal (O Cérebro) - Lógica de app.html
// ===================================================================
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
        currentAnalysisData: null
    },

    elements: {},

    // Inicialização principal: Decisão se está em app.html ou index.html (V2.2 Roteamento)
    init: () => {
        console.log("Iniciando AppPrincipal V3.3.3...");
        
        if (typeof window.firebaseConfig === 'undefined') {
            document.body.innerHTML = "<h1>Erro Crítico: O arquivo js/config.js não foi configurado.</h1>";
            return;
        }

        try {
            if (firebase.apps.length === 0) {
                firebase.initializeApp(window.firebaseConfig);
            }
        } catch (e) {
            document.body.innerHTML = "<h1>Erro Crítico: Falha ao conectar com o Firebase.</h1>";
            return;
        }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento: O script está na index.html ou app.html?
        if (document.getElementById('login-form')) { // index.html
            console.log("Modo: Autenticação (index.html)");
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); // Chama o AuthLogic com os objetos
        } else if (document.getElementById('app-container')) { // app.html
            console.log("Modo: Plataforma (app.html)");
            
            // CORREÇÃO CRÍTICA V3.3.3: Injeta a lógica do Strava APÓS a definição do AppPrincipal
            AppPrincipal.injectStravaLogic();
            
            AppPrincipal.initPlatform();
        }
    },
    
    // NOVO MÉTODO (V3.3.3): Contém a lógica de injeção do Strava que causava o erro TDZ
    injectStravaLogic: () => {
        // Injeta a correção do Guardião de Strava no initPlatform
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
                window.location.href = 'app.html';
            }
        };
        
        // Adiciona o botão de conexão Strava no Modal de Perfil
        AppPrincipal.openProfileModalOriginal = AppPrincipal.openProfileModal;
        AppPrincipal.openProfileModal = () => {
            AppPrincipal.openProfileModalOriginal();
            
            const modalBody = AppPrincipal.elements.profileModal.querySelector('.modal-body');
            
            if (!modalBody.querySelector('#strava-connect-section')) {
                const stravaSection = document.createElement('div');
                stravaSection.id = 'strava-connect-section';
                
                const editButton = `
                     <button id="btn-edit-profile" class="btn btn-secondary" style="margin-top: 1rem; margin-bottom: 1rem; width: 100%;">
                        <i class='bx bx-edit-alt'></i> Editar Perfil
                    </button>
                `;
                
                stravaSection.innerHTML = `
                    ${editButton}
                    <fieldset style="margin-top: 1rem;">
                        <legend><i class='bx bxl-strava'></i> Integração Strava</legend>
                        <p style="margin-bottom: 1rem; font-size: 0.9rem;">Conecte sua conta para permitir a leitura de dados pela IA.</p>
                        <button id="btn-connect-strava" class="btn btn-secondary" style="background-color: var(--strava-orange); color: white;">
                            <i class='bx bxl-strava'></i> Conectar Strava
                        </button>
                    </fieldset>
                `;
                
                const logoutButton = modalBody.querySelector('#logout-btn');
                if (logoutButton) {
                    modalBody.insertBefore(stravaSection, logoutButton);
                } else {
                    modalBody.appendChild(stravaSection);
                }

                modalBody.querySelector('#btn-edit-profile').addEventListener('click', AppPrincipal.openEditProfileModal);
                modalBody.querySelector('#btn-connect-strava').addEventListener('click', AppPrincipal.handleStravaConnect);
            }
        };
    },
    
    // Inicia a lógica da plataforma (app.html)
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
        
        // Listeners de Navegação
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        
        // Listeners do Modal Feedback
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.feedbackModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.feedbackModal) AppPrincipal.closeFeedbackModal();
        });
        AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);

        // Listeners Modal Log Atividade (V2.3)
        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', AppPrincipal.closeLogActivityModal);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        AppPrincipal.elements.logActivityModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.logActivityModal) AppPrincipal.closeLogActivityModal();
        });

        // Listeners Modal Quem Curtiu (V2.3)
        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        AppPrincipal.elements.whoLikedModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.whoLikedModal) AppPrincipal.closeWhoLikedModal();
        });

        // Listeners Modal Análise IA (V2.6)
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.iaAnalysisModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.iaAnalysisModal) AppPrincipal.closeIaAnalysisModal();
        });
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);

        // Listeners Modal Perfil (V3.0)
        AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModal.addEventListener('click', AppPrincipal.closeProfileModal);
        AppPrincipal.elements.profileModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.profileModal) AppPrincipal.closeProfileModal();
        });
        AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        AppPrincipal.elements.profilePicUpload.addEventListener('change', AppPrincipal.handleProfilePhotoUpload);

        // NOVO (V3.2): Listeners Modal Visualização de Perfil
        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', AppPrincipal.closeViewProfileModal);
        AppPrincipal.elements.viewProfileModal.addEventListener('click', (e) => {
            if (e.target === AppPrincipal.elements.viewProfileModal) AppPrincipal.closeViewProfileModal();
        });


        // O Guardião do app.html
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    // Carrega cache de /users (V2.9)
    loadCaches: () => {
        const adminsRef = AppPrincipal.state.db.ref('admins');
        AppPrincipal.state.listeners['cacheAdmins'] = adminsRef;
        adminsRef.on('value', snapshot => {
            AppPrincipal.state.adminUIDs = snapshot.val() || {};
            console.log("Cache de Admins carregado:", Object.keys(AppPrincipal.state.adminUIDs));
        });

        const usersRef = AppPrincipal.state.db.ref('users');
        AppPrincipal.state.listeners['cacheUsers'] = usersRef;
        usersRef.on('value', snapshot => {
            AppPrincipal.state.userCache = snapshot.val() || {};
            console.log("Cache de *Usuários* (V2.9) carregado.");
        });
    },

    // O Guardião (só roda no app.html)
    handlePlatformAuthStateChange: (user) => {
        if (!user) {
            console.log("Guardião (Plataforma): Acesso negado. Redirecionando para login.");
            AppPrincipal.cleanupListeners(false);
            window.location.href = 'index.html';
            return;
        }

        const { appContainer } = AppPrincipal.elements;
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        
        AppPrincipal.loadCaches();

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnapshot => {
            if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                
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
                    
                    AppPrincipal.elements.userDisplay.textContent = `${adminName} (Coach)`;
                    appContainer.classList.add('admin-view');
                    appContainer.classList.remove('atleta-view');
                    AppPrincipal.navigateTo('planilha');
                });
                return;
            }

            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnapshot => {
                if (userSnapshot.exists()) {
                    AppPrincipal.state.userData = { ...userSnapshot.val(), uid: uid };
                    AppPrincipal.elements.userDisplay.textContent = `${AppPrincipal.state.userData.name}`;
                    appContainer.classList.add('atleta-view');
                    appContainer.classList.remove('admin-view');
                    AppPrincipal.navigateTo('planilha');
                } else {
                    console.warn("Status: PENDENTE/REJEITADO. Voltando ao login.");
                    AppPrincipal.handleLogout(); 
                }
            });
        });
    },

    // O Roteador (V2)
    navigateTo: (page) => {
        const { mainContent, loader, appContainer, navPlanilhaBtn, navFeedBtn } = AppPrincipal.elements;
        mainContent.innerHTML = ""; 
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;

        navPlanilhaBtn.classList.toggle('active', page === 'planilha');
        navFeedBtn.classList.toggle('active', page === 'feed');

        if (typeof AdminPanel === 'undefined' || typeof AtletaPanel === 'undefined' || typeof FeedPanel === 'undefined') {
            console.error("ERRO CRÍTICO: js/panels.js não foi carregado a tempo.");
            mainContent.innerHTML = "<h1>Erro ao carregar módulos. Recarregue a página.</h1>";
            return;
        }

        if (page === 'planilha') {
            const role = AppPrincipal.state.userData.role;
            if (role === 'admin') {
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

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => {
        console.log("Saindo...");
        AppPrincipal.cleanupListeners(false);
        AppPrincipal.state.auth.signOut().catch(err => console.error("Erro ao sair:", err));
    },

    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(key => {
            const listenerRef = AppPrincipal.state.listeners[key];
            
            if (panelOnly && (key === 'cacheAdmins' || key === 'cacheUsers')) {
                return; 
            }
            
            if (listenerRef && typeof listenerRef.off === 'function') {
                listenerRef.off();
            }
            delete AppPrincipal.state.listeners[key];
        });
        console.log(panelOnly ? "Listeners de painel limpos." : "TODOS os listeners limpos.");
    },
    
    // MÓDULO 3/4: Lógica dos Modais (V3.2)
    openFeedbackModal: (workoutId, ownerId, workoutTitle) => {
        const { feedbackModal, feedbackModalTitle, workoutStatusSelect, workoutFeedbackText, commentsList, commentInput, photoUploadInput, saveFeedbackBtn, photoUploadFeedback, stravaDataDisplay } = AppPrincipal.elements;
        
        console.log(`Abrindo modal para treino: ${workoutId} (Dono: ${ownerId})`);
        
        AppPrincipal.state.modal.isOpen = true;
        AppPrincipal.state.modal.currentWorkoutId = workoutId;
        AppPrincipal.state.modal.currentOwnerId = ownerId;
        AppPrincipal.state.stravaData = null;
        
        feedbackModalTitle.textContent = workoutTitle || "Feedback do Treino";
        
        workoutStatusSelect.value = 'planejado';
        workoutFeedbackText.value = '';
        photoUploadInput.value = null;
        photoUploadFeedback.textContent = "";
        stravaDataDisplay.classList.add('hidden');
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
                if (data.stravaData) {
                    AppPrincipal.displayStravaData(data.stravaData);
                }
            } else {
                AppPrincipal.state.db.ref(`publicWorkouts/${workoutId}`).once('value', publicSnapshot => {
                     if (publicSnapshot.exists()) {
                        const data = publicSnapshot.val();
                        workoutStatusSelect.value = data.status || 'planejado';
                        workoutFeedbackText.value = data.feedback || '';
                        if (data.stravaData) {
                            AppPrincipal.displayStravaData(data.stravaData);
                        }
                     }
                });
            }
        });
        
        const commentsRef = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['modalComments'] = commentsRef;
        
        commentsRef.orderByChild('timestamp').on('value', snapshot => {
            commentsList.innerHTML = "";
            if (!snapshot.exists()) {
                commentsList.innerHTML = "<p>Nenhum comentário ainda.</p>";
                return;
            }
            
            const isCurrentUserAdmin = AppPrincipal.state.userData.role === 'admin';
            const isCurrentUserOwner = AppPrincipal.state.currentUser.uid === AppPrincipal.state.modal.currentOwnerId;

            snapshot.forEach(childSnapshot => {
                const data = childSnapshot.val();
                
                const isCommentFromAdmin = AppPrincipal.state.adminUIDs.hasOwnProperty(data.uid);

                if (!isCurrentUserOwner && !isCurrentUserAdmin && isCommentFromAdmin) {
                    return;
                }

                const item = document.createElement('div');
                item.className = 'comment-item';
                const date = new Date(data.timestamp).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' });
                
                const commenterName = AppPrincipal.state.userCache[data.uid]?.name || "Usuário";
                
                item.innerHTML = `
                    <p><strong>${commenterName}:</strong> ${data.text}</p>
                    <span>${date}</span>
                `;
                commentsList.appendChild(item);
            });
            commentsList.scrollTop = commentsList.scrollHeight;
        });
        
        feedbackModal.classList.remove('hidden');
    },
    
    closeFeedbackModal: () => {
        AppPrincipal.elements.feedbackModal.classList.add('hidden');
        
        const listenerRef = AppPrincipal.state.listeners['modalComments'];
        if (listenerRef && typeof listenerRef.off === 'function') {
            listenerRef.off();
            delete AppPrincipal.state.listeners['modalComments'];
            console.log("Listener do modal de comentários limpo.");
        }
    },
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { workoutStatusSelect, workoutFeedbackText, photoUploadInput, saveFeedbackBtn } = AppPrincipal.elements;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        
        if (currentOwnerId !== AppPrincipal.state.currentUser.uid) {
            alert("Você só pode salvar o feedback dos seus próprios treinos.");
            return;
        }

        saveFeedbackBtn.disabled = true;
        saveFeedbackBtn.textContent = "Salvando...";

        try {
            let imageUrl = null;
            const file = photoUploadInput.files[0];
            
            if (file) {
                saveFeedbackBtn.textContent = "Enviando foto...";
                imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'workouts');
            }

            const feedbackData = {
                status: workoutStatusSelect.value,
                feedback: workoutFeedbackText.value,
                realizadoAt: new Date().toISOString()
            };
            if (imageUrl) {
                feedbackData.imageUrl = imageUrl;
            }
            if (AppPrincipal.state.stravaData) {
                feedbackData.stravaData = AppPrincipal.state.stravaData;
            }

            const workoutRef = AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`);
            
            saveFeedbackBtn.textContent = "Atualizando treino...";
            await workoutRef.update(feedbackData);
            
            if (feedbackData.status !== 'planejado') {
                const snapshot = await workoutRef.once('value');
                const workoutData = snapshot.val();
                
                const publicData = {
                    ownerId: currentOwnerId,
                    ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || AppPrincipal.state.userData.name,
                    date: workoutData.date,
                    title: workoutData.title,
                    description: workoutData.description,
                    status: workoutData.status,
                    feedback: workoutData.feedback,
                    realizadoAt: workoutData.realizadoAt,
                    imageUrl: workoutData.imageUrl || null,
                    stravaData: workoutData.stravaData || null
                };
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set(publicData);
            } else {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).remove();
            }

            console.log("Feedback salvo e feed atualizado!");
            AppPrincipal.closeFeedbackModal();

        } catch (err) {
            console.error("Erro ao salvar feedback:", err);
            alert("Erro ao salvar: " + err.message);
            saveFeedbackBtn.disabled = false;
            saveFeedbackBtn.textContent = "Salvar Feedback";
        }
    },
    
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const { commentInput } = AppPrincipal.elements;
        const { currentWorkoutId } = AppPrincipal.state.modal;
        const text = commentInput.value.trim();
        
        if (!text) return;

        const commentData = {
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userCache[AppPrincipal.state.currentUser.uid]?.name || AppPrincipal.state.userData.name,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        AppPrincipal.state.db.ref(`workoutComments/${currentWorkoutId}`).push(commentData)
            .then(() => {
                commentInput.value = "";
            })
            .catch(err => alert("Erro ao enviar comentário: " + err.message));
    },

    // ----- Modal Log Atividade (V2.9) -----
    openLogActivityModal: () => {
        AppPrincipal.elements.logActivityForm.reset();
        AppPrincipal.elements.logActivityModal.classList.remove('hidden');
        document.getElementById('log-activity-date').value = new Date().toISOString().split('T')[0];
    },

    closeLogActivityModal: () => {
        AppPrincipal.elements.logActivityModal.classList.add('hidden');
    },

    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const btn = AppPrincipal.elements.logActivityForm.querySelector('button');
        btn.disabled = true;

        const athleteId = AppPrincipal.state.currentUser.uid;
        
        try {
            const workoutData = {
                date: document.getElementById('log-activity-date').value,
                title: document.getElementById('log-activity-title').value,
                description: `(${document.getElementById('log-activity-type').value})`,
                feedback: document.getElementById('log-activity-feedback').value,
                createdBy: athleteId,
                createdAt: new Date().toISOString(),
                status: "realizado",
                realizadoAt: new Date().toISOString(),
                imageUrl: null,
                stravaData: null
            };
            
            if (!workoutData.date || !workoutData.title || !workoutData.feedback) {
                 throw new Error("Data, Título e Feedback são obrigatórios.");
            }

            const newWorkoutRef = await AppPrincipal.state.db.ref(`data/${athleteId}/workouts`).push(workoutData);
            const newWorkoutId = newWorkoutRef.key;

            const publicData = {
                ownerId: athleteId,
                ownerName: AppPrincipal.state.userCache[athleteId]?.name || AppPrincipal.state.userData.name,
                date: workoutData.date,
                title: workoutData.title,
                description: workoutData.description,
                status: workoutData.status,
                feedback: workoutData.feedback,
                realizadoAt: workoutData.realizadoAt,
                imageUrl: null,
                stravaData: null
            };
            await AppPrincipal.state.db.ref(`publicWorkouts/${newWorkoutId}`).set(publicData);

            console.log("Atividade manual registrada e publicada no feed.");
            AppPrincipal.closeLogActivityModal();

        } catch (err) {
            alert("Erro ao salvar atividade: " + err.message);
        } finally {
            btn.disabled = false;
        }
    },

    // ----- Modal Quem Curtiu (V2.9) -----
    openWhoLikedModal: (workoutId) => {
        const { whoLikedModal, whoLikedList } = AppPrincipal.elements;
        whoLikedList.innerHTML = "<li>Carregando...</li>";
        whoLikedModal.classList.remove('hidden');

        const likesRef = AppPrincipal.state.db.ref(`workoutLikes/${workoutId}`);
        likesRef.once('value', async (snapshot) => {
            if (!snapshot.exists()) {
                whoLikedList.innerHTML = "<li>Ninguém curtiu ainda.</li>";
                return;
            }

            whoLikedList.innerHTML = "";
            const userCache = AppPrincipal.state.userCache;
            
            const promises = [];
            snapshot.forEach(childSnapshot => {
                const uid = childSnapshot.key;
                
                if (userCache[uid] && userCache[uid].name) {
                    promises.push(Promise.resolve(userCache[uid].name));
                } else {
                    const userRef = AppPrincipal.state.db.ref(`users/${uid}/name`);
                    promises.push(userRef.once('value').then(snap => snap.val() || "Usuário (ID: ..."+uid.slice(-4)+")"));
                }
            });

            const names = await Promise.all(promises);
            names.forEach(userName => {
                const li = document.createElement('li');
                li.textContent = userName;
                whoLikedList.appendChild(li);
            });
        });
    },

    closeWhoLikedModal: () => {
        AppPrincipal.elements.whoLikedModal.classList.add('hidden');
    },

    // ----- Modal Análise IA (V2.7) -----
    openIaAnalysisModal: (analysisData = null) => {
        const { iaAnalysisModal, iaAnalysisOutput, saveIaAnalysisBtn } = AppPrincipal.elements;
        
        if (analysisData) {
            // Modo "Visualização"
            iaAnalysisOutput.textContent = analysisData.analysisResult;
            AppPrincipal.state.currentAnalysisData = analysisData;
            saveIaAnalysisBtn.classList.add('hidden');
        } else {
            // Modo "Nova Análise"
            iaAnalysisOutput.textContent = "Coletando dados do atleta...";
            saveIaAnalysisBtn.classList.add('hidden');
            AppPrincipal.state.currentAnalysisData = null;
        }
        
        iaAnalysisModal.classList.remove('hidden');
    },

    closeIaAnalysisModal: () => {
        AppPrincipal.elements.iaAnalysisModal.classList.add('hidden');
        AppPrincipal.state.currentAnalysisData = null;
    },
    
    // Salva Análise IA (V3.0 - Correção Bug 4)
    handleSaveIaAnalysis: async () => {
        const { saveIaAnalysisBtn } = AppPrincipal.elements;
        const analysisData = AppPrincipal.state.currentAnalysisData;
        
        const athleteId = AdminPanel.state.selectedAthleteId; 

        if (!analysisData || !athleteId) {
            alert("ERRO: Dados da análise ou ID do atleta não encontrados.");
            return;
        }

        saveIaAnalysisBtn.disabled = true;
        saveIaAnalysisBtn.textContent = "Salvando...";

        try {
            const historyRef = AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`);
            await historyRef.push(analysisData);
            
            alert("Análise salva com sucesso!");
            AppPrincipal.closeIaAnalysisModal();
            
            // (V3.0 - Bug 4): Limpa o listener antigo ANTES de recarregar
            if (AppPrincipal.state.listeners['adminIaHistory']) {
                AppPrincipal.state.listeners['adminIaHistory'].off();
                delete AppPrincipal.state.listeners['adminIaHistory'];
                console.log("Listener de Histórico de IA limpo para recarga.");
            }
            
            // Recarrega o histórico de IA (se a aba estiver visível)
            if (AdminPanel.elements.iaHistoryList) {
                AdminPanel.loadIaHistory(athleteId); // Agora é seguro chamar
            }

        } catch (err) {
            console.error("Erro ao salvar análise:", err);
            alert("Erro ao salvar: " + err.message);
        } finally {
            saveIaAnalysisBtn.disabled = false;
            saveIaAnalysisBtn.textContent = "Salvar Análise";
        }
    },

    // ----- Funções do Modal de Perfil (V3.0) -----
    openProfileModal: () => {
        const { profileModal, profileName, profileBio, profilePicPreview, profileUploadFeedback, saveProfileBtn } = AppPrincipal.elements;
        const { userData } = AppPrincipal.state;
        
        if (!userData) return;

        // Reseta o estado
        AppPrincipal.state.modal.newPhotoUrl = null;
        profileUploadFeedback.textContent = "";
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Salvar Perfil";

        // Preenche com dados atuais
        profileName.value = userData.name || '';
        profileBio.value = userData.bio || '';
        profilePicPreview.src = userData.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';

        profileModal.classList.remove('hidden');
    },

    closeProfileModal: () => {
        AppPrincipal.elements.profileModal.classList.add('hidden');
        AppPrincipal.state.modal.newPhotoUrl = null; // Limpa URL pendente
    },
    
    handleProfilePhotoUpload: async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const { profileUploadFeedback, saveProfileBtn, profilePicPreview } = AppPrincipal.elements;

        profileUploadFeedback.textContent = "Enviando foto...";
        profileUploadFeedback.style.color = "var(--strava-orange)";
        saveProfileBtn.disabled = true;

        try {
            // Usa a pasta 'profile'
            const imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'profile');
            
            AppPrincipal.state.modal.newPhotoUrl = imageUrl; // Salva URL para o submit
            profilePicPreview.src = imageUrl; // Atualiza preview
            profileUploadFeedback.textContent = "Foto alterada. Clique em 'Salvar Perfil' para confirmar.";
            profileUploadFeedback.style.color = "var(--success-color)";

        } catch (err) {
            console.error("Erro no upload da foto de perfil:", err);
            profileUploadFeedback.textContent = "Falha no upload da foto.";
            profileUploadFeedback.style.color = "var(--danger-color)";
        } finally {
            saveProfileBtn.disabled = false;
            event.target.value = null; // Limpa o input
        }
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

            if (!newName) {
                throw new Error("O nome não pode ficar em branco.");
            }

            const updates = {};
            updates[`/users/${currentUser.uid}/name`] = newName;
            updates[`/users/${currentUser.uid}/bio`] = newBio;
            
            if (newPhotoUrl) {
                updates[`/users/${currentUser.uid}/photoUrl`] = newPhotoUrl;
            }
            
            // Salva no Firebase
            await AppPrincipal.state.db.ref().update(updates);

            // Atualiza o estado local
            AppPrincipal.state.userData.name = newName;
            AppPrincipal.state.userData.bio = newBio;
            if (newPhotoUrl) {
                AppPrincipal.state.userData.photoUrl = newPhotoUrl;
            }
            
            // Atualiza o header
            AppPrincipal.elements.userDisplay.textContent = newName;

            console.log("Perfil salvo com sucesso.");
            AppPrincipal.closeProfileModal();

        } catch (err) {
            console.error("Erro ao salvar perfil:", err);
            alert("Erro ao salvar perfil: " + err.message);
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = "Salvar Perfil";
        }
    },

    // ===================================================================
    // NOVO (V3.2): Funções do Modal de Visualização de Perfil
    // ===================================================================
    openViewProfileModal: (userId) => {
        const { viewProfileModal, viewProfilePic, viewProfileName, viewProfileBio } = AppPrincipal.elements;
        const userCache = AppPrincipal.state.userCache;

        if (!userCache || !userCache[userId]) {
            console.error("Dados do usuário não encontrados no cache:", userId);
            return;
        }

        const userData = userCache[userId];
        
        // Preenche o modal
        viewProfilePic.src = userData.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';
        viewProfileName.textContent = userData.name || "Atleta";
        viewProfileBio.textContent = userData.bio || "Este atleta ainda não escreveu uma biografia.";

        viewProfileModal.classList.remove('hidden');
    },

    closeViewProfileModal: () => {
        AppPrincipal.elements.viewProfileModal.classList.add('hidden');
    },


    // ===================================================================
    // MÓDULO 4: Funções de IA (V3.0 - Cloudinary atualizado)
    // ===================================================================

    // Lida com upload de foto do treino (V2.6)
    handlePhotoUpload: async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const { photoUploadFeedback, stravaDataDisplay, saveFeedbackBtn } = AppPrincipal.elements;
        
        // Limpa o estado anterior
        AppPrincipal.state.stravaData = null;
        stravaDataDisplay.classList.add('hidden');
        photoUploadFeedback.textContent = "Analisando imagem com Gemini Vision...";
        saveFeedbackBtn.disabled = true; // Desabilita salvar ENQUANTO analisa

        try {
            const base64Data = await AppPrincipal.fileToBase64(file);
            const mimeType = file.type;

            const prompt = `
                Analise esta imagem de um app de corrida (como Strava, Nike, etc.).
                Extraia SOMENTE os seguintes dados: Distância (km), Tempo (hh:mm:ss ou mm:ss) e Ritmo/Pace (mm:ss /km).
                
                Responda APENAS com um objeto JSON. Se um dado não for encontrado, retorne 'null'.
                
                Formato de Resposta (JSON):
                {
                  "distancia": "X.XX km",
                  "tempo": "XX:XX:XX",
                  "ritmo": "X:XX /km"
                }
            `;
            
            const jsonResult = await AppPrincipal.callGeminiVisionAPI(prompt, base64Data, mimeType);
            
            // Tenta parsear a resposta
            const data = JSON.parse(jsonResult);
            AppPrincipal.state.stravaData = data; // Salva os dados extraídos no state
            AppPrincipal.displayStravaData(data); // Mostra no modal
            photoUploadFeedback.textContent = "Foto analisada com sucesso!";

        } catch (err) {
            console.error("Erro na IA Vision:", err);
            photoUploadFeedback.textContent = "IA não conseguiu ler dados desta imagem.";
            AppPrincipal.state.stravaData = null; // Garante que esteja nulo se falhar
            stravaDataDisplay.classList.add('hidden');
        } finally {
            saveFeedbackBtn.disabled = false; // Reabilita o botão "Salvar"
        }
    },

    // Converte arquivo para Base64 (V2.6)
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // Pega só o data
            reader.onerror = error => reject(error);
        });
    },

    // Exibe os dados extraídos no modal (V2.6)
    displayStravaData: (data) => {
        const { stravaDataDisplay } = AppPrincipal.elements;
        document.getElementById('strava-data-distancia').textContent = `Distância: ${data.distancia || "N/A"}`;
        document.getElementById('strava-data-tempo').textContent = `Tempo:     ${data.tempo || "N/A"}`;
        document.getElementById('strava-data-ritmo').textContent = `Ritmo:     ${data.ritmo || "N/A"}`;
        stravaDataDisplay.classList.remove('hidden');
    },

    // API Gemini Texto (V2.6)
    callGeminiTextAPI: async (prompt) => {
        // V2.5: Lê a chave do 'window'
        if (!window.GEMINI_API_KEY || window.GEMINI_API_KEY.includes("COLE_SUA_CHAVE_GEMINI_AQUI")) {
            throw new Error("API Key do Gemini não configurada em js/config.js");
        }
        
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${window.GEMINI_API_KEY}`;
        
        const requestBody = {
            "contents": [{ "parts": [{ "text": prompt }] }]
        };

        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro API Gemini (Texto): ${err.error.message}`);
        }
        
        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("A IA (Texto) não retornou uma resposta.");
        }
        
        return data.candidates[0].content.parts[0].text;
    },

    // API Gemini Vision (V2.6)
    callGeminiVisionAPI: async (prompt, base64Data, mimeType) => {
        if (!window.GEMINI_API_KEY || window.GEMINI_API_KEY.includes("COLE_SUA_CHAVE_GEMINI_AQUI")) {
            throw new Error("API Key do Gemini não configurada em js/config.js");
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${window.GEMINI_API_KEY}`;
        
        const requestBody = {
            "contents": [
                {
                    "parts": [
                        { "text": prompt },
                        {
                            "inlineData": {
                                "mimeType": mimeType,
                                "data": base64Data
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json" // Pede a resposta em JSON
            }
        };

        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Erro API Gemini (Visão): ${err.error.message}`);
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("A IA (Visão) não retornou uma resposta.");
        }

        // Retorna a string JSON (que será parseada)
        return data.candidates[0].content.parts[0].text;
    },
    
    // Cloudinary (V3.0 - Aceita 'folderName')
    uploadFileToCloudinary: async (file, folderName = 'workouts') => {
        // V2.5: Lê a config do 'window'
        if (!window.CLOUDINARY_CONFIG || !window.CLOUDINARY_CONFIG.cloudName || !window.CLOUDINARY_CONFIG.uploadPreset || window.CLOUDINARY_CONFIG.cloudName.includes("SEU_CLOUD_NAME")) {
            throw new Error("Cloudinary não está configurado em js/config.js");
        }
        
        const f = new FormData(); 
        f.append('file', file); 
        f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); 
        // Salva na subpasta correta (workouts/ ou profile/)
        f.append('folder', `lerunners/${AppPrincipal.state.currentUser.uid}/${folderName}`);
        
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        if (!r.ok) throw new Error("Falha no upload para Cloudinary.");
        
        const data = await r.json();
        return data.secure_url; // Retorna a URL segura
    },
    
    // ===================================================================
    // StravaLogic
    // ===================================================================
    handleStravaConnect: () => {
        if (typeof window.STRAVA_PUBLIC_CONFIG === 'undefined') {
            alert("Erro: Configuração do Strava ausente (config.js).");
            return;
        }
        
        const config = window.STRAVA_PUBLIC_CONFIG;
        const stravaAuthUrl = `https://www.strava.com/oauth/authorize?` +
            `client_id=${config.clientID}&` +
            `response_type=code&` +
            `redirect_uri=${config.redirectURI}&` +
            `approval_prompt=force&` +
            `scope=read_all,activity:read_all,profile:read_all`;

        window.location.href = stravaAuthUrl;
    },

    exchangeStravaCode: async (stravaCode) => {
        const VERCEL_API_URL = window.STRAVA_PUBLIC_CONFIG.vercelAPI;
        const user = AppPrincipal.state.currentUser;

        if (!user) {
            alert("Erro: Usuário não autenticado para conectar ao Strava.");
            return;
        }

        try {
            const idToken = await user.getIdToken();

            console.log("Enviando código Strava para o backend Vercel...");

            const response = await fetch(VERCEL_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}` 
                },
                body: JSON.stringify({ 
                    code: stravaCode
                })
            });

            const result = await response.json();

            if (response.ok) {
                alert("Strava conectado com sucesso! Recarregando...");
                window.location.href = 'app.html';
            } else {
                console.error("Erro na integração Strava:", result);
                alert(`Falha ao conectar Strava: ${result.details || result.error}`);
                window.location.href = 'app.html';
            }

        } catch (error) {
            console.error("Erro de rede/chamada da função Vercel:", error);
            alert("Erro de rede ao contatar o backend.");
            window.location.href = 'app.html';
        }
    }
};


// ===================================================================
// 2. AuthLogic (Lógica da index.html - FIX V3.2.7)
// ===================================================================
const AuthLogic = {
    auth: null,
    db: null,
    elements: {},

    init: (auth, db) => {
        console.log("AuthLogic V3.2.7: Inicializado.");
        
        AuthLogic.auth = auth;
        AuthLogic.db = db;

        AuthLogic.elements = {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            pendingView: document.getElementById('pending-view'),
            btnLogoutPending: document.getElementById('btn-logout-pending'),
            loginErrorMsg: document.getElementById('login-error'),
            registerErrorMsg: document.getElementById('register-error'),
            toggleToRegister: document.getElementById('toggleToRegister'),
            toggleToLogin: document.getElementById('toggleToLogin'),
            
            btnSubmitLogin: document.getElementById('btn-submit-login'),
            btnSubmitRegister: document.getElementById('btn-submit-register'),
            
            // NOVO (V3.3.2): Elemento que faltava
            pendingEmailDisplay: document.getElementById('pending-email-display')
        };
        
        AuthLogic.elements.toggleToRegister.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.toggleToLogin.addEventListener('click', AuthLogic.handleToggle);
        AuthLogic.elements.btnLogoutPending.addEventListener('click', () => AuthLogic.auth.signOut());
        
        if(AuthLogic.elements.loginForm) {
             AuthLogic.elements.loginForm.addEventListener('submit', AuthLogic.handleLogin);
        }
        if(AuthLogic.elements.registerForm) {
             AuthLogic.elements.registerForm.addEventListener('submit', AuthLogic.handleRegister);
        }
        
        AuthLogic.auth.onAuthStateChanged(AuthLogic.handleLoginGuard);
    },
    
    showView: (view) => {
        const { loginForm, registerForm, pendingView, toggleToRegister, toggleToLogin, loginErrorMsg, registerErrorMsg } = AuthLogic.elements;
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        pendingView.classList.add('hidden');
        toggleToRegister.parentElement.classList.add('hidden');
        toggleToLogin.parentElement.classList.add('hidden');
        
        loginErrorMsg.textContent = "";
        registerErrorMsg.textContent = "";

        if (view === 'login') {
            loginForm.classList.remove('hidden');
            toggleToRegister.parentElement.classList.remove('hidden');
        } else if (view === 'register') {
            registerForm.classList.remove('hidden');
            toggleToLogin.parentElement.classList.remove('hidden');
        } else if (view === 'pending') {
            pendingView.classList.remove('hidden');
        }
    },
    
    handleToggle: (e) => {
        e.preventDefault();
        const view = e.target.id === 'toggleToRegister' ? 'register' : 'login';
        AuthLogic.showView(view);
    },
    
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = AuthLogic.elements.loginForm.querySelector('button'); // Usa o botão dentro do formulário
        
        AuthLogic.elements.loginErrorMsg.textContent = "";

        if(!email || !password) return;

        btn.disabled = true;
        btn.textContent = "Verificando...";
        
        AuthLogic.auth.signInWithEmailAndPassword(email, password)
            .catch((error) => {
                btn.disabled = false;
                btn.textContent = "Entrar";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    AuthLogic.elements.loginErrorMsg.textContent = "Email ou senha incorretos.";
                } else {
                    AuthLogic.elements.loginErrorMsg.textContent = "Erro ao tentar entrar.";
                }
            });
    },

    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const btn = AuthLogic.elements.registerForm.querySelector('button'); // Usa o botão dentro do formulário
        
        if (password.length < 6) {
            AuthLogic.elements.registerErrorMsg.textContent = "A senha deve ter no mínimo 6 caracteres.";
            return;
        }
        if (!name) {
            AuthLogic.elements.registerErrorMsg.textContent = "O nome é obrigatório.";
            return;
        }

        btn.disabled = true;
        btn.textContent = "Enviando...";
        AuthLogic.elements.registerErrorMsg.textContent = "";
        
        AuthLogic.auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                const pendingData = {
                    name: name,
                    email: email,
                    requestDate: new Date().toISOString()
                };
                return AuthLogic.db.ref('pendingApprovals/' + user.uid).set(pendingData);
            })
            .catch((error) => {
                btn.disabled = false;
                btn.textContent = "Solicitar Acesso";
                if (error.code === 'auth/email-already-in-use') {
                    AuthLogic.elements.loginErrorMsg.textContent = "Email já cadastrado. Tente fazer login.";
                    AuthLogic.showView('login');
                } else {
                    AuthLogic.elements.registerErrorMsg.textContent = "Erro ao criar sua conta.";
                }
            });
    },
    
    handleLoginGuard: (user) => {
        if (user) {
            const uid = user.uid;
            AuthLogic.db.ref('admins/' + uid).once('value', adminSnapshot => {
                if (adminSnapshot.exists() && adminSnapshot.val() === true) {
                    window.location.href = 'app.html';
                    return;
                }
                AuthLogic.db.ref('users/' + uid).once('value', userSnapshot => {
                    if (userSnapshot.exists()) {
                        window.location.href = 'app.html';
                        return;
                    }
                    AuthLogic.db.ref('pendingApprovals/' + uid).once('value', pendingSnapshot => {
                        if (pendingSnapshot.exists()) {
                            // CORREÇÃO CRÍTICA (V3.3.2): O elemento DOM precisa estar no cache
                            if (AuthLogic.elements.pendingEmailDisplay) {
                                AuthLogic.elements.pendingEmailDisplay.textContent = user.email;
                            }
                            AuthLogic.showView('pending');
                        } else {
                            AuthLogic.elements.loginErrorMsg.textContent = "Sua conta foi rejeitada ou excluída.";
                            AuthLogic.auth.signOut();
                            AuthLogic.showView('login');
                        }
                    });
                });
            });
        } else {
            AuthLogic.showView('login');
        }
    }
};


// ===================================================================
// =l= INICIALIZAÇÃO FINAL =l=
// O DOMContentLoaded irá chamar a função AppPrincipal.init(), que fará o roteamento.
// Este bloco deve ser o último no arquivo.
// ===================================================================
document.addEventListener('DOMContentLoaded', AppPrincipal.init);
