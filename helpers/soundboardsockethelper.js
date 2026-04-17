// eslint-disable-next-line no-unused-vars
class SBSocketHelper {
    static socketName = 'module.Soundboard-by-Jack';
    static SOCKETMESSAGETYPE = {
        PLAY: 1,
        STOP: 2,
        STOPALL: 3,
        CACHE: 4,
        CACHECOMPLETE: 5,
        VOLUMECHANGE: 6,
        REQUESTMACROPLAY: 7,
        SYNC_PLAYER_SOUNDS: 8,
        PLAYER_PLAY_REQUEST: 9,
        REQUEST_SYNC: 10
    }

    constructor() {
        game.socket.on(SBSocketHelper.socketName, this._onData);
    }

    _onData(data) {
        if (game.user.isGM) {
            switch (data.type) {
                case SBSocketHelper.SOCKETMESSAGETYPE.CACHECOMPLETE:
                    SoundBoard.audioHelper.cacheComplete(data.payload);
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.REQUESTMACROPLAY:
                    if (game.settings.get('Soundboard-by-Jack', 'allowPlayersMacroRequest')) {
                        SoundBoard.playSoundByName(data.payload);
                    }
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.PLAYER_PLAY_REQUEST: {
                    const { src, volume, identifyingPath, playerId, playerName,
                            loop, loopMode, loopDelayMin, loopDelayMax } = data.payload;
                    const vol = volume ?? SoundBoard.getVolume();

                    const payload = { src, volume: vol, detune: 0, loop: false };
                    const soundExtras = {
                        identifyingPath: identifyingPath ?? src,
                        individualVolume: 1
                    };

                    // Registra o som ativo do jogador para o badge do GM
                    if (playerId) {
                        if (!SoundBoard.playerActiveSounds) SoundBoard.playerActiveSounds = {};
                        SoundBoard.playerActiveSounds[playerId] = {
                            src, identifyingPath: identifyingPath ?? src,
                            playerName: playerName ?? 'Jogador',
                            isLooping: !!loop
                        };
                        SoundBoard._updatePlayerSoundIndicator();
                    }

                    // Se é um som com loop, guarda no mapa de loops de jogadores
                    if (loop && identifyingPath) {
                        if (!SoundBoard.playerLoopSounds) SoundBoard.playerLoopSounds = {};
                        SoundBoard.playerLoopSounds[identifyingPath] = {
                            src, volume: vol, identifyingPath,
                            playerId, playerName: playerName ?? 'Jogador',
                            loopMode: loopMode || 'simple',
                            loopDelayMin: loopDelayMin || 0,
                            loopDelayMax: loopDelayMax || 0
                        };
                    }

                    // Toca no GM (sem loop nativo — o loop é gerenciado pelo _schedulePlayerLoop)
                    SoundBoard.audioHelper.play(payload, soundExtras);

                    // Broadcast para todos os outros clientes
                    SoundBoard.socketHelper.sendData({
                        type: SBSocketHelper.SOCKETMESSAGETYPE.PLAY,
                        payload,
                        soundExtras
                    });
                    break;
                }

                case SBSocketHelper.SOCKETMESSAGETYPE.REQUEST_SYNC:
                    console.log(`SoundBoard: Jogador ${data.playerId} solicitou sincronização.`);
                    SoundBoard.syncSoundsForPlayer(data.playerId);
                    break;

                default:
                    break;
            }
        } else {
            switch (data.type) {
                case SBSocketHelper.SOCKETMESSAGETYPE.PLAY:
                    if (!data.payload.target || data.payload.target === game.userId) {
                        SoundBoard.audioHelper.play(data.payload, data.soundExtras);
                    }
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.STOP:
                    SoundBoard.audioHelper.stop(data.payload);
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.STOPALL:
                    SoundBoard.audioHelper.stopAll();
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.CACHE:
                    SoundBoard.audioHelper.cache(data.payload);
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.VOLUMECHANGE:
                    SoundBoard.audioHelper.onVolumeChange(data.payload?.volume, data.payload?.individualVolumes);
                    break;

                case SBSocketHelper.SOCKETMESSAGETYPE.SYNC_PLAYER_SOUNDS:
                    if (data.playerId === game.userId) {
                        const total = Object.values(data.sounds || {}).reduce((n, arr) => n + arr.length, 0);
                        console.log(`SoundBoard: Sons recebidos. Categorias: ${Object.keys(data.sounds || {}).length}, Total: ${total}`);
                        SoundBoard.sounds = data.sounds || {};
                        SoundBoard.soundsLoaded = true;
                        SoundBoard.soundsError = false;
                        ui.notifications.info(`SoundBoard: ${total} sons sincronizados pelo GM!`);
                        if (SoundBoard.openedBoard?.rendered) {
                            SoundBoard.openedBoard.render();
                        }
                    }
                    break;

                default:
                    break;
            }
        }
    }

    sendData(data) {
        game.socket.emit(SBSocketHelper.socketName, data);
    }
}
