// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences: Custom Message Page
 * Controls on-screen custom message content, typography, and colors.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { SETTINGS_KEYS } from '../constants.js';
import { setupColorPicker, createFontFactory } from './helpers.js';
import { createPreviewWidget } from './wallpaperPreview.js';

export function buildCustomTextPage(settings, fonts, customTextFontList) {
    const page = new Adw.PreferencesPage({
        title: 'Custom Message',
        icon_name: 'document-edit-symbolic',
    });

    const previewGroup = new Adw.PreferencesGroup();
    previewGroup.add(createPreviewWidget(settings));
    page.add(previewGroup);

    const textGroup = new Adw.PreferencesGroup({
        title: 'On-Screen Custom Message',
        description: 'Write custom text to show on your lockscreen (perfect for ownership info, welcome notes, or emergency contacts).',
    });
    page.add(textGroup);

    const customTextEnabledRow = new Adw.SwitchRow({
        title: 'Show Custom Message',
        subtitle: 'Display a custom text line below the clock/date',
    });
    settings.bind(SETTINGS_KEYS.CUSTOM_TEXT_ENABLED, customTextEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    textGroup.add(customTextEnabledRow);

    const customTextRow = new Adw.EntryRow({
        title: 'Custom Text Content',
    });
    settings.bind(SETTINGS_KEYS.CUSTOM_TEXT, customTextRow, 'text', Gio.SettingsBindFlags.DEFAULT);
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
    settings.bind(SETTINGS_KEYS.CUSTOM_TEXT_FONT_SIZE, customTextFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    customTextEnabledRow.bind_property('active', customTextFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    textGroup.add(customTextFontSizeRow);

    const customTextFontFamilyRow = new Adw.ComboRow({
        title: 'Message Font Family',
        model: customTextFontList,
        factory: createFontFactory(),
    });
    const currentCustomTextFont = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY) || 'Sans';
    const customTextIndex = fonts.indexOf(currentCustomTextFont);
    if (customTextIndex !== -1) {
        customTextFontFamilyRow.selected = customTextIndex;
    }
    customTextFontFamilyRow.connect('notify::selected', () => {
        const selectedFont = fonts[customTextFontFamilyRow.selected];
        if (selectedFont && settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY) !== selectedFont) {
            settings.set_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY, selectedFont);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY}`, () => {
        const currentFont = settings.get_string(SETTINGS_KEYS.CUSTOM_TEXT_FONT_FAMILY);
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
    settings.bind(SETTINGS_KEYS.CUSTOM_TEXT_COLOR, customTextColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    customTextEnabledRow.bind_property('active', customTextColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(customTextColorRow, SETTINGS_KEYS.CUSTOM_TEXT_COLOR, settings);
    textGroup.add(customTextColorRow);

    return page;
}
