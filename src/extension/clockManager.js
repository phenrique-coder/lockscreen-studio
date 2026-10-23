// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Clock & Date Display Manager
 * Responsible for managing clock styles, date formatting, and analog clock ticking timer.
 */

import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import { SETTINGS_KEYS, CLOCK_STYLES } from '../constants.js';
import { AnalogClock } from './analogClock.js';

export class ClockManager {
    constructor() {
        this._clockTimerId = null;
    }

    /**
     * Update the clock layout and styles according to settings.
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    updateStyles(dialog, settings) {
        if (!dialog || !settings || !dialog._clock) {
            return;
        }

        const clockVisible = settings.get_boolean(SETTINGS_KEYS.CLOCK_VISIBLE);
        const clockFontSize = settings.get_int(SETTINGS_KEYS.CLOCK_FONT_SIZE);
        const clockFontFamily = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY);
        const clockColor = settings.get_string(SETTINGS_KEYS.CLOCK_COLOR);
        const clockStyle = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;

        const dateVisible = settings.get_boolean(SETTINGS_KEYS.DATE_VISIBLE);
        const dateFontSize = settings.get_int(SETTINGS_KEYS.DATE_FONT_SIZE);
        const dateFontFamily = settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY);
        const dateColor = settings.get_string(SETTINGS_KEYS.DATE_COLOR);

        const useCustomClock = clockVisible && clockStyle !== CLOCK_STYLES.DEFAULT;

        if (useCustomClock) {
            if (!dialog._customClockContainer) {
                dialog._customClockContainer = new St.BoxLayout({
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });

                let timeIndex = 0;
                const children = dialog._clock.get_children();
                const idx = children.indexOf(dialog._clock._time);
                if (idx !== -1) {
                    timeIndex = idx;
                }
                dialog._clock.insert_child_at_index(dialog._customClockContainer, timeIndex);
            }

            if (clockStyle === CLOCK_STYLES.VERTICAL_STACK) {
                dialog._customClockContainer.set_orientation(Clutter.Orientation.VERTICAL);
            } else {
                dialog._customClockContainer.set_orientation(Clutter.Orientation.HORIZONTAL);
            }

            const analogClockSkin = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN) || 'minimalist';
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
            this.updateContent(dialog, settings);
        } else {
            if (dialog._customClockContainer) {
                dialog._customClockContainer.visible = false;
            }
        }

        // Native time label
        if (dialog._clock._time) {
            dialog._clock._time.visible = clockVisible && !useCustomClock;
            if (clockVisible && !useCustomClock) {
                dialog._clock._time.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor};`;
            }
        }

        // Native date label
        if (dialog._clock._date) {
            dialog._clock._date.visible = dateVisible;
            if (dateVisible) {
                dialog._clock._date.style = `font-size: ${dateFontSize}px; font-family: "${dateFontFamily}"; color: ${dateColor}; margin-top: 10px;`;
            }
        }
    }

    /**
     * Update text and hands of custom clock container.
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    updateContent(dialog, settings) {
        if (!dialog || !settings || !dialog._clock || !dialog._customClockContainer || !dialog._customClockContainer.visible) {
            return;
        }

        const clockStyle = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;
        if (clockStyle === CLOCK_STYLES.DEFAULT) {
            return;
        }

        const clockFontSize = settings.get_int(SETTINGS_KEYS.CLOCK_FONT_SIZE);
        const clockFontFamily = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY);
        const clockColor = settings.get_string(SETTINGS_KEYS.CLOCK_COLOR);
        const clockMinutesColor = settings.get_string(SETTINGS_KEYS.CLOCK_MINUTES_COLOR) || '#ffffff';
        const clockSeparatorColor = settings.get_string(SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR) || '#ffffff';

        const now = new Date();

        // 12h or 24h format check
        let is12h = false;
        try {
            const interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
            is12h = interfaceSettings.get_string('clock-format') === '12h';
        } catch (e) {
            // Fallback
        }

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');

        let ampm = '';
        if (is12h) {
            ampm = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12 || 12;
        }
        const hoursStr = String(hours);
        const hoursDisplay = is12h ? hoursStr : hoursStr.padStart(2, '0');

        if (clockStyle === CLOCK_STYLES.SEPARATED_COLORS) {
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

            dialog._customClockContainer._hoursLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor};`;
            dialog._customClockContainer._separatorLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockSeparatorColor}; margin: 0 4px;`;
            dialog._customClockContainer._minutesLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockMinutesColor};`;
            if (dialog._customClockContainer._ampmLabel) {
                dialog._customClockContainer._ampmLabel.style = `font-size: ${clockFontSize * 0.4}px; font-family: "${clockFontFamily}"; color: ${clockColor}; margin-left: 8px; y-align: end;`;
            }

        } else if (clockStyle === CLOCK_STYLES.VERTICAL_STACK) {
            if (!dialog._customClockContainer._hoursLabel) {
                dialog._customClockContainer.destroy_all_children();

                dialog._customClockContainer._hoursLabel = new St.Label({
                    text: hoursDisplay,
                    x_align: Clutter.ActorAlign.CENTER,
                });
                dialog._customClockContainer._minutesLabel = new St.Label({
                    text: minutes,
                    x_align: Clutter.ActorAlign.CENTER,
                });

                dialog._customClockContainer.add_child(dialog._customClockContainer._hoursLabel);
                dialog._customClockContainer.add_child(dialog._customClockContainer._minutesLabel);
            } else {
                dialog._customClockContainer._hoursLabel.text = hoursDisplay;
                dialog._customClockContainer._minutesLabel.text = minutes;
            }

            dialog._customClockContainer._hoursLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockColor}; line-height: 1.0; text-align: center;`;
            dialog._customClockContainer._minutesLabel.style = `font-size: ${clockFontSize}px; font-family: "${clockFontFamily}"; color: ${clockMinutesColor}; line-height: 1.0; text-align: center;`;

        } else if (clockStyle === CLOCK_STYLES.ANALOG) {
            AnalogClock.render(dialog._customClockContainer, settings, now);
        }
    }

    /**
     * Check timer requirement and start/stop the 1-second interval appropriately.
     *
     * @param {object} dialog - UnlockDialog instance
     * @param {Gio.Settings} settings - Extension GSettings
     */
    checkTimerState(dialog, settings) {
        if (!dialog || !settings) {
            this.stopTimer();
            return;
        }

        const clockVisible = settings.get_boolean(SETTINGS_KEYS.CLOCK_VISIBLE);
        const clockStyle = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;

        if (clockVisible && clockStyle === CLOCK_STYLES.ANALOG) {
            this.startTimer(dialog, settings);
        } else {
            this.stopTimer();
        }
    }

    startTimer(dialog, settings) {
        if (this._clockTimerId) {
            return;
        }

        this._clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (dialog && settings) {
                this.updateContent(dialog, settings);
                return GLib.SOURCE_CONTINUE;
            }
            this._clockTimerId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    stopTimer() {
        if (this._clockTimerId) {
            GLib.source_remove(this._clockTimerId);
            this._clockTimerId = null;
        }
    }

    /**
     * Restore original native clock styles and remove custom clock container.
     *
     * @param {object} dialog - UnlockDialog instance
     */
    cleanup(dialog) {
        this.stopTimer();

        if (!dialog || !dialog._clock) {
            return;
        }

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

        if (dialog._customClockContainer) {
            dialog._clock.remove_child(dialog._customClockContainer);
            dialog._customClockContainer.destroy();
            dialog._customClockContainer = null;
        }
    }
}
