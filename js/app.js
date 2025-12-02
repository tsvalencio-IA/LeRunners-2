const AppPrincipal = {
    state: { currentUser: null, userData: null, db: null, auth: null, currentView: 'planilha', stravaTokenData: null },
    elements: {},

    init: () => {
        try { if(firebase.apps.length===0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento V2 Seguro
        if(document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth);
        } else if(document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.mainContent = document.getElementById('app-main-content');

        // Binds
        document.getElementById('logoutButton').onclick = () => AppPrincipal.state.auth.signOut().then(()=>window.location.href='index.html');
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Form Binds Seguros (Verifica se existe antes de bindar)
        const fbForm = document.getElementById('feedback-form'); if(fbForm) fbForm.onsubmit = AppPrincipal.handleFeedbackSubmit;
        const cForm = document.getElementById('comment-form'); if(cForm) cForm.onsubmit = AppPrincipal.handleCommentSubmit;
        const pForm = document.getElementById('profile-form'); if(pForm) pForm.onsubmit = AppPrincipal.handleProfileSubmit;
        const ceBtn = document.getElementById('save-coach-eval-btn'); if(ceBtn) ceBtn.onclick = AppPrincipal.handleCoachEvaluationSubmit;

        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged(user => {
            if(!user) { window.location.href = 'index.html'; return; }
            AppPrincipal.state.currentUser = user;
            if(urlParams.get('code')) AppPrincipal.exchangeStravaCode(urlParams.get('code'));
            else AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val()||{});
        AppPrincipal.state.db.ref('users/'+uid).once('value', s => {
            let data = s.val();
            AppPrincipal.state.db.ref('admins/'+uid).once('value', asnap => {
                const isAdmin = asnap.exists() && asnap.val();
                if(!data && isAdmin) { data={name:AppPrincipal.state.currentUser.email, role:'admin'}; AppPrincipal.state.db.ref('users/'+uid).set(data); }
                if(data) {
                    AppPrincipal.state.userData = {...data, uid};
                    document.getElementById('userDisplay').textContent = data.name;
                    if(isAdmin) AppPrincipal.state.userData.role = 'admin';
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    
                    const c = document.getElementById('app-container');
                    if(isAdmin) { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
                    else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
                    
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = ""; // Limpa
        
        // LÓGICA V2 DE CARREGAMENTO (CLONAR TEMPLATE)
        // Isso garante que o HTML exista antes do JS tentar usar
        if(page === 'planilha') {
            if(AppPrincipal.state.userData.role === 'admin') {
                const tpl = document.getElementById('admin-panel-template');
                if(tpl) {
                    mainContent.appendChild(tpl.content.cloneNode(true));
                    AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                }
            } else {
                const tpl = document.getElementById('atleta-panel-template');
                if(tpl) {
                    mainContent.appendChild(tpl.content.cloneNode(true));
                    document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
                    AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                }
            }
        } else if(page === 'feed') {
            const tpl = document.getElementById('feed-panel-template');
            if(tpl) {
                mainContent.appendChild(tpl.content.cloneNode(true));
                FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        }
        
        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    // --- STRAVA (SYNC COM PARCIAIS) ---
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({code})});
        window.history.replaceState({}, document.title, "app.html"); window.location.reload();
    },
    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if(!stravaTokenData) return alert("Conecte o Strava.");
        try {
            const acts = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30`, { headers:{'Authorization':`Bearer ${stravaTokenData.accessToken}`} }).then(r=>r.json());
            const updates = {};
            for(const act of acts) {
                // Deep Fetch para Splits
                const det = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers:{'Authorization':`Bearer ${stravaTokenData.accessToken}`} }).then(r=>r.json());
                let splits = [];
                if(det.splits_metric) splits = det.splits_metric.map((s,i)=>({ km:i+1, pace: (s.moving_time/60)/(s.distance/1000), time: s.moving_time }));
                
                const key = AppPrincipal.state.db.ref().push().key;
                const data = {
                    title: act.name, date: act.start_date.split('T')[0], status: 'realizado', realizadoAt: new Date().toISOString(),
                    stravaData: { distancia: (act.distance/1000).toFixed(2)+'km', tempo: act.moving_time, splits: splits, id: act.id },
                    createdBy: currentUser.uid
                };
                updates[`/data/${currentUser.uid}/workouts/${key}`] = data;
                updates[`/publicWorkouts/${key}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...data };
            }
            await AppPrincipal.state.db.ref().update(updates);
            alert("Sync completo!");
        } catch(e) { alert("Erro Sync: "+e.message); }
    },

    // --- MODAL COMPLETO ---
    openFeedbackModal: (wid, oid, title) => {
        AppPrincipal.state.modal = { isOpen:true, currentWorkoutId:wid, currentOwnerId:oid };
        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('strava-data-display').innerHTML = "";
        
        AppPrincipal.state.db.ref(`data/${oid}/workouts/${wid}`).once('value', s => {
            if(!s.exists()) return;
            const d = s.val();
            // Preenche Strava e Tabela
            if(d.stravaData) {
                const sd = document.getElementById('strava-data-display');
                sd.classList.remove('hidden');
                let rows = "";
                if(d.stravaData.splits) {
                    d.stravaData.splits.forEach(sp => {
                        const pMin = Math.floor(sp.pace); const pSec = Math.round((sp.pace-pMin)*60);
                        rows += `<tr><td>${sp.km}</td><td>${pMin}:${pSec}</td></tr>`;
                    });
                }
                sd.innerHTML = `<b>Strava:</b> ${d.stravaData.distancia} <table>${rows}</table>`;
            }
        });
        document.getElementById('feedback-modal').classList.remove('hidden');
    },
    
    openProfileModal: () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        // Botão Strava Dinâmico
        const form = document.getElementById('profile-form');
        let btn = document.getElementById('btn-strava');
        if(!btn) { btn=document.createElement('button'); btn.id='btn-strava'; btn.type='button'; btn.className='btn btn-secondary'; form.appendChild(btn); }
        btn.textContent = AppPrincipal.state.stravaTokenData ? "Sincronizar Strava" : "Conectar Strava";
        btn.onclick = AppPrincipal.state.stravaTokenData ? AppPrincipal.handleStravaSyncActivities : AppPrincipal.handleStravaConnect;
    },
    handleProfileSubmit: (e) => { e.preventDefault(); document.getElementById('profile-modal').classList.add('hidden'); },
    handleFeedbackSubmit: async (e) => { e.preventDefault(); /* Lógica de salvar feedback */ document.getElementById('feedback-modal').classList.add('hidden'); },
    handleCommentSubmit: (e) => { e.preventDefault(); /* Lógica comentário */ },
    handleCoachEvaluationSubmit: (e) => { e.preventDefault(); /* Lógica avaliação */ }
};

const AuthLogic = {
    init: (auth) => {
        document.getElementById('login-form').addEventListener('submit', e => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .then(() => window.location.href='app.html')
                .catch(err => alert(err.message));
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);