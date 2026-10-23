// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Live Wallpaper & Lockscreen Preview Component
 * Renders real-time preview of wallpaper, blur, brightness, clocks, and custom messages.
 */

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';
import Gtk from 'gi://Gtk';
import { SETTINGS_KEYS, CLOCK_STYLES, ANALOG_SKINS } from '../constants.js';
import { BlurredBox } from './blurredBox.js';

export function createPreviewWidget(settings) {
    const provider = new Gtk.CssProvider();

    const overlay = new Gtk.Overlay({
        hexpand: true,
        vexpand: false,
    });

    let bgSettings = null;
    let interfaceSettings = null;
    try {
        bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
    } catch (e) {
        // Fallback
    }

    // 1. Wallpaper background with BlurredBox
    const wallpaper = new BlurredBox({
        css_classes: ['preview-wallpaper'],
        overflow: Gtk.Overflow.HIDDEN,
    });
    wallpaper.set_size_request(480, 270);

    const wallpaperPicture = new Gtk.Picture({
        hexpand: true,
        vexpand: true,
        content_fit: Gtk.ContentFit.COVER,
        can_shrink: true,
    });
    wallpaper.append(wallpaperPicture);
    overlay.set_child(wallpaper);

    // 2. Brightness Overlay
    const brightnessOverlay = new Gtk.Box({
        css_classes: ['preview-brightness-overlay'],
        hexpand: true,
        vexpand: true,
    });
    overlay.add_overlay(brightnessOverlay);

    // 3. Content Box
    const contentBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        hexpand: true,
        vexpand: true,
        css_classes: ['preview-content-box'],
    });
    overlay.add_overlay(contentBox);

    const clockContainer = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
    });
    contentBox.append(clockContainer);

    const now = new Date();
    const initDate = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

    const dateLabel = new Gtk.Label({
        label: initDate,
        css_classes: ['preview-date-label'],
    });
    contentBox.append(dateLabel);

    const customTextLabel = new Gtk.Label({
        label: 'Welcome to Lockscreen Studio',
        css_classes: ['preview-custom-text-label'],
    });
    contentBox.append(customTextLabel);

    // Live clock timer
    let clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        const activeStyle = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;

        if (activeStyle === CLOCK_STYLES.ANALOG) {
            const firstChild = clockContainer.get_first_child();
            if (firstChild && firstChild.queue_draw) {
                firstChild.queue_draw();
            }
        } else {
            const currDate = new Date();
            let hoursVal = currDate.getHours();
            const minutesVal = String(currDate.getMinutes()).padStart(2, '0');
            let ampmVal = '';

            const format = interfaceSettings ? interfaceSettings.get_string('clock-format') : '24h';
            if (format === '12h') {
                ampmVal = hoursVal >= 12 ? ' PM' : ' AM';
                hoursVal = hoursVal % 12 || 12;
            }
            const hrStr = String(hoursVal);
            const hoursValDisplay = format === '12h' ? hrStr : hrStr.padStart(2, '0');

            if (activeStyle === CLOCK_STYLES.DEFAULT) {
                const label = clockContainer.get_first_child();
                if (label) {
                    label.label = `${hoursValDisplay}:${minutesVal}`;
                }
            } else if (activeStyle === CLOCK_STYLES.SEPARATED_COLORS) {
                const hBox = clockContainer.get_first_child();
                if (hBox) {
                    const hr = hBox.get_first_child();
                    const sep = hr ? hr.get_next_sibling() : null;
                    const min = sep ? sep.get_next_sibling() : null;
                    if (hr) hr.label = hoursValDisplay;
                    if (min) min.label = minutesVal;

                    let ampmLabel = min ? min.get_next_sibling() : null;
                    if (format === '12h' && ampmLabel) {
                        ampmLabel.label = ampmVal;
                    }
                }
            } else if (activeStyle === CLOCK_STYLES.VERTICAL_STACK) {
                const vBox = clockContainer.get_first_child();
                if (vBox) {
                    const hr = vBox.get_first_child();
                    const min = hr ? hr.get_next_sibling() : null;
                    if (hr) hr.label = hoursValDisplay;
                    if (min) min.label = minutesVal;
                }
            }
        }

        const currDate = new Date();
        dateLabel.label = currDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
        return GLib.SOURCE_CONTINUE;
    });

    let debounceTimerId = null;

    overlay.connect('destroy', () => {
        if (clockTimerId) {
            GLib.source_remove(clockTimerId);
            clockTimerId = null;
        }
        if (debounceTimerId) {
            GLib.source_remove(debounceTimerId);
            debounceTimerId = null;
        }
    });

    // Style providers
    const styleContexts = [
        wallpaper.get_style_context(),
        brightnessOverlay.get_style_context(),
        dateLabel.get_style_context(),
        customTextLabel.get_style_context()
    ];
    styleContexts.forEach(ctx => {
        ctx.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    });

    let thumbFactory = null;
    try {
        thumbFactory = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);
    } catch (_e) {}

    let _cachedWallpaperUri = null;
    let _wallpaperLoading = false;

    const resolveDynamicWallpaper = (uri) => {
        try {
            const path = uri.startsWith('file://') ? uri.slice(7) : uri;
            if (!path.endsWith('.xml')) return uri;

            const xmlFile = Gio.File.new_for_path(path);
            const [, contents] = xmlFile.load_contents(null);
            const xmlStr = new TextDecoder().decode(contents);

            const fileMatches = [...xmlStr.matchAll(/<file>(.*?)<\/file>/g)];
            if (fileMatches.length === 0) return null;

            const hour = new Date().getHours();
            const idx = Math.floor((hour / 24) * fileMatches.length) % fileMatches.length;
            const imagePath = fileMatches[idx][1].trim();

            return imagePath.startsWith('file://') ? imagePath : 'file://' + imagePath;
        } catch (_e) {
            return null;
        }
    };

    const loadWallpaperPicture = (rawUri) => {
        if (!rawUri) {
            _cachedWallpaperUri = null;
            wallpaperPicture.file = null;
            return;
        }
        if (rawUri === _cachedWallpaperUri) return;
        _cachedWallpaperUri = rawUri;

        try {
            const resolvedUri = resolveDynamicWallpaper(rawUri) || rawUri;
            const resolvedFile = Gio.File.new_for_uri(resolvedUri);
            const resolvedPath = resolvedFile.get_path();
            const ext = resolvedPath ? resolvedPath.split('.').pop().toLowerCase() : '';
            const unsupportedFormats = ['jxl', 'avif', 'heic', 'heif'];

            if (unsupportedFormats.includes(ext)) {
                if (thumbFactory) {
                    try {
                        const mtime = resolvedFile.query_info(
                            'time::modified',
                            Gio.FileQueryInfoFlags.NONE,
                            null
                        ).get_attribute_uint64('time::modified');
                        const existingThumb = thumbFactory.lookup(resolvedUri, mtime);
                        if (existingThumb) {
                            wallpaperPicture.file = Gio.File.new_for_path(existingThumb);
                            return;
                        }
                    } catch (_e) {}
                }

                if (_wallpaperLoading) return;
                _wallpaperLoading = true;
                const tmpPath = GLib.build_filenamev([
                    GLib.get_tmp_dir(),
                    `lss-preview-${GLib.basename(resolvedPath)}.png`
                ]);
                try {
                    const proc = Gio.Subprocess.new(
                        ['convert', resolvedPath, '-resize', '800x450>', tmpPath],
                        Gio.SubprocessFlags.NONE
                    );
                    proc.wait_async(null, (_p, res) => {
                        _wallpaperLoading = false;
                        try {
                            proc.wait_finish(res);
                            if (proc.get_exit_status() === 0)
                                wallpaperPicture.file = Gio.File.new_for_path(tmpPath);
                        } catch (_e2) {}
                    });
                } catch (_e) {
                    _wallpaperLoading = false;
                    wallpaperPicture.file = null;
                }
            } else {
                wallpaperPicture.file = resolvedFile;
            }
        } catch (_e) {
            wallpaperPicture.file = null;
        }
    };

    let REFERENCE_WIDTH = 1920;
    try {
        const display = Gdk.Display.get_default();
        const monitors = display.get_monitors();
        if (monitors.get_n_items() > 0)
            REFERENCE_WIDTH = monitors.get_item(0).get_geometry().width;
    } catch (_e) {}

    let previewWidth = 480;
    let isFirstLayout = true;

    overlay.connect('notify::width', () => {
        const w = overlay.get_width();
        if (w > 10 && (w !== previewWidth || isFirstLayout)) {
            previewWidth = w;
            isFirstLayout = false;
            applyUpdate();
        }
    });

    const applyUpdate = () => {
        const clockFont    = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY) || 'Sans';
        const clockSize    = settings.get_int(SETTINGS_KEYS.CLOCK_FONT_SIZE) || 80;
        const clockColor   = settings.get_string(SETTINGS_KEYS.CLOCK_COLOR) || '#ffffff';
        const clockVisible = settings.get_boolean(SETTINGS_KEYS.CLOCK_VISIBLE);
        const clockStyle   = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;
        const clockMinutesColor = settings.get_string(SETTINGS_KEYS.CLOCK_MINUTES_COLOR) || '#ffffff';
        const clockSeparatorColor = settings.get_string(SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR) || '#ffffff';
        const analogClockSkin = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN) || ANALOG_SKINS.MINIMALIST;
        const clockSecondHandEnabled = settings.get_boolean(SETTINGS_KEYS.CLOCK_SECOND_HAND_ENABLED);
        const clockSecondHandColor = settings.get_string(SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR) || '#ff4444';
        const analogClockShowNumbers = settings.get_boolean(SETTINGS_KEYS.ANALOG_CLOCK_SHOW_NUMBERS);
        const analogClockSize = settings.get_int(SETTINGS_KEYS.ANALOG_CLOCK_SIZE);
        const analogClockNumbersColor = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR) || '#ffffff';

        const dateFont    = settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY) || 'Sans';
        const dateSize    = settings.get_int(SETTINGS_KEYS.DATE_FONT_SIZE) || 24;
        const dateColor   = settings.get_string(SETTINGS_KEYS.DATE_COLOR) || '#ffffff';
        const dateVisible = settings.get_boolean(SETTINGS_KEYS.DATE_VISIBLE);

        const customTextEnabled = settings.get_boolean(SETTINGS_KEYS.CUSTOM_TEXT_ENABLED);
        const customTextVal     = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT) || 'Welcome to Lockscreen Studio';
        const customTextFont    = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY) || 'Sans';
        const customTextSize    = settings.get_int(SETTINGS_KEYS.CUSTOM_TEXT_FONT_SIZE) || 20;
        const customTextColor   = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_COLOR) || '#ffffff';

        const enableBlur    = settings.get_boolean(SETTINGS_KEYS.ENABLE_BLUR);
        // Fix for Issue #1: Support blur radius 0 correctly without falling back to 30!
        const blurRadius    = settings.get_int(SETTINGS_KEYS.BLUR_RADIUS);
        const enableBrightness = settings.get_boolean(SETTINGS_KEYS.ENABLE_BRIGHTNESS);
        const blurBrightness = settings.get_double(SETTINGS_KEYS.BLUR_BRIGHTNESS);

        const overlayOpacity = enableBrightness ? Math.max(0.0, Math.min(1.0, 1.0 - blurBrightness)) : 0.0;

        let wallpaperUri = '';
        if (bgSettings) {
            const darkUri = bgSettings.get_string('picture-uri-dark');
            const lightUri = bgSettings.get_string('picture-uri');
            const colorScheme = interfaceSettings ? interfaceSettings.get_string('color-scheme') : 'default';
            if (colorScheme === 'prefer-dark' && darkUri)
                wallpaperUri = darkUri;
            else if (lightUri)
                wallpaperUri = lightUri;
            else if (darkUri)
                wallpaperUri = darkUri;
        }
        if (wallpaperUri && !wallpaperUri.startsWith('file://') && wallpaperUri.startsWith('/'))
            wallpaperUri = 'file://' + wallpaperUri;

        loadWallpaperPicture(wallpaperUri || null);

        const fallbackBg = wallpaperUri
            ? ''
            : 'background: linear-gradient(135deg, #4b1248, #9b2848, #d4682c);';

        const scale = previewWidth / REFERENCE_WIDTH;
        const clockPx      = Math.max(9,  Math.round(clockSize      * scale));
        const datePx       = Math.max(7,  Math.round(dateSize       * scale));
        const customTextPx = Math.max(6,  Math.round(customTextSize * scale));
        const ampmPx       = Math.max(5,  Math.round(clockSize      * scale * 0.4));
        const marginTop    = Math.max(2,  Math.round(previewWidth * 0.012));
        const marginSm     = Math.max(1,  Math.round(previewWidth * 0.006));

        provider.load_from_string(`
            .preview-wallpaper {
                border-radius: 16px;
                ${fallbackBg}
            }
            .preview-brightness-overlay {
                background-color: rgba(0, 0, 0, ${overlayOpacity});
                border-radius: 16px;
            }
            .preview-clock-label-default {
                font-family: '${clockFont}';
                font-size: ${clockPx}px;
                color: ${clockColor};
                font-weight: bold;
                margin-bottom: ${marginSm}px;
            }
            .preview-clock-hours {
                font-family: '${clockFont}';
                font-size: ${clockPx}px;
                color: ${clockColor};
                font-weight: bold;
            }
            .preview-clock-separator {
                font-family: '${clockFont}';
                font-size: ${clockPx}px;
                color: ${clockSeparatorColor};
                font-weight: bold;
                margin-left: 2px;
                margin-right: 2px;
            }
            .preview-clock-minutes {
                font-family: '${clockFont}';
                font-size: ${clockPx}px;
                color: ${clockMinutesColor};
                font-weight: bold;
            }
            .preview-clock-ampm {
                font-family: '${clockFont}';
                font-size: ${ampmPx}px;
                color: ${clockColor};
                font-weight: bold;
                margin-left: 4px;
            }
            .preview-date-label {
                font-family: '${dateFont}';
                font-size: ${datePx}px;
                color: ${dateColor};
                margin-top: ${marginTop}px;
            }
            .preview-custom-text-label {
                font-family: '${customTextFont}';
                font-size: ${customTextPx}px;
                color: ${customTextColor};
                margin-top: ${marginTop}px;
            }
        `);

        // Wallpaper blur: supports 0 blur radius!
        wallpaper.blurRadius = enableBlur ? blurRadius : 0.0;

        // Content layout
        while (clockContainer.get_first_child()) {
            clockContainer.remove(clockContainer.get_first_child());
        }

        const nowCurrent = new Date();
        let hours = nowCurrent.getHours();
        const minutes = String(nowCurrent.getMinutes()).padStart(2, '0');
        let ampm = '';

        const format = interfaceSettings ? interfaceSettings.get_string('clock-format') : '24h';
        if (format === '12h') {
            ampm = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12 || 12;
        }
        const hoursDisplay = format === '12h' ? String(hours) : String(hours).padStart(2, '0');

        if (clockVisible) {
            clockContainer.visible = true;

            if (clockStyle === CLOCK_STYLES.DEFAULT) {
                const label = new Gtk.Label({
                    label: `${hoursDisplay}:${minutes}`,
                    css_classes: ['preview-clock-label-default'],
                });
                label.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                clockContainer.append(label);

            } else if (clockStyle === CLOCK_STYLES.SEPARATED_COLORS) {
                const hBox = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                });

                const hr = new Gtk.Label({ label: hoursDisplay, css_classes: ['preview-clock-hours'] });
                const sep = new Gtk.Label({ label: ':', css_classes: ['preview-clock-separator'] });
                const min = new Gtk.Label({ label: minutes, css_classes: ['preview-clock-minutes'] });

                [hr, sep, min].forEach(w => {
                    w.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                    hBox.append(w);
                });

                if (format === '12h') {
                    const ampmLabel = new Gtk.Label({ label: ampm, css_classes: ['preview-clock-ampm'] });
                    ampmLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                    hBox.append(ampmLabel);
                }

                clockContainer.append(hBox);

            } else if (clockStyle === CLOCK_STYLES.VERTICAL_STACK) {
                const vBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                });

                const hr = new Gtk.Label({ label: hoursDisplay, css_classes: ['preview-clock-hours'] });
                const min = new Gtk.Label({ label: minutes, css_classes: ['preview-clock-minutes'] });

                [hr, min].forEach(w => {
                    w.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                    vBox.append(w);
                });

                clockContainer.append(vBox);

            } else if (clockStyle === CLOCK_STYLES.ANALOG) {
                const analogScale = previewWidth / REFERENCE_WIDTH;
                const canvasSize = Math.max(48, Math.round(analogClockSize * analogScale));

                const drawingArea = new Gtk.DrawingArea({
                    content_width: canvasSize,
                    content_height: canvasSize,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                });

                drawingArea.set_draw_func((area, cr, width, height) => {
                    const radius = Math.min(width, height) / 2;
                    const cx = width / 2;
                    const cy = height / 2;

                    const parseHex = (hex, alpha = 1.0) => {
                        const h = hex.replace('#', '');
                        const r = parseInt(h.substring(0, 2), 16) / 255 || 1;
                        const g = parseInt(h.substring(2, 4), 16) / 255 || 1;
                        const b = parseInt(h.substring(4, 6), 16) / 255 || 1;
                        return { r, g, b, a: alpha };
                    };

                    const cColor = parseHex(clockColor);
                    const mColor = parseHex(clockMinutesColor);
                    const sColor = parseHex(clockSecondHandColor);
                    const sepColor = parseHex(clockSeparatorColor);
                    const numColor = parseHex(analogClockNumbersColor);

                    cr.arc(cx, cy, radius - 2, 0, 2 * Math.PI);
                    if (analogClockSkin === ANALOG_SKINS.ACCENT) {
                        cr.setSourceRGBA(mColor.r, mColor.g, mColor.b, 0.08);
                        cr.fillPreserve();
                        cr.setSourceRGB(cColor.r, cColor.g, cColor.b);
                        cr.setLineWidth(2.5);
                        cr.stroke();
                    } else if (analogClockSkin === ANALOG_SKINS.MINIMALIST) {
                        cr.setSourceRGB(cColor.r, cColor.g, cColor.b);
                        cr.setLineWidth(1.5);
                        cr.stroke();
                    } else {
                        cr.setSourceRGB(cColor.r, cColor.g, cColor.b);
                        cr.setLineWidth(2.5);
                        cr.stroke();
                    }

                    // Ticks
                    for (let i = 0; i < 12; i++) {
                        const angle = (i * 30 - 90) * Math.PI / 180;
                        const isMajor = (analogClockSkin === ANALOG_SKINS.ACCENT) ? true : (i % 3 === 0);

                        if (analogClockSkin === ANALOG_SKINS.MINIMALIST) {
                            const dotR = radius * 0.85;
                            const dx = cx + dotR * Math.cos(angle);
                            const dy = cy + dotR * Math.sin(angle);
                            const dotSize = radius * (isMajor ? 0.04 : 0.025);
                            cr.arc(dx, dy, dotSize, 0, 2 * Math.PI);
                            cr.setSourceRGBA(cColor.r, cColor.g, cColor.b, isMajor ? 1.0 : 0.5);
                            cr.fill();
                        } else if (analogClockSkin === ANALOG_SKINS.ACCENT) {
                            const innerR = radius * 0.78;
                            const outerR = radius * 0.90;
                            cr.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
                            cr.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
                            cr.setSourceRGBA(mColor.r, mColor.g, mColor.b, isMajor ? 1.0 : 0.6);
                            cr.setLineWidth(radius * 0.04);
                            cr.stroke();
                        }
                    }

                    // Numbers
                    if (analogClockShowNumbers) {
                        const numR = radius * 0.72;
                        const fontSize = Math.max(7, Math.round(radius * 0.22));
                        cr.selectFontFace(clockFont, 0, 1);
                        cr.setFontSize(fontSize);
                        cr.setSourceRGB(numColor.r, numColor.g, numColor.b);

                        for (let i = 1; i <= 12; i++) {
                            const angle = (i * 30 - 90) * Math.PI / 180;
                            const nx = cx + numR * Math.cos(angle);
                            const ny = cy + numR * Math.sin(angle);
                            const str = String(i);
                            const ext = cr.textExtents(str);
                            cr.moveTo(nx - ext.width / 2 - ext.x_bearing, ny - ext.height / 2 - ext.y_bearing);
                            cr.showText(str);
                        }
                    }

                    // Hands
                    const d = new Date();
                    const s = d.getSeconds();
                    const m = d.getMinutes();
                    const h = d.getHours();

                    const hAngle = ((h % 12) * 30 + m * 0.5 - 90) * Math.PI / 180;
                    const hLen = radius * 0.45;
                    cr.moveTo(cx, cy);
                    cr.lineTo(cx + hLen * Math.cos(hAngle), cy + hLen * Math.sin(hAngle));
                    cr.setSourceRGB(cColor.r, cColor.g, cColor.b);
                    cr.setLineWidth(Math.max(2, radius * 0.08));
                    cr.setLineCap(1);
                    cr.stroke();

                    const mAngle = (m * 6 + s * 0.1 - 90) * Math.PI / 180;
                    const mLen = radius * 0.68;
                    cr.moveTo(cx, cy);
                    cr.lineTo(cx + mLen * Math.cos(mAngle), cy + mLen * Math.sin(mAngle));
                    cr.setSourceRGB(mColor.r, mColor.g, mColor.b);
                    cr.setLineWidth(Math.max(1.5, radius * 0.05));
                    cr.setLineCap(1);
                    cr.stroke();

                    if (clockSecondHandEnabled) {
                        const sAngle = (s * 6 - 90) * Math.PI / 180;
                        const sLen = radius * 0.75;
                        cr.moveTo(cx, cy);
                        cr.lineTo(cx + sLen * Math.cos(sAngle), cy + sLen * Math.sin(sAngle));
                        cr.setSourceRGB(sColor.r, sColor.g, sColor.b);
                        cr.setLineWidth(Math.max(1, radius * 0.025));
                        cr.setLineCap(1);
                        cr.stroke();
                    }

                    // Center pin
                    cr.arc(cx, cy, Math.max(3, radius * 0.08), 0, 2 * Math.PI);
                    cr.setSourceRGB(clockSecondHandEnabled ? sColor.r : mColor.r,
                                    clockSecondHandEnabled ? sColor.g : mColor.g,
                                    clockSecondHandEnabled ? sColor.b : mColor.b);
                    cr.fill();
                });

                clockContainer.append(drawingArea);
            }
        } else {
            clockContainer.visible = false;
        }

        dateLabel.visible = dateVisible;
        customTextLabel.visible = customTextEnabled;
        customTextLabel.label = customTextVal;
    };

    const scheduleUpdate = () => {
        if (debounceTimerId) {
            GLib.source_remove(debounceTimerId);
        }
        debounceTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            debounceTimerId = null;
            applyUpdate();
            return GLib.SOURCE_REMOVE;
        });
    };

    // Watch all relevant keys
    const watchedKeys = [
        SETTINGS_KEYS.ENABLE_BLUR,
        SETTINGS_KEYS.BLUR_RADIUS,
        SETTINGS_KEYS.ENABLE_BRIGHTNESS,
        SETTINGS_KEYS.BLUR_BRIGHTNESS,
        SETTINGS_KEYS.CLOCK_VISIBLE,
        SETTINGS_KEYS.CLOCK_STYLE,
        SETTINGS_KEYS.CLOCK_FONT_FAMILY,
        SETTINGS_KEYS.CLOCK_FONT_SIZE,
        SETTINGS_KEYS.CLOCK_COLOR,
        SETTINGS_KEYS.CLOCK_MINUTES_COLOR,
        SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR,
        SETTINGS_KEYS.ANALOG_CLOCK_SKIN,
        SETTINGS_KEYS.CLOCK_SECOND_HAND_ENABLED,
        SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR,
        SETTINGS_KEYS.ANALOG_CLOCK_SHOW_NUMBERS,
        SETTINGS_KEYS.ANALOG_CLOCK_SIZE,
        SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR,
        SETTINGS_KEYS.DATE_VISIBLE,
        SETTINGS_KEYS.DATE_FONT_FAMILY,
        SETTINGS_KEYS.DATE_FONT_SIZE,
        SETTINGS_KEYS.DATE_COLOR,
        SETTINGS_KEYS.CUSTOM_TEXT_ENABLED,
        SETTINGS_KEYS.CUSTOM_TEXT,
        SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY,
        SETTINGS_KEYS.CUSTOM_TEXT_FONT_SIZE,
        SETTINGS_KEYS.CUSTOM_TEXT_COLOR,
    ];

    watchedKeys.forEach(key => {
        settings.connect(`changed::${key}`, scheduleUpdate);
    });

    if (bgSettings) {
        bgSettings.connect('changed::picture-uri', scheduleUpdate);
        bgSettings.connect('changed::picture-uri-dark', scheduleUpdate);
    }
    if (interfaceSettings) {
        interfaceSettings.connect('changed::color-scheme', scheduleUpdate);
        interfaceSettings.connect('changed::clock-format', scheduleUpdate);
    }

    applyUpdate();

    return overlay;
}

/**
 * Creates a live preview widget specifically showing the User Avatar,
 * Username, Password entry, Auth messages, and Top Bar / Panel scaling.
 *
 * @param {Gio.Settings} settings - Extension GSettings
 * @returns {Gtk.Overlay}
 */
export function createAuthPreviewWidget(settings) {
    const provider = new Gtk.CssProvider();

    const overlay = new Gtk.Overlay({
        hexpand: true,
        vexpand: false,
    });

    let bgSettings = null;
    let interfaceSettings = null;
    try {
        bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
        interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
    } catch (e) {}

    // 1. Wallpaper background with BlurredBox
    const wallpaper = new BlurredBox({
        css_classes: ['preview-wallpaper'],
        overflow: Gtk.Overflow.HIDDEN,
    });
    wallpaper.set_size_request(480, 270);

    const wallpaperPicture = new Gtk.Picture({
        hexpand: true,
        vexpand: true,
        content_fit: Gtk.ContentFit.COVER,
        can_shrink: true,
    });
    wallpaper.append(wallpaperPicture);
    overlay.set_child(wallpaper);

    // 2. Brightness Overlay
    const brightnessOverlay = new Gtk.Box({
        css_classes: ['preview-brightness-overlay'],
        hexpand: true,
        vexpand: true,
    });
    overlay.add_overlay(brightnessOverlay);

    // 3. Top Panel / Bar
    const topPanel = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        valign: Gtk.Align.START,
        hexpand: true,
        css_classes: ['preview-top-panel'],
    });

    const panelLeft = new Gtk.Label({
        label: '🔒  Lockscreen',
        halign: Gtk.Align.START,
        css_classes: ['preview-panel-item'],
    });
    topPanel.append(panelLeft);

    const now = new Date();
    const panelCenter = new Gtk.Label({
        label: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        halign: Gtk.Align.CENTER,
        hexpand: true,
        css_classes: ['preview-panel-item', 'preview-panel-clock'],
    });
    topPanel.append(panelCenter);

    const panelRight = new Gtk.Label({
        label: '📶  🔋 100%',
        halign: Gtk.Align.END,
        css_classes: ['preview-panel-item'],
    });
    topPanel.append(panelRight);

    overlay.add_overlay(topPanel);

    // 4. Auth Prompt Container Box
    const authBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.CENTER,
        halign: Gtk.Align.CENTER,
        hexpand: true,
        vexpand: true,
        css_classes: ['preview-auth-container'],
    });

    // Avatar Box
    const avatarBox = new Gtk.Box({
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        css_classes: ['preview-user-avatar'],
    });
    const avatarIcon = new Gtk.Image({
        icon_name: 'avatar-default-symbolic',
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        vexpand: true,
        css_classes: ['preview-avatar-icon'],
    });
    avatarBox.append(avatarIcon);
    authBox.append(avatarBox);

    // Username Label
    const realName = GLib.get_real_name();
    const userName = GLib.get_user_name();
    const displayName = (realName && realName !== 'Unknown') ? realName : (userName || 'User');

    const usernameLabel = new Gtk.Label({
        label: displayName,
        halign: Gtk.Align.CENTER,
        css_classes: ['preview-username'],
    });
    authBox.append(usernameLabel);

    // Password Entry Mockup Box
    const passwordBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
        css_classes: ['preview-password-box'],
    });
    const passwordDots = new Gtk.Label({
        label: '••••••••',
        halign: Gtk.Align.CENTER,
        css_classes: ['preview-password-dots'],
    });
    passwordBox.append(passwordDots);
    authBox.append(passwordBox);

    // Auth PAM Message
    const authMessageLabel = new Gtk.Label({
        label: 'Authentication required',
        halign: Gtk.Align.CENTER,
        css_classes: ['preview-auth-message'],
    });
    authBox.append(authMessageLabel);

    overlay.add_overlay(authBox);

    // Clean up timer on destroy
    let debounceTimerId = null;
    overlay.connect('destroy', () => {
        if (debounceTimerId) {
            GLib.source_remove(debounceTimerId);
            debounceTimerId = null;
        }
    });

    // Style providers
    [
        wallpaper.get_style_context(),
        brightnessOverlay.get_style_context(),
        topPanel.get_style_context(),
        panelLeft.get_style_context(),
        panelCenter.get_style_context(),
        panelRight.get_style_context(),
        avatarBox.get_style_context(),
        usernameLabel.get_style_context(),
        passwordBox.get_style_context(),
        passwordDots.get_style_context(),
        authMessageLabel.get_style_context(),
    ].forEach(ctx => {
        ctx.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    });

    let REFERENCE_WIDTH = 1920;
    try {
        const display = Gdk.Display.get_default();
        const monitors = display.get_monitors();
        if (monitors.get_n_items() > 0) {
            REFERENCE_WIDTH = monitors.get_item(0).get_geometry().width;
        }
    } catch (_e) {}

    let previewWidth = 480;
    let isFirstLayout = true;

    overlay.connect('notify::width', () => {
        const w = overlay.get_width();
        if (w > 10 && (w !== previewWidth || isFirstLayout)) {
            previewWidth = w;
            isFirstLayout = false;
            applyUpdate();
        }
    });

    const applyUpdate = () => {
        const enableBlur = settings.get_boolean(SETTINGS_KEYS.ENABLE_BLUR);
        const blurRadius = settings.get_int(SETTINGS_KEYS.BLUR_RADIUS);
        const enableBrightness = settings.get_boolean(SETTINGS_KEYS.ENABLE_BRIGHTNESS);
        const blurBrightness = settings.get_double(SETTINGS_KEYS.BLUR_BRIGHTNESS);
        const overlayOpacity = enableBrightness ? Math.max(0.0, Math.min(1.0, 1.0 - blurBrightness)) : 0.0;

        const authCustom = settings.get_boolean(SETTINGS_KEYS.AUTH_CUSTOM_STYLE_ENABLED);
        const avatarSize = authCustom ? settings.get_int(SETTINGS_KEYS.AUTH_AVATAR_SIZE) : 64;
        const usernameFontSize = authCustom ? settings.get_int(SETTINGS_KEYS.AUTH_USERNAME_FONT_SIZE) : 20;
        const usernameFont = authCustom ? (settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY) || 'Sans') : 'Sans';
        const usernameColor = authCustom ? (settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_COLOR) || '#ffffff') : '#ffffff';
        const entryFontSize = authCustom ? settings.get_int(SETTINGS_KEYS.AUTH_ENTRY_FONT_SIZE) : 16;
        const entryColor = authCustom ? (settings.get_string(SETTINGS_KEYS.AUTH_ENTRY_COLOR) || '#ffffff') : '#ffffff';
        const messageFontSize = authCustom ? settings.get_int(SETTINGS_KEYS.AUTH_MESSAGE_FONT_SIZE) : 14;
        const messageColor = authCustom ? (settings.get_string(SETTINGS_KEYS.AUTH_MESSAGE_COLOR) || '#ffffff') : '#ffffff';

        const panelCustom = settings.get_boolean(SETTINGS_KEYS.PANEL_CUSTOM_STYLE_ENABLED);
        const panelHeight = panelCustom ? settings.get_int(SETTINGS_KEYS.PANEL_HEIGHT) : 32;
        const panelFontSize = panelCustom ? settings.get_int(SETTINGS_KEYS.PANEL_FONT_SIZE) : 14;

        // Scale proportionally
        const scale = previewWidth / REFERENCE_WIDTH;
        const scaledAvatar = Math.max(28, Math.round(avatarSize * scale));
        const scaledUserFont = Math.max(8, Math.round(usernameFontSize * scale));
        const scaledEntryFont = Math.max(7, Math.round(entryFontSize * scale));
        const scaledMsgFont = Math.max(6, Math.round(messageFontSize * scale));
        const scaledPanelHeight = Math.max(16, Math.round(panelHeight * scale));
        const scaledPanelFont = Math.max(7, Math.round(panelFontSize * scale));
        const scaledRadius = Math.round(scaledAvatar / 2);
        const marginSm = Math.max(3, Math.round(previewWidth * 0.008));
        const marginMd = Math.max(6, Math.round(previewWidth * 0.015));

        // Wallpaper URI
        let wallpaperUri = '';
        if (bgSettings) {
            const darkUri = bgSettings.get_string('picture-uri-dark');
            const lightUri = bgSettings.get_string('picture-uri');
            const colorScheme = interfaceSettings ? interfaceSettings.get_string('color-scheme') : 'default';
            if (colorScheme === 'prefer-dark' && darkUri)
                wallpaperUri = darkUri;
            else if (lightUri)
                wallpaperUri = lightUri;
            else if (darkUri)
                wallpaperUri = darkUri;
        }
        if (wallpaperUri && !wallpaperUri.startsWith('file://') && wallpaperUri.startsWith('/')) {
            wallpaperUri = 'file://' + wallpaperUri;
        }

        try {
            if (wallpaperUri) {
                const f = Gio.File.new_for_uri(wallpaperUri);
                wallpaperPicture.file = f;
            }
        } catch (_e) {}

        const fallbackBg = wallpaperUri ? '' : 'background: linear-gradient(135deg, #1b263b, #0d1b2a, #415a77);';

        provider.load_from_string(`
            .preview-wallpaper {
                border-radius: 16px;
                ${fallbackBg}
            }
            .preview-brightness-overlay {
                background-color: rgba(0, 0, 0, ${overlayOpacity});
                border-radius: 16px;
            }
            .preview-top-panel {
                background-color: rgba(0, 0, 0, 0.65);
                border-top-left-radius: 16px;
                border-top-right-radius: 16px;
                min-height: ${scaledPanelHeight}px;
                padding-left: 10px;
                padding-right: 10px;
            }
            .preview-panel-item {
                font-size: ${scaledPanelFont}px;
                color: #ffffff;
                font-weight: 500;
            }
            .preview-auth-container {
                margin-top: ${marginMd}px;
            }
            .preview-user-avatar {
                background-color: rgba(255, 255, 255, 0.2);
                border: 2px solid rgba(255, 255, 255, 0.35);
                border-radius: ${scaledRadius}px;
                width: ${scaledAvatar}px;
                height: ${scaledAvatar}px;
                min-width: ${scaledAvatar}px;
                min-height: ${scaledAvatar}px;
                padding: 0px;
                margin-left: auto;
                margin-right: auto;
                margin-bottom: ${marginSm}px;
            }
            .preview-username {
                font-family: '${usernameFont}';
                font-size: ${scaledUserFont}px;
                color: ${usernameColor};
                font-weight: bold;
                margin-bottom: ${marginSm}px;
            }
            .preview-password-box {
                background-color: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: ${Math.max(10, Math.round(scaledEntryFont * 1.2))}px;
                padding: 2px 14px;
                margin-bottom: ${marginSm}px;
            }
            .preview-password-dots {
                font-size: ${scaledEntryFont}px;
                color: ${entryColor};
                letter-spacing: 2px;
            }
            .preview-auth-message {
                font-size: ${scaledMsgFont}px;
                color: ${messageColor};
                opacity: 0.85;
            }
        `);

        avatarBox.set_size_request(scaledAvatar, scaledAvatar);
        const iconPx = Math.max(16, Math.round(scaledAvatar * 0.58));
        avatarIcon.set_pixel_size(iconPx);
        wallpaper.blurRadius = enableBlur ? blurRadius : 0.0;
    };

    const scheduleUpdate = () => {
        if (debounceTimerId) {
            GLib.source_remove(debounceTimerId);
        }
        debounceTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            debounceTimerId = null;
            applyUpdate();
            return GLib.SOURCE_REMOVE;
        });
    };

    const watchedKeys = [
        SETTINGS_KEYS.ENABLE_BLUR,
        SETTINGS_KEYS.BLUR_RADIUS,
        SETTINGS_KEYS.ENABLE_BRIGHTNESS,
        SETTINGS_KEYS.BLUR_BRIGHTNESS,
        SETTINGS_KEYS.AUTH_CUSTOM_STYLE_ENABLED,
        SETTINGS_KEYS.AUTH_AVATAR_SIZE,
        SETTINGS_KEYS.AUTH_USERNAME_FONT_SIZE,
        SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY,
        SETTINGS_KEYS.AUTH_USERNAME_COLOR,
        SETTINGS_KEYS.AUTH_ENTRY_FONT_SIZE,
        SETTINGS_KEYS.AUTH_ENTRY_COLOR,
        SETTINGS_KEYS.AUTH_MESSAGE_FONT_SIZE,
        SETTINGS_KEYS.AUTH_MESSAGE_COLOR,
        SETTINGS_KEYS.PANEL_CUSTOM_STYLE_ENABLED,
        SETTINGS_KEYS.PANEL_HEIGHT,
        SETTINGS_KEYS.PANEL_FONT_SIZE,
    ];

    watchedKeys.forEach(key => {
        settings.connect(`changed::${key}`, scheduleUpdate);
    });

    if (bgSettings) {
        bgSettings.connect('changed::picture-uri', scheduleUpdate);
        bgSettings.connect('changed::picture-uri-dark', scheduleUpdate);
    }
    if (interfaceSettings) {
        interfaceSettings.connect('changed::color-scheme', scheduleUpdate);
    }

    applyUpdate();

    return overlay;
}

