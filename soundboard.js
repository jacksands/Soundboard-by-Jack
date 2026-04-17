// Settings menu class for delete macros (follows LEARNINGS #004 pattern)
class SBDeleteMacrosMenu extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: 'sb-delete-macros-menu',
        window: { title: 'Delete SoundBoard Macros' }
    };
    async _renderHTML() { return null; }
    async _replaceHTML() {}
    async _onRender() {
        this.close({ animate: false });
        SoundBoard.promptDeleteMacros();
    }
}

// Settings menu class for managing player soundboard directories (using Dialog instead of AppV2)
class SBPlayerDirectoryManager extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: 'sb-player-directory-manager',
        window: { 
            title: 'Manage Player SoundBoard Directories',
            resizable: true,
            width: 600,
            height: 500
        }
    };

    constructor(options = {}) {
        super(options);
    }

    async _prepareContext(options) {
        const playerDirs = game.settings.get('Soundboard-by-Jack', 'soundboardPlayerDirectories') || {};
        // Mostra todos os jogadores não-GM, mesmo desconectados
        const players = game.users.contents.filter(u => !u.isGM);
        
        const playersList = players.map(player => ({
            id: player.id,
            name: player.name,
            directory: playerDirs[player.id] || '',
            hasDirectory: !!playerDirs[player.id]
        }));

        return { players: playersList };
    }

    async _renderHTML(context, options) {
        const isGM = game.user.isGM;
        const playerRows = context.players.map(player => {
            // Só GM pode editar qualquer campo, jogador só pode editar o próprio
            const editable = isGM;
            return `
            <div style="margin-bottom: 12px; padding: 8px; border: 1px solid #999; border-radius: 4px; background: #2a2a2a;">
                <div style="font-weight: bold; margin-bottom: 6px; color: #fff;">${player.name}</div>
                <div style="display: flex; gap: 4px; align-items: center;">
                    <input type="text" 
                           data-player-id="${player.id}" 
                           class="player-directory-input" 
                           value="${player.directory}" 
                           placeholder="e.g., sounds/player-1"
                           style="flex: 1; padding: 6px; border: 1px solid #666; border-radius: 3px; background: #1a1a1a; color: #fff;"
                           ${editable ? '' : 'readonly'}>
                    <button class="sb-player-picker-btn" data-player-id="${player.id}" 
                            style="padding: 6px 10px; background: #444; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;" title="Pick folder">📁</button>
                    <button class="sb-player-save-btn" data-player-id="${player.id}" 
                            style="padding: 6px 12px; background: #2c5aa0; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">Save</button>
                    ${player.hasDirectory ? `
                    <button class="sb-player-clear-btn" data-player-id="${player.id}" 
                            style="padding: 6px 12px; background: #d32f2f; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">Clear</button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        return `
        <div style="padding: 12px;">
            <div style="margin-bottom: 12px; padding: 8px; background: #333; border-radius: 4px; font-size: 12px; color: #ccc; border-left: 3px solid #2c5aa0;">
                <strong>Manage Player SoundBoard Directories</strong><br/>
                Assign folders for each player. Leave empty to let players use their own settings.
            </div>
            <div style="max-height: 380px; overflow-y: auto;">
                ${playerRows.length > 0 ? playerRows : '<p style="color: #999; text-align: center;">No players found.</p>'}
            </div>
            <div style="text-align:right; margin-top:10px;">
                <button id="sb-player-dir-close-btn" style="padding:6px 18px;background:#444;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:bold;">Fechar</button>
            </div>
        </div>
        `;
    }

    async _replaceHTML(result, content, data) {
        const html = this.element;
        if (html) {
            // Clear and insert new content
            html.innerHTML = result;
            // Re-attach listeners
            this._attachListeners();
        }
    }

    async _onRender(context, options) {
        super._onRender(context, options);
        this._attachListeners();
    }

    _attachListeners() {
        const html = this.element;
        const isGM = game.user.isGM;

        // File picker para cada player
        html?.querySelectorAll('.sb-player-picker-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                // Só GM pode editar qualquer campo
                if (!isGM) return;
                const input = html.querySelector(`.player-directory-input[data-player-id="${playerId}"]`);
                const current = input?.value || '';
                // Abre o file picker de pasta
                const fp = new FilePicker({
                    type: 'folder',
                    current: current,
                    callback: path => {
                        if (input) input.value = path;
                    }
                });
                fp.render(true);
            });
        });

        // Wire up save buttons
        html?.querySelectorAll('.sb-player-save-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                // Só GM pode salvar qualquer campo
                if (!isGM) return;
                const input = html.querySelector(`.player-directory-input[data-player-id="${playerId}"]`);
                if (input) {
                    await SBPlayerDirectoryManager.updateDirectory(playerId, input.value);
                    await this.render(true);
                }
            });
        });

        // Wire up clear buttons
        html?.querySelectorAll('.sb-player-clear-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId;
                // Só GM pode limpar
                if (!isGM) return;
                await SBPlayerDirectoryManager.deleteDirectory(playerId);
                await this.render(true);
            });
        });

        // Botão fechar
        const closeBtn = html?.querySelector('#sb-player-dir-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
    }

    static async updateDirectory(playerId, directory) {
        const playerDirs = game.settings.get('Soundboard-by-Jack', 'soundboardPlayerDirectories') || {};
        if (directory && directory.trim()) {
            playerDirs[playerId] = directory.trim();
            ui.notifications.info(`Directory set for player`);
        } else {
            delete playerDirs[playerId];
            ui.notifications.info(`Directory cleared for player`);
        }
        await game.settings.set('Soundboard-by-Jack', 'soundboardPlayerDirectories', playerDirs);
    }

    static async deleteDirectory(playerId) {
        const playerDirs = game.settings.get('Soundboard-by-Jack', 'soundboardPlayerDirectories') || {};
        delete playerDirs[playerId];
        await game.settings.set('Soundboard-by-Jack', 'soundboardPlayerDirectories', playerDirs);
    }
}

class SoundBoard {

    static sounds = {};
    static bundledSounds = {};
    static currentlyPlayingSounds = [];

    static LOGTYPE = {
        LOG: 0,
        WARN: 1,
        ERR: 2
    }

    static soundsLoaded = false;
    static soundsError = false;

    static targetedPlayerID;
    static cacheMode = false;
    static macroMode = false;
    static volumeMode = game?.settings?.get?.('Soundboard-by-Jack', 'volumeToggle') ?? false;

    static openedBoard;

    static socketHelper;
    static audioHelper;
    static packageManager;

    static log(message, logLevel = SoundBoard.LOGTYPE.LOG) {
        switch (logLevel) {
            case SoundBoard.LOGTYPE.LOG:
                console.log(`SoundBoard | ${message}`);
                break;
            case SoundBoard.LOGTYPE.WARN:
                console.warn(`SoundBoard | ${message}`);
                break;
            case SoundBoard.LOGTYPE.ERR:
                console.error(`SoundBoard | ${message}`);
                break;
            default:
                console.log(`SoundBoard | ${message}`);
                break;
        }
    }

    static handlebarsHelpers = {
                'is-playing': function(identifyingPath) {
                    // Verifica se o som está tocando
                    if (!window.SoundBoard || !Array.isArray(window.SoundBoard.currentlyPlayingSounds)) return false;
                    return window.SoundBoard.currentlyPlayingSounds.some(s => s && s.identifyingPath === identifyingPath);
                },
        'eq': (a, b) => a === b,
        'soundboard-safeid': (str) => {
            return 'sbsafe-' + str.toLowerCase().replace(/[^a-z0-9]/g, function (s) {
                var c = s.charCodeAt(0);
                if (c === 32) return '-';
                return '__' + ('000' + c.toString(16)).slice(-4);
            });
        },
        'soundboard-getarraycount': (array) => {
            return array.length;
        },
        'soundboard-escape': (str) => {
            return str.replace(/(')/g, '\$1');
        },
        'get-individual-volume': (identifyingPath) => {
            return this.getVolumeForSound(identifyingPath);
        }
    }

    // Settings client-scope podem ser lidos/escritos por qualquer usuário.
    // Settings world-scope restricted só o GM pode escrever (Foundry já bloqueia).
    static setUserSetting(key, value) {
        game.settings.set('Soundboard-by-Jack', key, value);
    }

    static getUserSetting(key) {
        return game.settings.get('Soundboard-by-Jack', key);
    }

    static async openSoundBoard() {
        // Só permite abrir se for GM ou se a opção permitir
        const allowPlayers = game.settings.get('Soundboard-by-Jack', 'allowPlayerSoundBoard');
        if (!game.user.isGM && !allowPlayers) {
            ui.notifications.warn('SoundBoard: O GM desativou o SoundBoard para jogadores.');
            return;
        }
        if (!game.user.isGM) {
            console.log(`SoundBoard (Player): Sons carregados: ${SoundBoard.soundsLoaded}, Categorias: ${Object.keys(SoundBoard.sounds).length}`);
            if (!SoundBoard.soundsLoaded || Object.keys(SoundBoard.sounds).length === 0) {
                // Pede ao GM para enviar os sons agora
                ui.notifications.warn('SoundBoard: Solicitando sons ao GM...');
                if (SoundBoard.socketHelper) {
                    SoundBoard.socketHelper.sendData({
                        type: SBSocketHelper.SOCKETMESSAGETYPE.REQUEST_SYNC,
                        playerId: game.userId
                    });
                }
                // Abre assim mesmo — o painel vai se atualizar automaticamente ao receber os sons
            }
        }
        
        if (SoundBoard.soundsError) {
            const dir = SoundBoard.getDirectoryForCurrentUser();
            if (!dir || !dir.trim()) {
                ui.notifications.warn('SoundBoard: Nenhum diretório configurado. Configure em "Module Settings > My SoundBoard Directory".');
            } else {
                ui.notifications.error(`SoundBoard Error: Diretório "${dir}" não encontrado ou inacessível. Verifique Module Settings.`);
            }
        }
        
        // Log de depuração: quantos sons carregados
        let total = 0;
        Object.keys(SoundBoard.sounds).forEach(k => total += SoundBoard.sounds[k].length);
        console.log(`SoundBoard | Sons carregados: ${total}`);
        
        // Garante que pode abrir múltiplas vezes
        if (SoundBoard.openedBoard && SoundBoard.openedBoard.rendered) {
            SoundBoard.openedBoard.close();
        }
        SoundBoard.openedBoard = new SoundBoardApplication();
        SoundBoard.openedBoard.render(true);
    }

    static async openSoundBoardFav() {
        // Para jogadores, os sons são recebidos via socket pelo GM
        if (!game.user.isGM && (!SoundBoard.soundsLoaded || Object.keys(SoundBoard.sounds).length === 0)) {
            ui.notifications.warn('SoundBoard: Aguardando sincronização de sons pelo GM...');
        }
        if (SoundBoard.openedBoard && SoundBoard.openedBoard.rendered) {
            SoundBoard.openedBoard.close();
        }
        SoundBoard.openedBoard = new SoundBoardFavApplication();
        SoundBoard.openedBoard.render(true);
    }

    static async openSoundBoardBundled() {
        // Para jogadores, os sons são recebidos via socket pelo GM
        if (!game.user.isGM && (!SoundBoard.soundsLoaded || Object.keys(SoundBoard.sounds).length === 0)) {
            ui.notifications.warn('SoundBoard: Aguardando sincronização de sons pelo GM...');
        }
        if (SoundBoard.openedBoard && SoundBoard.openedBoard.rendered) {
            SoundBoard.openedBoard.close();
        }
        SoundBoard.openedBoard = new SoundBoardBundledApplication();
        SoundBoard.openedBoard.render(true);
    }

    static openSoundBoardHelp() {
        if (SoundBoard.openedBoard && SoundBoard.openedBoard.rendered) {
            SoundBoard.openedBoard.close();
        }
        SoundBoard.openedBoard = new SoundBoardHelp();
        SoundBoard.openedBoard.render(true);
    }

    static openSoundBoardPackageManager() {
        try {
            if (SoundBoard.openedBoard && SoundBoard.openedBoard.rendered) {
                SoundBoard.openedBoard.close();
            }
            SoundBoard.openedBoard = new SoundBoardPackageManagerApplication(SoundBoard.packageManager);
            SoundBoard.openedBoard.render(true);
        } catch (e) {
            console.error(e);
        }
    }

    static updateVolume(volumePercentage) {
        let volume = volumePercentage / 100;
        SoundBoard.audioHelper.onVolumeChange(volume);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.VOLUMECHANGE,
            payload: {
                volume
            }
        });
        game.settings.set('Soundboard-by-Jack', 'soundboardServerVolume', volumePercentage);
    }

    static updateVolumeForSound(volumePercentage, identifyingPath) {
        const originalSoundVolumes = game.settings.get('Soundboard-by-Jack', 'soundboardIndividualSoundVolumes');
        let individualVolumes = {...originalSoundVolumes, [identifyingPath]: volumePercentage};
        game.settings.set('Soundboard-by-Jack', 'soundboardIndividualSoundVolumes', individualVolumes);

        let sbVolume = SoundBoard.getVolume();
        SoundBoard.audioHelper.onVolumeChange(sbVolume, individualVolumes);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.VOLUMECHANGE,
            payload: {
                volume: sbVolume,
                individualVolumes
            }
        });
    }

    static getVolume() {
        // Usa o novo setting client-side para volume geral do módulo
        return (game.settings.get('Soundboard-by-Jack', 'moduleGeneralVolume') || 90) / 100;
    }

    static getVolumeForSound(identifyingPath) {
        const individualSoundVolumes = game.settings.get('Soundboard-by-Jack', 'soundboardIndividualSoundVolumes');
        if (individualSoundVolumes[identifyingPath]) {
            return parseInt(individualSoundVolumes[identifyingPath]);
        } else {
            return 100;
        }
    }

    static async playSoundOrStopLoop(identifyingPath) {
        let sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        const kb = game?.keyboard;
        const altDown = kb?.downKeys?.has('AltLeft') || kb?.downKeys?.has('AltRight');
        const ctrlDown = kb?.downKeys?.has('ControlLeft') || kb?.downKeys?.has('ControlRight');
        const shiftDown = kb?.downKeys?.has('ShiftLeft') || kb?.downKeys?.has('ShiftRight');

        if (altDown) {
            if (sound.isFavorite) {
                this.unfavoriteSound(identifyingPath);
            } else {
                this.favoriteSound(identifyingPath);
            }
        } else if (sound.loop) {
            SoundBoard.stopLoop(identifyingPath);
        } else if (ctrlDown) {
            this.stopSound(identifyingPath);
        } else if (shiftDown) {
            this.startLoop(identifyingPath);
        } else {
            SoundBoard.playSound(identifyingPath);
        }
    }

    static async playSound(identifyingPath, push = true) {
        let sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        if (!sound) return;

        // ---------------------------------------------------------------
        // JOGADOR (não GM): não toca localmente — pede ao GM tocar globalmente
        // ---------------------------------------------------------------
        if (!game.user.isGM) {
            if (push) {
                // Resolve qual arquivo tocar (suporte a wildcard/múltiplos src)
                let soundIndex = Math.floor(Math.random() * sound.src.length);
                if (sound.lastPlayedIndex >= 0 && sound.src.length > 1 && sound.lastPlayedIndex === soundIndex) {
                    if (++soundIndex > sound.src.length - 1) soundIndex = 0;
                }
                sound.lastPlayedIndex = soundIndex;
                const src = sound.src[soundIndex];
                const volume = SoundBoard.getVolume();

                SoundBoard.socketHelper.sendData({
                    type: SBSocketHelper.SOCKETMESSAGETYPE.PLAYER_PLAY_REQUEST,
                    payload: {
                        src, volume, identifyingPath,
                        playerId: game.userId, playerName: game.user.name,
                        loop: sound.loop || false,
                        loopMode: sound.loopMode || 'simple',
                        loopDelayMin: sound.loopDelayMin || 0,
                        loopDelayMax: sound.loopDelayMax || 0
                    }
                });
            }
            return;
        }

        // ---------------------------------------------------------------
        // GM: comportamento original
        // ---------------------------------------------------------------
        let volume = SoundBoard.getVolume();
        sound.individualVolume = SoundBoard.getVolumeForSound(identifyingPath) / 100;
        let soundIndex = Math.floor(Math.random() * sound.src.length);
        if (sound.lastPlayedIndex >= 0 && sound.src.length > 1 && sound.lastPlayedIndex === soundIndex) {
            if (++soundIndex > sound.src.length - 1) {
                soundIndex = 0;
            }
        }
        sound.lastPlayedIndex = soundIndex;
        let src = sound.src[soundIndex];

        let detune = game.settings.get('Soundboard-by-Jack', 'detuneAmount');

        let loop = sound.loop;

        if (detune > 0) {
            detune *= 10;
            let normalizedAmount = Math.random() * detune;
            detune = 0 - detune / 2 + normalizedAmount;
        }
        let payload = {
            src,
            volume,
            detune,
            loop
        };
        // Adiciona à lista de sons tocando e atualiza indicador visual
        if (!SoundBoard.currentlyPlayingSounds.some(s => s && s.identifyingPath === sound.identifyingPath)) {
            SoundBoard.currentlyPlayingSounds.push(sound);
        }
        SoundBoard._updatePlayingIndicator(identifyingPath, true);
        if (SoundBoard.cacheMode) {
            SoundBoard.audioHelper.cache(payload);
            if (push) {
                SoundBoard.socketHelper.sendData({
                    type: SBSocketHelper.SOCKETMESSAGETYPE.CACHE,
                    payload
                });
            }
        } else if (SoundBoard.macroMode) {
            SBMacroHelper.generateMacro(sound.name);
        } else {
            if (SoundBoard.targetedPlayerID) {
                payload.target = SoundBoard.targetedPlayerID;
            }
            SoundBoard.audioHelper.play(payload, sound);
            if (push) {
                SoundBoard.socketHelper.sendData({
                    type: SBSocketHelper.SOCKETMESSAGETYPE.PLAY,
                    payload,
                    soundExtras: {identifyingPath: sound.identifyingPath, individualVolume: sound.individualVolume}
                });
            }
        }
    }

    static async playSoundByName(name, push = true) {
        if (!game.user.isGM) {
            this.socketHelper.sendData({type: SBSocketHelper.SOCKETMESSAGETYPE.REQUESTMACROPLAY, payload: name});
            return;
        }
        let wasMacroMode = SoundBoard.macroMode;
        if (wasMacroMode) {
            SoundBoard.macroMode = false;
        }
        // V14: event may not be available in macro context; use keyboard API
        const kb = game?.keyboard;
        const shiftDown = kb?.downKeys?.has('ShiftLeft') || kb?.downKeys?.has('ShiftRight');
        if (shiftDown) {
            SoundBoard.cacheMode = true;
        }
        let sound;
        for (let key of Object.keys(SoundBoard.sounds)) {
            sound = SoundBoard.sounds[key].find((el) => {
                return el.name.toLowerCase() === name.toLowerCase();
            });
            if (sound) {
                break;
            }
        }
        if (!sound) {
            for (let key of Object.keys(SoundBoard.bundledSounds)) {
                sound = SoundBoard.bundledSounds[key].find((el) => {
                    return el.name.toLowerCase() === name.toLowerCase();
                });
                if (sound) {
                    break;
                }
            }
        }
        if (sound) {
            SoundBoard.playSound(sound.identifyingPath, push);
        }
        if (shiftDown) {
            SoundBoard.cacheMode = false;
        }
        SoundBoard.macroMode = wasMacroMode;
    }

    static _formatName(name, shouldStripFileName = true) {
        if (shouldStripFileName) {
            if (name.indexOf('.') > -1 && name.indexOf('.') < name.length) {
                name = name.substr(0, name.lastIndexOf('.'));
            }
        }
        name = decodeURIComponent(name);
        name = name.replace(/_(?! )|-(?! )/g, ' ');
        name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
        name = name.replace(/([a-zA-Z])([0-9])/g, '$1 $2');
        name = name.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        return name;
    }

    static async previewSound(identifyingPath) {
        SoundBoard.playSound(identifyingPath, false);
    }

    // V14: html parameter may be an HTMLElement or the app element; using native DOM
    static async targetPlayer(element, id) {
        const el = element instanceof HTMLElement ? element : element[0];
        el.classList.add('active');
        el.parentElement?.querySelectorAll(':not([data-player-id="' + (id || '') + '"])').forEach(sib => {
            if (sib !== el) sib.classList.remove('active');
        });
        // Simpler: just toggle siblings via the app element
        const appEl = document.getElementById('soundboard-app');
        if (appEl) {
            appEl.querySelectorAll('[data-player-id]').forEach(btn => btn.classList.remove('active'));
            el.classList.add('active');
        }
        if (!id) {
            appEl?.querySelector('#granular-send')?.classList.remove('active');
            SoundBoard.targetedPlayerID = undefined;
        } else {
            appEl?.querySelector('#granular-send')?.classList.add('active');
            SoundBoard.targetedPlayerID = id;
        }
    }

    static toggleCacheMode(appEl) {
        const el = appEl instanceof HTMLElement ? appEl : (appEl[0] ?? document.getElementById('soundboard-app'));
        SoundBoard.cacheMode = !SoundBoard.cacheMode;
        const cacheBtn = el.querySelector('#cache-sounds');
        const macroBtn = el.querySelector('#macro-mode');
        if (SoundBoard.cacheMode) {
            cacheBtn?.classList.add('active');
            macroBtn?.classList.remove('active');
            SoundBoard.macroMode = false;
        } else {
            cacheBtn?.classList.remove('active');
        }
    }

    static toggleMacroMode(appEl) {
        const el = appEl instanceof HTMLElement ? appEl : (appEl[0] ?? document.getElementById('soundboard-app'));
        SoundBoard.macroMode = !SoundBoard.macroMode;
        const macroBtn = el.querySelector('#macro-mode');
        const cacheBtn = el.querySelector('#cache-sounds');
        if (SoundBoard.macroMode) {
            macroBtn?.classList.add('active');
            cacheBtn?.classList.remove('active');
            SoundBoard.cacheMode = false;
        } else {
            macroBtn?.classList.remove('active');
        }
    }

    static toggleVolumeMode(appEl) {
        const el = appEl instanceof HTMLElement ? appEl : (appEl[0] ?? document.getElementById('soundboard-app'));
        SoundBoard.volumeMode = !SoundBoard.volumeMode;
        // Salva o estado no setting client-side
        SoundBoard.setUserSetting('volumeToggle', SoundBoard.volumeMode);
        const volBtn = el.querySelector('#volume-mode');
        if (SoundBoard.volumeMode) {
            volBtn?.classList.add('active');
            document.querySelectorAll('.sb-individual-volume').forEach(v => v.style.display = '');
        } else {
            volBtn?.classList.remove('active');
            document.querySelectorAll('.sb-individual-volume').forEach(v => v.style.display = 'none');
        }
    }
    // Chamar isso ao abrir o app para restaurar o estado salvo
    static restoreVolumeToggle(appEl) {
        const el = appEl instanceof HTMLElement ? appEl : (appEl[0] ?? document.getElementById('soundboard-app'));
        SoundBoard.volumeMode = SoundBoard.getUserSetting('volumeToggle');
        const volBtn = el.querySelector('#volume-mode');
        if (SoundBoard.volumeMode) {
            volBtn?.classList.add('active');
            document.querySelectorAll('.sb-individual-volume').forEach(v => v.style.display = '');
        } else {
            volBtn?.classList.remove('active');
            document.querySelectorAll('.sb-individual-volume').forEach(v => v.style.display = 'none');
        }
    }

    static promptDeleteMacros() {
        // V14: use DialogV2 instead of removed Dialog V1
        foundry.applications.api.DialogV2.confirm({
            window: { title: 'Delete SoundBoard Macros' },
            content: '<h1>Delete SoundBoard Macros?</h1><p>Note, this will break any SoundBoard macro journal links.</p>',
            yes: {
                label: 'Ok',
                callback: () => { SBMacroHelper.deleteAllMacros(); }
            },
            no: { label: 'Cancel' }
        });
    }

    static getSoundFromIdentifyingPath(identifyingPath) {
        var sound;
        Object.keys(SoundBoard.sounds).forEach((key) => {
            if (sound) return;
            sound = SoundBoard.sounds[key].find((element) => {
                return element.identifyingPath === identifyingPath;
            });
        });
        Object.keys(SoundBoard.bundledSounds).forEach((key) => {
            if (sound) return;
            sound = SoundBoard.bundledSounds[key].find((element) => {
                return element.identifyingPath === identifyingPath;
            });
        });
        if (sound) {
            sound.identifyingPath = identifyingPath;
            // Aplicar configuração de loop salva (se houver)
            let loopSettings = game.settings?.get?.('Soundboard-by-Jack', 'soundboardIndividualLoopSettings') || {};
            if (loopSettings[identifyingPath]) {
                sound.loopMode = loopSettings[identifyingPath].mode;
                sound.loopDelayMin = loopSettings[identifyingPath].min;
                sound.loopDelayMax = loopSettings[identifyingPath].max;
            }
        }
        return sound;
    }

    static updateAllSounds(property, value) {
        Object.keys(SoundBoard.sounds).forEach((key) => {
            SoundBoard.sounds[key].forEach((o, i, a) => { a[i][property] = value; });
        });
        Object.keys(SoundBoard.bundledSounds).forEach((key) => {
            SoundBoard.bundledSounds[key].forEach((o, i, a) => { a[i][property] = value; });
        });
    }

    static favoriteSound(identifyingPath) {
        let favoriteArray = game.settings.get('Soundboard-by-Jack', 'favoritedSounds');
        if (favoriteArray.includes(identifyingPath)) return;
        favoriteArray.push(identifyingPath);
        game.settings.set('Soundboard-by-Jack', 'favoritedSounds', favoriteArray);
        SoundBoard.getSoundFromIdentifyingPath(identifyingPath).isFavorite = true;
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`).forEach(btn => btn.classList.add('favorited'));
    }

    static unfavoriteSound(identifyingPath) {
        let favoriteArray = game.settings.get('Soundboard-by-Jack', 'favoritedSounds');
        if (!favoriteArray.includes(identifyingPath)) return;
        favoriteArray.splice(favoriteArray.findIndex((element) => element === identifyingPath), 1);
        game.settings.set('Soundboard-by-Jack', 'favoritedSounds', favoriteArray);
        SoundBoard.getSoundFromIdentifyingPath(identifyingPath).isFavorite = false;
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`).forEach(btn => btn.classList.remove('favorited'));
    }

    static startLoop(identifyingPath, loopMode = 'simple', delayMin = 0, delayMax = 0) {
        let sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        if (sound.loop) return;
        sound.loop = true;
        sound.loopMode = loopMode;
        sound.loopDelayMin = Number(delayMin) || 0;
        sound.loopDelayMax = Number(delayMax) || 0;
        sound.loopDelay = 0;
        SoundBoard.playSound(identifyingPath);
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`).forEach(btn => btn.classList.add('loop-active'));
    }

    static stopLoop(identifyingPath) {
        const sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        sound.loop = false;
        // Cancela loop de jogador se existir
        if (SoundBoard.playerLoopSounds?.[identifyingPath]) {
            delete SoundBoard.playerLoopSounds[identifyingPath];
        }
        // Para o áudio imediatamente e notifica os outros clientes
        SoundBoard.audioHelper.stop(sound);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.STOP,
            payload: sound
        });
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`).forEach(btn => btn.classList.remove('loop-active'));
    }

    static setLoopDelay(identifyingPath, delayInSeconds, button) {
        // Legacy shim kept for any existing calls
        SoundBoard.setLoopMode(identifyingPath, 'fixed', delayInSeconds, delayInSeconds);
    }

    static setLoopMode(identifyingPath, mode, delayMin, delayMax) {
        const sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        // Salvar configuração individual
        let loopSettings = game.settings.get('Soundboard-by-Jack', 'soundboardIndividualLoopSettings') || {};
        if (mode === 'off') {
            if (sound.loop) SoundBoard.stopLoop(identifyingPath);
            // Remove configuração salva se existir
            if (loopSettings[identifyingPath]) {
                delete loopSettings[identifyingPath];
                game.settings.set('Soundboard-by-Jack', 'soundboardIndividualLoopSettings', loopSettings);
            }
            return;
        }
        const min = Math.max(0, Math.min(3600, Number(delayMin) || 0));
        const max = Math.max(min, Math.min(3600, Number(delayMax) || min));
        // Salva as opções
        loopSettings[identifyingPath] = { mode, min, max };
        game.settings.set('Soundboard-by-Jack', 'soundboardIndividualLoopSettings', loopSettings);
        if (sound.loop) {
            // Update in-place without restarting
            sound.loopMode = mode;
            sound.loopDelayMin = min;
            sound.loopDelayMax = max;
            sound.loopDelay = (mode === 'fixed') ? min : 0;
        } else {
            SoundBoard.startLoop(identifyingPath, mode, min, max);
        }
    }

    static stopSound(identifyingPath) {
        let sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
        // Garante que o loop é cancelado antes de parar o áudio
        sound.loop = false;
        // Limpa loop de jogador se existir
        if (SoundBoard.playerLoopSounds?.[identifyingPath]) {
            delete SoundBoard.playerLoopSounds[identifyingPath];
        }
        SoundBoard.audioHelper.stop(sound);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.STOP,
            payload: sound
        });
        SoundBoard.currentlyPlayingSounds = SoundBoard.currentlyPlayingSounds.filter(s => s && s.identifyingPath !== identifyingPath);
        SoundBoard._updatePlayingIndicator(identifyingPath, false);
        // Remove indicador de loop-active
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`).forEach(btn => btn.classList.remove('loop-active'));
    }

    static stopAllSounds() {
        // Mark all sounds as not looping BEFORE calling stopAll,
        // so the 'stop' event handler in audioHelper sees loop=false
        // and doesn't try to trigger another cycle.
        SoundBoard.updateAllSounds('loop', false);
        SoundBoard.updateAllSounds('loopMode', 'off');
        SoundBoard.audioHelper.stopAll();
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.STOPALL
        });
        document.querySelectorAll('#soundboard-app .btn').forEach(btn => btn.classList.remove('loop-active'));
        // Limpar todos os indicadores visuais de "tocando"
        SoundBoard._updatePlayingIndicator(null, false);
        SoundBoard.currentlyPlayingSounds = [];
        // Limpar badges de sons de jogadores e loops
        SoundBoard.playerActiveSounds = {};
        SoundBoard.playerLoopSounds = {};
        SoundBoard._updatePlayerSoundIndicator();
    }


    /**
     * Atualiza o indicador visual de "tocando" (classe sb-playing) no botão do som.
     * @param {string|null} identifyingPath — path do som, ou null para limpar todos
     * @param {boolean} playing
     */
    static _updatePlayingIndicator(identifyingPath, playing) {
        if (identifyingPath === null) {
            document.querySelectorAll('#soundboard-app .btn[uuid].sb-playing')
                .forEach(el => el.classList.remove('sb-playing'));
            return;
        }
        document.querySelectorAll(`#soundboard-app .btn[uuid="${CSS.escape(identifyingPath)}"]`)
            .forEach(el => el.classList.toggle('sb-playing', playing));
    }

    static clearStoppedSounds() {
        SoundBoard.currentlyPlayingSounds = SoundBoard.currentlyPlayingSounds.filter(function (sound) {
            return sound.playing();
        });
    }

    static async _getBundledSounds(forceRefresh = false) {
        // Não usa mais settings/localStorage para BundledSounds
        const favoritesArray = game.settings.get('Soundboard-by-Jack', 'favoritedSounds');
        SoundBoard.bundledSounds = {};

        for (const pack of this.packageManager.soundPacks) {
            if (pack.disabled) continue;

            if (typeof (ForgeVTT) !== 'undefined' && ForgeVTT.usingTheForge) {
                const soundboardDirArray = await FilePicker.browse('data', pack.dir, {recursive: true});
                const subDirs = soundboardDirArray.dirs.map((dir) => {
                    let subDir = dir.replace(pack.dir, '');
                    if (subDir[0] !== '/') subDir = `/${subDir}`;
                    return subDir;
                });

                let dirShortName;
                for (const [index, dir] of subDirs.entries()) {
                    const slashCount = (dir.match(/\//g) || []).length;
                    const actualDir = soundboardDirArray.dirs[index];
                    if (slashCount === 1) {
                        dirShortName = this._formatName(`${pack.name} - ${actualDir.split(/[/]+/).pop()}`, false);
                        SoundBoard.bundledSounds[dirShortName] = [];
                        for (const file of soundboardDirArray.files) {
                            if (file.includes(dir.replaceAll(' ', '%20'))) {
                                switch (file.substring(file.length - 4)) {
                                    case '.ogg':
                                    case '.oga':
                                    case '.mp3':
                                    case '.wav':
                                    case 'flac': {
                                        const dirSpaceReplace = dir.replaceAll(' ', '%20');
                                        if (file.includes(dirSpaceReplace) &&
                                            file.substring(file.lastIndexOf(dirSpaceReplace) + dirSpaceReplace.length).match(/\//g).length < 2) {
                                            SoundBoard.bundledSounds[dirShortName].push({
                                                name: this._formatName(file.split(/[/]+/).pop()),
                                                src: [file],
                                                identifyingPath: file,
                                                isWild: false,
                                                isFavorite: favoritesArray.includes(file)
                                            });
                                        }
                                        break;
                                    }
                                    default:
                                        SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                        break;
                                }
                            }
                        }
                    } else if (slashCount === 2) {
                        const wildcardFileArray = soundboardDirArray.files.filter(function (file) {
                            switch (file.substring(file.length - 4)) {
                                case '.ogg':
                                case '.oga':
                                case '.mp3':
                                case '.wav':
                                case 'flac':
                                    return file.includes(dir.replaceAll(' ', '%20'));
                                default:
                                    SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                    return false;
                            }
                        });
                        SoundBoard.bundledSounds[dirShortName].push({
                            name: this._formatName(actualDir.split(/[/]+/).pop(), false),
                            src: wildcardFileArray,
                            identifyingPath: actualDir,
                            isWild: true,
                            isFavorite: favoritesArray.includes(actualDir)
                        });
                    } else {
                        console.error('Forge SoundBoard parsing could not parse dir ' + dir + ', does not match expected format.');
                    }
                }
            } else {
                let soundboardDirArray = await FilePicker.browse('data', pack.dir);
                for (const dir of soundboardDirArray.dirs) {
                    const dirShortName = this._formatName(`${pack.name} - ${dir.split(/[/]+/).pop()}`, false);
                    SoundBoard.bundledSounds[dirShortName] = [];
                    let innerDirArray = await FilePicker.browse('data', dir);
                    for (const wildcardDir of innerDirArray.dirs) {
                        let wildcardFileArray = await FilePicker.browse('data', wildcardDir);
                        wildcardFileArray = wildcardFileArray.files;
                        wildcardFileArray = wildcardFileArray.filter(function (file) {
                            switch (file.substring(file.length - 4)) {
                                case '.ogg':
                                case '.oga':
                                case '.mp3':
                                case '.webm':
                                case '.opus':
                                case '.wav':
                                case 'flac':
                                    return true;
                                default:
                                    SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                    return false;
                            }
                        });
                        SoundBoard.bundledSounds[dirShortName].push({
                            name: this._formatName(wildcardDir.split(/[/]+/).pop(), false),
                            src: wildcardFileArray,
                            identifyingPath: wildcardDir,
                            isWild: true,
                            isFavorite: favoritesArray.includes(wildcardDir)
                        });
                    }
                    for (const file of innerDirArray.files) {
                        switch (file.substring(file.length - 4)) {
                            case '.ogg':
                            case '.oga':
                            case '.mp3':
                            case '.webm':
                            case '.opus':
                            case '.wav':
                            case 'flac':
                                SoundBoard.bundledSounds[dirShortName].push({
                                    name: this._formatName(file.split(/[/]+/).pop()),
                                    src: [file],
                                    identifyingPath: file,
                                    isWild: false,
                                    isFavorite: favoritesArray.includes(file)
                                });
                                break;
                            default:
                                SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                break;
                        }
                    }
                }
            }
        }
        // Não salva mais BundledSounds em settings
        SoundBoard.soundsLoaded = true;
        if (!forceRefresh) {
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.soundsDiscovered'));
        }
    }

    static getDirectoryForCurrentUser() {
        if (game.user.isGM) {
            // GM always uses the world setting
            return game.settings.get('Soundboard-by-Jack', 'soundboardDirectory');
        } else {
            // Player: só pode usar o diretório definido pelo GM para ele, ou o padrão do GM
            const playerDirs = game.settings.get('Soundboard-by-Jack', 'soundboardPlayerDirectories') || {};
            if (playerDirs[game.user.id] && playerDirs[game.user.id].trim()) {
                return playerDirs[game.user.id].trim();
            }
            // Fallback para o padrão do GM
            const gmDefault = game.settings.get('Soundboard-by-Jack', 'soundboardDirectory');
            return gmDefault || 'modules/Soundboard-by-Jack/exampleAudio';
        }
    }

    static async getSounds(forceRefresh = false) {
        // Não usa mais settings/localStorage para UserSounds
        const favoritesArray = game.settings.get('Soundboard-by-Jack', 'favoritedSounds');
        const source = game.settings.get('Soundboard-by-Jack', 'source');

        // Get the correct directory for current user
        let soundboardDir = SoundBoard.getDirectoryForCurrentUser();
        console.log('SoundBoard: Usando diretório', soundboardDir);

        SoundBoard.soundsError = false;
        SoundBoard.soundsLoaded = false;

        try {
            // Validate directory is not empty or whitespace
            if (!soundboardDir || !soundboardDir.trim()) {
                throw new Error('SoundBoard directory is empty or invalid. Please configure in Module Settings.');
            }

            soundboardDir = soundboardDir.trim();
            SoundBoard.sounds = {};

            if (typeof (ForgeVTT) !== 'undefined' && ForgeVTT.usingTheForge) {
                const soundboardDirArray = await FilePicker.browse(source, soundboardDir, {recursive: true});

                if (soundboardDirArray.target !== soundboardDir.replace(' ', '%20')) {
                    throw 'Filepicker target did not match input. Parent directory may be correct. Soft failure.';
                }

                const subDirs = soundboardDirArray.dirs.map((dir) => {
                    let subDir = dir.replace(soundboardDir, '');
                    if (subDir[0] !== '/') subDir = `/${subDir}`;
                    return subDir;
                });

                let dirShortName;
                for (const [index, dir] of subDirs.entries()) {
                    const slashCount = (dir.match(/\//g) || []).length;
                    const actualDir = soundboardDirArray.dirs[index];
                    if (slashCount === 1) {
                        dirShortName = this._formatName(actualDir.split(/[/]+/).pop(), false);
                        SoundBoard.sounds[dirShortName] = [];
                        for (const file of soundboardDirArray.files) {
                            if (file.includes(dir.replaceAll(' ', '%20'))) {
                                switch (file.substring(file.length - 4)) {
                                    case '.ogg':
                                    case '.oga':
                                    case '.mp3':
                                    case '.wav':
                                    case 'flac': {
                                        const dirSpaceReplace = dir.replaceAll(' ', '%20');
                                        if (file.includes(dirSpaceReplace) &&
                                            file.substring(file.lastIndexOf(dirSpaceReplace) + dirSpaceReplace.length).match(/\//g).length < 2) {
                                            SoundBoard.sounds[dirShortName].push({
                                                name: this._formatName(file.split(/[/]+/).pop()),
                                                src: [file],
                                                identifyingPath: file,
                                                isWild: false,
                                                isFavorite: favoritesArray.includes(file)
                                            });
                                        }
                                        break;
                                    }
                                    default:
                                        SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                        break;
                                }
                            }
                        }
                    } else if (slashCount === 2) {
                        const wildcardFileArray = soundboardDirArray.files.filter(function (file) {
                            switch (file.substring(file.length - 4)) {
                                case '.ogg':
                                case '.oga':
                                case '.mp3':
                                case '.wav':
                                case 'flac':
                                    return file.includes(dir.replaceAll(' ', '%20'));
                                default:
                                    SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                    return false;
                            }
                        });
                        SoundBoard.sounds[dirShortName].push({
                            name: this._formatName(actualDir.split(/[/]+/).pop(), false),
                            src: wildcardFileArray,
                            identifyingPath: actualDir,
                            isWild: true,
                            isFavorite: favoritesArray.includes(actualDir)
                        });
                    } else {
                        console.error('Forge SoundBoard parsing could not parse dir ' + dir + ', does not match expected format.');
                    }
                }

                // Não salva mais UserSounds em settings
            } else {
                let bucket;
                if (source === 's3') {
                    const bucketContainer = await FilePicker.browse(source, soundboardDir);
                    bucket = bucketContainer.dirs[0];
                }
                const soundboardDirArray = await FilePicker.browse(source, soundboardDir, {
                    ...(bucket && { bucket })
                });
                if (soundboardDirArray.target !== soundboardDir.replace(' ', '%20')) {
                    throw 'Filepicker target did not match input. Parent directory may be correct. Soft failure.';
                }

                for (const dir of soundboardDirArray.dirs) {
                    const dirShortName = this._formatName(dir.split(/[/]+/).pop(), false);
                    SoundBoard.sounds[dirShortName] = [];
                    let innerDirArray = await FilePicker.browse(source, dir, {
                        ...(bucket && { bucket })
                    });
                    for (const wildcardDir of innerDirArray.dirs) {
                        let wildcardFileArray = await FilePicker.browse(source, wildcardDir, {
                            ...(bucket && { bucket })
                        });
                        wildcardFileArray = wildcardFileArray.files;
                        wildcardFileArray = wildcardFileArray.filter(function (file) {
                            switch (file.substring(file.length - 4)) {
                                case '.ogg':
                                case '.oga':
                                case '.mp3':
                                case '.wav':
                                case 'flac':
                                    return true;
                                default:
                                    SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                    return false;
                            }
                        });
                        SoundBoard.sounds[dirShortName].push({
                            name: this._formatName(wildcardDir.split(/[/]+/).pop(), false),
                            src: wildcardFileArray,
                            identifyingPath: wildcardDir,
                            isWild: true,
                            isFavorite: favoritesArray.includes(wildcardDir)
                        });
                    }
                    for (const file of innerDirArray.files) {
                        switch (file.substring(file.length - 4)) {
                            case '.ogg':
                            case '.oga':
                            case '.mp3':
                            case '.wav':
                            case 'flac':
                                SoundBoard.sounds[dirShortName].push({
                                    name: this._formatName(file.split(/[/]+/).pop()),
                                    src: [file],
                                    identifyingPath: file,
                                    isWild: false,
                                    isFavorite: favoritesArray.includes(file)
                                });
                                break;
                            default:
                                SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                                break;
                        }
                    }
                }
            }
            // Não salva mais UserSounds em settings
        } catch (error) {
            SoundBoard.soundsError = true;
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            SoundBoard.log(`Error loading sounds from directory "${soundboardDir}": ${errorMsg}`, SoundBoard.LOGTYPE.ERR);
            
            // Check if it's a directory issue
            if (errorMsg.includes('empty or invalid') || errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                if (!soundboardDir || !soundboardDir.trim()) {
                    ui.notifications.error('SoundBoard: No directory configured. Please set it in Module Settings.');
                } else {
                    ui.notifications.error(`SoundBoard directory not found: "${soundboardDir}". Please check your Module Settings.`);
                }
            } else {
                ui.notifications.error(game.i18n.localize('SOUNDBOARD.notif.soundsError'));
            }
        } finally {
            await SoundBoard._getBundledSounds(forceRefresh);
            // soundsLoaded is set to true by _getBundledSounds()
        }
    }

    static async refreshSounds({notify, bringToTop} = {notify: true, bringToTop: true}) {
        if (game.user.isGM) {
            if (notify) {
                ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.refreshing'));
            }
            SoundBoard.stopAllSounds();
            SoundBoard.soundsError = false;
            await SoundBoard.getSounds(true);
            if (SoundBoard.openedBoard?.rendered) {
                SoundBoard.openedBoard.render();
                if (bringToTop) {
                    SoundBoard.openedBoard.bringToTop();
                }
            }
            if (notify) {
                ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.refreshComplete'));
            }
        }
    }

    // ---- Soundscape ----

    static saveSoundscape(name) {
        const active = [];
        const allSounds = {...SoundBoard.sounds, ...SoundBoard.bundledSounds};
        Object.values(allSounds).forEach(arr => arr.forEach(s => {
            if (s.loop) active.push({
                identifyingPath: s.identifyingPath,
                loopMode:     s.loopMode     || 'fixed',
                loopDelayMin: s.loopDelayMin || 0,
                loopDelayMax: s.loopDelayMax || 0
            });
        }));
        if (active.length === 0) {
            ui.notifications.warn('No looping sounds to save as soundscape.');
            return;
        }
        const saved = game.settings.get('Soundboard-by-Jack', 'savedSoundscapes') || {};
        saved[name] = active;
        game.settings.set('Soundboard-by-Jack', 'savedSoundscapes', saved);
        ui.notifications.notify(`Soundscape "${name}" saved (${active.length} sounds).`);
    }

    static loadSoundscape(name) {
        const saved = game.settings.get('Soundboard-by-Jack', 'savedSoundscapes') || {};
        const scape = saved[name];
        if (!scape) { ui.notifications.warn(`Soundscape "${name}" not found.`); return; }
        scape.forEach(entry => {
            SoundBoard.startLoop(entry.identifyingPath, entry.loopMode, entry.loopDelayMin, entry.loopDelayMax);
        });
        ui.notifications.notify(`Soundscape "${name}" loaded.`);
    }

    static deleteSoundscape(name) {
        const saved = game.settings.get('Soundboard-by-Jack', 'savedSoundscapes') || {};
        delete saved[name];
        game.settings.set('Soundboard-by-Jack', 'savedSoundscapes', saved);
    }

    static soundscapeToMacro(name) {
        const saved = game.settings.get('Soundboard-by-Jack', 'savedSoundscapes') || {};
        const scape = saved[name];
        if (!scape) { ui.notifications.warn(`Soundscape "${name}" not found.`); return; }
        const lines = scape.map(e =>
            `SoundBoard.startLoop("${e.identifyingPath}", "${e.loopMode}", ${e.loopDelayMin}, ${e.loopDelayMax});`
        );
        const command = lines.join('\n');
        Macro.create({ name: `Soundscape - ${name}`, type: 'script', command,
            img: 'modules/Soundboard-by-Jack/bundledDocs/sbmacro.png' })
            .then(m => ui.notifications.notify(`Macro "Soundscape - ${name}" created.`));
    }

    static openSoundscapeManager() {
        const saved = game.settings.get('Soundboard-by-Jack', 'savedSoundscapes') || {};
        const names = Object.keys(saved);

        const rows = names.length
            ? names.map(n => `<div class="sb-scape-row" data-name="${n}" style="display:flex;gap:6px;align-items:center;margin:4px 0;padding:4px 0;border-bottom:1px solid #333;">
                <span style="flex:1;font-weight:600;">${n}</span>
                <button type="button" class="sb-scape-load" data-name="${n}" style="font-size:11px;padding:2px 8px;">▶ Load</button>
                <button type="button" class="sb-scape-macro" data-name="${n}" style="font-size:11px;padding:2px 8px;">⚙ Macro</button>
                <button type="button" class="sb-scape-del" data-name="${n}" style="font-size:11px;padding:2px 8px;color:#e84030;background:none;border:1px solid #e84030;">✕</button>
            </div>`).join('')
            : '<p style="color:#888;font-size:12px;">No soundscapes saved yet.</p>';

        foundry.applications.api.DialogV2.wait({
            window: { title: '🎼 Soundscape Manager', id: 'sb-soundscape-manager' },
            content: `<div style="padding:8px;">
                <p style="margin-bottom:8px;font-size:12px;">Captures all currently looping sounds with their delay settings.</p>
                <div style="display:flex;gap:6px;margin-bottom:12px;">
                    <input id="sb-scape-name" type="text" placeholder="Soundscape name..."
                           style="flex:1;padding:4px 8px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#fff;">
                    <button type="button" id="sb-scape-save-btn"
                            style="padding:4px 12px;background:#01701c;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">
                        💾 Save current
                    </button>
                </div>
                <hr style="margin:8px 0;border-color:#444;">
                <div id="sb-scape-list">${rows}</div>
            </div>`,
            buttons: [{ action: 'close', label: 'Close', callback: () => null }],
            render: (_event, dialog) => {
                const el = dialog.element;

                // Save button
                el.querySelector('#sb-scape-save-btn')?.addEventListener('click', () => {
                    const name = el.querySelector('#sb-scape-name')?.value.trim();
                    if (!name) return;
                    SoundBoard.saveSoundscape(name);
                    // Reopen to refresh list
                    dialog.close();
                    setTimeout(() => SoundBoard.openSoundscapeManager(), 100);
                });

                // Load buttons
                el.querySelectorAll('.sb-scape-load').forEach(btn => {
                    btn.addEventListener('click', () => {
                        SoundBoard.loadSoundscape(btn.dataset.name);
                        dialog.close();
                    });
                });

                // Macro buttons
                el.querySelectorAll('.sb-scape-macro').forEach(btn => {
                    btn.addEventListener('click', () => {
                        SoundBoard.soundscapeToMacro(btn.dataset.name);
                    });
                });

                // Delete buttons
                el.querySelectorAll('.sb-scape-del').forEach(btn => {
                    btn.addEventListener('click', () => {
                        SoundBoard.deleteSoundscape(btn.dataset.name);
                        btn.closest('.sb-scape-row')?.remove();
                        const list = el.querySelector('#sb-scape-list');
                        if (list && !list.querySelector('.sb-scape-row')) {
                            list.innerHTML = '<p style="color:#888;font-size:12px;">No soundscapes saved yet.</p>';
                        }
                    });
                });
            }
        });
    }

    static _applySimpleLoop(identifyingPath, btnEl) {
        SoundBoard.setLoopMode(identifyingPath, 'simple', 0, 0);
        SoundBoardApplication.toggleExtendedOptions(btnEl);
    }

    static _applyFixedLoop(identifyingPath, btnEl) {
        const safeId = identifyingPath.replace(/[^a-z0-9]/gi, '_');
        const input = document.getElementById(`sb-fixed-delay-${safeId}`);
        const delay = input ? parseFloat(input.value) || 3 : 3;
        // Sempre salva min = max = delay
        SoundBoard.setLoopMode(identifyingPath, 'fixed', delay, delay);
        SoundBoardApplication.toggleExtendedOptions(btnEl);
    }

    static _applyRandomLoop(identifyingPath, btnEl) {
        const safeId = identifyingPath.replace(/[^a-z0-9]/gi, '_');
        const minInput = document.getElementById(`sb-rand-min-${safeId}`);
        const maxInput = document.getElementById(`sb-rand-max-${safeId}`);
        const min = minInput ? parseFloat(minInput.value) || 3 : 3;
        const max = maxInput ? parseFloat(maxInput.value) || min : min;
        // Salva min e max conforme preenchido
        SoundBoard.setLoopMode(identifyingPath, 'random', min, max);
        SoundBoardApplication.toggleExtendedOptions(btnEl);
    }

    // (player soundboard removed)



    // ---------------------------------------------------------------
    // GM STOP PLAYER SOUNDS
    // ---------------------------------------------------------------

    /** Mapa de sons ativos de jogadores: { playerId: {src, identifyingPath, playerName} } */
    static playerActiveSounds = {};

    /**
     * Para todos os sons tocados por um jogador específico.
     * Chamado pelo GM ao clicar no badge de jogador ativo.
     */
    static stopPlayerSound(playerId) {
        const entry = SoundBoard.playerActiveSounds?.[playerId];
        if (!entry) return;

        // Envia STOP para todos os clientes (mesmo caminho do stopSound normal)
        const fakeSound = { src: [entry.src], identifyingPath: entry.identifyingPath };
        SoundBoard.audioHelper.stop(fakeSound);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.STOP,
            payload: fakeSound
        });

        delete SoundBoard.playerActiveSounds[playerId];
        SoundBoard._updatePlayerSoundIndicator();
    }

    /**
     * Atualiza o badge de "jogador tocando som" na UI do GM.
     */
    static _updatePlayerSoundIndicator() {
        const bar = document.getElementById('sb-player-sounds-bar');
        if (!bar || !game.user.isGM) return;

        const active = SoundBoard.playerActiveSounds || {};
        const entries = Object.entries(active);

        if (entries.length === 0) {
            bar.style.display = 'none';
            bar.innerHTML = '';
            return;
        }

        bar.style.display = 'flex';
        bar.innerHTML = entries.map(([pid, entry]) => {
            // isLooping: badge verde pulsante; som normal: badge azul
            const isLooping = entry.isLooping || !!SoundBoard.playerLoopSounds?.[entry.identifyingPath];
            const cls = isLooping ? 'sb-player-badge sb-player-badge--loop' : 'sb-player-badge';
            const icon = isLooping ? 'fa-redo' : 'fa-volume-up';
            return `<span class="${cls}" onclick="SoundBoard.stopPlayerSound('${pid}')" title="Parar sons de ${entry.playerName}">` +
                   `<i class="fas ${icon}"></i> ${entry.playerName} <i class="fas fa-stop"></i></span>`;
        }).join('');
    }

    static _registerSettings() {
                        // Preferências do usuário (client)
                        game.settings.register('Soundboard-by-Jack', 'nameTruncation', {
                            name: 'Truncar nomes dos botões',
                            hint: 'Ativa/desativa truncamento de nomes dos botões de som.',
                            scope: 'client',
                            config: false,
                            type: Boolean,
                            default: true
                        });
                        game.settings.register('Soundboard-by-Jack', 'buttonFontSize', {
                            name: 'Tamanho da fonte dos botões',
                            hint: 'Define o tamanho da fonte dos botões do SoundBoard.',
                            scope: 'client',
                            config: false,
                            type: Number,
                            default: 1.0
                        });
                        game.settings.register('Soundboard-by-Jack', 'volumeToggle', {
                            name: 'Mostrar/ocultar controles de volume',
                            hint: 'Ativa/desativa o botão de volume rápido.',
                            scope: 'client',
                            config: false,
                            type: Boolean,
                            default: true
                        });
                        game.settings.register('Soundboard-by-Jack', 'moduleGeneralVolume', {
                            name: 'Volume geral do módulo SoundBoard',
                            hint: 'Volume principal do SoundBoard (não afeta o volume global do Foundry).',
                            scope: 'client',
                            config: false,
                            type: Number,
                            default: 90
                        });
                game.settings.register('Soundboard-by-Jack', 'soundboardIndividualLoopSettings', {
                    name: 'Loop/Repeat por Som',
                    hint: 'Salva as opções de repeat/loop para cada som individualmente.',
                    scope: 'world',
                    config: false,
                    restricted: true,
                    type: Object,
                    default: {}
                });
        game.settings.registerMenu('Soundboard-by-Jack', 'deleteMacrosMenu', {
            name: 'Delete All SoundBoard Macros',
            label: 'Delete Macros',
            hint: 'Remove all automatically generated SoundBoard macros from your Macro Directory.',
            icon: 'fas fa-bomb',
            type: SBDeleteMacrosMenu,
            restricted: true
        });

        // Menu para gerenciar diretórios dos players (apenas GM)
        game.settings.registerMenu('Soundboard-by-Jack', 'playerDirectoryManager', {
            name: 'Manage Player SoundBoard Directories',
            label: 'Player Directories',
            hint: 'Configure custom SoundBoard directories for each player.',
            icon: 'fas fa-folder-users',
            type: SBPlayerDirectoryManager,
            restricted: true
        });

        game.settings.register('Soundboard-by-Jack', 'soundboardDirectory', {
            name: 'Custom SoundBoard Directory (GM)',
            hint: 'This should point to a folder containing subfolders, each containing audio files. See modules/Soundboard-by-Jack/exampleAudio/ for an example',
            scope: 'world',
            config: true,
            restricted: true,
            default: 'modules/Soundboard-by-Jack/exampleAudio',
            type: String,
            filePicker: 'folder',
            onChange: value => {
                if (value.length <= 0) {
                    game.settings.set('Soundboard-by-Jack', 'soundboardDirectory', 'modules/Soundboard-by-Jack/exampleAudio');
                }
                // Força refresh para garantir persistência e recarregar sons
                window.location.reload();
            }
        });

        // Opção para permitir/desabilitar SoundBoard para players
        game.settings.register('Soundboard-by-Jack', 'allowPlayerSoundBoard', {
            name: 'Allow Player SoundBoard',
            hint: 'Permite que jogadores usem o SoundBoard. Se desativado, apenas o GM pode usar.',
            scope: 'world',
            config: true,
            restricted: true,
            default: true,
            type: Boolean
        });

        // WORLD-SCOPE mapping for GM to manage player directories
        game.settings.register('Soundboard-by-Jack', 'soundboardPlayerDirectories', {
            name: 'Player SoundBoard Directories',
            hint: 'Mapping of player IDs to their SoundBoard folders. Only editable via the Player Manager.',
            scope: 'world',
            config: false,
            restricted: true,
            default: {},
            type: Object
        });

        game.settings.register('Soundboard-by-Jack', 'source', {
            name: 'Source Type',
            hint: 'If your sounds are stored in your Forge Assets, select Forge. If they are stored in an S3 bucket, select S3. Otherwise, select Data',
            scope: 'world',
            config: true,
            restricted: true,
            type: String,
            choices: { 'data': 'Data', 'forgevtt': 'Forge', 's3': 'S3' },
            default: 'data',
            onChange: value => { if (SoundBoard.audioHelper) SoundBoard.getSounds(true); }
        });

        game.settings.register('Soundboard-by-Jack', 'opacity', {
            name: 'Defocus Opacity',
            hint: 'Set the opacity of the SoundBoard when you are not hovering over it. 1 to disable.',
            scope: 'world',
            config: true,
            restricted: true,
            type: Number,
            range: { min: 0.1, max: 1.0, step: 0.05 },
            default: 0.75,
            onChange: value => {
                const appEl = document.getElementById('soundboard-app');
                if (appEl) appEl.style.opacity = value;
            }
        });

        game.settings.register('Soundboard-by-Jack', 'detuneAmount', {
            name: 'Random Detune Amount',
            hint: 'Randomly detune a sound each time it plays. 0 to disable.',
            scope: 'world',
            config: true,
            restricted: true,
            type: Number,
            range: { min: 0, max: 100, step: 1 },
            default: 0
        });

        game.settings.register('Soundboard-by-Jack', 'buttonNameMaxChars', {
            name: 'Button Name Max Characters',
            hint: 'Maximum characters shown on sound buttons when name truncation is active. Range: 5-50.',
            scope: 'world',
            config: true,
            restricted: true,
            type: Number,
            range: { min: 5, max: 50, step: 1 },
            default: 15
        });

        game.settings.register('Soundboard-by-Jack', 'allowPlayersMacroRequest', {
            name: 'Players trigger SoundBoard macros',
            hint: 'Enable this to allow players to trigger a sound using a macro with SoundBoard.playSoundByName()',
            scope: 'world',
            config: true,
            restricted: true,
            type: Boolean,
            default: true
        });

        game.settings.register('Soundboard-by-Jack', 'forcePopoutCompat', {
            name: 'Force Popout Compatibility',
            hint: 'Enable this if you are having issues with the SoundBoard being cut off by the edge of the screen.',
            scope: 'world',
            config: true,
            restricted: true,
            type: Boolean,
            default: false,
            onChange: value => { window.location.reload(); }
        });

        // Hidden/internal settings (config: false)
        game.settings.register('Soundboard-by-Jack', 'disabledPacks', {
            scope: 'world', config: false, restricted: true, default: []
        });
        game.settings.register('Soundboard-by-Jack', 'soundboardServerVolume', {
            name: 'Server Volume', scope: 'world', config: false, restricted: true, type: Number, default: 100
        });
        game.settings.register('Soundboard-by-Jack', 'soundboardIndividualSoundVolumes', {
            name: 'Individual Sound Volumes', scope: 'world', config: false, restricted: true, type: Object, default: {}
        });
        game.settings.register('Soundboard-by-Jack', 'favoritedSounds', {
            name: 'Favorited Sounds', scope: 'world', config: false, restricted: true, default: []
        });
        game.settings.register('Soundboard-by-Jack', 'savedSoundscapes', {
            name: 'Saved Soundscapes', scope: 'world', config: false, restricted: true, type: Object, default: {}
        });
    }

    static async onReady() {
        SoundBoard.packageManager = new SBPackageManager();
        Hooks.callAll('SBPackageManagerReady');

        // Note: all game.settings.register() calls happen in init hook (_registerSettings)
        // onReady only loads sounds and sets up runtime state

        // V14: Hook into clientSettingChanged for globalInterfaceVolume
        Hooks.on('clientSettingChanged', (key, value) => {
            if (key === 'core.globalInterfaceVolume' && SoundBoard.audioHelper) {
                SoundBoard.audioHelper.onVolumeChange(game.settings.get('Soundboard-by-Jack', 'soundboardServerVolume') / 100);
            }
        });

        // Handlebars helpers needed by all users (player board uses them too)
        Handlebars.registerHelper(SoundBoard.handlebarsHelpers);

        // IMPORTANTE: inicializar helpers ANTES de qualquer operação que os use
        // (syncPlayerSoundsToAll precisa de socketHelper; play precisa de audioHelper)
        SoundBoard.socketHelper = new SBSocketHelper();
        SoundBoard.audioHelper = new SBAudioHelper();

        if (game.user.isGM) {
            SoundBoard.soundsError = false;
            await SoundBoard.getSounds();
            Handlebars.registerPartial('SoundBoardPackageCard', await foundry.applications.handlebars.getTemplate('modules/Soundboard-by-Jack/templates/partials/packagecard.hbs'));
            
            // Enviar lista de sons para cada jogador já conectado
            await SoundBoard.syncPlayerSoundsToAll();
        }
    }
    
    // Carregar sons de um diretório específico (sem alterar SoundBoard.sounds global).
    // Espelha a lógica do getSounds principal: browse não-recursivo, categoria por subdir.
    static async loadSoundsFromDirectory(directory, source) {
        const sounds = {};
        const VALID_EXTS = ['.ogg', '.oga', '.mp3', '.wav', '.webm', '.opus', 'flac'];
        const isValidAudio = (f) => VALID_EXTS.includes(f.substring(f.length - 4).toLowerCase());

        try {
            if (!directory || !directory.trim()) return sounds;
            const dir = directory.trim();
            const src = source || 'data';

            const topLevel = await FilePicker.browse(src, dir);
            console.log(`SoundBoard: loadSoundsFromDirectory "${dir}" → ${topLevel.dirs.length} categorias, ${topLevel.files.length} arquivos no topo`);

            for (const subDir of topLevel.dirs) {
                const categoryName = this._formatName(subDir.split(/[/]+/).pop(), false);
                sounds[categoryName] = [];

                const innerLevel = await FilePicker.browse(src, subDir);

                // Arquivos direto na categoria
                for (const file of innerLevel.files) {
                    if (isValidAudio(file)) {
                        sounds[categoryName].push({
                            name: this._formatName(file.split(/[/]+/).pop()),
                            src: [file],
                            identifyingPath: file,
                            isWild: false,
                            isFavorite: false
                        });
                    } else {
                        SoundBoard.log(`${file} ${game.i18n.localize('SOUNDBOARD.log.invalidSound')}`, SoundBoard.LOGTYPE.WARN);
                    }
                }

                // Subpastas wildcard (grupo de variações do mesmo som)
                for (const wildcardDir of innerLevel.dirs) {
                    const wildcardBrowse = await FilePicker.browse(src, wildcardDir);
                    const validFiles = wildcardBrowse.files.filter(isValidAudio);
                    if (validFiles.length > 0) {
                        sounds[categoryName].push({
                            name: this._formatName(wildcardDir.split(/[/]+/).pop(), false),
                            src: validFiles,
                            identifyingPath: wildcardDir,
                            isWild: true,
                            isFavorite: false
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('SoundBoard: Erro ao carregar sons de', directory, e);
        }
        return sounds;
    }
    
    // Enviar sons de cada jogador para ele mesmo
    // Sincronizar sons de um jogador específico (usado no ready e no userConnected)
    static async syncSoundsForPlayer(playerId) {
        if (!game.user.isGM) return;
        const player = game.users.get(playerId);
        if (!player || player.isGM) return;

        const playerDirs = game.settings.get('Soundboard-by-Jack', 'soundboardPlayerDirectories') || {};
        const source = game.settings.get('Soundboard-by-Jack', 'source') || 'data';
        const playerDir = playerDirs[playerId];

        let playerSounds;
        if (playerDir && playerDir.trim()) {
            console.log(`SoundBoard: Carregando sons de ${player.name} de "${playerDir}"`);
            playerSounds = await SoundBoard.loadSoundsFromDirectory(playerDir, source);
            const totalSounds = Object.values(playerSounds).reduce((n, arr) => n + arr.length, 0);
            if (totalSounds === 0) {
                console.warn(`SoundBoard: Diretório "${playerDir}" retornou 0 sons para ${player.name} — usando sons do GM como fallback.`);
                playerSounds = SoundBoard.sounds;
            }
        } else {
            // Sem diretório específico: usa os sons do GM como fallback
            console.log(`SoundBoard: Sem diretório para ${player.name} — enviando sons do GM.`);
            playerSounds = SoundBoard.sounds;
        }

        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.SYNC_PLAYER_SOUNDS,
            playerId,
            sounds: playerSounds
        });
    }

    // Enviar sons para todos os jogadores conectados
    static async syncPlayerSoundsToAll() {
        if (!game.user.isGM) return;
        for (const player of game.users.contents) {
            if (player.isGM) continue;
            await SoundBoard.syncSoundsForPlayer(player.id);
        }
        console.log('SoundBoard: Sincronização de sons de jogadores concluída');
    }

    static addSoundBoard(controls) {
        const soundControls = controls?.sounds;
        if (!soundControls) return;
        if (!soundControls.tools || typeof soundControls.tools !== 'object') soundControls.tools = {};
        soundControls.tools['Soundboard-by-Jack'] = {
            name: 'Soundboard-by-Jack',
            title: game.i18n.localize('SOUNDBOARD.button.openSoundboard'),
            icon: 'fas fa-border-all',
            visible: !!game.user?.isGM,
            button: true,
            order: 95,
            onChange: () => SoundBoard.openSoundBoard()
        };
    }

    static addCustomPlaylistElements(app, html) {
        if (!game.user.isGM) return;
        // V14: html may be HTMLElement (ApplicationV2) or jQuery (AppV1 sidebar)
        const el = html instanceof HTMLElement ? html : html[0];
        if (!el) return;
        if (app.options?.id === 'playlists' || app.id === 'playlists') {
            const btn = document.createElement('button');
            btn.innerHTML = `<i class='fas fa-border-all'></i> ${game.i18n.localize('SOUNDBOARD.button.openSoundboard')}`;
            btn.addEventListener('click', SoundBoard.openSoundBoard);
            const container = document.createElement('div');
            container.className = 'header-actions action-buttons flexrow';
            container.appendChild(btn);
            el.querySelector('.directory-header')?.appendChild(container);
        }
    }
}

// V14: settings must be registered in 'init', but getSounds needs 'ready'
// Split: register settings in init, load sounds in ready
Hooks.once('init', () => {
    // All settings registered here so Foundry maps them correctly
    // and shows Save Changes / requires reload prompts properly.
    SoundBoard._registerSettings();
});

Hooks.once('ready', SoundBoard.onReady);
Hooks.on('getSceneControlButtons', SoundBoard.addSoundBoard);
Hooks.on('renderSidebarTab', SoundBoard.addCustomPlaylistElements);
Hooks.on('renderPlaylistDirectory', SoundBoard.addCustomPlaylistElements);

// Hook: quando um jogador conecta, GM sincroniza os sons dele automaticamente
Hooks.on('userConnected', (user, connected) => {
    if (!game.user.isGM) return;
    if (!connected || user.isGM) return;
    // Aguarda 2s para garantir que o socket do jogador está pronto
    setTimeout(async () => {
        console.log(`SoundBoard: Jogador ${user.name} conectou — sincronizando sons.`);
        await SoundBoard.syncSoundsForPlayer(user.id);
    }, 2000);
});

// Esconder configurações do SoundBoard para jogadores não-GM
Hooks.on('renderSettingsConfig', (app, element) => {
    if (game.user.isGM) return;
    const el = element instanceof HTMLElement ? element : element[0];
    if (!el) return;

    // V14: procura seção/categoria do módulo e esconde tudo dela
    // Tenta por data-module, data-setting-id, e text content do cabeçalho
    const selectors = [
        '[data-setting-id^="Soundboard-by-Jack."]',
        '[data-key^="Soundboard-by-Jack."]',
        '[name^="Soundboard-by-Jack."]'
    ];
    selectors.forEach(sel => {
        el.querySelectorAll(sel).forEach(node => {
            (node.closest('.form-group') ?? node.closest('li') ?? node).remove();
        });
    });

    // Esconde cabeçalhos de seção do módulo (V14 usa <section data-category="...">)
    el.querySelectorAll('section[data-category], [data-module]').forEach(section => {
        const cat = section.dataset.category ?? section.dataset.module ?? '';
        if (cat.toLowerCase().includes('soundboard')) section.remove();
    });

    // Fallback: esconde por texto do heading
    el.querySelectorAll('h2, h3, .settings-header').forEach(h => {
        if (/soundboard/i.test(h.textContent)) {
            let el2 = h;
            // Remove o heading e todos os form-groups seguintes até o próximo heading
            const toRemove = [el2];
            let next = el2.nextElementSibling;
            while (next && !next.matches('h2, h3, .settings-header')) {
                toRemove.push(next);
                next = next.nextElementSibling;
            }
            toRemove.forEach(n => n.remove());
        }
    });
});

// CSS dos badges de jogador ativo (injetado uma vez)
(function injectPlayerBadgeCSS() {
    const id = 'sb-player-badge-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
        #sb-player-sounds-bar {
            display: none;
            flex-wrap: wrap;
            gap: 4px;
            padding: 4px 8px;
            background: rgba(0,0,0,0.25);
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        .sb-player-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #1a3a5c;
            border: 1px solid #2c6aa0;
            border-radius: 10px;
            padding: 2px 8px;
            font-size: 10px;
            color: #fff;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
            user-select: none;
        }
        .sb-player-badge:hover { background: #c62828; border-color: #e57373; }
        .sb-player-badge .fa-volume-up { color: #7ab3e0; font-size: 9px; }
        .sb-player-badge .fa-stop { color: #e84030; font-size: 8px; }
        /* Badge de loop: verde pulsante */
        .sb-player-badge--loop {
            background: #0d3320;
            border-color: #2e7d32;
            animation: sb-badge-pulse 2s infinite;
        }
        .sb-player-badge--loop .fa-redo { color: #66bb6a; font-size: 9px; }
        @keyframes sb-badge-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(46,125,50,0.6); }
            50%       { box-shadow: 0 0 0 4px rgba(46,125,50,0); }
        }
    `;
    document.head.appendChild(style);
})();
