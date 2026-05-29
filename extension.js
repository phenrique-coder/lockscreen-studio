import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { UnlockDialog } from 'resource:///org/gnome/shell/ui/unlockDialog.js';

let origInit = null;
let origUpdateBackgroundEffects = null;

export default class LockscreenStudioExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._activeDialog = null;

        const extension = this;

        // Helper method to update clock styles on the active UnlockDialog instance
        UnlockDialog.prototype._updateCustomClockStyles = function() {
            const settings = extension._settings;
            if (!settings || !this._clock) return;

            const clockVisible = settings.get_boolean('clock-visible');
            const clockFontSize = settings.get_int('clock-font-size');
            const clockFontFamily = settings.get_string('clock-font-family');
            const clockColor = settings.get_string('clock-color');

            const dateVisible = settings.get_boolean('date-visible');
            const dateFontSize = settings.get_int('date-font-size');
            const dateFontFamily = settings.get_string('date-font-family');
            const dateColor = settings.get_string('date-color');

            const customTextEnabled = settings.get_boolean('custom-text-enabled');
            const customText = settings.get_string('custom-text');
            const customTextFontSize = settings.get_int('custom-text-font-size');
            const customTextFontFamily = settings.get_string('custom-text-font-family');
            const customTextColor = settings.get_string('custom-text-color');

            // Apply Time (Clock) styles
            if (this._clock._time) {
                this._clock._time.visible = clockVisible;
                if (clockVisible) {
                    this._clock._time.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor};`;
                }
            }

            // Apply Date styles
            if (this._clock._date) {
                this._clock._date.visible = dateVisible;
                if (dateVisible) {
                    this._clock._date.style = `font-size: ${dateFontSize}px; font-family: "${dateFontFamily}"; color: ${dateColor}; margin-top: 10px;`;
                }
            }

            // Manage Custom Text Label
            if (customTextEnabled && customText) {
                if (!this._customTextLabel) {
                    this._customTextLabel = new St.Label({
                        text: customText,
                        style_class: 'lockscreen-custom-text'
                    });
                    this._clock.add_child(this._customTextLabel);
                } else {
                    this._customTextLabel.text = customText;
                }
                this._customTextLabel.visible = true;
                this._customTextLabel.style = `font-size: ${customTextFontSize}px; font-family: "${customTextFontFamily}"; color: ${customTextColor}; margin-top: 15px; text-align: center;`;
            } else {
                if (this._customTextLabel) {
                    this._customTextLabel.visible = false;
                }
            }
        };

        // 1. Monkey patch UnlockDialog.prototype._init
        if (!origInit) {
            origInit = UnlockDialog.prototype._init;
            
            UnlockDialog.prototype._init = function() {
                origInit.apply(this, arguments);
                
                // Track active dialog instance
                extension._activeDialog = this;
                
                // Setup destroy listener to prevent leaks
                this.connect('destroy', () => {
                    if (extension._activeDialog === this) {
                        extension._activeDialog = null;
                    }
                });
                
                // Apply custom styles immediately
                this._updateCustomClockStyles();
            };
        }

        // 2. Monkey patch UnlockDialog.prototype._updateBackgroundEffects
        if (!origUpdateBackgroundEffects) {
            origUpdateBackgroundEffects = UnlockDialog.prototype._updateBackgroundEffects;
            
            UnlockDialog.prototype._updateBackgroundEffects = function() {
                // Always call native first to allow proper initialization
                origUpdateBackgroundEffects.apply(this, arguments);

                const settings = extension._settings;
                if (!settings) {
                    return;
                }

                const enableBlur = settings.get_boolean('enable-blur');
                const blurRadius = settings.get_int('blur-radius');
                const blurBrightness = settings.get_double('blur-brightness');

                if (enableBlur) {
                    // Fine-tune the blur radius and brightness on all background actors
                    if (this._backgroundGroup) {
                        // Retrieve current screen scale factor to ensure blur looks consistent on HiDPI/Retina screens
                        let scaleFactor = 1;
                        try {
                            const themeContext = St.ThemeContext.get_for_stage(global.stage);
                            if (themeContext) {
                                scaleFactor = themeContext.scale_factor;
                            }
                        } catch (e) {
                            // Fallback
                        }

                        this._backgroundGroup.get_children().forEach(actor => {
                            let effect = actor.get_effect('blur');
                            if (effect) {
                                // Newer GNOME Shell (46+) uses 'radius'. It expects sigma * 2
                                if ('radius' in effect) {
                                    effect.radius = blurRadius * 2 * scaleFactor;
                                }
                                // Older GNOME Shell uses 'sigma'
                                if ('sigma' in effect) {
                                    effect.sigma = blurRadius * scaleFactor;
                                }
                                if ('brightness' in effect) {
                                    effect.brightness = blurBrightness;
                                }
                            }
                        });
                    }
                } else {
                    // Remove all blur effects from background group if blur is disabled
                    if (this._backgroundGroup) {
                        this._backgroundGroup.get_children().forEach(actor => {
                            let effect = actor.get_effect('blur');
                            if (effect) {
                                actor.remove_effect(effect);
                            }
                        });
                    }
                }
            };
        }

        // 3. If lockscreen is already active during extension enablement
        if (Main.screenShield && Main.screenShield._dialog) {
            const dialog = Main.screenShield._dialog;
            this._activeDialog = dialog;
            dialog._updateCustomClockStyles();
            dialog._updateBackgroundEffects();
        }

        // 4. Listen to settings changes for real-time live preview/updates
        this._settingsChangedId = this._settings.connect('changed', () => {
            if (this._activeDialog) {
                this._activeDialog._updateCustomClockStyles();
                this._activeDialog._updateBackgroundEffects();
            }
        });
    }

    disable() {
        // Disconnect settings change listener
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        // Restore original prototype methods
        if (origInit) {
            UnlockDialog.prototype._init = origInit;
            origInit = null;
        }
        if (origUpdateBackgroundEffects) {
            UnlockDialog.prototype._updateBackgroundEffects = origUpdateBackgroundEffects;
            origUpdateBackgroundEffects = null;
        }

        // Revert any customizations on the active lockscreen dialog
        if (this._activeDialog) {
            const dialog = this._activeDialog;
            
            // Delete instance-attached helper method
            if (typeof dialog._updateCustomClockStyles === 'function') {
                delete dialog._updateCustomClockStyles;
            }

            // Restore native clock visibility and remove styles
            if (dialog._clock) {
                if (dialog._clock._time) {
                    dialog._clock._time.visible = true;
                    dialog._clock._time.style = '';
                }
                if (dialog._clock._date) {
                    dialog._clock._date.visible = true;
                    dialog._clock._date.style = '';
                }
                
                // Completely clean up and remove the custom text message label
                if (dialog._customTextLabel) {
                    dialog._clock.remove_child(dialog._customTextLabel);
                    dialog._customTextLabel.destroy();
                    dialog._customTextLabel = null;
                }
            }

            // Re-apply native background blur effects by calling the restored original method
            UnlockDialog.prototype._updateBackgroundEffects.call(dialog);

            this._activeDialog = null;
        }

        this._settings = null;
    }
}
