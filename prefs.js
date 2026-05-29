import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import PangoCairo from 'gi://PangoCairo';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BlurredBox = GObject.registerClass({
    GTypeName: 'BlurredBox',
}, class BlurredBox extends Gtk.Box {
    _init(params = {}) {
        super._init(params);
        this._blurRadius = 0.0;
    }

    get blurRadius() {
        return this._blurRadius;
    }

    set blurRadius(value) {
        if (this._blurRadius !== value) {
            this._blurRadius = value;
            this.queue_draw();
        }
    }

    vfunc_snapshot(snapshot) {
        if (this._blurRadius > 0.0) {
            snapshot.push_blur(this._blurRadius);
            super.vfunc_snapshot(snapshot);
            snapshot.pop();
        } else {
            super.vfunc_snapshot(snapshot);
        }
    }
});

export default class LockscreenStudioPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Adjust window default size to comfortable standard vertical size
        window.set_default_size(680, 780);

        // Query system fonts via Pango
        const fontMap = PangoCairo.font_map_get_default();
        const families = fontMap.list_families();
        const systemFonts = families.map(f => f.get_name());

        // Get currently saved fonts to ensure they are in the list
        const currentClockFont = settings.get_string('clock-font-family') || 'Sans';
        const currentDateFont = settings.get_string('date-font-family') || 'Sans';
        const currentCustomTextFont = settings.get_string('custom-text-font-family') || 'Sans';

        // Create a unique, sorted list of fonts
        const fontsSet = new Set([
            ...systemFonts,
            currentClockFont,
            currentDateFont,
            currentCustomTextFont,
            'Sans',
            'Serif',
            'Monospace',
            'Cantarell',
            'Ubuntu'
        ]);
        const fonts = Array.from(fontsSet).sort((a, b) => a.localeCompare(b));

        // Create separate StringList models for each ComboRow to avoid widget conflicts
        const clockFontList = Gtk.StringList.new(fonts);
        const dateFontList = Gtk.StringList.new(fonts);
        const customTextFontList = Gtk.StringList.new(fonts);

        // Helper to convert Gdk.RGBA to Hex string
        const rgbaToHex = (rgba) => {
            const r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
            const g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
            const b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        };

        // Helper to set up a color picker button inside an Adw.EntryRow
        const setupColorPicker = (entryRow, settingsKey) => {
            const colorButton = new Gtk.ColorButton({
                valign: Gtk.Align.CENTER,
                use_alpha: false,
            });
            entryRow.add_suffix(colorButton);

            // Sync initial color
            const initialHex = settings.get_string(settingsKey) || '#ffffff';
            const rgba = new Gdk.RGBA();
            if (rgba.parse(initialHex)) {
                colorButton.rgba = rgba;
            }

            // Update GSettings when user picks a color from the dialog
            colorButton.connect('color-set', () => {
                const hexColor = rgbaToHex(colorButton.rgba);
                if (settings.get_string(settingsKey) !== hexColor) {
                    settings.set_string(settingsKey, hexColor);
                }
            });

            // Update color button when GSettings changes
            settings.connect(`changed::${settingsKey}`, () => {
                const hexColor = settings.get_string(settingsKey) || '#ffffff';
                const newRgba = new Gdk.RGBA();
                if (newRgba.parse(hexColor)) {
                    colorButton.rgba = newRgba;
                }
            });

            // Update color button when user manually types in the entry row
            entryRow.connect('notify::text', () => {
                const hexColor = entryRow.text;
                const newRgba = new Gdk.RGBA();
                if (newRgba.parse(hexColor)) {
                    colorButton.rgba = newRgba;
                }
            });

            // Bind sensitivity
            entryRow.bind_property('sensitive', colorButton, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        };

        // Helper to create a live preview card for the lockscreen
        const createPreviewWidget = () => {
            const provider = new Gtk.CssProvider();

            const overlay = new Gtk.Overlay({
                hexpand: true,
                vexpand: false,
            });
            
            // Get system background settings
            let bgSettings = null;
            let interfaceSettings = null;
            try {
                bgSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.background' });
                interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
            } catch (e) {
                console.error('Failed to access system background/interface GSettings', e);
            }
            
            // 1. Wallpaper background — use Gtk.Picture as child so push_blur actually blurs it
            const wallpaper = new BlurredBox({
                css_classes: ['preview-wallpaper'],
                overflow: Gtk.Overflow.HIDDEN,
            });
            wallpaper.set_size_request(400, 225);

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

            // 3. Content Box with Labels
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                hexpand: true,
                vexpand: true,
                css_classes: ['preview-content-box'],
            });
            overlay.add_overlay(contentBox);

            // Helper: get formatted time and date strings
            const getNow = () => {
                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
                return { timeStr, dateStr };
            };

            const { timeStr: initTime, dateStr: initDate } = getNow();

            const clockLabel = new Gtk.Label({
                label: initTime,
                css_classes: ['preview-clock-label'],
            });
            contentBox.append(clockLabel);

            const dateLabel = new Gtk.Label({
                label: initDate,
                css_classes: ['preview-date-label'],
            });
            contentBox.append(dateLabel);

            // Live clock: update every second
            let clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                const { timeStr, dateStr } = getNow();
                clockLabel.label = timeStr;
                dateLabel.label = dateStr;
                return GLib.SOURCE_CONTINUE;
            });

            // Clean up the timer when the widget is destroyed
            overlay.connect('destroy', () => {
                if (clockTimerId) {
                    GLib.source_remove(clockTimerId);
                    clockTimerId = null;
                }
            });

            const customTextLabel = new Gtk.Label({
                label: 'Welcome to Lockscreen Studio',
                css_classes: ['preview-custom-text-label'],
            });
            contentBox.append(customTextLabel);

            // Apply style provider to all individual styled widgets (bypassing GTK4 cascade limitation)
            const styleContexts = [
                wallpaper.get_style_context(),
                brightnessOverlay.get_style_context(),
                clockLabel.get_style_context(),
                dateLabel.get_style_context(),
                customTextLabel.get_style_context()
            ];
            styleContexts.forEach(ctx => {
                ctx.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            });

            // Update function
            const updatePreview = () => {
                const clockFont = settings.get_string('clock-font-family') || 'Sans';
                const clockSize = settings.get_int('clock-font-size') || 80;
                const clockColor = settings.get_string('clock-color') || '#ffffff';
                const clockVisible = settings.get_boolean('clock-visible');

                const dateFont = settings.get_string('date-font-family') || 'Sans';
                const dateSize = settings.get_int('date-font-size') || 24;
                const dateColor = settings.get_string('date-color') || '#ffffff';
                const dateVisible = settings.get_boolean('date-visible');

                const customTextEnabled = settings.get_boolean('custom-text-enabled');
                const customTextVal = settings.get_string('custom-text') || 'Welcome to Lockscreen Studio';
                const customTextFont = settings.get_string('custom-text-font-family') || 'Sans';
                const customTextSize = settings.get_int('custom-text-font-size') || 20;
                const customTextColor = settings.get_string('custom-text-color') || '#ffffff';

                const enableBlur = settings.get_boolean('enable-blur');
                const blurRadius = settings.get_int('blur-radius') || 30;
                const blurBrightness = settings.get_double('blur-brightness');

                // Dynamic CSS styling - Only apply brightness overlay when blur is enabled
                const overlayOpacity = enableBlur ? Math.max(0.0, Math.min(1.0, 1.0 - blurBrightness)) : 0.0;
                
                // Get wallpaper URI
                let wallpaperUri = '';
                if (bgSettings) {
                    const darkUri = bgSettings.get_string('picture-uri-dark');
                    const lightUri = bgSettings.get_string('picture-uri');
                    const colorScheme = interfaceSettings ? interfaceSettings.get_string('color-scheme') : 'default';

                    if (colorScheme === 'prefer-dark' && darkUri) {
                        wallpaperUri = darkUri;
                    } else if (lightUri) {
                        wallpaperUri = lightUri;
                    } else if (darkUri) {
                        wallpaperUri = darkUri;
                    }
                }

                if (wallpaperUri && !wallpaperUri.startsWith('file://') && wallpaperUri.startsWith('/')) {
                    wallpaperUri = 'file://' + wallpaperUri;
                }

                // Set wallpaper via Gtk.Picture (required for push_blur to work on the image)
                if (wallpaperUri) {
                    try {
                        wallpaperPicture.file = Gio.File.new_for_uri(wallpaperUri);
                    } catch (_e) {
                        wallpaperPicture.file = null;
                    }
                } else {
                    wallpaperPicture.file = null;
                }

                // Fallback gradient on the box itself when no wallpaper is available
                const fallbackBg = wallpaperUri
                    ? ''
                    : 'background: linear-gradient(135deg, #4b1248, #9b2848, #d4682c);';

                const css = `
                    .preview-wallpaper {
                        border-radius: 16px;
                        ${fallbackBg}
                    }
                    .preview-brightness-overlay {
                        background-color: rgba(0, 0, 0, ${overlayOpacity});
                        border-radius: 16px;
                    }
                    .preview-clock-label {
                        font-family: '${clockFont}';
                        font-size: ${Math.max(12, clockSize * 0.5)}px;
                        color: ${clockColor};
                        font-weight: bold;
                        margin-top: 8px;
                    }
                    .preview-date-label {
                        font-family: '${dateFont}';
                        font-size: ${Math.max(10, dateSize * 0.65)}px;
                        color: ${dateColor};
                        margin-top: 4px;
                    }
                    .preview-custom-text-label {
                        font-family: '${customTextFont}';
                        font-size: ${Math.max(8, customTextSize * 0.7)}px;
                        color: ${customTextColor};
                        margin-top: 12px;
                        margin-bottom: 8px;
                    }
                `;
                provider.load_from_string(css);

                // Visibility and content updates
                clockLabel.visible = clockVisible;
                dateLabel.visible = dateVisible;
                customTextLabel.visible = customTextEnabled;
                customTextLabel.label = customTextVal;

                // Native blur applied directly to the Gtk.Picture child — now works correctly
                wallpaper.blurRadius = (enableBlur && blurRadius > 0) ? blurRadius : 0.0;
            };

            // Connect settings changed signals to update this preview
            const signals = [
                'clock-visible', 'clock-font-size', 'clock-font-family', 'clock-color',
                'date-visible', 'date-font-size', 'date-font-family', 'date-color',
                'custom-text-enabled', 'custom-text', 'custom-text-font-size', 'custom-text-font-family', 'custom-text-color',
                'enable-blur', 'blur-radius', 'blur-brightness'
            ];
            
            signals.forEach(sig => {
                settings.connect(`changed::${sig}`, updatePreview);
            });

            // Connect system wallpaper changes
            if (bgSettings) {
                bgSettings.connect('changed::picture-uri', updatePreview);
                bgSettings.connect('changed::picture-uri-dark', updatePreview);
            }
            if (interfaceSettings) {
                interfaceSettings.connect('changed::color-scheme', updatePreview);
            }

            // Run initial update
            updatePreview();

            const aspectFrame = new Gtk.AspectFrame({
                ratio: 16 / 9,
                obey_child: false,
                valign: Gtk.Align.START,
                halign: Gtk.Align.CENTER,
                margin_bottom: 12,
            });
            aspectFrame.set_child(overlay);

            return aspectFrame;
        };

        // ==========================================
        // Page 1: Wallpaper & Blur
        // ==========================================
        const blurPage = new Adw.PreferencesPage({
            title: 'Background Blur',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        window.add(blurPage);

        const blurPreviewGroup = new Adw.PreferencesGroup();
        blurPreviewGroup.add(createPreviewWidget());
        blurPage.add(blurPreviewGroup);

        const blurGroup = new Adw.PreferencesGroup({
            title: 'Blur Effect Control',
            description: 'Tweak or remove the blur applied to your lockscreen wallpaper.',
        });
        blurPage.add(blurGroup);

        // Switch to enable/disable blur
        const enableBlurRow = new Adw.SwitchRow({
            title: 'Enable Lock Screen Blur',
            subtitle: 'Apply visual blur to the lockscreen background',
        });
        settings.bind('enable-blur', enableBlurRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        blurGroup.add(enableBlurRow);

        // Spin row for blur radius
        const blurRadiusRow = new Adw.SpinRow({
            title: 'Blur Radius (Sigma)',
            subtitle: 'Higher values create more blur (default: 30)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 100,
                step_increment: 5,
                page_increment: 10,
            }),
        });
        settings.bind('blur-radius', blurRadiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        enableBlurRow.bind_property('active', blurRadiusRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        blurGroup.add(blurRadiusRow);

        // Spin row for background brightness factor
        const blurBrightnessRow = new Adw.SpinRow({
            title: 'Background Brightness',
            subtitle: 'Adjust the brightness overlay on the lock screen (default: 0.60)',
            digits: 2,
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
            }),
        });
        settings.bind('blur-brightness', blurBrightnessRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        enableBlurRow.bind_property('active', blurBrightnessRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        blurGroup.add(blurBrightnessRow);


        // ==========================================
        // Page 2: Clock & Date Customizer
        // ==========================================
        const clockPage = new Adw.PreferencesPage({
            title: 'Clock & Date Style',
            icon_name: 'preferences-system-time-symbolic',
        });
        window.add(clockPage);

        // Clock Time customizer group
        const clockPreviewGroup = new Adw.PreferencesGroup();
        clockPreviewGroup.add(createPreviewWidget());
        clockPage.add(clockPreviewGroup);

        const clockGroup = new Adw.PreferencesGroup({
            title: 'Time Display Styling',
            description: 'Change sizes, visibility, fonts, and colors of the clock time.',
        });
        clockPage.add(clockGroup);

        const clockVisibleRow = new Adw.SwitchRow({
            title: 'Show Clock Time',
        });
        settings.bind('clock-visible', clockVisibleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(clockVisibleRow);

        const clockFontSizeRow = new Adw.SpinRow({
            title: 'Clock Font Size (px)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 300,
                step_increment: 2,
            }),
        });
        settings.bind('clock-font-size', clockFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        clockVisibleRow.bind_property('active', clockFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        clockGroup.add(clockFontSizeRow);

        const clockFontFamilyRow = new Adw.ComboRow({
            title: 'Clock Font Family',
            model: clockFontList,
        });
        const clockIndex = fonts.indexOf(currentClockFont);
        if (clockIndex !== -1) {
            clockFontFamilyRow.selected = clockIndex;
        }
        clockFontFamilyRow.connect('notify::selected', () => {
            const selectedFont = fonts[clockFontFamilyRow.selected];
            if (selectedFont && settings.get_string('clock-font-family') !== selectedFont) {
                settings.set_string('clock-font-family', selectedFont);
            }
        });
        settings.connect('changed::clock-font-family', () => {
            const currentFont = settings.get_string('clock-font-family');
            const idx = fonts.indexOf(currentFont);
            if (idx !== -1 && clockFontFamilyRow.selected !== idx) {
                clockFontFamilyRow.selected = idx;
            }
        });
        clockVisibleRow.bind_property('active', clockFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        clockGroup.add(clockFontFamilyRow);

        const clockColorRow = new Adw.EntryRow({
            title: 'Clock Text Color — Hex (e.g. #ffffff, #ffaa00)',
        });
        settings.bind('clock-color', clockColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        clockVisibleRow.bind_property('active', clockColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        setupColorPicker(clockColorRow, 'clock-color');
        clockGroup.add(clockColorRow);

        // Clock Date customizer group
        const dateGroup = new Adw.PreferencesGroup({
            title: 'Date Display Styling',
            description: 'Change sizes, visibility, fonts, and colors of the clock date.',
        });
        clockPage.add(dateGroup);

        const dateVisibleRow = new Adw.SwitchRow({
            title: 'Show Date Info',
        });
        settings.bind('date-visible', dateVisibleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dateGroup.add(dateVisibleRow);

        const dateFontSizeRow = new Adw.SpinRow({
            title: 'Date Font Size (px)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 1,
            }),
        });
        settings.bind('date-font-size', dateFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        dateVisibleRow.bind_property('active', dateFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        dateGroup.add(dateFontSizeRow);

        const dateFontFamilyRow = new Adw.ComboRow({
            title: 'Date Font Family',
            model: dateFontList,
        });
        const dateIndex = fonts.indexOf(currentDateFont);
        if (dateIndex !== -1) {
            dateFontFamilyRow.selected = dateIndex;
        }
        dateFontFamilyRow.connect('notify::selected', () => {
            const selectedFont = fonts[dateFontFamilyRow.selected];
            if (selectedFont && settings.get_string('date-font-family') !== selectedFont) {
                settings.set_string('date-font-family', selectedFont);
            }
        });
        settings.connect('changed::date-font-family', () => {
            const currentFont = settings.get_string('date-font-family');
            const idx = fonts.indexOf(currentFont);
            if (idx !== -1 && dateFontFamilyRow.selected !== idx) {
                dateFontFamilyRow.selected = idx;
            }
        });
        dateVisibleRow.bind_property('active', dateFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        dateGroup.add(dateFontFamilyRow);

        const dateColorRow = new Adw.EntryRow({
            title: 'Date Text Color — Hex (e.g. #ffffff)',
        });
        settings.bind('date-color', dateColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        dateVisibleRow.bind_property('active', dateColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        setupColorPicker(dateColorRow, 'date-color');
        dateGroup.add(dateColorRow);


        // ==========================================
        // Page 3: Custom Text Message
        // ==========================================
        const textPage = new Adw.PreferencesPage({
            title: 'Custom Message',
            icon_name: 'document-edit-symbolic',
        });
        window.add(textPage);

        const textPreviewGroup = new Adw.PreferencesGroup();
        textPreviewGroup.add(createPreviewWidget());
        textPage.add(textPreviewGroup);

        const textGroup = new Adw.PreferencesGroup({
            title: 'On-Screen Custom Message',
            description: 'Write custom text to show on your lockscreen (perfect for ownership info, welcome notes, or emergency contacts).',
        });
        textPage.add(textGroup);

        const customTextEnabledRow = new Adw.SwitchRow({
            title: 'Show Custom Message',
            subtitle: 'Display a custom text line below the clock/date',
        });
        settings.bind('custom-text-enabled', customTextEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        textGroup.add(customTextEnabledRow);

        const customTextRow = new Adw.EntryRow({
            title: 'Custom Text Content',
        });
        settings.bind('custom-text', customTextRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        customTextEnabledRow.bind_property('active', customTextRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        textGroup.add(customTextRow);

        const customTextFontSizeRow = new Adw.SpinRow({
            title: 'Message Font Size (px)',
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 1,
            }),
        });
        settings.bind('custom-text-font-size', customTextFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        customTextEnabledRow.bind_property('active', customTextFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        textGroup.add(customTextFontSizeRow);

        const customTextFontFamilyRow = new Adw.ComboRow({
            title: 'Message Font Family',
            model: customTextFontList,
        });
        const customTextIndex = fonts.indexOf(currentCustomTextFont);
        if (customTextIndex !== -1) {
            customTextFontFamilyRow.selected = customTextIndex;
        }
        customTextFontFamilyRow.connect('notify::selected', () => {
            const selectedFont = fonts[customTextFontFamilyRow.selected];
            if (selectedFont && settings.get_string('custom-text-font-family') !== selectedFont) {
                settings.set_string('custom-text-font-family', selectedFont);
            }
        });
        settings.connect('changed::custom-text-font-family', () => {
            const currentFont = settings.get_string('custom-text-font-family');
            const idx = fonts.indexOf(currentFont);
            if (idx !== -1 && customTextFontFamilyRow.selected !== idx) {
                customTextFontFamilyRow.selected = idx;
            }
        });
        customTextEnabledRow.bind_property('active', customTextFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        textGroup.add(customTextFontFamilyRow);

        const customTextColorRow = new Adw.EntryRow({
            title: 'Message Text Color — Hex (e.g. #ffffff)',
        });
        settings.bind('custom-text-color', customTextColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        customTextEnabledRow.bind_property('active', customTextColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        setupColorPicker(customTextColorRow, 'custom-text-color');
        textGroup.add(customTextColorRow);
    }
}
