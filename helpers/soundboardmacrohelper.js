class SBMacroHelper {

    static async generateMacro(soundName) {
        let macroName = `SoundBoard - ${soundName}`;
        let macroData;

        let existingMacro = game.macros.find((macro) => {
            return macro.name === macroName;
        });
        if (existingMacro) {
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.macroExists', {macro: macroName}));
            macroData = existingMacro;
        } else {
            macroData = await Macro.create({
                name: macroName,
                command: `SoundBoard.playSoundByName("${soundName}");\n// SHIFT CLICK this macro to cache the sound, click to play it`,
                type: 'script',
                img: 'modules/SoundBoard/bundledDocs/sbmacro.png'
            });
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.macroCreated', {macro: macroName}));
        }
        // V14: TinyMCE removed. Journal macro insertion no longer supported.
        // Users can drag macros from the Macro Directory into journal entries manually.
    }

    static async deleteAllMacros() {
        let existingMacros = game.macros.filter(macro => macro.name.indexOf('SoundBoard - ') === 0).map(macro => macro.id);
        if (existingMacros.length > 0) {
            await Macro.deleteDocuments(existingMacros);
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.deleteMacros'));
        } else {
            ui.notifications.notify(game.i18n.localize('SOUNDBOARD.notif.noMacros'));
        }
    }
}
