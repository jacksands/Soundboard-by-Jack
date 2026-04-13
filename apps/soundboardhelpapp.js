class SoundBoardHelp extends foundry.appv1.api.Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `❔${game.i18n.localize('SOUNDBOARD.app.help.title')}`;
        options.id = 'soundboard-help-app';
        options.template = 'modules/SoundBoard/templates/soundboardhelp.html';
        options.resizable = true;
        options.width = 460;
        options.height = 640;
        return options;
    }

    _onResize() {
        super._onResize();
        const ytHelpEl = document.querySelector('.yt-help-video');
        const sbHelpEl = document.querySelector('.soundboard-help');
        if (ytHelpEl && sbHelpEl) {
            ytHelpEl.style.width = sbHelpEl.offsetWidth + 'px';
            ytHelpEl.style.height = ((sbHelpEl.offsetWidth / 16) * 9) + 'px';
        }
    }

    activateListeners(html) {
        super.bringToTop();
        // Wire collapsible sections — html is jQuery in AppV1
        const el = html instanceof HTMLElement ? html : html[0];
        el.querySelectorAll('.sb-help-section-title').forEach(title => {
            title.addEventListener('click', () => {
                const body = title.nextElementSibling;
                if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });
    }

    getData() {
        let helpItems = [{
            title: 'General Usage',
            body: `<p><b>SoundBoard by Jack</b> is a GM soundboard for Foundry VTT V14.</p>
            <b>Features</b>
            <ul>
            <li>Custom sounds — point to your own directory in Module Settings</li>
            <li>Broadcast sounds to all players simultaneously</li>
            <li>Target a single player — only that player hears the sound</li>
            <li>Preview mode — right-click any sound to hear it locally without broadcasting</li>
            <li>Cache mode — preload sounds on all clients before playing</li>
            <li>Loop with fixed delay, random delay, or immediate repeat</li>
            <li>Soundscape — save/load a set of looping sounds as a named preset</li>
            <li>Per-sound volume control</li>
            <li>Wildcard sounds — link multiple files to one button (plays a random file each time)</li>
            <li>Favorites — star sounds for quick access on the Favorites tab</li>
            <li>Macro generation — one click creates a macro for any sound</li>
            <li>Player SoundBoard — give players their own limited soundboard</li>
            <li>Searchable sound list with collapsible categories</li>
            </ul>`
        }, {
            title: 'Setting Up Custom Audio',
            body: `<b style="color:red;text-decoration:underline;">DO NOT place sounds inside the module folder — they will be lost on updates!</b>
            <p>Create your sound directory in your Foundry user data folder, then set the path in Module Settings.</p>
            <h3>Required Directory Structure</h3>
            <ol>
            <li>Create a top-level folder (e.g. <code>Data/my-sounds/</code>)</li>
            <li>Inside it, create one folder per <b>category</b> (e.g. <code>Battle/</code>, <code>Ambient/</code>)</li>
            <li>Place audio files inside the category folders</li>
            <li>Optionally: inside a category, create a subfolder with multiple files — this becomes a <b>wildcard button</b> that plays a random file</li>
            </ol>
            <h3>Supported Formats</h3>
            <p>.ogg, .oga, .mp3, .wav, .flac, .webm, .opus</p>
            <h3>Setting the Path</h3>
            <p>Go to Module Settings → Custom SoundBoard Directory. Use the file picker to select your top-level sounds folder.</p>`
        }, {
            title: 'Playing & Previewing Sounds',
            body: `<p><b>Left-click</b> a sound button to broadcast it to all connected players.</p>
            <p><b>Right-click</b> a sound button to play it locally (GM preview only — players do not hear it).</p>
            <p>Use the <b>Target Player</b> toolbar button <i class="fas fa-users"></i> to send sounds to a single player only.</p>`
        }, {
            title: 'Looping Sounds',
            body: `<p>Click the <b>three dots</b> on any sound button to open its options menu. Then click the <b>Loop</b> icon <i class="fas fa-sync-alt"></i> to open loop mode settings:</p>
            <ul>
            <li><b>Off</b> — Stops the loop immediately</li>
            <li><b>Repeat every X s</b> — Loops with a fixed delay of X seconds between repetitions</li>
            <li><b>Random X–Y s</b> — Loops with a random delay between X and Y seconds each cycle</li>
            </ul>
            <p>A looping button pulses with a golden background. <b>Click the button</b> again to stop the loop immediately.</p>
            <p>Wildcard loop: each loop cycle plays a different random file from the wildcard set.</p>`
        }, {
            title: 'Soundscape (Save & Load Loop Sets)',
            body: `<p>A <b>Soundscape</b> saves all currently looping sounds (with their loop mode and delay settings) as a named preset.</p>
            <p>Click the <b>Soundscape</b> toolbar button <i class="fas fa-music"></i> to open the manager:</p>
            <ul>
            <li>Type a name and click <b>Save current</b> to capture all active loops</li>
            <li>Click <b>▶ Load</b> to restore a saved soundscape</li>
            <li>Click <b>⚙ Macro</b> to generate a Foundry macro that activates the soundscape</li>
            <li>Click <b>✕</b> to delete a soundscape</li>
            </ul>
            <p>Note: loading a soundscape does not stop currently playing sounds. Stop all first if needed.</p>`
        }, {
            title: 'Favorites',
            body: `<p>Click the <b>three dots</b> on a sound and then the star <i class="far fa-star"></i> to favorite it. Favorited sounds appear in the <b>Favorite Sounds</b> tab for quick access.</p>
            <p>Click the filled star <i class="fas fa-star"></i> to unfavorite.</p>`
        }, {
            title: 'Modifier Keys',
            body: `<p>Hold a modifier key while clicking a sound button:</p>
            <ul>
            <li><b>Shift</b> — Start looping immediately (no delay)</li>
            <li><b>Alt</b> — Toggle favorite</li>
            <li><b>Ctrl / Cmd</b> — Stop this sound immediately</li>
            </ul>`
        }, {
            title: 'Caching Mode',
            body: `<p>Click the <b>Cache</b> toolbar button <i class="fas fa-cloud-download-alt"></i> to enable caching mode (button turns green).</p>
            <p>While active, clicking a sound sends it to all clients to load into their browser cache — without playing it. This ensures instant, synchronized playback later.</p>
            <p>The GM receives a notification when each player finishes caching.</p>`
        }, {
            title: 'Macro Mode',
            body: `<p>Click the <b>Macro</b> toolbar button <i class="fas fa-file-code"></i> to enable macro mode (button turns green).</p>
            <p>While active, clicking a sound creates a macro for it in your Macro Directory instead of playing it. The macro can be assigned to a hotbar slot.</p>
            <p>Players can trigger SoundBoard macros if <b>Players trigger SoundBoard macros</b> is enabled in settings.</p>`
        }, {
            title: 'Per-Sound Volume',
            body: `<p>Click the <b>Volume</b> toolbar button <i class="fas fa-volume-up"></i> to show individual volume sliders on every sound button.</p>
            <p>Adjust sliders to set relative volumes per sound. These values are saved and persist across sessions.</p>
            <p>The master volume slider at the bottom controls the overall SoundBoard volume.</p>`
        }, {
            title: 'Player Personal SoundBoard',
            body: `<p>GMs can give individual players access to a limited SoundBoard containing only specific sounds.</p>
            <p>Click the <b>Player Manager</b> toolbar button <i class="fas fa-user-cog"></i>:</p>
            <ul>
            <li>Toggle access for each connected player</li>
            <li>Search and assign individual sounds to each player</li>
            </ul>
            <p>Players with access will see the SoundBoard button in their scene controls. They can play or preview their assigned sounds, but cannot loop, cache, or use macro mode.</p>`
        }, {
            title: 'Stopping Sounds',
            body: `<p>The red <b>Stop</b> button at the bottom stops all playing sounds immediately and signals all connected clients to do the same.</p>
            <p>To stop a single looping sound: click the flashing button.</p>
            <p>To stop any single sound immediately: hold <b>Ctrl / Cmd</b> and click the sound button.</p>`
        }, {
            title: 'Module Settings',
            body: `<h3>Custom SoundBoard Directory</h3>
            <p>Path to the top-level folder containing your category subfolders. Use the folder picker icon.</p>
            <h3>Source Type</h3>
            <p>Where your sounds are stored: Data (default), Forge Assets, or S3 bucket.</p>
            <h3>Defocus Opacity</h3>
            <p>How transparent the SoundBoard becomes when your mouse is elsewhere. Set to 1 to disable.</p>
            <h3>Random Detune Amount</h3>
            <p>Randomly shifts the pitch of sounds each time they play. Adds variety to repeated sounds.</p>
            <h3>Players trigger SoundBoard macros</h3>
            <p>Allow players to activate sounds via SoundBoard macros. Requires a connected GM.</p>
            <h3>Allow Personal Player SoundBoard</h3>
            <p>Enables the Player SoundBoard Manager in the toolbar. Assign sounds to players.</p>`
        }];

        return { help: helpItems };
    }
}
