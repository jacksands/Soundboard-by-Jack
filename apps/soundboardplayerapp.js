/**
 * Personal SoundBoard for players.
 *
 * Folder modes (set by GM in Player Manager):
 *  'gm'       — player sees GM's current sounds (sent via socket)
 *  'global'   — all players use one folder (playerSoundboardRootDir, set by GM)
 *  'personal' — each player has their own folder (playerPersonalFolders[userId])
 *               If allowPlayersAlterFolder: player can override via client setting
 */
class SoundBoardPlayerApplication extends foundry.appv1.api.Application {

    constructor(userId) {
        super();
        this.userId = userId;
        this.sounds = {};
        this.loaded = false;
        this.error = false;
        this.waitingForGM = false;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `🎵 ${game.i18n.localize('SOUNDBOARD.app.playerTitle')}`;
        options.id = 'soundboard-player-app';
        options.template = 'modules/Soundboard-by-Jack/templates/soundboardplayer.html';
        options.resizable = true;
        options.width = 600;
        options.height = 600;
        return options;
    }

    _getActiveDir() {
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'gm';
        if (mode === 'global') {
            return game.settings.get('SoundBoard', 'playerSoundboardRootDir') || '';
        }
        if (mode === 'personal') {
            const personalFolders = game.settings.get('SoundBoard', 'playerPersonalFolders') || {};
            const assignedDir = personalFolders[this.userId] || '';
            const allowAlter = game.settings.get('SoundBoard', 'allowPlayersAlterFolder') || false;
            if (allowAlter) {
                const playerOverride = game.settings.get('SoundBoard', 'playerSoundboardDirectory') || '';
                return playerOverride || assignedDir;
            }
            return assignedDir;
        }
        return ''; // 'gm' mode — no dir
    }

    async _loadSounds() {
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'gm';
        this.sounds = {};
        this.error = false;
        this.waitingForGM = false;

        if (mode === 'gm') {
            this.sounds = SoundBoard.sounds || {};
            if (Object.keys(this.sounds).length === 0 && !game.user.isGM) {
                this.waitingForGM = true;
                SoundBoard._requestSoundsFromGM();
            }
            this.loaded = true;
            return;
        }

        const dir = this._getActiveDir();
        if (!dir) {
            this.error = 'nodir';
            this.loaded = true;
            return;
        }

        const EXTS = ['.ogg', '.oga', '.mp3', '.wav', '.flac', '.webm', '.opus'];
        try {
            const source = game.settings.get('SoundBoard', 'source') || 'data';
            const dirArray = await FilePicker.browse(source, dir);

            for (const subDir of dirArray.dirs) {
                const catName = SoundBoard._formatName(subDir.split(/[/]+/).pop(), false);
                this.sounds[catName] = [];
                const inner = await FilePicker.browse(source, subDir);
                for (const wildcardDir of inner.dirs) {
                    const wFiles = (await FilePicker.browse(source, wildcardDir)).files
                        .filter(f => EXTS.some(e => f.toLowerCase().endsWith(e)));
                    if (wFiles.length) this.sounds[catName].push({
                        name: SoundBoard._formatName(wildcardDir.split(/[/]+/).pop(), false),
                        src: wFiles, identifyingPath: wildcardDir, isWild: true
                    });
                }
                for (const file of inner.files) {
                    if (EXTS.some(e => file.toLowerCase().endsWith(e))) {
                        this.sounds[catName].push({
                            name: SoundBoard._formatName(file.split(/[/]+/).pop()),
                            src: [file], identifyingPath: file, isWild: false
                        });
                    }
                }
            }

            // Root-level audio files → "General" category
            const rootFiles = (dirArray.files || []).filter(f => EXTS.some(e => f.toLowerCase().endsWith(e)));
            if (rootFiles.length) {
                this.sounds['General'] = rootFiles.map(f => ({
                    name: SoundBoard._formatName(f.split(/[/]+/).pop()),
                    src: [f], identifyingPath: f, isWild: false
                }));
            }

            this.loaded = true;
        } catch(e) {
            SoundBoard.log(`PlayerSoundBoard error: ${e}`, SoundBoard.LOGTYPE.ERR);
            this.error = 'loadfail';
            this.loaded = true;
        }
    }

    async getData() {
        await this._loadSounds();
        const volume = game.settings.get('SoundBoard', 'soundboardServerVolume');
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'gm';
        const activeDir = this._getActiveDir();
        const totalCount = Object.values(this.sounds).reduce((s, a) => s + a.length, 0);
        const allowAlter = game.settings.get('SoundBoard', 'allowPlayersAlterFolder') || false;
        const playerOverride = game.settings.get('SoundBoard', 'playerSoundboardDirectory') || '';

        const categories = Object.keys(this.sounds)
            .filter(k => this.sounds[k].length > 0)
            .map(k => ({ categoryName: k, files: this.sounds[k] }));

        return {
            categories, volume, totalCount,
            error: this.error, mode, activeDir, allowAlter, playerOverride,
            waitingForGM: this.waitingForGM,
            isGM: game.user.isGM,
            gmRootDir: game.settings.get('SoundBoard', 'playerSoundboardRootDir') || ''
        };
    }

    activateListeners(html) {
        super.bringToTop();
        const el = html instanceof HTMLElement ? html : html[0];

        // ---- Sound buttons: left-click = broadcast, right-click = local preview ----
        el.querySelectorAll('.sb-player-btn[data-src]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const src = decodeURIComponent(btn.dataset.src);
                SoundBoard.playAudioPath(src, true);   // push=true: broadcast to all
            });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const src = decodeURIComponent(btn.dataset.src);
                SoundBoard.playAudioPath(src, false);  // push=false: local preview only
            });
        });

        // ---- Reload / re-request sounds ----
        el.querySelector('#player-refresh')?.addEventListener('click', () => {
            const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'gm';
            if (mode === 'gm' && !game.user.isGM) SoundBoard._requestSoundsFromGM();
            setTimeout(() => this.render(), 800);
        });

        // ---- Expand / Collapse All ----
        el.querySelector('#player-expand-all')?.addEventListener('click', () => {
            el.querySelectorAll('.sb-collapse-div').forEach(d => d.style.display = '');
        });
        el.querySelector('#player-collapse-all')?.addEventListener('click', () => {
            el.querySelectorAll('.sb-collapse-div').forEach(d => d.style.display = 'none');
        });

        // ---- Player folder override (when allowPlayersAlterFolder is true) ----
        el.querySelector('#player-dir-pick')?.addEventListener('click', () => {
            new FilePicker({
                type: 'folder',
                callback: path => {
                    game.settings.set('SoundBoard', 'playerSoundboardDirectory', path);
                    this.render();
                }
            }).render(true);
        });
        el.querySelector('#player-dir-clear')?.addEventListener('click', () => {
            game.settings.set('SoundBoard', 'playerSoundboardDirectory', '');
            this.render();
        });

        // ---- Volume slider ----
        el.querySelector('#player-volume-slider')?.addEventListener('change', function() {
            SoundBoard.updateVolume(this.value);
        });

        // ---- Search filter ----
        let ft;
        el.querySelector('#player-sound-search')?.addEventListener('keyup', function () {
            clearTimeout(ft);
            ft = setTimeout(() => {
                const v = this.value.toLowerCase();
                el.querySelectorAll('.sb-player-btn').forEach(b => {
                    b.style.display = (b.getAttribute('title') || '').toLowerCase().includes(v) ? '' : 'none';
                });
                el.querySelectorAll('.sb-player-category').forEach(cat => {
                    const hasVisible = [...cat.querySelectorAll('.sb-player-btn')].some(b => b.style.display !== 'none');
                    cat.style.display = hasVisible ? '' : 'none';
                });
            }, 300);
        });

        // ---- Category collapse toggles ----
        el.querySelectorAll('.sb-player-cat-header').forEach(h => {
            h.addEventListener('click', () => {
                const body = h.nextElementSibling;
                if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });
    }
}

/**
 * GM Player SoundBoard Manager — 3 folder modes + per-player folder
 */
class SoundBoardPlayerManagerApplication extends foundry.appv1.api.Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = '👥 Player SoundBoard Manager';
        options.id = 'soundboard-player-manager';
        options.template = 'modules/Soundboard-by-Jack/templates/soundboardplayermanager.html';
        options.resizable = true;
        options.width = 520;
        options.height = 600;
        return options;
    }

    getData() {
        const players = game.users.contents.filter(u => !u.isGM);
        const allowed = game.settings.get('SoundBoard', 'playersWithSoundboard') || [];
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'gm';
        const gmDir = game.settings.get('SoundBoard', 'soundboardDirectory') || '';
        const gmRootDir = game.settings.get('SoundBoard', 'playerSoundboardRootDir') || '';
        const personalFolders = game.settings.get('SoundBoard', 'playerPersonalFolders') || {};
        const allowAlter = game.settings.get('SoundBoard', 'allowPlayersAlterFolder') || false;

        return {
            players: players.map(p => ({
                id: p.id, name: p.name,
                hasAccess: allowed.includes(p.id),
                personalDir: personalFolders[p.id] || ''
            })),
            mode, gmDir, gmRootDir, allowAlter
        };
    }

    activateListeners(html) {
        super.bringToTop();
        const el = html instanceof HTMLElement ? html : html[0];

        // Mode radio buttons
        el.querySelectorAll('input[name="pm-mode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                game.settings.set('SoundBoard', 'playerSoundboardMode', radio.value);
            });
        });

        // GM sets global folder
        el.querySelector('#pm-global-dir-pick')?.addEventListener('click', () => {
            new FilePicker({
                type: 'folder',
                callback: path => {
                    game.settings.set('SoundBoard', 'playerSoundboardRootDir', path);
                    this.render();
                }
            }).render(true);
        });

        // Per-player folder pickers
        el.querySelectorAll('.pm-player-dir-pick').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.dataset.userId;
                new FilePicker({
                    type: 'folder',
                    callback: path => {
                        const pf = { ...(game.settings.get('SoundBoard', 'playerPersonalFolders') || {}) };
                        pf[uid] = path;
                        game.settings.set('SoundBoard', 'playerPersonalFolders', pf);
                        this.render();
                    }
                }).render(true);
            });
        });

        el.querySelectorAll('.pm-player-dir-clear').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.dataset.userId;
                const pf = { ...(game.settings.get('SoundBoard', 'playerPersonalFolders') || {}) };
                delete pf[uid];
                game.settings.set('SoundBoard', 'playerPersonalFolders', pf);
                this.render();
            });
        });

        // Toggle player access
        el.querySelectorAll('.sb-pm-access-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.dataset.userId;
                const allowed = [...(game.settings.get('SoundBoard', 'playersWithSoundboard') || [])];
                const idx = allowed.indexOf(uid);
                if (idx === -1) allowed.push(uid); else allowed.splice(idx, 1);
                game.settings.set('SoundBoard', 'playersWithSoundboard', allowed);
                const hasAccess = allowed.includes(uid);
                btn.textContent = hasAccess ? '✓ Has Access' : '✗ No Access';
                btn.className = `btn btn-sm sb-pm-access-toggle ${hasAccess ? 'btn-success' : 'btn-outline-secondary'}`;
            });
        });
    }
}
