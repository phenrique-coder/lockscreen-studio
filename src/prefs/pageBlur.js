// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences: Blur & Brightness Page
 * Controls background blur and brightness overlay.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { SETTINGS_KEYS } from '../constants.js';
import { createPreviewWidget } from './wallpaperPreview.js';

export function buildBlurPage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Background & Blur',
        icon_name: 'preferences-desktop-wallpaper-symbolic',
    });

    // Preview
    const previewGroup = new Adw.PreferencesGroup();
    previewGroup.add(createPreviewWidget(settings));
    page.add(previewGroup);

    // Blur Group
    const blurGroup = new Adw.PreferencesGroup({
        title: 'Background Blur',
        description: 'Apply and control blur intensity on the lockscreen wallpaper.',
    });
    page.add(blurGroup);

    const enableBlurRow = new Adw.SwitchRow({
        title: 'Enable Background Blur',
        subtitle: 'Apply visual blur to the lockscreen background',
    });
    settings.bind(SETTINGS_KEYS.ENABLE_BLUR, enableBlurRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    blurGroup.add(enableBlurRow);

    // Spin row for blur radius
    const blurRadiusRow = new Adw.SpinRow({
        title: 'Blur Radius (Sigma)',
        subtitle: 'Higher values create more blur. Set to 0 for no blur (default: 30)',
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 100,
            step_increment: 5,
            page_increment: 10,
        }),
    });
    settings.bind(SETTINGS_KEYS.BLUR_RADIUS, blurRadiusRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableBlurRow.bind_property('active', blurRadiusRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    blurGroup.add(blurRadiusRow);

    // Brightness Group
    const brightnessGroup = new Adw.PreferencesGroup({
        title: 'Background Brightness',
        description: 'Apply a dark overlay to dim the lockscreen background. Works independently from blur.',
    });
    page.add(brightnessGroup);

    const enableBrightnessRow = new Adw.SwitchRow({
        title: 'Enable Brightness Overlay',
        subtitle: 'Add a dark overlay on the lockscreen background',
    });
    settings.bind(SETTINGS_KEYS.ENABLE_BRIGHTNESS, enableBrightnessRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    brightnessGroup.add(enableBrightnessRow);

    const blurBrightnessRow = new Adw.SpinRow({
        title: 'Brightness Level',
        subtitle: '0.0 = fully black overlay | 1.0 = no overlay (default: 0.60)',
        digits: 2,
        adjustment: new Gtk.Adjustment({
            lower: 0.0,
            upper: 1.0,
            step_increment: 0.05,
            page_increment: 0.1,
        }),
    });
    settings.bind(SETTINGS_KEYS.BLUR_BRIGHTNESS, blurBrightnessRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    enableBrightnessRow.bind_property('active', blurBrightnessRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
    brightnessGroup.add(blurBrightnessRow);

    return page;
}
