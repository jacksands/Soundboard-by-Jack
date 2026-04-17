/**
 * MACRO: Open Player SoundBoard
 *
 * Use esta macro como JOGADOR para abrir o SoundBoard.
 * Se os sons ainda não foram sincronizados pelo GM, solicita a sincronização
 * e abre o painel de qualquer forma (ele atualiza automaticamente ao receber os sons).
 */

(async () => {
    if (!window.SoundBoard) {
        ui.notifications.error('SoundBoard: Módulo não encontrado.');
        return;
    }

    const allowPlayers = game.settings.get('Soundboard-by-Jack', 'allowPlayerSoundBoard');
    if (!game.user.isGM && !allowPlayers) {
        ui.notifications.warn('SoundBoard: O GM desativou o SoundBoard para jogadores.');
        return;
    }

    // Se não há sons, pede sincronização ao GM antes de abrir
    if (!game.user.isGM && (!SoundBoard.soundsLoaded || Object.keys(SoundBoard.sounds).length === 0)) {
        ui.notifications.info('SoundBoard: Solicitando sons ao GM...');
        if (SoundBoard.socketHelper) {
            SoundBoard.socketHelper.sendData({
                type: SBSocketHelper.SOCKETMESSAGETYPE.REQUEST_SYNC,
                playerId: game.userId
            });
        }
    }

    SoundBoard.openSoundBoard();
})();
