// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Background Blur & Brightness Overlay Manager
 * Responsible for applying background blur and brightness adjustments to UnlockDialog.
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { SETTINGS_KEYS } from '../constants.js';

export class BackgroundManager {
    /**
     * Apply background blur and brightness adjustments to the dialog.
     * Supports blur-radius 0.
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    static updateBackground(dialog, settings) {
        if (!dialog || !settings || !dialog._backgroundGroup) {
            return;
        }

        const enableBlur = settings.get_boolean(SETTINGS_KEYS.ENABLE_BLUR);
        const blurRadius = settings.get_int(SETTINGS_KEYS.BLUR_RADIUS);
        const enableBrightness = settings.get_boolean(SETTINGS_KEYS.ENABLE_BRIGHTNESS);
        const blurBrightness = settings.get_double(SETTINGS_KEYS.BLUR_BRIGHTNESS);

        let scaleFactor = 1;
        try {
            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            if (themeContext) {
                scaleFactor = themeContext.scale_factor;
            }
        } catch (e) {
            // Fallback to scaleFactor 1
        }

        // Apply or reset blur on background actors
        // If enableBlur is true and blurRadius is 0, blurEffect radius & sigma are set to 0.
        dialog._backgroundGroup.get_children().forEach(actor => {
            const blurEffect = actor.get_effect('blur');
            if (blurEffect) {
                if (enableBlur) {
                    if ('radius' in blurEffect) {
                        blurEffect.radius = blurRadius * 2 * scaleFactor;
                    }
                    if ('sigma' in blurEffect) {
                        blurEffect.sigma = blurRadius * scaleFactor;
                    }
                } else {
                    if ('radius' in blurEffect) {
                        blurEffect.radius = 0;
                    }
                    if ('sigma' in blurEffect) {
                        blurEffect.sigma = 0;
                    }
                }
            }
        });

        // Manage independent brightness overlay widget
        if (!dialog._lssBrightnessOverlay) {
            dialog._lssBrightnessOverlay = new St.Widget({
                reactive: false,
            });
            const overlay = dialog._lssBrightnessOverlay;
            overlay.add_constraint(new Clutter.BindConstraint({
                source: dialog._backgroundGroup,
                coordinate: Clutter.BindCoordinate.ALL,
            }));
            overlay.connect('destroy', () => {
                if (dialog._lssBrightnessOverlay === overlay)
                    dialog._lssBrightnessOverlay = null;
            });
            dialog._backgroundGroup.add_child(overlay);
        }

        if (enableBrightness) {
            const opacity = Math.max(0, Math.min(1, 1.0 - blurBrightness));
            dialog._lssBrightnessOverlay.style = `background-color: rgba(0, 0, 0, ${opacity});`;
            dialog._lssBrightnessOverlay.visible = true;
        } else {
            dialog._lssBrightnessOverlay.visible = false;
        }
    }

    /**
     * Clean up brightness overlay widget from the dialog.
     *
     * @param {object} dialog - UnlockDialog instance
     */
    static cleanup(dialog) {
        if (dialog?._lssBrightnessOverlay) {
            dialog._lssBrightnessOverlay.destroy();
            dialog._lssBrightnessOverlay = null;
        }
    }
}
