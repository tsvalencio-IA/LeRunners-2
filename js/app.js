/* =================================================================== */
/* APP.JS V13.0 - VERSÃO ESTÁVEL E COMPLETA
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
        if(typeof window.firebaseConfig === 'undefined') {
            console.error("ERRO: Configuração do Firebase não encontrada.");
            return;
        }
        
        try { 
            if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); 
        } catch(e) { console.error("Erro Firebase:", e); }
        
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // --- AUTENTICAÇÃO GLOBAL ---
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            const isLoginPage = document.body.classList.contains('login-page');
            
            if (user) {
                // Usuário Logado
                AppPrincipal.state.currentUser = user;
                
                if (isLoginPage) {
                    window.location.href = 'app.html'; // Redireciona para o App
                } else {
                    // Já está no App
                    AppPrincipal.initPlatform();
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('code')) { 
                        AppPrincipal.exchangeStravaCode(urlParams.get('code')); 
                    } else {
                        AppPrincipal.loadUserData(user.uid);
                    }
                }
            } else {
                // Usuário Não Logado
                if (!isLoginPage) {
                    window.location.href = 'index.html'; // Chuta para login
                } else {
                    AuthLogic.init(AppPrincipal.state.auth); // Inicia form de login
                }
            }
        });
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        if(el.loader) el.loader.classList.remove('hidden');
        
        // Listeners
        const btnLogout = document.getElementById('logoutButton');
        if(btnLogout) btnLogout.onclick = AppPrincipal.handleLogout;
        
        const btnPlanilha = document.getElementById('nav-planilha-btn');
        if(btnPlanilha) btnPlanilha.onclick = () => AppPrincipal.navigateTo('planilha');
        
        const btnFeed = document.getElementById('nav-feed-btn');
        if(btnFeed) btnFeed.onclick = () => AppPrincipal.navigateTo('feed');
        
        const btnProfile = document.getElementById('nav-profile-btn');
        if(btnProfile) btnProfile.onclick = AppPrincipal.openProfileModal;
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if(document.getElementById('log-activity-form')) document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;
        if(document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        if(document.getElementById('photo-upload-input')) document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        
        const btnEval = document.getElementById('save-coach-eval-btn');
        if(btnEval) btnEval.onclick = AppPrincipal.handleCoachEvaluationSubmit;
    },

    loadUserData: (uid) => {
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
                    const display = document.getElementById('userDisplay');
                    if(display) display.textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        AppPrincipal.state.viewMode = 'admin';
                        AppPrincipal.setupAdminToggle();
                    } else {
                        AppPrincipal.state.viewMode = 'atleta';
                    }
                    
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    
                    AppPrincipal.updateViewClasses();
                    AppPrincipal.navigateTo('planilha');
                }
                
                if(document.getElementById('loader')) document.getElementById('loader').classList.add('hidden');
            });
        });
    },

    setupAdminToggle: () => {
        if(document.getElementById('admin-toggle-btn')) return;
        const nav = document.querySelector('.app-header nav');
        if(!nav) return;
        
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
        
        const logoutBtn = document.getElementById('logoutButton');
        if(logoutBtn) nav.insertBefore(btn, logoutBtn);
    },

    updateViewClasses: () => {
        const c = document.getElementById('app-container');
        if(!c) return;
        if(AppPrincipal.state.viewMode === 'admin') { 
            c.classList.add('admin-view'); c.classList.remove('atleta-view'); 
        } else { 
            c.classList.add('atleta-view'); c.classList.remove('admin-view'); 
        }
    },

    navigateTo: (page) => {
        const m = document.getElementById('app-main-content');
        if(!m) return;
        m.innerHTML = "";
        
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); 
        if(btn) btn.classList.add('active');

        if(page === 'planilha') {
            if(AppPrincipal.state.viewMode === 'admin') {
                if(typeof AdminPanel !== 'undefined') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                if(typeof AtletaPanel !== 'undefined') AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            if(typeof FeedPanel !== 'undefined') FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
    },

    handleLogout: () => {
        AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html');
    },

    // --- STRAVA DEEP SYNC (CORRIGIDO PARA BUSCAR DETALHES/SPLITS) ---
    handleStravaConnect: () => { 
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; 
    },
    
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ code }) 
        });
        if(res.ok) {
            window.history.replaceState({}, document.title, "app.html"); 
            window.location.reload();
        } else {
            alert("Erro ao conectar Strava.");
        }
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        
        const btn = document.getElementById('btn-strava-action');
        if(btn) { btn.disabled = true; btn.textContent = "Sincronizando (buscando detalhes)..."; }

        try {
            // 1. Busca Lista (Limite 50)
            const activities = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, { 
                headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
            }).then(r => {
                if(!r.ok) throw new Error("Erro API Strava");
                return r.json();
            });

            const updates = {};
            let count = 0;

            for(const act of activities) {
                // 2. BUSCA PROFUNDA (SPLITS)
                // Pequeno delay para não estourar API
                await new Promise(r => setTimeout(r, 150)); 
                
                let detail = act; 
                try {
                    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { 
                        headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
                    });
                    if(detailRes.ok) detail = await detailRes.json();
                } catch(e) { console.warn("Erro detalhe:", e); }

                const newKey = AppPrincipal.state.db.ref().push().key;

                // Formatação
                const distanceKm = (act.distance / 1000).toFixed(2) + " km";
                const hours = Math.floor(act.moving_time / 3600);
                const minutes = Math.floor((act.moving_time % 3600) / 60);
                const seconds = act.moving_time % 60;
                const timeStr = `${hours > 0 ? hours + ':' : ''}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                let paceStr = "0:00 /km";
                if(act.distance > 0) {
                    const pVal = (act.moving_time / 60) / (act.distance / 1000);
                    const pMin = Math.floor(pVal);
                    const pSec = Math.round((pVal - pMin) * 60);
                    paceStr = `${pMin}:${pSec.toString().padStart(2, '0')} /km`;
                }

                // Extração Splits
                let splits = [];
                if(detail.splits_metric) {
                    splits = detail.splits_metric.map((s, i) => {
                        let sPaceStr = "-";
                        if(s.distance > 0) {
                            const sPace = (s.moving_time / 60) / (s.distance / 1000);
                            const sMin = Math.floor(sPace); 
                            const sSec = Math.round((sPace - sMin) * 60);
                            sPaceStr = `${sMin}'${sSec.toString().padStart(2,'0')}"`;
                        }
                        const sMinTime = Math.floor(s.moving_time / 60);
                        const sSecTime = s.moving_time % 60;
                        const sTimeStr = `${sMinTime}:${sSecTime.toString().padStart(2,'0')}`;

                        return {
                            km: i + 1,
                            pace: sPaceStr,
                            time: sTimeStr,
                            elev: (s.elevation_difference || 0).toFixed(0)
                        };
                    });
                }

                const workoutData = {
                    title: act.name,
                    date: act.start_date.split('T')[0],
                    description: `[Importado Strava] ${act.type} - ${distanceKm}`,
                    status: 'realizado',
                    realizadoAt: new Date().toISOString(),
                    feedback: `Sincronizado via Strava.`,
                    stravaActivityId: act.id,
                    stravaData: { 
                        distancia: distanceKm, 
                        tempo: timeStr, 
                        ritmo: paceStr, 
                        id: act.id,
                        splits: splits, // DADOS DE PARCIAIS AQUI
                        elevacao: (act.total_elevation_gain || 0) + "m",
                        calorias: (act.calories || act.kilojoules || 0).toFixed(0)
                    },
                    createdBy: currentUser.uid
                };

                updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                updates[`/publicWorkouts/${newKey}`] = { 
                    ownerId: currentUser.uid, 
                    ownerName: AppPrincipal.state.userData.name, 
                    ...workoutData 
                };
                count++;
            }
            
            await AppPrincipal.state.db.ref().update(updates);
            alert(`${count} atividades sincronizadas com histórico!`);
            document.getElementById('profile-modal').classList.add('hidden');
            
        } catch(e) { 
            alert("Erro sync: " + e.message); 
        } finally {
            if(btn) { btn.disabled = false; btn.textContent = "Sincronizar Strava Agora"; }
        }
    },

    // --- MODAL DETALHADO (COM TABELA DE PARCIAIS) ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        if(document.getElementById('feedback-modal-title')) document.getElementById('feedback-modal-title').textContent = title;
        
        const sd = document.getElementById('strava-data-display');
        if(sd) { sd.innerHTML = ""; sd.classList.add('hidden'); }
        
        const cl = document.getElementById('comments-list');
        if(cl) cl.innerHTML = "Carregando...";
        
        const coachArea = document.getElementById('coach-evaluation-area');
        const coachText = document.getElementById('coach-evaluation-text');
        if(coachText) coachText.value = "";
        
        const isCoach = AppPrincipal.state.userData && AppPrincipal.state.userData.role === 'admin';
        if(coachArea) coachArea.classList.toggle('hidden', !isCoach);

        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
                if(d.coachEvaluation && coachText) coachText.value = d.coachEvaluation;
                
                // RENDERIZA DADOS DO STRAVA (MAPA + SPLITS)
                if(d.stravaData && sd) {
                    sd.classList.remove('hidden');
                    
                    let tableHTML = "";
                    if(d.stravaData.splits && d.stravaData.splits.length > 0) {
                        tableHTML = `
                            <div style="margin-top:15px; border:1px solid #eee; border-radius:8px; overflow:hidden;">
                                <div style="background:#f4f5f7; padding:8px; font-weight:bold; font-size:0.9rem; border-bottom:1px solid #ddd;">Parciais (Km a Km)</div>
                                <table style="width:100%; font-size:0.85rem; border-collapse:collapse; text-align:center;">
                                    <thead style="background:#fff; color:#666; border-bottom:1px solid #eee;">
                                        <tr><th style="padding:8px;">Km</th><th>Pace</th><th>Tempo</th><th>Elev</th></tr>
                                    </thead>
                                    <tbody>
                                        ${d.stravaData.splits.map(split => `
                                            <tr style="border-bottom:1px solid #f9f9f9;">
                                                <td style="padding:6px; font-weight:bold;">${split.km}</td>
                                                <td style="color:#00008B;">${split.pace}</td>
                                                <td>${split.time}</td>
                                                <td style="color:#666;">${split.elev}m</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }

                    sd.innerHTML = `
                        <div style="padding:15px; background:#fff; border:1px solid #e0e0e0; border-radius:8px; margin-top:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:#fc4c02; font-weight:bold; font-size:1rem;"><i class='bx bxl-strava'></i> Dados do Strava</span>
                                ${d.stravaData.id ? `<a href="https://www.strava.com/activities/${d.stravaData.id}" target="_blank" style="font-size:0.85rem; color:#007bff; text-decoration:none;">Ver no App <i class='bx bx-link-external'></i></a>` : ''}
                            </div>
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-top:15px; text-align:center;">
                                <div style="background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #eee;">
                                    <div style="font-size:0.7rem; color:#666; text-transform:uppercase;">Distância</div>
                                    <div style="font-weight:bold; color:#333; font-size:1.1rem;">${d.stravaData.distancia}</div>
                                </div>
                                <div style="background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #eee;">
                                    <div style="font-size:0.7rem; color:#666; text-transform:uppercase;">Tempo</div>
                                    <div style="font-weight:bold; color:#333; font-size:1.1rem;">${d.stravaData.tempo}</div>
                                </div>
                                <div style="background:#f9f9f9; padding:8px; border-radius:5px; border:1px solid #eee;">
                                    <div style="font-size:0.7rem; color:#666; text-transform:uppercase;">Pace Médio</div>
                                    <div style="font-weight:bold; color:#333; font-size:1.1rem;">${d.stravaData.ritmo}</div>
                                </div>
                            </div>
                            ${tableHTML}
                        </div>
                    `;
                }
            }
        });
        
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            if(!list) return;
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<small style='color:#999'>Nenhum comentário.</small>"; return; }
            s.forEach(c => {
                const v = c.val();
                const div = document.createElement('div');
                div.className = 'comment-item';
                div.innerHTML = `<strong>${v.name || 'Usuário'}:</strong> ${v.text}`;
                list.appendChild(div);
            });
        });

        if(modal) modal.classList.remove('hidden');
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
        
        const fullData = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
        if(updates.status !== 'planejado') {
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                ownerId: currentOwnerId,
                ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || "Atleta",
                ...fullData
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

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid, 
            name: AppPrincipal.state.userData.name || "Usuário", 
            text: text, 
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },
    
    handleLogActivitySubmit: async (e) => { e.preventDefault(); },
    handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {},
    
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const form = document.getElementById('profile-form');
        let btn = document.getElementById('btn-strava-action');
        if(!btn) {
            btn = document.createElement('button'); btn.id='btn-strava-action'; btn.type='button';
            btn.className='btn btn-secondary'; btn.style.marginTop='15px'; btn.style.width='100%'; btn.style.background='#fc4c02'; btn.style.color='white'; btn.style.border='none';
            form.appendChild(btn);
        }
        btn.textContent = AppPrincipal.state.stravaTokenData ? "Sincronizar Strava Agora" : "Conectar Strava";
        btn.onclick = AppPrincipal.state.stravaTokenData ? AppPrincipal.handleStravaSyncActivities : AppPrincipal.handleStravaConnect;
    },
    handleProfileSubmit: (e) => { e.preventDefault(); document.getElementById('profile-modal').classList.add('hidden'); },
    
    // IA GEMINI
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) throw new Error("Chave Gemini não configurada");
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if(!r.ok) throw new Error("Erro na API Gemini: " + r.status);
        const d = await r.json(); 
        return d.candidates[0].content.parts[0].text;
    }
};

// Lógica isolada de Login para index.html
const AuthLogic = {
    init: (auth) => {
        const form = document.getElementById('login-form');
        if(form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                const btn = form.querySelector('button');
                btn.disabled = true; btn.textContent = "Entrando...";
                
                auth.signInWithEmailAndPassword(email, password)
                    .catch(err => {
                        btn.disabled = false; btn.textContent = "Entrar";
                        const errorMsg = document.getElementById('login-error');
                        if(errorMsg) errorMsg.textContent = "Erro: " + err.message;
                    });
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);