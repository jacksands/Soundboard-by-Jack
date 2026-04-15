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
    static volumeMode = false;

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
            return str.replace(/(')/g, '\\$1');
        },
        'get-individual-volume': (identifyingPath) => {
            return this.getVolumeForSound(identifyingPath);
        }
    }

    static setLocalStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    static getLocalStorage(key) {
        return JSON.parse(localStorage.getItem(key));
    }

    static openSoundBoard() {
        if (SoundBoard.soundsError) {
            ui.notifications.error(game.i18n.localize('SOUNDBOARD.notif.soundsError'));
            return;
        }
        if (!SoundBoard.soundsLoaded) {
            ui.notifications.warn(game.i18n.localize('SOUNDBOARD.notif.soundsNotLoaded'));
            return;
        }
        SoundBoard.openedBoard = new SoundBoardApplication();
        SoundBoard.openedBoard.render(true);
    }

    static openSoundBoardFav() {
        if (!SoundBoard.soundsLoaded) {
            ui.notifications.warn(game.i18n.localize('SOUNDBOARD.notif.soundsNotLoaded'));
            return;
        }
        SoundBoard.openedBoard = new SoundBoardFavApplication();
        SoundBoard.openedBoard.render(true);
    }

    static openSoundBoardBundled() {
        if (!SoundBoard.soundsLoaded) {
            ui.notifications.warn(game.i18n.localize('SOUNDBOARD.notif.soundsNotLoaded'));
            return;
        }
        SoundBoard.openedBoard = new SoundBoardBundledApplication();
        SoundBoard.openedBoard.render(true);
    }

    static openSoundBoardHelp() {
        new SoundBoardHelp().render(true);
    }

    static openSoundBoardPackageManager() {
        try {
            new SoundBoardPackageManagerApplication(SoundBoard.packageManager).render(true);
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
        return game.settings.get('Soundboard-by-Jack', 'soundboardServerVolume') / 100;
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
        sound.identifyingPath = identifyingPath;
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
        if (mode === 'off') {
            if (sound.loop) SoundBoard.stopLoop(identifyingPath);
            return;
        }
        const min = Math.max(0, Math.min(3600, Number(delayMin) || 0));
        const max = Math.max(min, Math.min(3600, Number(delayMax) || min));
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
        SoundBoard.audioHelper.stop(sound);
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.STOP,
            payload: sound
        });
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
    }

    static clearStoppedSounds() {
        SoundBoard.currentlyPlayingSounds = SoundBoard.currentlyPlayingSounds.filter(function (sound) {
            return sound.playing();
        });
    }

    static async _getBundledSounds(forceRefresh = false) {
        if (!forceRefresh) {
            try {
                SoundBoard.bundledSounds = SoundBoard.getLocalStorage('SoundBoardModule.BundledSounds');
                if (SoundBoard.bundledSounds) {
                    SoundBoard.soundsLoaded = true;
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.removeItem('SoundBoardModule.BundledSounds');
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
        SoundBoard.setLocalStorage('SoundBoardModule.BundledSounds', SoundBoard.bundledSounds);
        SoundBoard.soundsLoaded = true;
        if (!forceRefresh) {
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.soundsDiscovered'));
        }
    }

    static async getSounds(forceRefresh = false) {
        if (!forceRefresh) {
            try {
                SoundBoard.sounds = SoundBoard.getLocalStorage('SoundBoardModule.UserSounds');
                if (SoundBoard.sounds) {
                    await SoundBoard._getBundledSounds();
                    return;
                }
            } catch (e) {
                console.error(e);
            }
        }
        localStorage.removeItem('SoundBoardModule.UserSounds');
        const favoritesArray = game.settings.get('Soundboard-by-Jack', 'favoritedSounds');
        const source = game.settings.get('Soundboard-by-Jack', 'source');

        SoundBoard.soundsError = false;
        SoundBoard.soundsLoaded = false;

        try {
            SoundBoard.sounds = {};

            if (typeof (ForgeVTT) !== 'undefined' && ForgeVTT.usingTheForge) {
                const soundboardDirArray = await FilePicker.browse(source, game.settings.get('Soundboard-by-Jack', 'soundboardDirectory'), {recursive: true});

                if (soundboardDirArray.target !== game.settings.get('Soundboard-by-Jack', 'soundboardDirectory').replace(' ', '%20')) {
                    throw 'Filepicker target did not match input. Parent directory may be correct. Soft failure.';
                }

                const subDirs = soundboardDirArray.dirs.map((dir) => {
                    let subDir = dir.replace(game.settings.get('Soundboard-by-Jack', 'soundboardDirectory'), '');
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

                SoundBoard.setLocalStorage('SoundBoardModule.UserSounds', SoundBoard.sounds);
            } else {
                let bucket;
                if (source === 's3') {
                    const bucketContainer = await FilePicker.browse(source, game.settings.get('Soundboard-by-Jack', 'soundboardDirectory'));
                    bucket = bucketContainer.dirs[0];
                }
                const soundboardDirArray = await FilePicker.browse(source, game.settings.get('Soundboard-by-Jack', 'soundboardDirectory'), {
                    ...(bucket && { bucket })
                });
                if (soundboardDirArray.target !== game.settings.get('Soundboard-by-Jack', 'soundboardDirectory').replace(' ', '%20')) {
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
            SoundBoard.setLocalStorage('SoundBoardModule.UserSounds', SoundBoard.sounds);
        } catch (error) {
            SoundBoard.log(error, SoundBoard.LOGTYPE.ERR);
            SoundBoard.soundsError = true;
        } finally {
            await SoundBoard._getBundledSounds(forceRefresh);
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
        const delay = input ? parseFloat(input.value) || 0 : 0;
        SoundBoard.setLoopMode(identifyingPath, 'fixed', delay, delay);
        SoundBoardApplication.toggleExtendedOptions(btnEl);
    }

    static _applyRandomLoop(identifyingPath, btnEl) {
        const safeId = identifyingPath.replace(/[^a-z0-9]/gi, '_');
        const minInput = document.getElementById(`sb-rand-min-${safeId}`);
        const maxInput = document.getElementById(`sb-rand-max-${safeId}`);
        const min = minInput ? parseFloat(minInput.value) || 0 : 0;
        const max = maxInput ? parseFloat(maxInput.value) || min : min;
        SoundBoard.setLoopMode(identifyingPath, 'random', min, max);
        SoundBoardApplication.toggleExtendedOptions(btnEl);
    }

    // (player soundboard removed)


    static _registerSettings() {
        game.settings.registerMenu('Soundboard-by-Jack', 'deleteMacrosMenu', {
            name: 'Delete All SoundBoard Macros',
            label: 'Delete Macros',
            hint: 'Remove all automatically generated SoundBoard macros from your Macro Directory.',
            icon: 'fas fa-bomb',
            type: SBDeleteMacrosMenu,
            restricted: true
        });

        game.settings.register('Soundboard-by-Jack', 'soundboardDirectory', {
            name: 'Custom SoundBoard Directory',
            hint: 'This should point to a folder containing subfolders, each containing audio files. See modules/Soundboard-by-Jack/exampleAudio/ for an example',
            scope: 'world',
            config: true,
            default: 'modules/Soundboard-by-Jack/exampleAudio',
            type: String,
            filePicker: 'folder',
            onChange: value => {
                if (value.length <= 0) {
                    game.settings.set('Soundboard-by-Jack', 'soundboardDirectory', 'modules/Soundboard-by-Jack/exampleAudio');
                }
                if (SoundBoard.audioHelper) SoundBoard.getSounds(true);
            }
        });

        game.settings.register('Soundboard-by-Jack', 'source', {
            name: 'Source Type',
            hint: 'If your sounds are stored in your Forge Assets, select Forge. If they are stored in an S3 bucket, select S3. Otherwise, select Data',
            scope: 'world',
            config: true,
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
            type: Number,
            range: { min: 0, max: 100, step: 1 },
            default: 0
        });

        game.settings.register('Soundboard-by-Jack', 'buttonNameMaxChars', {
            name: 'Button Name Max Characters',
            hint: 'Maximum characters shown on sound buttons when name truncation is active. Range: 5-50.',
            scope: 'world',
            config: true,
            type: Number,
            range: { min: 5, max: 50, step: 1 },
            default: 15
        });

        game.settings.register('Soundboard-by-Jack', 'allowPlayersMacroRequest', {
            name: 'Players trigger SoundBoard macros',
            hint: 'Enable this to allow players to trigger a sound using a macro with SoundBoard.playSoundByName()',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });

        game.settings.register('Soundboard-by-Jack', 'forcePopoutCompat', {
            name: 'Force Popout Compatibility',
            hint: 'Enable this if you are having issues with the SoundBoard being cut off by the edge of the screen.',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false,
            onChange: value => { window.location.reload(); }
        });

        // Hidden/internal settings (config: false)
        game.settings.register('Soundboard-by-Jack', 'soundboardServerVolume', {
            name: 'Server Volume', scope: 'world', config: false, type: Number, default: 100
        });
        game.settings.register('Soundboard-by-Jack', 'soundboardIndividualSoundVolumes', {
            name: 'Individual Sound Volumes', scope: 'world', config: false, type: Object, default: {}
        });
        game.settings.register('Soundboard-by-Jack', 'favoritedSounds', {
            name: 'Favorited Sounds', scope: 'world', config: false, default: []
        });
        game.settings.register('Soundboard-by-Jack', 'savedSoundscapes', {
            name: 'Saved Soundscapes', scope: 'world', config: false, type: Object, default: {}
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

        if (game.user.isGM) {
            SoundBoard.soundsError = false;
            await SoundBoard.getSounds();
            Handlebars.registerPartial('SoundBoardPackageCard', await foundry.applications.handlebars.getTemplate('modules/Soundboard-by-Jack/templates/partials/packagecard.hbs'));
        }

        SoundBoard.socketHelper = new SBSocketHelper();
        SoundBoard.audioHelper = new SBAudioHelper();
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

// V14: use closeSoundBoardApplication hook name (fires from AppV1 name, but our apps extend AppV1 base via Application)
Hooks.on('closeSoundBoardApplication', () => {
    if (SoundBoard.openedBoard?.rendered) {
        SoundBoard.openedBoard.close();
    }
});

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
