import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import PangoCairo from 'gi://PangoCairo';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LockscreenStudioPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

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
                has_opacity_control: false,
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

        // ==========================================
        // Page 1: Wallpaper & Blur
        // ==========================================
        const blurPage = new Adw.PreferencesPage({
            title: 'Background Blur',
            icon_name: 'preferences-desktop-wallpaper-symbolic',
        });
        window.add(blurPage);

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
                lower: 0,
                upper: 200,
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
