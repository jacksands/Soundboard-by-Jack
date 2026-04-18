class SoundBoardHelp extends foundry.appv1.api.Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.title = `❔${game.i18n.localize('SOUNDBOARD.app.help.title')}`;
        options.id = 'soundboard-help-app';
        options.template = 'modules/Soundboard-by-Jack/templates/soundboardhelp.html';
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
        const el = html instanceof HTMLElement ? html : html[0];

        // Collapsible sections
        el.querySelectorAll('.sb-help-section-title').forEach(title => {
            title.addEventListener('click', () => {
                const body = title.nextElementSibling;
                if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
            });
        });

        // Install macro button (GM only)
        el.querySelector('#sb-install-player-macro')?.addEventListener('click', async () => {
            const command = `// 1. Open SoundBoard
SoundBoard.openSoundBoard();

// 2. Collapse all categories as soon as the UI renders
let attempts = 0;
const checkRender = setInterval(() => {
    const collapseButton = document.querySelector("#collapse-all");
    if (collapseButton) {
        collapseButton.click();
        clearInterval(checkRender);
    }
    attempts++;
    if (attempts > 50) clearInterval(checkRender);
}, 100);`;

            const macroName = 'soundboard';
            const existing = game.macros.find(m => m.name === macroName);
            let macro;

            if (existing) {
                macro = existing;
                await macro.update({ ownership: { default: 2 } });
                ui.notifications.info(`SoundBoard: Macro "${macroName}" already exists — permissions set to Observer.`);
            } else {
                macro = await Macro.create({
                    name: macroName,
                    type: 'script',
                    command,
                    img: 'icons/magic/sonic/projectile-sound-rings-wave.webp',
                    ownership: { default: 2 }   // Observer: players can see and drag to their hotbar
                });
                ui.notifications.notify(`SoundBoard: Macro "${macroName}" created with Observer permission!`);
            }

            // Add to GM hotbar
            if (macro) {
                const usedSlots = new Set(Object.values(game.user.hotbar ?? {}).filter(Boolean));
                const emptySlot = Array.from({length: 10}, (_, i) => i + 1).find(s => !usedSlots.has(s));
                if (emptySlot) {
                    await game.user.assignHotbarMacro(macro, emptySlot);
                    ui.notifications.notify(`SoundBoard: Macro added to hotbar slot ${emptySlot}.`);
                } else {
                    ui.notifications.warn('SoundBoard: No empty hotbar slot. Macro is in the Macro Directory.');
                }
            }
        });
    }

    getData() {
        const isGM = game.user.isGM;
        const helpItems = [{
            title: 'General Usage',
            body: `<p><b>SoundBoard by Jack</b> is a GM soundboard for Foundry VTT V14.</p>
            <b>Features</b>
            <ul>
            <li>Custom sounds — point to your own directory in Module Settings</li>
            <li>Broadcast sounds to all players simultaneously</li>
            <li>Target a single player — only that player hears the sound</li>
            <li>Preview mode — right-click any sound to hear it locally (GM only)</li>
            <li>Cache mode — preload sounds on all clients before playing</li>
            <li>Loop with fixed delay, random delay, or immediate repeat</li>
            <li>Soundscape — save/load a set of looping sounds as a named preset</li>
            <li>Per-sound volume control</li>
            <li>Wildcard sounds — one button plays a random file from a subfolder</li>
            <li>Favorites — star sounds for quick access on the Favorites tab</li>
            <li>Macro generation — one click creates a macro for any sound</li>
            <li>Player SoundBoard — give players access to a limited soundboard</li>
            <li>Searchable sound list with collapsible categories</li>
            </ul>`
        }, {
            title: 'Setting Up Custom Audio',
            body: `<b style="color:red;text-decoration:underline;">DO NOT place sounds inside the module folder — they will be deleted on updates!</b>
            <p>Create your sound directory in your Foundry user data folder, then set the path in Module Settings.</p>
            <h3>Required Directory Structure</h3>
            <ol>
            <li>Create a top-level folder (e.g. <code>Data/my-sounds/</code>)</li>
            <li>Inside it, create one subfolder per <b>category</b> (e.g. <code>Battle/</code>, <code>Ambient/</code>)</li>
            <li>Place audio files inside the category folders</li>
            <li>Optionally: inside a category, create a subfolder with multiple files — this becomes a <b>wildcard button</b> that plays a random file each time</li>
            </ol>
            <h3>Supported Formats</h3>
            <p>.ogg, .oga, .mp3, .wav, .flac, .webm, .opus</p>
            <h3>Setting the Path</h3>
            <p>Go to <b>Module Settings → Custom SoundBoard Directory</b> and use the file picker to select your top-level sounds folder.</p>`
        }, {
            title: 'Playing & Previewing Sounds',
            body: `<p><b>Left-click</b> a sound button to broadcast it to all connected players.</p>
            <p><b>Right-click</b> a sound button to play it locally (GM preview only — players do not hear it).</p>
            <p>Use the <b>Target Player</b> toolbar button <i class="fas fa-users"></i> to send a sound to a single player only.</p>`
        }, {
            title: 'Looping Sounds',
            body: `<p>Click the <b>three dots (⋮)</b> on any sound button to open its options. Click the <b>Loop</b> icon <i class="fas fa-sync-alt"></i> to set the loop mode:</p>
            <ul>
            <li><b>Off</b> — Stops the loop immediately</li>
            <li><b>Repeat every X s</b> — Fixed delay of X seconds between repetitions</li>
            <li><b>Random X–Y s</b> — Random delay between X and Y seconds each cycle</li>
            </ul>
            <p>A looping button pulses with a golden background. <b>Click it again</b> to stop the loop.</p>
            <p>Wildcard loop: each cycle plays a different random file from the wildcard set.</p>`
        }, {
            title: 'Soundscape (Save & Load Loop Sets)',
            body: `<p>A <b>Soundscape</b> saves all currently looping sounds (with their loop settings) as a named preset.</p>
            <p>Click the <b>Soundscape</b> toolbar button <i class="fas fa-music"></i> to open the manager:</p>
            <ul>
            <li><b>Save current</b> — captures all active loops</li>
            <li><b>▶ Load</b> — restores a saved soundscape</li>
            <li><b>⚙ Macro</b> — generates a macro that activates the soundscape</li>
            <li><b>✕</b> — deletes the soundscape entry</li>
            </ul>
            <p>Loading a soundscape does not stop currently playing sounds. Use Stop All first if needed.</p>`
        }, {
            title: 'Favorites',
            body: `<p>Click the <b>three dots (⋮)</b> on a sound then click the <b>star <i class="far fa-star"></i></b> to favorite it. Favorited sounds appear in the <b>Favorite Sounds</b> tab.</p>
            <p>Click the filled star <i class="fas fa-star"></i> to unfavorite.</p>`
        }, {
            title: 'Modifier Keys',
            body: `<ul>
            <li><b>Shift + click</b> — Start looping immediately</li>
            <li><b>Alt + click</b> — Toggle favorite</li>
            <li><b>Ctrl / Cmd + click</b> — Stop this sound immediately</li>
            </ul>`
        }, {
            title: 'Caching Mode',
            body: `<p>Click the <b>Cache</b> toolbar button <i class="fas fa-cloud-download-alt"></i> to enable caching mode.</p>
            <p>While active, clicking a sound preloads it on all clients without playing it. The GM is notified when each player finishes caching.</p>`
        }, {
            title: 'Macro Mode',
            body: `<p>Click the <b>Macro</b> toolbar button <i class="fas fa-file-code"></i> to enable macro mode.</p>
            <p>While active, clicking a sound creates a hotbar macro for it instead of playing it. These macros call <code>SoundBoard.playSoundByName("Sound Name")</code>.</p>
            <p>Players can trigger SoundBoard sound macros if <b>Players trigger SoundBoard macros</b> is enabled in settings.</p>`
        }, {
            title: 'Per-Sound Volume',
            body: `<p>Click the <b>Volume</b> toolbar button <i class="fas fa-volume-up"></i> to show individual volume sliders on every sound button.</p>
            <p>The master volume slider at the bottom controls overall SoundBoard volume. Individual sliders set relative volume per sound.</p>`
        }, {
            title: 'Player Personal SoundBoard',
            body: `<p>GMs can give individual players access to a limited SoundBoard with specific sounds.</p>
            <ol>
            <li>Enable <b>Allow Player SoundBoard</b> in Module Settings</li>
            <li>Go to <b>Module Settings → Player Directories</b> and assign a sound folder to each player. Leave empty to use the GM folder as fallback.</li>
            <li>Use the <b>Player SoundBoard Macro</b> section below to share the macro with players</li>
            </ol>
            <p>Sounds played by players are broadcast globally. The GM sees a live badge in the footer for each player currently playing a sound — click it to stop that player's sound.</p>`
        }, {
            title: 'Player SoundBoard Macro',
            body: `<p>Players access their SoundBoard via the <b>"soundboard"</b> macro.</p>
            ${isGM ? `<div style="text-align:center; margin: 10px 0;">
                <button id="sb-install-player-macro" class="btn btn-primary"
                        style="padding:6px 18px; font-size:13px; font-weight:700; background:#2c5aa0; color:#fff; border:none; border-radius:5px; cursor:pointer;">
                    <i class="fas fa-plus"></i> Install Macro on GM Hotbar
                </button>
            </div>` : ''}
            <p>This button (GM only) creates the <b>"soundboard"</b> macro with <b>Observer</b> permission and adds it to the GM hotbar.</p>
            <p><b>How players get the macro:</b> Players open the <b>Macro Directory</b> (click the book icon on the hotbar), search for <b>"soundboard"</b>, and drag it to their own hotbar. Dragging it creates a personal copy they can execute.</p>
            <p>Players cannot run a macro directly from the Macro Directory — they must drag it to their hotbar first.</p>`
        }, {
            title: 'Stopping Sounds',
            body: `<p>The red <b>Stop</b> button at the bottom stops all playing sounds and signals all connected clients.</p>
            <p>To stop a single looping sound: click the flashing button again.</p>
            <p>To stop any individual sound immediately: hold <b>Ctrl / Cmd</b> and click it.</p>`
        }, {
            title: 'Module Settings',
            body: `<h3>Custom SoundBoard Directory</h3>
            <p>Path to your top-level sounds folder (must contain category subfolders). Use the folder picker icon.</p>
            <h3>Allow Player SoundBoard</h3>
            <p>Enables the player soundboard feature. When disabled, only the GM can use the SoundBoard.</p>
            <h3>Player Directories</h3>
            <p>Assign a sound folder to each player. Leave empty to use the GM folder as fallback.</p>
            <h3>Source Type</h3>
            <p>Where your sounds are stored: <b>Data</b> (default, recommended). <b>Forge</b> and <b>S3</b> are largely untested — use at your own risk.</p>
            <h3>Defocus Opacity</h3>
            <p>How transparent the SoundBoard becomes when the mouse is elsewhere. Set to 1 to disable.</p>
            <h3>Random Detune Amount</h3>
            <p>Randomly shifts the pitch of sounds each time they play. Set to 0 to disable.</p>
            <h3>Button Name Max Characters</h3>
            <p>Maximum characters shown on sound buttons when name truncation is active (range: 5–50).</p>
            <h3>Players trigger SoundBoard macros</h3>
            <p>Allow players to activate sounds via <code>SoundBoard.playSoundByName("Name")</code> macros. Requires a connected GM.</p>
            <h3>Delete All SoundBoard Macros</h3>
            <p>Removes all auto-generated <b>SoundBoard - [Sound Name]</b> macros from the Macro Directory. Does not delete the "soundboard" player macro.</p>`
        }];

        return { help: helpItems, isGM };
    }
}
