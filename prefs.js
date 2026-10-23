// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences Entry Point
 *
 * Assembles modular preference pages:
 * - pageBlur: Background blur and brightness overlay (Issue #1: blur-radius 0 support)
 * - pageClock: Digital clock styles, fonts, colors, analog skins, and date styling
 * - pageCustomText: On-screen custom lockscreen message
 * - pageAuth: User avatar scaling, username/password styling, top bar scaling (Issue #2)
 */

import Gtk from 'gi://Gtk';
import PangoCairo from 'gi://PangoCairo';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { SETTINGS_KEYS } from './src/constants.js';
import { buildBlurPage } from './src/prefs/pageBlur.js';
import { buildClockPage } from './src/prefs/pageClock.js';
import { buildCustomTextPage } from './src/prefs/pageCustomText.js';
import { buildAuthPage } from './src/prefs/pageAuth.js';

export default class LockscreenStudioPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Adjust window default size
        window.set_default_size(700, 800);

        // Query system fonts via Pango
        const fontMap = PangoCairo.font_map_get_default();
        const families = fontMap.list_families();
        const systemFonts = families.map(f => f.get_name());

        const currentClockFont = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY) || 'Sans';
        const currentDateFont = settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY) || 'Sans';
        const currentCustomTextFont = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY) || 'Sans';
        const currentUsernameFont = settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY) || 'Sans';

        const fontsSet = new Set([
            ...systemFonts,
            currentClockFont,
            currentDateFont,
            currentCustomTextFont,
            currentUsernameFont,
            'Sans',
            'Serif',
            'Monospace',
            'Cantarell',
            'Ubuntu',
        ]);
        const fonts = Array.from(fontsSet).sort((a, b) => a.localeCompare(b));

        // Create independent StringList models for each ComboRow
        const clockFontList = Gtk.StringList.new(fonts);
        const dateFontList = Gtk.StringList.new(fonts);
        const customTextFontList = Gtk.StringList.new(fonts);
        const usernameFontList = Gtk.StringList.new(fonts);

        // Build and add modular pages
        window.add(buildBlurPage(settings));
        window.add(buildClockPage(settings, fonts, clockFontList, dateFontList));
        window.add(buildCustomTextPage(settings, fonts, customTextFontList));
        window.add(buildAuthPage(settings, fonts, usernameFontList));
    }
}
