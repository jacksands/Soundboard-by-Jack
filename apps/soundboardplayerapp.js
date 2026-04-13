/**
 * Personal SoundBoard for a specific player.
 *
 * Two modes (set by GM in settings):
 *  - 'folder'  : player points to their own folder (client setting), SoundBoard loads it
 *  - 'shared'  : player sees the same directory as the GM (read-only, play only)
 *
 * Players can only play (left-click) or preview (right-click).
 * No loop, cache, macro, or volume mode.
 */
class SoundBoardPlayerApplication extends foundry.appv1.api.Application {

    constructor(userId) {
        super();
        this.userId = userId;
        this.sounds = {};
        this.loaded = false;
        this.error = false;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `🎵 ${game.i18n.localize('SOUNDBOARD.app.playerTitle')}`;
        options.id = 'soundboard-player-app';
        options.template = 'modules/SoundBoard/templates/soundboardplayer.html';
        options.resizable = true;
        options.width = 520;
        options.height = 560;
        return options;
    }

    async _loadSounds() {
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'shared';
        this.sounds = {};

        if (mode === 'shared') {
            // Use the same sounds as the GM
            this.sounds = SoundBoard.sounds;
            this.loaded = true;
            return;
        }

        // 'folder' mode: each player has their own directory (client setting)
        const dir = game.settings.get('SoundBoard', 'playerSoundboardDirectory') || '';
        if (!dir) {
            this.error = true;
            this.loaded = true;
            return;
        }

        try {
            const source = game.settings.get('SoundBoard', 'source') || 'data';
            const dirArray = await FilePicker.browse(source, dir);
            const EXTS = ['.ogg', '.oga', '.mp3', '.wav', 'flac', '.webm', '.opus'];

            for (const subDir of dirArray.dirs) {
                const catName = SoundBoard._formatName(subDir.split(/[/]+/).pop(), false);
                this.sounds[catName] = [];
                const inner = await FilePicker.browse(source, subDir);

                for (const wildcardDir of inner.dirs) {
                    const files = (await FilePicker.browse(source, wildcardDir)).files
                        .filter(f => EXTS.some(e => f.endsWith(e)));
                    if (files.length) this.sounds[catName].push({
                        name: SoundBoard._formatName(wildcardDir.split(/[/]+/).pop(), false),
                        src: files, identifyingPath: wildcardDir, isWild: true
                    });
                }

                for (const file of inner.files) {
                    if (EXTS.some(e => file.endsWith(e))) {
                        this.sounds[catName].push({
                            name: SoundBoard._formatName(file.split(/[/]+/).pop()),
                            src: [file], identifyingPath: file, isWild: false
                        });
                    }
                }
            }
            this.loaded = true;
        } catch(e) {
            SoundBoard.log(`PlayerSoundBoard load error: ${e}`, SoundBoard.LOGTYPE.ERR);
            this.error = true;
            this.loaded = true;
        }
    }

    async getData() {
        await this._loadSounds();
        const volume = game.settings.get('SoundBoard', 'soundboardServerVolume');
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'shared';
        const dir = game.settings.get('SoundBoard', 'playerSoundboardDirectory') || '';
        const totalCount = Object.values(this.sounds).reduce((s, a) => s + a.length, 0);

        const categories = Object.keys(this.sounds)
            .filter(k => this.sounds[k].length > 0)
            .map(k => ({ categoryName: k, files: this.sounds[k] }));

        return { categories, volume, totalCount, error: this.error, mode, dir, isGM: game.user.isGM };
    }

    activateListeners(html) {
        super.bringToTop();
        const el = html instanceof HTMLElement ? html : html[0];

        // Directory picker for folder mode
        el.querySelector('#player-dir-pick')?.addEventListener('click', () => {
            new FilePicker({
                type: 'folder',
                callback: path => {
                    game.settings.set('SoundBoard', 'playerSoundboardDirectory', path);
                    this.render();
                }
            }).render(true);
        });

        // Search filter
        let ft;
        el.querySelector('#player-sound-search')?.addEventListener('keyup', function () {
            clearTimeout(ft);
            ft = setTimeout(() => {
                const v = this.value.toLowerCase();
                el.querySelectorAll('.sb-player-btn').forEach(b => {
                    b.style.display = b.textContent.toLowerCase().includes(v) ? '' : 'none';
                });
                el.querySelectorAll('.sb-player-category').forEach(cat => {
                    const hasVisible = [...cat.querySelectorAll('.sb-player-btn')].some(b => b.style.display !== 'none');
                    cat.style.display = hasVisible ? '' : 'none';
                });
            }, 300);
        });

        // Collapse toggles
        el.querySelectorAll('.sb-player-cat-header').forEach(h => {
            h.addEventListener('click', () => {
                const body = h.nextElementSibling;
                if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });
    }
}

/**
 * GM Player SoundBoard Manager
 * Controls access and mode (shared/folder).
 */
class SoundBoardPlayerManagerApplication extends foundry.appv1.api.Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = '👥 Player SoundBoard Manager';
        options.id = 'soundboard-player-manager';
        options.template = 'modules/SoundBoard/templates/soundboardplayermanager.html';
        options.resizable = true;
        options.width = 500;
        options.height = 520;
        return options;
    }

    getData() {
        const players = game.users.contents.filter(u => !u.isGM);
        const allowed = game.settings.get('SoundBoard', 'playersWithSoundboard') || [];
        const mode = game.settings.get('SoundBoard', 'playerSoundboardMode') || 'shared';
        const gmDir = game.settings.get('SoundBoard', 'soundboardDirectory') || '';

        return {
            players: players.map(p => ({ id: p.id, name: p.name, hasAccess: allowed.includes(p.id) })),
            mode,
            gmDir
        };
    }

    activateListeners(html) {
        super.bringToTop();
        const el = html instanceof HTMLElement ? html : html[0];

        // Mode select
        el.querySelector('#pm-mode-select')?.addEventListener('change', function () {
            game.settings.set('SoundBoard', 'playerSoundboardMode', this.value);
        });

        // Toggle player access
        el.querySelectorAll('.sb-pm-access-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const uid = btn.dataset.userId;
                const allowed = [...(game.settings.get('SoundBoard', 'playersWithSoundboard') || [])];
                const idx = allowed.indexOf(uid);
                if (idx === -1) allowed.push(uid); else allowed.splice(idx, 1);
                game.settings.set('SoundBoard', 'playersWithSoundboard', allowed);
                btn.classList.toggle('active');
                const hasAccess = allowed.includes(uid);
                btn.textContent = hasAccess ? '✓ Has Access' : '✗ No Access';
                btn.className = `btn btn-sm sb-pm-access-toggle ${hasAccess ? 'btn-success' : 'btn-outline-secondary'}`;
                btn.dataset.userId = uid;
            });
        });
    }
}
