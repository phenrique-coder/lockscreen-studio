import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { UnlockDialog } from 'resource:///org/gnome/shell/ui/unlockDialog.js';

let origInit = null;
let origUpdateBackgroundEffects = null;

function updateCustomClockContent(dialog, settings) {
    if (!settings || !dialog._clock || !dialog._customClockContainer || !dialog._customClockContainer.visible) return;

    const clockStyle = settings.get_string('clock-style') || 'default';
    if (clockStyle === 'default') return;

    const clockFontSize = settings.get_int('clock-font-size');
    const clockFontFamily = settings.get_string('clock-font-family');
    const clockColor = settings.get_string('clock-color');
    const clockMinutesColor = settings.get_string('clock-minutes-color') || '#ffffff';
    const clockSeparatorColor = settings.get_string('clock-separator-color') || '#ffffff';
    const analogClockSkin = settings.get_string('analog-clock-skin') || 'minimalist';
    const clockSecondHandEnabled = settings.get_boolean('clock-second-hand-enabled');
    const clockSecondHandColor = settings.get_string('clock-second-hand-color') || '#ff4444';
    const analogClockShowNumbers = settings.get_boolean('analog-clock-show-numbers');
    const analogClockSize = settings.get_int('analog-clock-size');
    const analogClockNumbersColor = settings.get_string('analog-clock-numbers-color') || '#ffffff';

    const now = new Date();
    
    // Get clock format (12h or 24h)
    let is12h = false;
    try {
        const interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        is12h = interfaceSettings.get_string('clock-format') === '12h';
    } catch (e) {
        // Fallback
    }

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    let ampm = '';
    if (is12h) {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
    }
    const hoursStr = String(hours);
    const hoursDisplay = is12h ? hoursStr : hoursStr.padStart(2, '0');

    if (clockStyle === 'separated-colors') {
        // Ensure child nodes exist
        if (!dialog._customClockContainer._hoursLabel) {
            dialog._customClockContainer.destroy_all_children();
            
            dialog._customClockContainer._hoursLabel = new St.Label({ text: hoursDisplay });
            dialog._customClockContainer._separatorLabel = new St.Label({ text: ':' });
            dialog._customClockContainer._minutesLabel = new St.Label({ text: minutes });
            
            dialog._customClockContainer.add_child(dialog._customClockContainer._hoursLabel);
            dialog._customClockContainer.add_child(dialog._customClockContainer._separatorLabel);
            dialog._customClockContainer.add_child(dialog._customClockContainer._minutesLabel);

            if (is12h) {
                dialog._customClockContainer._ampmLabel = new St.Label({ text: ampm });
                dialog._customClockContainer.add_child(dialog._customClockContainer._ampmLabel);
            }
        } else {
            dialog._customClockContainer._hoursLabel.text = hoursDisplay;
            dialog._customClockContainer._minutesLabel.text = minutes;
            if (dialog._customClockContainer._ampmLabel) {
                dialog._customClockContainer._ampmLabel.text = ampm;
            }
        }

        // Apply styles
        dialog._customClockContainer._hoursLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor};`;
        dialog._customClockContainer._separatorLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockSeparatorColor}; margin: 0 4px;`;
        dialog._customClockContainer._minutesLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockMinutesColor};`;
        if (dialog._customClockContainer._ampmLabel) {
            dialog._customClockContainer._ampmLabel.style = `font-size: ${clockFontSize * 0.4}px; font-family: "${clockFontFamily}"; color: ${clockColor}; margin-left: 8px; y-align: end;`;
        }

    } else if (clockStyle === 'vertical-stack') {
        if (!dialog._customClockContainer._hoursLabel) {
            dialog._customClockContainer.destroy_all_children();

            dialog._customClockContainer._hoursLabel = new St.Label({ 
                text: hoursDisplay,
                x_align: Clutter.ActorAlign.CENTER 
            });
            dialog._customClockContainer._minutesLabel = new St.Label({ 
                text: minutes,
                x_align: Clutter.ActorAlign.CENTER 
            });

            dialog._customClockContainer.add_child(dialog._customClockContainer._hoursLabel);
            dialog._customClockContainer.add_child(dialog._customClockContainer._minutesLabel);
        } else {
            dialog._customClockContainer._hoursLabel.text = hoursDisplay;
            dialog._customClockContainer._minutesLabel.text = minutes;
        }

        dialog._customClockContainer._hoursLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor}; line-height: 1.0; text-align: center;`;
        dialog._customClockContainer._minutesLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockMinutesColor}; line-height: 1.0; text-align: center;`;

    } else if (clockStyle === 'analog') {
        const diameter = Math.max(100, analogClockSize);

        // Recreate outer widget if diameter changes or it's not created
        if (!dialog._customClockContainer._analogWidget) {
            dialog._customClockContainer.destroy_all_children();

            dialog._customClockContainer._analogWidget = new St.Widget({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            dialog._customClockContainer.add_child(dialog._customClockContainer._analogWidget);

            // Number labels (1-12)
            dialog._customClockContainer._numberLabels = [];
            for (let i = 1; i <= 12; i++) {
                const label = new St.Label({ text: String(i) });
                dialog._customClockContainer._analogWidget.add_child(label);
                dialog._customClockContainer._numberLabels.push(label);
            }

            // Hour tick marks — 12 positions
            dialog._customClockContainer._ticks = [];
            for (let i = 0; i < 12; i++) {
                const tick = new St.Widget({ style_class: 'analog-clock-tick' });
                dialog._customClockContainer._analogWidget.add_child(tick);
                dialog._customClockContainer._ticks.push(tick);
            }

            // Create hands
            dialog._customClockContainer._hourHand = new St.Widget({ style_class: 'analog-hour-hand' });
            dialog._customClockContainer._hourHand.set_pivot_point(0.5, 1.0);
            dialog._customClockContainer._analogWidget.add_child(dialog._customClockContainer._hourHand);

            dialog._customClockContainer._minuteHand = new St.Widget({ style_class: 'analog-minute-hand' });
            dialog._customClockContainer._minuteHand.set_pivot_point(0.5, 1.0);
            dialog._customClockContainer._analogWidget.add_child(dialog._customClockContainer._minuteHand);

            dialog._customClockContainer._secondHand = new St.Widget({ style_class: 'analog-second-hand' });
            dialog._customClockContainer._secondHand.set_pivot_point(0.5, 1.0);
            dialog._customClockContainer._analogWidget.add_child(dialog._customClockContainer._secondHand);

            dialog._customClockContainer._centerPin = new St.Widget({ style_class: 'analog-center-pin' });
            dialog._customClockContainer._analogWidget.add_child(dialog._customClockContainer._centerPin);

            // Inner decorative ring (Classic skin)
            dialog._customClockContainer._innerRing = new St.Widget();
            dialog._customClockContainer._analogWidget.add_child(dialog._customClockContainer._innerRing);
        }

        // Configure Face/Border styles based on Skin
        let borderColor = clockColor;
        let faceBg = 'rgba(255, 255, 255, 0.05)';
        let borderWidth = 3;
        let shadow = 'none';
        let showNumbers = false;
        let tickStyle = 'none';

        if (analogClockSkin === 'accent') {
            borderWidth = 3;
            const aHex = clockMinutesColor.replace('#', '');
            const aR = parseInt(aHex.substring(0, 2), 16);
            const aG = parseInt(aHex.substring(2, 4), 16);
            const aB = parseInt(aHex.substring(4, 6), 16);
            faceBg = `rgba(${aR}, ${aG}, ${aB}, 0.08)`;
            shadow = 'none';
            showNumbers = false;
            tickStyle = 'bars';
        } else if (analogClockSkin === 'minimalist') {
            borderWidth = 1.5;
            faceBg = 'transparent';
            shadow = 'none';
            showNumbers = false;
            tickStyle = 'dots';
        } else if (analogClockSkin === 'classic') {
            borderWidth = 3;
            faceBg = 'transparent';
            shadow = 'none';
            showNumbers = true;
            tickStyle = 'none';
        }

        dialog._customClockContainer._analogWidget.set_size(diameter, diameter);
        dialog._customClockContainer._analogWidget.style = `
            width: ${diameter}px;
            height: ${diameter}px;
            border-radius: ${diameter / 2}px;
            border: ${borderWidth}px solid ${borderColor};
            background-color: ${faceBg};
            box-shadow: ${shadow};
        `;

        // Position hands
        const wh = diameter * 0.04;
        const hh = diameter * 0.22;
        dialog._customClockContainer._hourHand.set_position(diameter/2 - wh/2, diameter/2 - hh);
        dialog._customClockContainer._hourHand.style = `
            background-color: ${clockColor};
            width: ${wh}px;
            height: ${hh}px;
            border-radius: ${wh/2}px;
        `;

        const wm = diameter * 0.03;
        const hm = diameter * 0.32;
        dialog._customClockContainer._minuteHand.set_position(diameter/2 - wm/2, diameter/2 - hm);
        dialog._customClockContainer._minuteHand.style = `
            background-color: ${clockMinutesColor};
            width: ${wm}px;
            height: ${hm}px;
            border-radius: ${wm/2}px;
        `;

        // Show/hide second hand
        dialog._customClockContainer._secondHand.visible = clockSecondHandEnabled;
        const ws = diameter * 0.015;
        const hs = diameter * 0.35;
        dialog._customClockContainer._secondHand.set_position(diameter/2 - ws/2, diameter/2 - hs);
        dialog._customClockContainer._secondHand.style = `
            background-color: ${clockSecondHandColor};
            width: ${ws}px;
            height: ${hs}px;
            border-radius: ${ws/2}px;
        `;

        // Center Pin
        const wp = diameter * 0.08;
        dialog._customClockContainer._centerPin.set_position(diameter/2 - wp/2, diameter/2 - wp/2);
        dialog._customClockContainer._centerPin.style = `
            background-color: ${clockSecondHandEnabled ? clockSecondHandColor : clockMinutesColor};
            width: ${wp}px;
            height: ${wp}px;
            border-radius: ${wp/2}px;
        `;

        // Inner decorative ring (Classic skin — always visible when analog)
        if (dialog._customClockContainer._innerRing) {
            dialog._customClockContainer._innerRing.visible = false;
        }

        // Number labels positioning and styling
        const numRadius = diameter * 0.36;
        const numFontSize = Math.max(8, Math.round(diameter * 0.13));
        const numColor = analogClockNumbersColor;

        dialog._customClockContainer._numberLabels.forEach((label, idx) => {
            const n = idx + 1;
            label.visible = showNumbers;
            if (showNumbers) {
                const angle = (n * 30 - 90) * Math.PI / 180;
                const labelW = (n >= 10) ? numFontSize * 0.9 : numFontSize * 0.55;
                const labelH = numFontSize * 0.8;
                const cx = diameter / 2 + numRadius * Math.cos(angle);
                const cy = diameter / 2 + numRadius * Math.sin(angle);
                const nx = Math.round(cx - labelW / 2);
                const ny = Math.round(cy - labelH / 2);
                label.set_position(nx, ny);
                label.style = `
                    font-size: ${numFontSize}px;
                    font-family: "${clockFontFamily}";
                    color: ${numColor};
                    font-weight: bold;
                `;
            }
        });

        // Ticks configuration — 12 hour positions
        const tickColor = (analogClockSkin === 'accent') ? clockMinutesColor : clockSeparatorColor;

        dialog._customClockContainer._ticks.forEach((tick, i) => {
            const isMajor = (analogClockSkin === 'accent') ? true : (i % 3 === 0);

            if (tickStyle === 'none') {
                tick.visible = false;
            } else if (tickStyle === 'dots') {
                tick.visible = true;
                const dotSize = Math.round(diameter * (isMajor ? 0.025 : 0.015));
                const angle = (i * 30 - 90) * Math.PI / 180;
                const dotR = diameter * 0.42;
                const dx = diameter / 2 + dotR * Math.cos(angle) - dotSize / 2;
                const dy = diameter / 2 + dotR * Math.sin(angle) - dotSize / 2;
                tick.set_position(Math.round(dx), Math.round(dy));
                tick.rotation_angle_z = 0;
                tick.style = `
                    background-color: ${clockColor};
                    width: ${dotSize}px;
                    height: ${dotSize}px;
                    border-radius: ${dotSize / 2}px;
                    opacity: ${isMajor ? 1.0 : 0.5};
                `;
            } else {
                tick.visible = true;
                const innerR = diameter * 0.41;
                const h = Math.round(diameter * (isMajor ? 0.065 : 0.04));
                const outerR = innerR + h;
                const w = Math.round(diameter * (isMajor ? 0.015 : 0.01));
                const angleRad = (i * 30 - 90) * Math.PI / 180;

                const px = diameter / 2 + innerR * Math.cos(angleRad) - w / 2;
                const py = diameter / 2 + innerR * Math.sin(angleRad) - h;

                tick.set_position(Math.round(px), Math.round(py));
                tick.set_pivot_point(0.5, 1.0);
                tick.rotation_angle_z = i * 30;
                tick.style = `
                    background-color: ${tickColor};
                    width: ${w}px;
                    height: ${h}px;
                    border-radius: ${Math.round(w / 2)}px;
                    opacity: ${isMajor ? 1.0 : 0.6};
                `;
            }
        });

        // Rotate hands based on time
        const s = now.getSeconds();
        const m = now.getMinutes();
        const h = now.getHours();

        const hourAngle = (h % 12) * 30 + m * 0.5;
        const minuteAngle = m * 6 + s * 0.1;
        const secondAngle = s * 6;

        dialog._customClockContainer._hourHand.rotation_angle_z = hourAngle;
        dialog._customClockContainer._minuteHand.rotation_angle_z = minuteAngle;
        if (clockSecondHandEnabled) {
            dialog._customClockContainer._secondHand.rotation_angle_z = secondAngle;
        }
    }
}

function updateCustomClockStyles(dialog, settings) {
    if (!settings || !dialog._clock) return;

    const clockVisible = settings.get_boolean('clock-visible');
    const clockFontSize = settings.get_int('clock-font-size');
    const clockFontFamily = settings.get_string('clock-font-family');
    const clockColor = settings.get_string('clock-color');
    const clockStyle = settings.get_string('clock-style') || 'default';

    const dateVisible = settings.get_boolean('date-visible');
    const dateFontSize = settings.get_int('date-font-size');
    const dateFontFamily = settings.get_string('date-font-family');
    const dateColor = settings.get_string('date-color');

    const customTextEnabled = settings.get_boolean('custom-text-enabled');
    const customText = settings.get_string('custom-text');
    const customTextFontSize = settings.get_int('custom-text-font-size');
    const customTextFontFamily = settings.get_string('custom-text-font-family');
    const customTextColor = settings.get_string('custom-text-color');

    // 1. Manage Custom Clock Container visibility
    const useCustomClock = clockVisible && clockStyle !== 'default';

    if (useCustomClock) {
        if (!dialog._customClockContainer) {
            dialog._customClockContainer = new St.BoxLayout({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            // Find index of standard time label and insert it there
            let timeIndex = 0;
            const children = dialog._clock.get_children();
            const idx = children.indexOf(dialog._clock._time);
            if (idx !== -1) {
                timeIndex = idx;
            }
            dialog._clock.insert_child_at_index(dialog._customClockContainer, timeIndex);
        }
        
        // Match container orientation
        if (clockStyle === 'vertical-stack') {
            dialog._customClockContainer.vertical = true;
        } else {
            dialog._customClockContainer.vertical = false;
        }
        
        // Force recreation of child widgets when style or skin changes
        const analogClockSkin = settings.get_string('analog-clock-skin') || 'minimalist';
        const styleChanged = dialog._customClockContainer._currentStyle !== clockStyle;
        const skinChanged = dialog._customClockContainer._currentSkin !== analogClockSkin;
        if (styleChanged || skinChanged) {
            dialog._customClockContainer.destroy_all_children();
            dialog._customClockContainer._hoursLabel = null;
            dialog._customClockContainer._minutesLabel = null;
            dialog._customClockContainer._separatorLabel = null;
            dialog._customClockContainer._ampmLabel = null;
            dialog._customClockContainer._analogWidget = null;
            dialog._customClockContainer._numberLabels = null;
            dialog._customClockContainer._ticks = null;
            dialog._customClockContainer._innerRing = null;
            dialog._customClockContainer._currentStyle = clockStyle;
            dialog._customClockContainer._currentSkin = analogClockSkin;
        }

        dialog._customClockContainer.visible = true;
        
        // Update content
        updateCustomClockContent(dialog, settings);
    } else {
        if (dialog._customClockContainer) {
            dialog._customClockContainer.visible = false;
        }
    }

    // Apply Time (Clock) styles
    if (dialog._clock._time) {
        dialog._clock._time.visible = clockVisible && !useCustomClock;
        if (clockVisible && !useCustomClock) {
            dialog._clock._time.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor};`;
        }
    }

    // Apply Date styles
    if (dialog._clock._date) {
        dialog._clock._date.visible = dateVisible;
        if (dateVisible) {
            dialog._clock._date.style = `font-size: ${dateFontSize}px; font-family: "${dateFontFamily}"; color: ${dateColor}; margin-top: 10px;`;
        }
    }

    // Manage Custom Text Label
    if (customTextEnabled && customText) {
        if (!dialog._customTextLabel) {
            dialog._customTextLabel = new St.Label({
                text: customText,
                style_class: 'lockscreen-custom-text'
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

export default class LockscreenStudioExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._activeDialog = null;
        this._clockTimerId = null;

        const extension = this;

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
                        extension._stopClockTimer();
                        extension._activeDialog = null;
                    }
                });

                // Monkey-patch _updateClock on the instance to update our custom clock content
                if (this._clock && !this._clock._origUpdateClock) {
                    this._clock._origUpdateClock = this._clock._updateClock;
                    const clockInstance = this._clock;
                    this._clock._updateClock = function() {
                        clockInstance._origUpdateClock.apply(this, arguments);
                        updateCustomClockContent(extension._activeDialog, extension._settings);
                    };
                }
                
                // Apply custom styles immediately
                updateCustomClockStyles(this, extension._settings);

                // Manage timer state
                extension._checkTimerState();
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
                const enableBrightness = settings.get_boolean('enable-brightness');
                const blurBrightness = settings.get_double('blur-brightness');

                if (enableBlur || enableBrightness) {
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
                                    effect.radius = enableBlur ? (blurRadius * 2 * scaleFactor) : 0;
                                }
                                // Older GNOME Shell uses 'sigma'
                                if ('sigma' in effect) {
                                    effect.sigma = enableBlur ? (blurRadius * scaleFactor) : 0;
                                }
                                if ('brightness' in effect) {
                                    effect.brightness = enableBrightness ? blurBrightness : 1.0;
                                }
                            }
                        });
                    }
                } else {
                    // Remove all blur effects from background group if both blur and brightness are disabled
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
            
            // Patch instance _updateClock
            if (dialog._clock && !dialog._clock._origUpdateClock) {
                dialog._clock._origUpdateClock = dialog._clock._updateClock;
                dialog._clock._updateClock = function() {
                    dialog._clock._origUpdateClock.apply(this, arguments);
                    updateCustomClockContent(dialog, extension._settings);
                };
            }

            updateCustomClockStyles(dialog, this._settings);
            dialog._updateBackgroundEffects();
            this._checkTimerState();
        }

        // 4. Listen to settings changes for real-time live preview/updates
        this._settingsChangedId = this._settings.connect('changed', () => {
            if (this._activeDialog) {
                updateCustomClockStyles(this._activeDialog, this._settings);
                this._activeDialog._updateBackgroundEffects();
                this._checkTimerState();
            }
        });
    }

    _checkTimerState() {
        if (!this._settings || !this._activeDialog) {
            this._stopClockTimer();
            return;
        }

        const clockVisible = this._settings.get_boolean('clock-visible');
        const clockStyle = this._settings.get_string('clock-style') || 'default';

        if (clockVisible && clockStyle === 'analog') {
            this._startClockTimer();
        } else {
            this._stopClockTimer();
        }
    }

    _startClockTimer() {
        if (this._clockTimerId) return;

        this._clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._activeDialog && this._settings) {
                updateCustomClockContent(this._activeDialog, this._settings);
                return GLib.SOURCE_CONTINUE;
            }
            this._clockTimerId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopClockTimer() {
        if (this._clockTimerId) {
            GLib.source_remove(this._clockTimerId);
            this._clockTimerId = null;
        }
    }

    disable() {
        this._stopClockTimer();

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

            // Restore native clock visibility and remove styles
            if (dialog._clock) {
                if (dialog._clock._origUpdateClock) {
                    dialog._clock._updateClock = dialog._clock._origUpdateClock;
                    delete dialog._clock._origUpdateClock;
                }

                if (dialog._clock._time) {
                    dialog._clock._time.visible = true;
                    dialog._clock._time.style = '';
                }
                if (dialog._clock._date) {
                    dialog._clock._date.visible = true;
                    dialog._clock._date.style = '';
                }
                
                // Completely clean up and remove the custom clock container
                if (dialog._customClockContainer) {
                    dialog._clock.remove_child(dialog._customClockContainer);
                    dialog._customClockContainer.destroy();
                    dialog._customClockContainer = null;
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
