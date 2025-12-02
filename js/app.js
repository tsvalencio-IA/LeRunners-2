/* =================================================================== */
/* APP.JS V15.0 - BASE V2 FUNCIONAL + SYNC DETALHADO
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, userData: null, db: null, auth: null,
        listeners: {}, currentView: 'planilha', viewMode: 'admin',
        adminUIDs: {}, userCache: {}, modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null
    },
    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try { if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch (e) {}

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento V2 (Seguro)
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
        el.mainContent = document.getElementById('app-main-content');

        // Navegação
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms (V2)
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if(document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        
        // Botão Log Manual (V2)
        if(document.getElementById('log-activity-form')) document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;

        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            AppPrincipal.state.currentUser = user;
            if (urlParams.get('code')) { AppPrincipal.exchangeStravaCode(urlParams.get('code')); return; }
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                if (!data && isAdmin) { data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; AppPrincipal.state.db.ref('users/' + uid).set(data); }
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        // Toggle V2
                        const nav = document.querySelector('.app-header nav');
                        if(!document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; btn.className = 'btn btn-nav'; 
                            btn.innerHTML = "Modo Atleta"; btn.style.border = "1px solid white";
                            btn.onclick = () => {
                                AppPrincipal.state.viewMode = AppPrincipal.state.viewMode === 'admin' ? 'atleta' : 'admin';
                                btn.innerHTML = AppPrincipal.state.viewMode === 'admin' ? "Modo Atleta" : "Modo Coach";
                                AppPrincipal.updateClasses(); AppPrincipal.navigateTo('planilha');
                            };
                            nav.insertBefore(btn, document.getElementById('logoutButton'));
                        }
                    }
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    AppPrincipal.updateClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    updateClasses: () => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode==='admin') { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = "";
        
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); if(btn) btn.classList.add('active');

        if (page === 'planilha') {
            if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') {
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- STRAVA DEEP SYNC (CORREÇÃO VITAL) ---
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({code}) });
        window.history.replaceState({}, document.title, "app.html"); window.location.reload();
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        const btn = document.getElementById('btn-strava-action');
        if(btn) { btn.disabled=true; btn.textContent="Buscando detalhes (Km a Km)..."; }

        try {
            // BUSCA LISTA (100 itens para garantir histórico)
            const activities = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=100`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());
            const updates = {};
            let count = 0;

            for(const act of activities) {
                // BUSCA DETALHADA PARA CADA ATIVIDADE (SPLITS)
                const detail = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());
                
                // Processa Splits
                let splits = [];
                if(detail.splits_metric) {
                    splits = detail.splits_metric.map((s, i) => {
                        const paceVal = (s.moving_time/60)/(s.distance/1000);
                        const pMin = Math.floor(paceVal); const pSec = Math.round((paceVal-pMin)*60);
                        return { 
                            km: i+1, 
                            pace: `${pMin}'${pSec.toString().padStart(2,'0')}"`, 
                            time: new Date(s.moving_time*1000).toISOString().substr(14,5),
                            elev: (s.elevation_difference||0).toFixed(0)
                        };
                    });
                }

                const newKey = AppPrincipal.state.db.ref().push().key;
                const distKm = (act.distance/1000).toFixed(2)+" km";
                const paceMin = Math.floor((act.moving_time/60)/(act.distance/1000));
                const paceSec = Math.round(((act.moving_time/60)/(act.distance/1000)-paceMin)*60);
                
                const workoutData = {
                    title: act.name,
                    date: act.start_date.split('T')[0],
                    description: `[Importado Strava] ${act.type}`,
                    status: 'realizado',
                    realizadoAt: new Date().toISOString(),
                    feedback: "Importado automaticamente.",
                    stravaActivityId: act.id,
                    stravaData: { 
                        distancia: distKm, tempo: new Date(act.moving_time*1000).toISOString().substr(11,8), 
                        ritmo: `${paceMin}:${paceSec.toString().padStart(2,'0')}`, id: act.id,
                        splits: splits, elevacao: (act.total_elevation_gain||0)+"m"
                    },
                    createdBy: currentUser.uid
                };

                // Salva nos 2 lugares (V2 Logic)
                updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData };
                count++;
            }
            await AppPrincipal.state.db.ref().update(updates);
            alert(`${count} atividades sincronizadas com tabela de Pace!`);
            document.getElementById('profile-modal').classList.add('hidden');
        } catch(e) { alert("Erro Sync: "+e.message); } finally { if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; } }
    },

    // --- MODAL V2 (COM TABELA DE PACE) ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        document.getElementById('feedback-modal-title').textContent = title;
        
        const sd = document.getElementById('strava-data-display');
        sd.innerHTML=""; sd.classList.add('hidden');
        document.getElementById('comments-list').innerHTML = "Carregando...";

        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                document.getElementById('workout-status').value = d.status || 'planejado';
                document.getElementById('workout-feedback-text').value = d.feedback || '';
                
                // Exibe Tabela de Splits (Correção V2)
                if(d.stravaData) {
                    sd.classList.remove('hidden');
                    let rows = "";
                    if(d.stravaData.splits) {
                        d.stravaData.splits.forEach(sp => {
                            rows += `<tr><td>${sp.km}</td><td>${sp.pace}</td><td>${sp.time}</td><td>${sp.elev}m</td></tr>`;
                        });
                    }
                    sd.innerHTML = `
                        <div style="background:#f9f9f9; padding:10px; border:1px solid #ccc; margin-top:10px;">
                            <strong>Dados Strava:</strong> ${d.stravaData.distancia} | ${d.stravaData.tempo} | ${d.stravaData.ritmo}
                            <table style="width:100%; font-size:0.8rem; margin-top:5px; text-align:center; border-collapse:collapse;">
                                <thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Tempo</th><th>Elev</th></tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    `;
                }
            }
        });
        
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            s.forEach(c => {
                const v = c.val();
                list.innerHTML += `<div class="comment-item"><b>${v.name}:</b> ${v.text}</div>`;
            });
        });
        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const updates = { status: document.getElementById('workout-status').value, feedback: document.getElementById('workout-feedback-text').value, realizadoAt: new Date().toISOString() };
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        const full = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
        if(updates.status !== 'planejado') await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ownerId: currentOwnerId, ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name, ...full});
        document.getElementById('feedback-modal').classList.add('hidden');
    },
    
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ uid: AppPrincipal.state.currentUser.uid, name: AppPrincipal.state.userData.name, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById('comment-input').value = "";
    },
    
    handleLogActivitySubmit: async (e) => { e.preventDefault(); },
    handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {},
    
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const form = document.getElementById('profile-form');
        let btn = document.getElementById('btn-strava-action');
        if(!btn) {
            btn = document.createElement('button'); btn.id='btn-strava-action'; btn.type='button'; btn.className='btn btn-secondary'; btn.style.marginTop='10px'; btn.style.width='100%';
            form.appendChild(btn);
        }
        btn.textContent = AppPrincipal.state.stravaTokenData ? "Sincronizar Strava (Histórico Completo)" : "Conectar Strava";
        btn.onclick = AppPrincipal.state.stravaTokenData ? AppPrincipal.handleStravaSyncActivities : AppPrincipal.handleStravaConnect;
    },
    handleProfileSubmit: (e) => { e.preventDefault(); document.getElementById('profile-modal').classList.add('hidden'); },
    
    // IA Gemini (Restaurada)
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) throw new Error("Sem Chave API");
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if(r.status === 429) return "⚠️ Limite de uso da IA atingido. Tente novamente mais tarde.";
        if(!r.ok) throw new Error("Erro IA: "+r.status);
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    }
};

const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .then(() => window.location.href = 'app.html')
                .catch(e => document.getElementById('login-error').textContent = e.message);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
