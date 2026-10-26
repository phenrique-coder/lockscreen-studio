// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences: User & Panel Scaling Page
 * Controls user avatar size, username/password typography, and lockscreen top bar panel scaling.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { SETTINGS_KEYS } from '../constants.js';
import { setupColorPicker, createFontFactory } from './helpers.js';
import { createAuthPreviewWidget } from './wallpaperPreview.js';

export function buildAuthPage(settings, fonts, usernameFontList) {
    const page = new Adw.PreferencesPage({
        title: 'User & Panel Scaling',
        icon_name: 'avatar-default-symbolic',
    });

    // Live Preview Card
    const previewGroup = new Adw.PreferencesGroup();
    previewGroup.add(createAuthPreviewWidget(settings));
    page.add(previewGroup);

    const authGroup = new Adw.PreferencesGroup({
        title: 'User Avatar & Auth Prompt',
        description: 'Scale the user icon, username typography, and password entry (useful on HiDPI displays).',
    });
    page.add(authGroup);

    const enableAuthCustomRow = new Adw.SwitchRow({
        title: 'Enable Custom User & Auth Styling',
        subtitle: 'Apply custom scaling to the avatar, username, and password entry',
    });
    settings.bind(SETTINGS_KEYS.AUTH_CUSTOM_STYLE_ENABLED, enableAuthCustomRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    authGroup.add(enableAuthCustomRow);

    // Avatar Size
    const avatarSizeRow = new Adw.SpinRow({
        title: 'User Avatar Size (px)',
        subtitle: 'Icon dimensions for the user avatar (default: 64)',
        adjustment: new Gtk.Adjustment({
            lower: 32,
            upper: 256,
            step_increment: 8,
            page_increment: 16,
        }),
    });
    settings.bind(SETTINGS_KEYS.AUTH_AVATAR_SIZE, avatarSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', avatarSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    authGroup.add(avatarSizeRow);

    // Username Font Size
    const usernameFontSizeRow = new Adw.SpinRow({
        title: 'Username Font Size (px)',
        adjustment: new Gtk.Adjustment({
            lower: 10,
            upper: 80,
            step_increment: 1,
            page_increment: 5,
        }),
    });
    settings.bind(SETTINGS_KEYS.AUTH_USERNAME_FONT_SIZE, usernameFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', usernameFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    authGroup.add(usernameFontSizeRow);

    // Username Font Family
    const usernameFontFamilyRow = new Adw.ComboRow({
        title: 'Username Font Family',
        model: usernameFontList,
        factory: createFontFactory(),
    });
    const currentUsernameFont = settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY) || 'Sans';
    const userFontIdx = fonts.indexOf(currentUsernameFont);
    if (userFontIdx !== -1) {
        usernameFontFamilyRow.selected = userFontIdx;
    }
    usernameFontFamilyRow.connect('notify::selected', () => {
        const selectedFont = fonts[usernameFontFamilyRow.selected];
        if (selectedFont && settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY) !== selectedFont) {
            settings.set_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY, selectedFont);
        }
    });
    settings.connect(`changed::${SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY}`, () => {
        const current = settings.get_string(SETTINGS_KEYS.AUTH_USERNAME_FONT_FAMILY);
        const idx = fonts.indexOf(current);
        if (idx !== -1 && usernameFontFamilyRow.selected !== idx) {
            usernameFontFamilyRow.selected = idx;
        }
    });
    enableAuthCustomRow.bind_property('active', usernameFontFamilyRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    authGroup.add(usernameFontFamilyRow);

    // Username Color
    const usernameColorRow = new Adw.EntryRow({
        title: 'Username Text Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.AUTH_USERNAME_COLOR, usernameColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', usernameColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(usernameColorRow, SETTINGS_KEYS.AUTH_USERNAME_COLOR, settings);
    authGroup.add(usernameColorRow);

    // Password Entry Font Size
    const entryFontSizeRow = new Adw.SpinRow({
        title: 'Password Entry Font Size (px)',
        adjustment: new Gtk.Adjustment({
            lower: 10,
            upper: 60,
            step_increment: 1,
            page_increment: 4,
        }),
    });
    settings.bind(SETTINGS_KEYS.AUTH_ENTRY_FONT_SIZE, entryFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', entryFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    authGroup.add(entryFontSizeRow);

    // Password Entry Color
    const entryColorRow = new Adw.EntryRow({
        title: 'Password Text Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.AUTH_ENTRY_COLOR, entryColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', entryColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(entryColorRow, SETTINGS_KEYS.AUTH_ENTRY_COLOR, settings);
    authGroup.add(entryColorRow);

    // Auth Message Font Size
    const messageFontSizeRow = new Adw.SpinRow({
        title: 'Auth Message Font Size (px)',
        subtitle: 'Size for prompt, PAM, and error messages (default: 14)',
        adjustment: new Gtk.Adjustment({
            lower: 10,
            upper: 50,
            step_increment: 1,
        }),
    });
    settings.bind(SETTINGS_KEYS.AUTH_MESSAGE_FONT_SIZE, messageFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', messageFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    authGroup.add(messageFontSizeRow);

    // Auth Message Color
    const messageColorRow = new Adw.EntryRow({
        title: 'Auth Message Color — Hex (e.g. #ffffff)',
    });
    settings.bind(SETTINGS_KEYS.AUTH_MESSAGE_COLOR, messageColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
    enableAuthCustomRow.bind_property('active', messageColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    setupColorPicker(messageColorRow, SETTINGS_KEYS.AUTH_MESSAGE_COLOR, settings);
    authGroup.add(messageColorRow);

    const panelGroup = new Adw.PreferencesGroup({
        title: 'Top Bar / Panel Scaling',
        description: 'Customize the height and font size of the top bar/panel on the lock screen.',
    });
    page.add(panelGroup);

    const enablePanelCustomRow = new Adw.SwitchRow({
        title: 'Enable Custom Top Bar Scaling',
        subtitle: 'Scale the top bar height and text size on the lockscreen',
    });
    settings.bind(SETTINGS_KEYS.PANEL_CUSTOM_STYLE_ENABLED, enablePanelCustomRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    panelGroup.add(enablePanelCustomRow);

    const panelHeightRow = new Adw.SpinRow({
        title: 'Top Bar Height (px)',
        subtitle: 'Height of the top bar on the lockscreen (default: 32)',
        adjustment: new Gtk.Adjustment({
            lower: 20,
            upper: 80,
            step_increment: 2,
            page_increment: 6,
        }),
    });
    settings.bind(SETTINGS_KEYS.PANEL_HEIGHT, panelHeightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enablePanelCustomRow.bind_property('active', panelHeightRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    panelGroup.add(panelHeightRow);

    const panelFontSizeRow = new Adw.SpinRow({
        title: 'Top Bar Font Size (px)',
        subtitle: 'Font size of indicators and clock on the top bar (default: 14)',
        adjustment: new Gtk.Adjustment({
            lower: 8,
            upper: 40,
            step_increment: 1,
            page_increment: 2,
        }),
    });
    settings.bind(SETTINGS_KEYS.PANEL_FONT_SIZE, panelFontSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enablePanelCustomRow.bind_property('active', panelFontSizeRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    panelGroup.add(panelFontSizeRow);

    return page;
}
