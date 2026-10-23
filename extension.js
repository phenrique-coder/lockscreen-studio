// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Main Extension Entry Point
 *
 * Coordinates modular managers with single responsibilities:
 * - BackgroundManager: blur and brightness overlay
 * - ClockManager: clock formats, styles, date and analog clock ticking
 * - CustomTextManager: custom on-screen lock screen message
 * - AuthPromptManager: user icon, username, password and panel scaling (Issue #2)
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { UnlockDialog } from 'resource:///org/gnome/shell/ui/unlockDialog.js';

import { BackgroundManager } from './src/extension/backgroundManager.js';
import { ClockManager } from './src/extension/clockManager.js';
import { CustomTextManager } from './src/extension/customTextManager.js';
import { AuthPromptManager } from './src/extension/authPromptManager.js';

let origInit = null;
let origUpdateBackgroundEffects = null;
let origEnsureAuthPrompt = null;

export default class LockscreenStudioExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._activeDialog = null;
        this._dialogDestroyId = null;
        this._settingsChangedId = null;
        this._clockManager = new ClockManager();

        const extension = this;

        // 1. Monkey patch UnlockDialog.prototype._init
        if (!origInit) {
            origInit = UnlockDialog.prototype._init;

            UnlockDialog.prototype._init = function() {
                origInit.apply(this, arguments);

                // Track active dialog instance
                extension._activeDialog = this;

                // Setup destroy listener to prevent leaks
                extension._dialogDestroyId = this.connect('destroy', () => {
                    extension._dialogDestroyId = null;
                    if (extension._activeDialog === this) {
                        extension._clockManager.stopTimer();
                        extension._activeDialog = null;
                    }
                });

                // Monkey-patch _updateClock on the instance to update custom clock content
                if (this._clock && !this._clock._origUpdateClock) {
                    this._clock._origUpdateClock = this._clock._updateClock;
                    const clockInstance = this._clock;
                    this._clock._updateClock = function() {
                        clockInstance._origUpdateClock.apply(this, arguments);
                        extension._clockManager.updateContent(extension._activeDialog, extension._settings);
                    };
                }

                // Apply styles immediately
                extension._applyDialogCustomizations(this);
            };
        }

        // 2. Monkey patch UnlockDialog.prototype._updateBackgroundEffects
        if (!origUpdateBackgroundEffects) {
            origUpdateBackgroundEffects = UnlockDialog.prototype._updateBackgroundEffects;

            UnlockDialog.prototype._updateBackgroundEffects = function() {
                origUpdateBackgroundEffects.apply(this, arguments);

                if (extension._settings) {
                    BackgroundManager.updateBackground(this, extension._settings);
                }
            };
        }

        // 3. Monkey patch UnlockDialog.prototype._ensureAuthPrompt (Issue #2)
        if (!origEnsureAuthPrompt) {
            origEnsureAuthPrompt = UnlockDialog.prototype._ensureAuthPrompt;

            UnlockDialog.prototype._ensureAuthPrompt = function() {
                origEnsureAuthPrompt.apply(this, arguments);

                if (extension._settings && this._authPrompt) {
                    AuthPromptManager.updateAuthPrompt(this, extension._settings);

                    // Hook setUser on instance to re-apply styles when user switches/reloads
                    if (!this._authPrompt._origSetUser) {
                        this._authPrompt._origSetUser = this._authPrompt.setUser;
                        const authPromptInstance = this._authPrompt;
                        const activeDialog = this;
                        this._authPrompt.setUser = function() {
                            authPromptInstance._origSetUser.apply(this, arguments);
                            if (extension._settings) {
                                AuthPromptManager.updateAuthPrompt(activeDialog, extension._settings);
                            }
                        };
                    }
                }
            };
        }

        // 4. If lockscreen is already active during extension enablement
        if (Main.screenShield && Main.screenShield._dialog) {
            const dialog = Main.screenShield._dialog;
            this._activeDialog = dialog;

            this._dialogDestroyId = dialog.connect('destroy', () => {
                extension._dialogDestroyId = null;
                if (extension._activeDialog === dialog) {
                    extension._clockManager.stopTimer();
                    extension._activeDialog = null;
                }
            });

            // Patch instance _updateClock
            if (dialog._clock && !dialog._clock._origUpdateClock) {
                dialog._clock._origUpdateClock = dialog._clock._updateClock;
                dialog._clock._updateClock = function() {
                    dialog._clock._origUpdateClock.apply(this, arguments);
                    extension._clockManager.updateContent(dialog, extension._settings);
                };
            }

            this._applyDialogCustomizations(dialog);
            dialog._updateBackgroundEffects();
        }

        // Apply panel scaling
        AuthPromptManager.updatePanel(this._settings);

        // 5. Listen to settings changes for real-time live preview/updates
        this._settingsChangedId = this._settings.connect('changed', () => {
            AuthPromptManager.updatePanel(this._settings);

            if (this._activeDialog) {
                this._applyDialogCustomizations(this._activeDialog);
                this._activeDialog._updateBackgroundEffects();
            }
        });
    }

    _applyDialogCustomizations(dialog) {
        if (!dialog || !this._settings) {
            return;
        }

        this._clockManager.updateStyles(dialog, this._settings);
        CustomTextManager.update(dialog, this._settings);
        AuthPromptManager.updateAuthPrompt(dialog, this._settings);
        this._clockManager.checkTimerState(dialog, this._settings);
    }

    disable() {
        // Session Modes: 'user' and 'unlock-dialog'
        // 'user' allows the extension to remain enabled during the regular user desktop session,
        // listen to settings changes, and prepare UnlockDialog hooks.
        // 'unlock-dialog' ensures GNOME Shell keeps the extension active when the screen locks,
        // allowing custom clock styles, custom text, and blur/brightness effects to display on the lock screen.
        // During disable(), we restore all original prototypes and remove all created elements to clean up.

        // Disconnect settings change listener
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        // Disconnect active dialog destroy listener
        if (this._dialogDestroyId) {
            if (this._activeDialog) {
                this._activeDialog.disconnect(this._dialogDestroyId);
            }
            this._dialogDestroyId = null;
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
        if (origEnsureAuthPrompt) {
            UnlockDialog.prototype._ensureAuthPrompt = origEnsureAuthPrompt;
            origEnsureAuthPrompt = null;
        }

        // Restore active dialog customizations
        if (this._activeDialog) {
            const dialog = this._activeDialog;

            if (dialog._authPrompt && dialog._authPrompt._origSetUser) {
                dialog._authPrompt.setUser = dialog._authPrompt._origSetUser;
                delete dialog._authPrompt._origSetUser;
            }

            if (this._clockManager) {
                this._clockManager.cleanup(dialog);
            }
            CustomTextManager.cleanup(dialog);
            BackgroundManager.cleanup(dialog);
            AuthPromptManager.cleanup(dialog);

            // Re-apply native background blur effects
            UnlockDialog.prototype._updateBackgroundEffects.call(dialog);

            this._activeDialog = null;
        } else {
            if (this._clockManager) {
                this._clockManager.stopTimer();
            }
            AuthPromptManager.cleanup(null);
        }

        this._clockManager = null;
        this._settings = null;
    }
}
