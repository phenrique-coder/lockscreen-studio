// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Custom Text / Screen Message Manager
 * Responsible for creating, updating, and removing the custom message on the lock screen.
 */

import St from 'gi://St';
import { SETTINGS_KEYS } from '../constants.js';

export class CustomTextManager {
    /**
     * Apply or update custom text label on dialog clock.
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    static update(dialog, settings) {
        if (!dialog || !settings || !dialog._clock) {
            return;
        }

        const customTextEnabled = settings.get_boolean(SETTINGS_KEYS.CUSTOM_TEXT_ENABLED);
        const customText = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT);
        const customTextFontSize = settings.get_int(SETTINGS_KEYS.CUSTOM_TEXT_FONT_SIZE);
        const customTextFontFamily = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY);
        const customTextColor = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_COLOR);

        if (customTextEnabled && customText) {
            if (!dialog._customTextLabel) {
                dialog._customTextLabel = new St.Label({
                    text: customText,
                    style_class: 'lockscreen-custom-text',
                });
                dialog._clock.add_child(dialog._customTextLabel);
            } else {
                dialog._customTextLabel.text = customText;
            }
            dialog._customTextLabel.visible = true;
            dialog._customTextLabel.style = `font-size: ${customTextFontSize}px; font-family: "${customTextFontFamily}"; color: ${customTextColor}; margin-top: 15px; text-align: center;`;
        } else {
            if (dialog._customTextLabel) {
                dialog._customTextLabel.visible = false;
            }
        }
    }

    /**
     * Clean up and destroy the custom text label.
     *
     * @param {object} dialog - UnlockDialog instance
     */
    static cleanup(dialog) {
        if (dialog?._clock && dialog?._customTextLabel) {
            dialog._clock.remove_child(dialog._customTextLabel);
            dialog._customTextLabel.destroy();
            dialog._customTextLabel = null;
        } else if (dialog?._customTextLabel) {
            dialog._customTextLabel.destroy();
            dialog._customTextLabel = null;
        }
    }
}
