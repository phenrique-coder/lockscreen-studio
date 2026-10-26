// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences: Clock & Date Page
 * Controls clock formats, styles, fonts, colors, analog skins, and date layout.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { SETTINGS_KEYS, CLOCK_STYLES, ANALOG_SKINS } from '../constants.js';
import { setupColorPicker, createFontFactory } from './helpers.js';
import { createPreviewWidget } from './wallpaperPreview.js';

export function buildClockPage(settings, fonts, clockFontList, dateFontList) {
    const page = new Adw.PreferencesPage({
        title: 'Clock & Date Style',
        icon_name: 'preferences-system-time-symbolic',
    });

    const previewGroup = new Adw.PreferencesGroup();
    previewGroup.add(createPreviewWidget(settings));
    page.add(previewGroup);

    const clockGroup = new Adw.PreferencesGroup({
        title: 'Time Display Styling',
        description: 'Change sizes, visibility, fonts, and colors of the clock time.',
    });
    page.add(clockGroup);

    const clockVisibleRow = new Adw.SwitchRow({
        title: 'Show Clock Time',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_VISIBLE, clockVisibleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    clockGroup.add(clockVisibleRow);

    const clockFontSizeRow = new Adw.SpinRow({
        title: 'Clock Font Size (px)',
        adjustment: new Gtk.Adjustment({
            lower: 10,
            upper: 300,
            step_increment: 2,
        }),
    });
    settings.bind(SETTINGS_KEYS.CLOCK_FONT_SIZE, clockFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    clockVisibleRow.bind_property('active', clockFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    clockGroup.add(clockFontSizeRow);

    const clockFontFamilyRow = new Adw.ComboRow({
        title: 'Clock Font Family',
        model: clockFontList,
        factory: createFontFactory(),
    });
    const currentClockFont = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY) || 'Sans';
    const clockIndex = fonts.indexOf(currentClockFont);
    if (clockIndex !== -1) {
        clockFontFamilyRow.selected = clockIndex;
    }
    clockFontFamilyRow.connect('notify::selected', () => {
        const selectedFont = fonts[clockFontFamilyRow.selected];
        if (selectedFont && settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY) !== selectedFont) {
            settings.set_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY, selectedFont);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.CLOCK_FONT_FAMILY}`, () => {
        const currentFont = settings.get_string(SETTINGS_KEYS.CLOCK_FONT_FAMILY);
        const idx = fonts.indexOf(currentFont);
        if (idx !== -1 && clockFontFamilyRow.selected !== idx) {
            clockFontFamilyRow.selected = idx;
        }
    });
    clockVisibleRow.bind_property('active', clockFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    clockGroup.add(clockFontFamilyRow);

    // Clock Style Selection
    const clockStylesList = Gtk.StringList.new([
        'Default Digital',
        'Separated Colors (Horizontal)',
        'Vertical Stack',
        'Analog Clock',
    ]);
    const clockStyleRow = new Adw.ComboRow({
        title: 'Clock Style',
        model: clockStylesList,
    });
    const styleKeys = [CLOCK_STYLES.DEFAULT, CLOCK_STYLES.SEPARATED_COLORS, CLOCK_STYLES.VERTICAL_STACK, CLOCK_STYLES.ANALOG];
    const currentStyle = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) || CLOCK_STYLES.DEFAULT;
    const styleIdx = styleKeys.indexOf(currentStyle);
    if (styleIdx !== -1) {
        clockStyleRow.selected = styleIdx;
    }
    clockStyleRow.connect('notify::selected', () => {
        const selectedStyle = styleKeys[clockStyleRow.selected];
        if (selectedStyle && settings.get_string(SETTINGS_KEYS.CLOCK_STYLE) !== selectedStyle) {
            settings.set_string(SETTINGS_KEYS.CLOCK_STYLE, selectedStyle);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.CLOCK_STYLE}`, () => {
        const current = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE);
        const idx = styleKeys.indexOf(current);
        if (idx !== -1 && clockStyleRow.selected !== idx) {
            clockStyleRow.selected = idx;
        }
    });
    clockVisibleRow.bind_property('active', clockStyleRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    clockGroup.add(clockStyleRow);

    const clockColorRow = new Adw.EntryRow({
        title: 'Clock Text Color — Hex (e.g. #ffffff, #ffaa00)',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_COLOR, clockColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    clockVisibleRow.bind_property('active', clockColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(clockColorRow, SETTINGS_KEYS.CLOCK_COLOR, settings);
    clockGroup.add(clockColorRow);

    const clockMinutesColorRow = new Adw.EntryRow({
        title: 'Minutes / Hand Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_MINUTES_COLOR, clockMinutesColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    setupColorPicker(clockMinutesColorRow, SETTINGS_KEYS.CLOCK_MINUTES_COLOR, settings);
    clockGroup.add(clockMinutesColorRow);

    const clockSeparatorColorRow = new Adw.EntryRow({
        title: 'Separator / Ticks Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR, clockSeparatorColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    setupColorPicker(clockSeparatorColorRow, SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR, settings);
    clockGroup.add(clockSeparatorColorRow);

    // Analog Clock Options
    const skinsList = Gtk.StringList.new([
        'Minimalist',
        'Classic',
        'Accent',
    ]);
    const analogClockSkinRow = new Adw.ComboRow({
        title: 'Analog Clock Skin',
        model: skinsList,
    });
    const skinKeys = [ANALOG_SKINS.MINIMALIST, ANALOG_SKINS.CLASSIC, ANALOG_SKINS.ACCENT];
    const currentSkin = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN) || ANALOG_SKINS.MINIMALIST;
    const skinIdx = skinKeys.indexOf(currentSkin);
    if (skinIdx !== -1) {
        analogClockSkinRow.selected = skinIdx;
    }
    analogClockSkinRow.connect('notify::selected', () => {
        const selectedSkin = skinKeys[analogClockSkinRow.selected];
        if (selectedSkin && settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN) !== selectedSkin) {
            settings.set_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN, selectedSkin);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.ANALOG_CLOCK_SKIN}`, () => {
        const current = settings.get_string(SETTINGS_KEYS.ANALOG_CLOCK_SKIN);
        const idx = skinKeys.indexOf(current);
        if (idx !== -1 && analogClockSkinRow.selected !== idx) {
            analogClockSkinRow.selected = idx;
        }
    });
    clockGroup.add(analogClockSkinRow);

    const analogClockNumbersColorRow = new Adw.EntryRow({
        title: 'Numbers Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR, analogClockNumbersColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    setupColorPicker(analogClockNumbersColorRow, SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR, settings);
    clockGroup.add(analogClockNumbersColorRow);

    const clockSecondHandRow = new Adw.SwitchRow({
        title: 'Show Second Hand',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_SECOND_HAND_ENABLED, clockSecondHandRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    clockGroup.add(clockSecondHandRow);

    const clockSecondHandColorRow = new Adw.EntryRow({
        title: 'Second Hand Color — Hex (e.g. #ff4444)',
    });
    settings.bind(SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR, clockSecondHandColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    setupColorPicker(clockSecondHandColorRow, SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR, settings);
    clockGroup.add(clockSecondHandColorRow);

    const analogClockShowNumbersRow = new Adw.SwitchRow({
        title: 'Show Hour Numbers',
        subtitle: 'Display numbers 1-12 on the analog clock face',
    });
    settings.bind(SETTINGS_KEYS.ANALOG_CLOCK_SHOW_NUMBERS, analogClockShowNumbersRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    clockGroup.add(analogClockShowNumbersRow);

    const analogClockSizeRow = new Adw.SpinRow({
        title: 'Analog Clock Size (diameter px)',
        subtitle: 'Adjust the size of the analog clock (80-400)',
        adjustment: new Gtk.Adjustment({
            lower: 80,
            upper: 400,
            step_increment: 10,
            page_increment: 20,
        }),
    });
    settings.bind(SETTINGS_KEYS.ANALOG_CLOCK_SIZE, analogClockSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    clockGroup.add(analogClockSizeRow);

    const resetColorsButton = new Gtk.Button({
        label: 'Reset Colors to Defaults',
        halign: Gtk.Align.CENTER,
        margin_top: 8,
        css_classes: ['destructive-action'],
    });
    resetColorsButton.connect('clicked', () => {
        settings.reset(SETTINGS_KEYS.CLOCK_COLOR);
        settings.reset(SETTINGS_KEYS.CLOCK_MINUTES_COLOR);
        settings.reset(SETTINGS_KEYS.CLOCK_SEPARATOR_COLOR);
        settings.reset(SETTINGS_KEYS.CLOCK_SECOND_HAND_COLOR);
        settings.reset(SETTINGS_KEYS.ANALOG_CLOCK_NUMBERS_COLOR);
    });
    clockGroup.add(resetColorsButton);

    // Visibility toggles for analog-only rows
    const updateAnalogVisibility = () => {
        const style = settings.get_string(SETTINGS_KEYS.CLOCK_STYLE);
        const isAnalog = style === CLOCK_STYLES.ANALOG;
        analogClockSkinRow.visible = isAnalog;
        clockSecondHandRow.visible = isAnalog;
        clockSecondHandColorRow.visible = isAnalog;
        analogClockShowNumbersRow.visible = isAnalog;
        analogClockSizeRow.visible = isAnalog;
        analogClockNumbersColorRow.visible = isAnalog;
        resetColorsButton.visible = isAnalog;
    };
    settings.connect(`changed::${SETTINGS_KEYS.CLOCK_STYLE}`, updateAnalogVisibility);
    updateAnalogVisibility();

    const dateGroup = new Adw.PreferencesGroup({
        title: 'Date Display Styling',
        description: 'Change sizes, visibility, fonts, and colors of the lockscreen date.',
    });
    page.add(dateGroup);

    const dateVisibleRow = new Adw.SwitchRow({
        title: 'Show Date',
    });
    settings.bind(SETTINGS_KEYS.DATE_VISIBLE, dateVisibleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    dateGroup.add(dateVisibleRow);

    const dateFontSizeRow = new Adw.SpinRow({
        title: 'Date Font Size (px)',
        adjustment: new Gtk.Adjustment({
            lower: 10,
            upper: 100,
            step_increment: 1,
        }),
    });
    settings.bind(SETTINGS_KEYS.DATE_FONT_SIZE, dateFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    dateVisibleRow.bind_property('active', dateFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    dateGroup.add(dateFontSizeRow);

    const dateFontFamilyRow = new Adw.ComboRow({
        title: 'Date Font Family',
        model: dateFontList,
        factory: createFontFactory(),
    });
    const currentDateFont = settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY) || 'Sans';
    const dateIndex = fonts.indexOf(currentDateFont);
    if (dateIndex !== -1) {
        dateFontFamilyRow.selected = dateIndex;
    }
    dateFontFamilyRow.connect('notify::selected', () => {
        const selectedFont = fonts[dateFontFamilyRow.selected];
        if (selectedFont && settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY) !== selectedFont) {
            settings.set_string(SETTINGS_KEYS.DATE_FONT_FAMILY, selectedFont);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.DATE_FONT_FAMILY}`, () => {
        const currentFont = settings.get_string(SETTINGS_KEYS.DATE_FONT_FAMILY);
        const idx = fonts.indexOf(currentFont);
        if (idx !== -1 && dateFontFamilyRow.selected !== idx) {
            dateFontFamilyRow.selected = idx;
        }
    });
    dateVisibleRow.bind_property('active', dateFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    dateGroup.add(dateFontFamilyRow);

    const dateColorRow = new Adw.EntryRow({
        title: 'Date Text Color — Hex (e.g. #ffffff, #888888)',
    });
    settings.bind(SETTINGS_KEYS.DATE_COLOR, dateColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    dateVisibleRow.bind_property('active', dateColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(dateColorRow, SETTINGS_KEYS.DATE_COLOR, settings);
    dateGroup.add(dateColorRow);

    return page;
}
