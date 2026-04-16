// eslint-disable-next-line no-unused-vars
class SBAudioHelper {

    activeSounds = [];
    loopTimers = new Map(); // timers por identifyingPath

    constructor() {}

    detuneNode(soundNode, detuneBy) {
        if (!detuneBy || detuneBy === 0) return;
        try {
            if (soundNode.container?.isBuffer) {
                soundNode.node.detune.value = detuneBy;
            } else if (soundNode.container?.element) {
                soundNode.container.element.preservesPitch = false;
                soundNode.container.element.playbackRate = 1 + ((detuneBy / 500) * 0.2);
            }
        } catch(e) {}
    }

    // ---------------------------------------------------------
    // PLAY NORMAL
    // ---------------------------------------------------------
    async play({src, volume, detune}, sound) {
        if (game.settings.get('core', 'globalInterfaceVolume') === 0) {
            ui.notifications.warn(game.i18n.localize('SOUNDBOARD.notif.interfaceMuted'));
        }

        volume *= game.settings.get('core', 'globalInterfaceVolume');

        const soundNode = new foundry.audio.Sound(src);
        soundNode.loop = false;

        soundNode.addEventListener('play', () => {
            this.detuneNode(soundNode, detune);
            if (soundNode.sourceNode && game.audio.soundboardGain) {
                try {
                    const gainNode = game.audio.context.createGain();
                    gainNode.gain.value = sound.individualVolume ?? 1;
                    soundNode.sourceNode.disconnect();
                    gainNode.connect(game.audio.soundboardGain);
                    soundNode.sourceNode.connect(gainNode);
                    soundNode.individualGainNode = gainNode;
                } catch(e) {}
            }
            this.activeSounds.push(soundNode);
        });

        soundNode.addEventListener('end', () => {
            this.removeActiveSound(soundNode);
            if (!game.user.isGM) return;

            if (sound.loop) {
                this._scheduleNextLoop(sound);
                return;
            }

            // Som terminou naturalmente — remove indicador se não houver outra instância ativa
            const stillActive = this.activeSounds.some(s => s.identifyingPath === sound.identifyingPath);
            if (!stillActive) {
                SoundBoard.currentlyPlayingSounds = SoundBoard.currentlyPlayingSounds
                    .filter(s => s && s.identifyingPath !== sound.identifyingPath);
                SoundBoard._updatePlayingIndicator(sound.identifyingPath, false);
            }
        });

        if (!soundNode.loaded) await soundNode.load();

        if (!game.audio.soundboardGain) {
            game.audio.soundboardGain = game.audio.context.createGain();
            game.audio.soundboardGain.connect(game.audio.context.destination);
        }

        game.audio.soundboardGain.gain.value = volume;
        soundNode.identifyingPath = sound.identifyingPath;
        soundNode.individualVolume = sound.individualVolume ?? 1;
        soundNode.play({ volume });
    }

    // ---------------------------------------------------------
    // LOOPING — LÓGICA SEPARADA POR MODO
    // ---------------------------------------------------------
    _scheduleNextLoop(sound) {
        const id = sound.identifyingPath;

        // limpa timer anterior
        if (this.loopTimers.has(id)) {
            clearTimeout(this.loopTimers.get(id));
            this.loopTimers.delete(id);
        }

        let delay = 0;

        switch (sound.loopMode) {
            case "simple":
                delay = 0;
                break;

            case "fixed":
                delay = (sound.loopDelayMin || 0) * 1000;
                break;

            case "random":
                const min = sound.loopDelayMin || 0;
                const max = sound.loopDelayMax || min;
                delay = (min + Math.random() * (max - min)) * 1000;
                break;

            default:
                delay = 0;
        }

        const timer = setTimeout(() => {
            if (!sound.loop) return;
            SoundBoard.playSound(id, true);
        }, delay);

        this.loopTimers.set(id, timer);
    }

    // ---------------------------------------------------------
    // STOP
    // ---------------------------------------------------------
    stop(soundObj) {
        const toStop = this.activeSounds.filter(s => soundObj.src.includes(s.src));
        toStop.forEach(s => {
            this._callStop(s);
            this.removeActiveSound(s);
        });

        const id = soundObj.identifyingPath;
        if (this.loopTimers.has(id)) {
            clearTimeout(this.loopTimers.get(id));
            this.loopTimers.delete(id);
        }
    }

    stopAll() {
        for (const s of this.activeSounds) this._callStop(s);
        this.activeSounds = [];

        for (const [id, t] of this.loopTimers.entries()) {
            clearTimeout(t);
        }
        this.loopTimers.clear();
    }

    _callStop(sound) {
        try {
            if (!sound.isBuffer && sound.element) {
                sound.element.onended = undefined;
                sound.element.pause();
                sound.element.src = '';
                sound.element.remove();
            }
            sound.stop();
        } catch(e) {}
    }

    removeActiveSound(sound) {
        const idx = this.activeSounds.findIndex(s => s.id === sound.id);
        if (idx > -1) this.activeSounds.splice(idx, 1);
    }

    // ---------------------------------------------------------
    // VOLUME
    // ---------------------------------------------------------
    onVolumeChange(volume, individualVolumes) {
        volume *= game.settings.get('core', 'globalInterfaceVolume');
        if (game.audio.soundboardGain) game.audio.soundboardGain.gain.value = volume;

        if (individualVolumes) {
            this.activeSounds.forEach(s => {
                if (s.individualGainNode && individualVolumes[s.identifyingPath]) {
                    s.individualGainNode.gain.value = parseInt(individualVolumes[s.identifyingPath]) / 100;
                }
            });
        }
    }

    // ---------------------------------------------------------
    // CACHE
    // ---------------------------------------------------------
    async cache({src, volume}) {
        const soundNode = new foundry.audio.Sound(src);
        await soundNode.load();
        const player = game.user.name;
        SoundBoard.socketHelper.sendData({
            type: SBSocketHelper.SOCKETMESSAGETYPE.CACHECOMPLETE,
            payload: { src, volume, player }
        });
    }

    cacheComplete({src, player}) {
        ui.notifications.notify(`${player} cache complete for ${src}`);
    }
}
