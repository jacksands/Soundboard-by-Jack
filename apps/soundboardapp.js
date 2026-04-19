// SoundBoard main app - extends Application (AppV1, deprecated in V14, removed in V16)
// Kept as AppV1 because the template/UI is deeply tied to AppV1 patterns.
class SoundBoardApplication extends foundry.appv1.api.Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `🔊${game.i18n.localize('SOUNDBOARD.app.title')}`;
        options.id = 'soundboard-app';
        options.template = 'modules/Soundboard-by-Jack/templates/soundboard.html';
        options.resizable = true;
        return options;
    }

    static toggleExtendedOptions(element, identifyingPath, favTab) {
        const el = element instanceof HTMLElement ? element : element[0];
        if (!identifyingPath) {
            // Find and remove any existing extended option container in ancestors
            let target = el.parentElement;
            for (let i = 0; i < 5; i++) {
                if (!target) break;
                const existing = target.querySelector('.sb-extended-option-container');
                if (existing) {
                    existing.style.transition = 'opacity 0.3s';
                    existing.style.opacity = '0';
                    setTimeout(() => existing.remove(), 300);
                    return;
                }
                target = target.parentElement;
            }
            return;
        }

        const parent = el.parentElement;
        const existing = parent?.querySelector('.sb-extended-option-container');
        if (existing) {
            existing.style.transition = 'opacity 0.3s';
            existing.style.opacity = '0';
            setTimeout(() => existing.remove(), 300);
        } else {
            let sound = SoundBoard.getSoundFromIdentifyingPath(identifyingPath);
            let isFavorite = sound.isFavorite;
            let isLooping = sound.loop;
            const loopMode = sound.loopMode || 'off';
            // Buscar valores salvos para cada modo
            let loopSettings = game.settings?.get?.('Soundboard-by-Jack', 'soundboardIndividualLoopSettings') || {};
            let fixedDelay = 3, randMin = 3, randMax = 3;
            if (loopSettings[identifyingPath]) {
                if (loopSettings[identifyingPath].mode === 'fixed') {
                    fixedDelay = loopSettings[identifyingPath].min || 3;
                } else if (loopSettings[identifyingPath].mode === 'random') {
                    randMin = loopSettings[identifyingPath].min || 3;
                    randMax = loopSettings[identifyingPath].max || 3;
                }
            }
            // safe id for element ids in the template
            const safeId = identifyingPath.replace(/[^a-z0-9]/gi, '_');
            fetch('modules/Soundboard-by-Jack/templates/extendedoptions.html')
                .then(r => r.text())
                .then(data => {
                    // escape identifyingPath for use inside onclick strings
                    const escaped = identifyingPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                    data = data.replace(/\$identifyingPath/g, escaped);
                    data = data.replace(/\$safeId/g, safeId);
                    data = data.replace('$loopClass', isLooping ? 'loop-active' : '');
                    data = data.replace('$star', isFavorite ? 'fas fa-star' : 'far fa-star');
                    data = data.replace('$favoriteFn', isFavorite ? 'unfavoriteSound' : 'favoriteSound');
                    data = data.replace('$offActiveClass',    (!isLooping)                       ? 'active' : '');
                    data = data.replace('$simpleActiveClass', (isLooping && loopMode==='simple')  ? 'active' : '');
                    data = data.replace('$fixedActiveClass',  (isLooping && loopMode==='fixed')   ? 'active' : '');
                    data = data.replace('$randomActiveClass', (isLooping && loopMode==='random')  ? 'active' : '');
                    data = data.replace('$fixedDelay', fixedDelay);
                    data = data.replace('$randMin', randMin);
                    data = data.replace('$randMax', randMax);
                    if (favTab) {
                        data = data.replace('$removeFavFn', "this.closest('.sb-sound-container')?.remove();");
                    } else {
                        data = data.replace('$removeFavFn', '');
                    }
                    parent.insertAdjacentHTML('beforeend', data);

                    // Wire dropdown toggle for loop button inside the injected HTML
                    const container = parent.querySelector('.sb-extended-option-container');
                    container?.querySelector('.sb-repeat-button')?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const menu = container.querySelector('.sb-loop-menu');
                        if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    });
                    container?.querySelector('.sb-loop-menu')?.addEventListener('click', e => e.stopPropagation());
                });
        }
    }

    async render(force = false, options = {}) {
        await super.render(force, options);
        let renderedInterval = setInterval(() => {
            if (this.rendered) {
                setTimeout(() => {
                    const appEl = document.getElementById('soundboard-app');
                    if (appEl) appEl.style.opacity = game.settings.get('Soundboard-by-Jack', 'opacity');
                    // Restaurar estado do volume toggle
                    SoundBoard.restoreVolumeToggle(appEl);
                    clearInterval(renderedInterval);
                    renderedInterval = undefined;
                }, 100);
            }
        }, 50);
    }

    activateListeners(html) {
        super.bringToTop();
    }

    getData() {
        var sounds = [];
        var totalCount = 0;

        Object.keys(SoundBoard.sounds).forEach(key => {
            totalCount += SoundBoard.sounds[key].length;
            if (SoundBoard.sounds[key].length > 0) {
                sounds.push({
                    categoryName: key,
                    length: SoundBoard.sounds[key].length,
                    files: SoundBoard.sounds[key]
                });
            }
        });
        // Use per-client volume (moduleGeneralVolume) so the slider reflects this client's setting
        var volume = game.settings.get('Soundboard-by-Jack', 'moduleGeneralVolume') ?? 90;
        var collapse = totalCount > 2000;
        // V14: game.users.entities removed, use game.users.contents
        var players = game.users.contents.filter((el) => el.active && !el.isGM).map((el) => {
            return {name: el.name, id: el.id, isTarget: el.id === SoundBoard.targetedPlayerID};
        });
        var targetedPlayer = SoundBoard.targetedPlayerID;
        var cacheMode = SoundBoard.cacheMode;
        var macroMode = SoundBoard.macroMode;
        var volumeMode = SoundBoard.volumeMode;
        var isExampleAudio = SoundBoard.getDirectoryForCurrentUser() === 'modules/Soundboard-by-Jack/exampleAudio';
        var isGM = game.user.isGM;

        return {
            tab: { main: true },
            sounds,
            volume,
            totalCount,
            collapse,
            players,
            targetedPlayer,
            cacheMode,
            macroMode,
            volumeMode,
            isExampleAudio,
            isGM
        };
    }
}
