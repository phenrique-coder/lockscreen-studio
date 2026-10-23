// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Preferences UI Helpers
 * Utility functions for color conversion, color picker buttons, and font list items.
 */

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

/**
 * Convert Gdk.RGBA to a hex color string (#rrggbb).
 *
 * @param {Gdk.RGBA} rgba - Gdk RGBA color
 * @returns {string} Hex color string
 */
export function rgbaToHex(rgba) {
    const r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
    const g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
    const b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

/**
 * Attach a Gtk.ColorButton suffix to an Adw.EntryRow and bind it to a GSettings key.
 *
 * @param {Adw.EntryRow} entryRow - The target entry row
 * @param {string} settingsKey - GSettings key name
 * @param {Gio.Settings} settings - Extension GSettings
 */
export function setupColorPicker(entryRow, settingsKey, settings) {
    const colorButton = new Gtk.ColorButton({
        valign: Gtk.Align.CENTER,
        use_alpha: false,
    });
    entryRow.add_suffix(colorButton);

    // Initial color
    const initialHex = settings.get_string(settingsKey) || '#ffffff';
    const rgba = new Gdk.RGBA();
    if (rgba.parse(initialHex)) {
        colorButton.rgba = rgba;
    }

    // When color dialog selects a color
    colorButton.connect('color-set', () => {
        const hexColor = rgbaToHex(colorButton.rgba);
        if (settings.get_string(settingsKey) !== hexColor) {
            settings.set_string(settingsKey, hexColor);
        }
    });

    // When settings key changes externally
    settings.connect(`changed::${settingsKey}`, () => {
        const hexColor = settings.get_string(settingsKey) || '#ffffff';
        const newRgba = new Gdk.RGBA();
        if (newRgba.parse(hexColor)) {
            colorButton.rgba = newRgba;
        }
    });

    // When user edits text in entry row directly
    entryRow.connect('notify::text', () => {
        const hexColor = entryRow.text;
        const newRgba = new Gdk.RGBA();
        if (newRgba.parse(hexColor)) {
            colorButton.rgba = newRgba;
        }
    });

    // Bind sensitivity
    entryRow.bind_property('sensitive', colorButton, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
}

/**
 * Create a factory for font combo rows preventing UI stretching on long font names.
 *
 * @returns {Gtk.SignalListItemFactory}
 */
export function createFontFactory() {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (f, listitem) => {
        const label = new Gtk.Label({
            ellipsize: Pango.EllipsizeMode.END,
            max_width_chars: 20,
            halign: Gtk.Align.START,
        });
        listitem.set_child(label);
    });
    factory.connect('bind', (f, listitem) => {
        const label = listitem.get_child();
        const item = listitem.get_item();
        if (item) {
            label.label = item.string;
        }
    });
    return factory;
}
