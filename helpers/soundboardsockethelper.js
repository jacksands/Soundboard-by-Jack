// eslint-disable-next-line no-unused-vars
class SBSocketHelper {
    static socketName = 'module.Soundboard-by-Jack';
    static SOCKETMESSAGETYPE = {
        PLAY: 1, STOP: 2, STOPALL: 3, CACHE: 4, CACHECOMPLETE: 5, VOLUMECHANGE: 6, REQUESTMACROPLAY: 7,
        REQUESTSOUNDS: 8, SOUNDSDATA: 9
    }

    constructor() {
        game.socket.on(SBSocketHelper.socketName, this._onData);
    }

    _onData(data) {
        if (game.user.isGM) {
            if (data.type === SBSocketHelper.SOCKETMESSAGETYPE.CACHECOMPLETE) {
                SoundBoard.audioHelper.cacheComplete(data.payload);
            } else if (data.type === SBSocketHelper.SOCKETMESSAGETYPE.REQUESTMACROPLAY) {
                if (game.settings.get('SoundBoard', 'allowPlayersMacroRequest')) {
                    SoundBoard.playSoundByName(data.payload);
                }
            } else if (data.type === SBSocketHelper.SOCKETMESSAGETYPE.REQUESTSOUNDS) {
                // Player requested the GM's sound list — send it back
                SoundBoard.socketHelper.sendData({
                    type: SBSocketHelper.SOCKETMESSAGETYPE.SOUNDSDATA,
                    target: data.requesterId,
                    payload: { sounds: SoundBoard.sounds, bundledSounds: SoundBoard.bundledSounds }
                });
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
                case SBSocketHelper.SOCKETMESSAGETYPE.SOUNDSDATA:
                    if (!data.target || data.target === game.user.id) {
                        SoundBoard._onSoundsDataReceived(data.payload);
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