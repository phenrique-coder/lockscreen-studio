// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - User / Auth Prompt & Top Bar Panel Manager
 * Scaling and fonts for username, password, user icon, and top panel.
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import { SETTINGS_KEYS } from '../constants.js';

export class AuthPromptManager {
    /**
     * Apply custom auth prompt styles (user avatar size, username font/color, password entry font/color).
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    static updateAuthPrompt(dialog, settings) {
        if (!dialog || !settings || !dialog._authPrompt) {
            return;
        }

        const authCustomEnabled = settings.get_boolean(SETTINGS_KEYS.AUTH_CUSTOM_STYLE_ENABLED);
        const authPrompt = dialog._authPrompt;

        let scaleFactor = 1;
        try {
            const themeContext = St.ThemeContext.get_for_stage(global.stage);
            if (themeContext) {
                scaleFactor = themeContext.scale_factor;
            }
        } catch (e) {
            // Fallback
        }

        const userWidget = authPrompt._userWell ? authPrompt._userWell.get_child() : null;

        if (authCustomEnabled) {
            const avatarSize = settings.get_int(SETTINGS_KEYS.AUTH_AVATAR_SIZE);
            const usernameFontSize = settings.get_int(SETTINGS_KEYS.AUTH_USERNAME_FONT_SIZE);
            const usernameFontFamily = settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY);
            const usernameColor = settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_COLOR);
            const entryFontSize = settings.get_int(SETTINGS_KEYS.AUTH_ENTRY_FONT_SIZE);
            const entryColor = settings.get_string(SETTINGS_KEYS.AUTH_ENTRY_COLOR);
            const messageFontSize = settings.get_int(SETTINGS_KEYS.AUTH_MESSAGE_FONT_SIZE);
            const messageColor = settings.get_string(SETTINGS_KEYS.AUTH_MESSAGE_COLOR);

            // Style user avatar
            if (userWidget && userWidget._avatar) {
                const avatar = userWidget._avatar;
                const scaledSize = avatarSize * scaleFactor;
                avatar.set_size(scaledSize, scaledSize);
                avatar.style = `width: ${scaledSize}px; height: ${scaledSize}px; border-radius: ${Math.round(scaledSize / 2)}px;`;

                if (avatar.child && avatar.child.set_icon_size) {
                    avatar.child.set_icon_size(Math.round(scaledSize * 0.65));
                }
            }

            // Style username label
            if (userWidget && userWidget._label) {
                const labelContainer = userWidget._label;
                const usernameStyle = `font-size: ${usernameFontSize}px; font-family: "${usernameFontFamily}"; color: ${usernameColor}; text-align: center;`;

                if (labelContainer._realNameLabel) {
                    labelContainer._realNameLabel.style = usernameStyle;
                }
                if (labelContainer._userNameLabel) {
                    labelContainer._userNameLabel.style = usernameStyle;
                }
                if (labelContainer.style !== undefined) {
                    labelContainer.style = usernameStyle;
                }
            }

            // Style password and input entries
            const applyEntryStyle = (entry) => {
                if (!entry) return;
                entry.style = `font-size: ${entryFontSize}px; color: ${entryColor};`;
                if (entry.clutter_text) {
                    entry.clutter_text.style = `font-size: ${entryFontSize}px; color: ${entryColor};`;
                }
            };

            applyEntryStyle(authPrompt._entry);
            applyEntryStyle(authPrompt._passwordEntry);
            applyEntryStyle(authPrompt._textEntry);

            // Style PAM message
            if (authPrompt._message) {
                authPrompt._message.style = `font-size: ${messageFontSize}px; color: ${messageColor}; text-align: center;`;
            }
        } else {
            // Restore default styles
            if (userWidget && userWidget._avatar) {
                userWidget._avatar.style = '';
                if (userWidget._avatar.update) {
                    userWidget._avatar.update();
                }
            }

            if (userWidget && userWidget._label) {
                if (userWidget._label._realNameLabel) {
                    userWidget._label._realNameLabel.style = '';
                }
                if (userWidget._label._userNameLabel) {
                    userWidget._label._userNameLabel.style = '';
                }
            }

            const clearEntryStyle = (entry) => {
                if (!entry) return;
                entry.style = '';
                if (entry.clutter_text) {
                    entry.clutter_text.style = '';
                }
            };

            clearEntryStyle(authPrompt._entry);
            clearEntryStyle(authPrompt._passwordEntry);
            clearEntryStyle(authPrompt._textEntry);

            if (authPrompt._message) {
                authPrompt._message.style = '';
            }
        }
    }

    /**
     * Apply or restore Top Bar / Panel custom scaling.
     *
     * @param {Gio.Settings} settings - Extension GSettings
     */
    static updatePanel(settings) {
        if (!Main.panel || !settings) {
            return;
        }

        const panelCustomEnabled = settings.get_boolean(SETTINGS_KEYS.PANEL_CUSTOM_STYLE_ENABLED);

        if (panelCustomEnabled) {
            if (Main.panel._lssOrigStyle === undefined) {
                Main.panel._lssOrigStyle = Main.panel.style || '';
            }

            const panelHeight = settings.get_int(SETTINGS_KEYS.PANEL_HEIGHT);
            const panelFontSize = settings.get_int(SETTINGS_KEYS.PANEL_FONT_SIZE);

            Main.panel.style = `${Main.panel._lssOrigStyle}; height: ${panelHeight}px; font-size: ${panelFontSize}px;`;
        } else {
            if (Main.panel._lssOrigStyle !== undefined) {
                Main.panel.style = Main.panel._lssOrigStyle;
                delete Main.panel._lssOrigStyle;
            }
        }
    }

    /**
     * Clean up and restore default styles on dialog authPrompt and panel.
     *
     * @param {object} dialog - UnlockDialog instance
     */
    static cleanup(dialog) {
        // Restore Panel
        if (Main.panel && Main.panel._lssOrigStyle !== undefined) {
            Main.panel.style = Main.panel._lssOrigStyle;
            delete Main.panel._lssOrigStyle;
        }

        // Restore AuthPrompt
        if (dialog?._authPrompt) {
            const authPrompt = dialog._authPrompt;
            const userWidget = authPrompt._userWell ? authPrompt._userWell.get_child() : null;

            if (userWidget && userWidget._avatar) {
                userWidget._avatar.style = '';
                if (userWidget._avatar.update) {
                    userWidget._avatar.update();
                }
            }

            if (userWidget && userWidget._label) {
                if (userWidget._label._realNameLabel) {
                    userWidget._label._realNameLabel.style = '';
                }
                if (userWidget._label._userNameLabel) {
                    userWidget._label._userNameLabel.style = '';
                }
            }

            const clearEntry = (entry) => {
                if (entry) {
                    entry.style = '';
                    if (entry.clutter_text) {
                        entry.clutter_text.style = '';
                    }
                }
            };

            clearEntry(authPrompt._entry);
            clearEntry(authPrompt._passwordEntry);
            clearEntry(authPrompt._textEntry);

            if (authPrompt._message) {
                authPrompt._message.style = '';
            }
        }
    }
}
