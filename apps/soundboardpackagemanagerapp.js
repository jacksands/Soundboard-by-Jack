class SoundBoardPackageManagerApplication extends foundry.appv1.api.Application {

    constructor(packageManager) {
        super();
        this.packageManager = packageManager;
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `🎁${game.i18n.localize('SOUNDBOARD.app.packman.title')}`;
        options.id = 'soundboard-packagemanager-app';
        options.template = 'modules/Soundboard-by-Jack/templates/soundboardpackagemanager.html';
        options.resizable = false;
        options.width = 400;
        options.height = 600;
        return options;
    }

    activateListeners(html) {
        super.bringToTop();
    }

    getData() {
        this.packageManager.alphabetizePacks();
        let packages = this.packageManager.soundPacks;
        return {
            package: packages
        };
    }
}
