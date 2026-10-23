// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Analog Clock Component
 * Responsible for constructing, styling, and animating the Analog Clock widget on the lock screen.
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { SETTINGS_KEYS, ANALOG_SKINS } from '../constants.js';

export class AnalogClock {
    /**
     * Create or update the analog clock face, hands, ticks and numbers.
     *
     * @param {St.BoxLayout} container - Custom clock container
     * @param {Gio.Settings} settings - Extension GSettings
     * @param {Date} now - Current time
     */
    static render(container, settings, now) {
        if (!container || !settings) {
            return;
        }

        const clockFontSize = settings.get_int(SETTINGS_KEYS.CLOCK_FONT_SIZE);
        const clockFontFamily = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY);
        const clockColor = settings.get_string(SETTINGS_KEYS.CLOCK_COLOR);
        const clockMinutesColor = settings.get_string(SETTINGS_KEYS.CLOCK_MINUTES_COLOR) || '#ffffff';
        const clockSeparatorColor = settings.get_string(SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR) || '#ffffff';
        const analogClockSkin = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN) || ANALOG_SKINS.MINIMALIST;
        const clockSecondHandEnabled = settings.get_boolean(SETTINGS_KEYS.CLOCK_SECOND_HAND_ENABLED);
        const clockSecondHandColor = settings.get_string(SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR) || '#ff4444';
        const analogClockShowNumbers = settings.get_boolean(SETTINGS_KEYS.ANALOG_CLOCK_SHOW_NUMBERS);
        const analogClockSize = settings.get_int(SETTINGS_KEYS.ANALOG_CLOCK_SIZE);
        const analogClockNumbersColor = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR) || '#ffffff';

        const diameter = Math.max(80, analogClockSize);

        // Recreate outer widget if diameter changes or it's not created
        if (!container._analogWidget) {
            container.destroy_all_children();

            container._analogWidget = new St.Widget({
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            container.add_child(container._analogWidget);

            // Number labels (1-12)
            container._numberLabels = [];
            for (let i = 1; i <= 12; i++) {
                const label = new St.Label({ text: String(i) });
                container._analogWidget.add_child(label);
                container._numberLabels.push(label);
            }

            // Hour tick marks — 12 positions
            container._ticks = [];
            for (let i = 0; i < 12; i++) {
                const tick = new St.Widget({ style_class: 'analog-clock-tick' });
                container._analogWidget.add_child(tick);
                container._ticks.push(tick);
            }

            // Create hands
            container._hourHand = new St.Widget({ style_class: 'analog-hour-hand' });
            container._hourHand.set_pivot_point(0.5, 1.0);
            container._analogWidget.add_child(container._hourHand);

            container._minuteHand = new St.Widget({ style_class: 'analog-minute-hand' });
            container._minuteHand.set_pivot_point(0.5, 1.0);
            container._analogWidget.add_child(container._minuteHand);

            container._secondHand = new St.Widget({ style_class: 'analog-second-hand' });
            container._secondHand.set_pivot_point(0.5, 1.0);
            container._analogWidget.add_child(container._secondHand);

            container._centerPin = new St.Widget({ style_class: 'analog-center-pin' });
            container._analogWidget.add_child(container._centerPin);

            // Inner decorative ring (Classic skin)
            container._innerRing = new St.Widget();
            container._analogWidget.add_child(container._innerRing);
        }

        // Configure Face/Border styles based on Skin
        let borderColor = clockColor;
        let faceBg = 'rgba(255, 255, 255, 0.05)';
        let borderWidth = 3;
        let showNumbers = false;
        let tickStyle = 'none';

        if (analogClockSkin === ANALOG_SKINS.ACCENT) {
            borderWidth = 3;
            try {
                const aHex = clockMinutesColor.replace('#', '');
                const aR = parseInt(aHex.substring(0, 2), 16) || 255;
                const aG = parseInt(aHex.substring(2, 4), 16) || 255;
                const aB = parseInt(aHex.substring(4, 6), 16) || 255;
                faceBg = `rgba(${aR}, ${aG}, ${aB}, 0.08)`;
            } catch (e) {
                faceBg = 'rgba(255, 255, 255, 0.08)';
            }
            showNumbers = analogClockShowNumbers;
            tickStyle = 'bars';
        } else if (analogClockSkin === ANALOG_SKINS.MINIMALIST) {
            borderWidth = 1.5;
            faceBg = 'transparent';
            showNumbers = analogClockShowNumbers;
            tickStyle = 'dots';
        } else if (analogClockSkin === ANALOG_SKINS.CLASSIC) {
            borderWidth = 3;
            faceBg = 'transparent';
            showNumbers = analogClockShowNumbers;
            tickStyle = 'none';
        }

        container._analogWidget.set_size(diameter, diameter);
        container._analogWidget.style = `
            width: ${diameter}px;
            height: ${diameter}px;
            border-radius: ${diameter / 2}px;
            border: ${borderWidth}px solid ${borderColor};
            background-color: ${faceBg};
        `;

        // Position hands
        const wh = diameter * 0.04;
        const hh = diameter * 0.22;
        container._hourHand.set_position(diameter / 2 - wh / 2, diameter / 2 - hh);
        container._hourHand.style = `
            background-color: ${clockColor};
            width: ${wh}px;
            height: ${hh}px;
            border-radius: ${wh / 2}px;
        `;

        const wm = diameter * 0.03;
        const hm = diameter * 0.32;
        container._minuteHand.set_position(diameter / 2 - wm / 2, diameter / 2 - hm);
        container._minuteHand.style = `
            background-color: ${clockMinutesColor};
            width: ${wm}px;
            height: ${hm}px;
            border-radius: ${wm / 2}px;
        `;

        // Show/hide second hand
        container._secondHand.visible = clockSecondHandEnabled;
        const ws = diameter * 0.015;
        const hs = diameter * 0.35;
        container._secondHand.set_position(diameter / 2 - ws / 2, diameter / 2 - hs);
        container._secondHand.style = `
            background-color: ${clockSecondHandColor};
            width: ${ws}px;
            height: ${hs}px;
            border-radius: ${ws / 2}px;
        `;

        // Center Pin
        const wp = diameter * 0.08;
        container._centerPin.set_position(diameter / 2 - wp / 2, diameter / 2 - wp / 2);
        container._centerPin.style = `
            background-color: ${clockSecondHandEnabled ? clockSecondHandColor : clockMinutesColor};
            width: ${wp}px;
            height: ${wp}px;
            border-radius: ${wp / 2}px;
        `;

        if (container._innerRing) {
            container._innerRing.visible = false;
        }

        // Number labels positioning and styling
        const numRadius = diameter * 0.36;
        const numFontSize = Math.max(8, Math.round(diameter * 0.13));
        const numColor = analogClockNumbersColor;

        if (container._numberLabels) {
            container._numberLabels.forEach((label, idx) => {
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
        }

        // Ticks configuration — 12 hour positions
        const tickColor = (analogClockSkin === ANALOG_SKINS.ACCENT) ? clockMinutesColor : clockSeparatorColor;

        if (container._ticks) {
            container._ticks.forEach((tick, i) => {
                const isMajor = (analogClockSkin === ANALOG_SKINS.ACCENT) ? true : (i % 3 === 0);

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
        }

        // Rotate hands based on time
        const s = now.getSeconds();
        const m = now.getMinutes();
        const h = now.getHours();

        const hourAngle = (h % 12) * 30 + m * 0.5;
        const minuteAngle = m * 6 + s * 0.1;
        const secondAngle = s * 6;

        if (container._hourHand) {
            container._hourHand.rotation_angle_z = hourAngle;
        }
        if (container._minuteHand) {
            container._minuteHand.rotation_angle_z = minuteAngle;
        }
        if (container._secondHand && clockSecondHandEnabled) {
            container._secondHand.rotation_angle_z = secondAngle;
        }
    }
}
