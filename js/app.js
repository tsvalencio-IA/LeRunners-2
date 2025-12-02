<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LeRunners - Plataforma</title>
    <link rel="stylesheet" href="css/styles.css">
    
    <link rel="manifest" href="manifest.json">
    <link rel="icon" type="image/png" sizes="192x192" href="img/logo-192.png">
    <link rel="apple-touch-icon" href="img/logo-192.png">

    <link href="https://cdn.jsdelivr.net/npm/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">
    <meta name="theme-color" content="#00008B">
</head>
<body class="app-page">

    <div id="loader" class="loader-container">
        <div class="loader"></div>
        <p>Carregando...</p>
    </div>

    <div id="app-container" class="hidden">
        
        <header class="app-header">
            <h1>LeRunners</h1>
            <nav>
                <button id="nav-planilha-btn" class="btn btn-nav active">
                    <i class='bx bx-calendar'></i> <span>Planilha</span>
                </button>
                <button id="nav-feed-btn" class="btn btn-nav">
                    <i class='bx bx-news'></i> <span>Feed</span>
                </button>

                <button id="nav-profile-btn" class="btn btn-nav">
                    <i class='bx bx-user-circle'></i> <span>Meu Perfil</span>
                </button>

                <span id="userDisplay" class="user-display"></span>
                <button id="logoutButton" class="btn btn-danger">
                    <i class="bx bx-log-out"></i> Sair
                </button>
            </nav>
        </header>

        <main id="app-main-content" class="app-main">
            </main>
    </div>

    <footer class="app-footer">
        Desenvolvido com 🤖 por thIAguinho Soluções
    </footer>

    <div id="feedback-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="feedback-modal-title">Detalhes do Treino</h3>
                <button class="close-btn" id="close-feedback-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="feedback-form">
                    <fieldset>
                        <legend>Feedback do Atleta</legend>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="workout-status">
                                <option value="planejado">Planejado</option>
                                <option value="realizado" style="color:green">Realizado</option>
                                <option value="realizado_parcial" style="color:orange">Parcial</option>
                                <option value="nao_realizado" style="color:red">Não Realizado</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Sensação / Comentário</label>
                            <textarea id="workout-feedback-text" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Foto</label>
                            <input type="file" id="photo-upload-input" accept="image/*">
                            <p id="photo-upload-feedback" class="upload-feedback"></p>
                        </div>
                        
                        <div id="strava-data-display" class="strava-data-display hidden"></div>

                        <button type="submit" id="save-feedback-btn" class="btn btn-primary">Salvar Feedback</button>
                    </fieldset>
                </form>

                <div id="coach-evaluation-area" class="hidden" style="margin-top:20px; border:2px solid #00008B; padding:15px; border-radius:8px; background:#f0f8ff;">
                    <h4 style="color:#00008B"><i class='bx bx-medal'></i> Avaliação do Treinador</h4>
                    <textarea id="coach-evaluation-text" rows="2" style="width:100%; border:1px solid #ccc; margin-top:5px;" placeholder="Deixe sua avaliação técnica..."></textarea>
                    <button id="save-coach-eval-btn" class="btn btn-secondary btn-small" style="margin-top:5px;">Salvar Avaliação</button>
                </div>

                <hr>
                
                <div class="comments-section">
                    <h4>Comentários</h4>
                    <div id="comments-list" class="comments-list"></div>
                    <form id="comment-form" class="comment-form">
                        <input type="text" id="comment-input" placeholder="Escreva um comentário..." required>
                        <button type="submit" class="btn btn-secondary"><i class='bx bxs-send'></i></button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <div id="log-activity-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h3>Registrar Atividade</h3><button class="close-btn" id="close-log-activity-modal">&times;</button></div>
            <div class="modal-body">
                <form id="log-activity-form">
                    <div class="form-group"><label>Data</label><input type="date" id="log-activity-date" required></div>
                    <div class="form-group"><label>Título</label><input type="text" id="log-activity-title" required></div>
                    <div class="form-group"><label>Tipo</label><select id="log-activity-type"><option>Corrida</option><option>Caminhada</option><option>Outro</option></select></div>
                    <div class="form-group"><label>Descrição</label><textarea id="log-activity-feedback" required></textarea></div>
                    <button type="submit" class="btn btn-primary">Salvar</button>
                </form>
            </div>
        </div>
    </div>

    <div id="profile-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h3>Meu Perfil</h3><button class="close-btn" id="close-profile-modal">&times;</button></div>
            <div class="modal-body">
                <form id="profile-form">
                    <div style="text-align:center; margin-bottom:10px;">
                        <img id="profile-pic-preview" style="width:100px; height:100px; border-radius:50%; object-fit:cover;">
                    </div>
                    <div class="form-group"><input type="file" id="profile-pic-upload"></div>
                    <div class="form-group"><label>Nome</label><input type="text" id="profile-name" required></div>
                    <div class="form-group"><label>Bio</label><textarea id="profile-bio"></textarea></div>
                    <button type="submit" id="save-profile-btn" class="btn btn-primary">Salvar</button>
                </form>
            </div>
        </div>
    </div>

    <div id="view-profile-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h3>Atleta</h3><button class="close-btn" id="close-view-profile-modal">&times;</button></div>
            <div class="modal-body" style="text-align:center;">
                <img id="view-profile-pic" style="width:120px; height:120px; border-radius:50%; margin-bottom:10px;">
                <h2 id="view-profile-name" style="color:#00008B"></h2>
                <p id="view-profile-bio" style="font-style:italic; color:#666;"></p>
            </div>
        </div>
    </div>

    <div id="who-liked-modal" class="modal-overlay hidden">
        <div class="modal-content"><div class="modal-header"><h3>Curtidas</h3><button class="close-btn" id="close-who-liked-modal">&times;</button></div><div class="modal-body"><ul id="who-liked-list"></ul></div></div>
    </div>

    <div id="ia-analysis-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h3>Análise IA</h3><button class="close-btn" id="close-ia-analysis-modal">&times;</button></div>
            <div class="modal-body"><pre id="ia-analysis-output" style="white-space:pre-wrap; background:#f4f4f4; padding:10px;"></pre></div>
            <div class="modal-footer"><button id="save-ia-analysis-btn" class="btn btn-primary hidden">Salvar</button></div>
        </div>
    </div>

    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
    <script src="https://upload-widget.cloudinary.com/global/all.js" type="text/javascript"></script>

    <script src="js/config.js"></script>
    <script src="js/app.js"></script> 
    <script src="js/panels.js"></script> 
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js');
            });
        }
    </script>
</body>
</html>
