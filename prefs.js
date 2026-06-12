import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GnomeDesktop from 'gi://GnomeDesktop';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
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

        // Helper to prevent ComboRow from stretching when long font names are selected
        const createFontFactory = () => {
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

            const clockContainer = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
            });
            contentBox.append(clockContainer);

            const dateLabel = new Gtk.Label({
                label: initDate,
                css_classes: ['preview-date-label'],
            });
            contentBox.append(dateLabel);

            // Live clock: update every second
            let clockTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                const now = new Date();
                const activeStyle = settings.get_string('clock-style') || 'default';

                if (activeStyle === 'analog') {
                    const firstChild = clockContainer.get_first_child();
                    if (firstChild && firstChild.queue_draw) {
                        firstChild.queue_draw();
                    }
                } else {
                    let hoursVal = now.getHours();
                    const minutesVal = String(now.getMinutes()).padStart(2, '0');
                    let ampmVal = '';
                    
                    let interfaceSettings = null;
                    try {
                        interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
                    } catch (e) {}
                    
                    const format = interfaceSettings ? interfaceSettings.get_string('clock-format') : '24h';
                    if (format === '12h') {
                        ampmVal = hoursVal >= 12 ? ' PM' : ' AM';
                        hoursVal = hoursVal % 12 || 12;
                    }
                    const hrStr = String(hoursVal);
                    const hoursValDisplay = format === '12h' ? hrStr : hrStr.padStart(2, '0');

                    if (activeStyle === 'default') {
                        const label = clockContainer.get_first_child();
                        if (label) {
                            label.label = hoursValDisplay + ':' + minutesVal;
                        }
                    } else if (activeStyle === 'separated-colors') {
                        const hBox = clockContainer.get_first_child();
                        if (hBox) {
                            const hr = hBox.get_first_child();
                            const sep = hr ? hr.get_next_sibling() : null;
                            const min = sep ? sep.get_next_sibling() : null;
                            if (hr) hr.label = hoursValDisplay;
                            if (min) min.label = minutesVal;
                            
                            // Handle AM/PM
                            let ampmLabel = min ? min.get_next_sibling() : null;
                            if (format === '12h') {
                                if (!ampmLabel) {
                                    ampmLabel = new Gtk.Label({ css_classes: ['preview-clock-ampm'] });
                                    ampmLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                                    
                                    const clockSizeVal = settings.get_int('clock-font-size') || 80;
                                    const scaleVal = previewWidth / REFERENCE_WIDTH;
                                    const ampmPx = Math.max(5, Math.round(clockSizeVal * scaleVal * 0.4));
                                    provider.load_from_string(provider.to_string() + `
                                        .preview-clock-ampm {
                                            font-size: ${ampmPx}px;
                                            color: ${settings.get_string('clock-color') || '#ffffff'};
                                            margin-left: 4px;
                                        }
                                    `);
                                    hBox.append(ampmLabel);
                                }
                                ampmLabel.label = ampmVal;
                            } else if (ampmLabel) {
                                hBox.remove(ampmLabel);
                            }
                        }
                    } else if (activeStyle === 'vertical-stack') {
                        const vBox = clockContainer.get_first_child();
                        if (vBox) {
                            const hr = vBox.get_first_child();
                            const min = hr ? hr.get_next_sibling() : null;
                            if (hr) hr.label = hoursValDisplay;
                            if (min) min.label = minutesVal;
                        }
                    }
                }

                // Update Date
                const dateStr = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
                dateLabel.label = dateStr;

                return GLib.SOURCE_CONTINUE;
            });

            // Clean up timers when the widget is destroyed
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

            const customTextLabel = new Gtk.Label({
                label: 'Welcome to Lockscreen Studio',
                css_classes: ['preview-custom-text-label'],
            });
            contentBox.append(customTextLabel);

            // Apply style provider to all individual styled widgets (bypassing GTK4 cascade limitation)
            const styleContexts = [
                wallpaper.get_style_context(),
                brightnessOverlay.get_style_context(),
                dateLabel.get_style_context(),
                customTextLabel.get_style_context()
            ];
            styleContexts.forEach(ctx => {
                ctx.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
            });

            // ── Performance: thumbnail factory created once (heavy object) ──────────
            let thumbFactory = null;
            try {
                thumbFactory = GnomeDesktop.DesktopThumbnailFactory.new(
                    GnomeDesktop.DesktopThumbnailSize.LARGE
                );
            } catch (_e) { /* not available, will fall back to convert */ }

            // ── Wallpaper cache: only re-resolve when URI actually changes ──────────
            let _cachedWallpaperUri = null; // last raw URI from GSettings
            let _wallpaperLoading = false;  // guard against concurrent convert jobs

            // Resolve dynamic (XML) wallpaper — sync but only called on URI change
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

            // Load wallpaper — skips entirely if URI hasn't changed (zero I/O)
            const loadWallpaperPicture = (rawUri) => {
                if (!rawUri) {
                    _cachedWallpaperUri = null;
                    wallpaperPicture.file = null;
                    return;
                }
                // Skip if nothing changed
                if (rawUri === _cachedWallpaperUri) return;
                _cachedWallpaperUri = rawUri;

                try {
                    const resolvedUri = resolveDynamicWallpaper(rawUri) || rawUri;
                    const resolvedFile = Gio.File.new_for_uri(resolvedUri);
                    const resolvedPath = resolvedFile.get_path();
                    const ext = resolvedPath ? resolvedPath.split('.').pop().toLowerCase() : '';
                    const unsupportedFormats = ['jxl', 'avif', 'heic', 'heif'];

                    if (unsupportedFormats.includes(ext)) {
                        // 1st: try GNOME thumbnail cache (instant if already cached)
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
                            } catch (_e) { /* fall through */ }
                        }

                        // 2nd: async convert — never blocks the main thread
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
                                } catch (_e2) { /* ignore */ }
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

            // ── Proportional scaling: tracks actual rendered preview width ──────────
            // Reference = real monitor width. Fonts scale relative to that.
            let REFERENCE_WIDTH = 1920; // fallback
            try {
                const display = Gdk.Display.get_default();
                const monitors = display.get_monitors();
                if (monitors.get_n_items() > 0)
                    REFERENCE_WIDTH = monitors.get_item(0).get_geometry().width;
            } catch (_e) { /* keep fallback */ }
            let previewWidth = 480; // safe default/fallback
            let isFirstLayout = true;

            overlay.connect('notify::width', () => {
                const w = overlay.get_width();
                if (w > 10 && (w !== previewWidth || isFirstLayout)) {
                    previewWidth = w;
                    isFirstLayout = false;
                    applyUpdate();
                }
            });

            // ── Debounce: 200ms — coalesces rapid slider/settings changes ──────────
            let debounceTimerId = null;
            const DEBOUNCE_MS = 200;

            // Core update — fast path, no I/O (wallpaper handled separately above)
            const applyUpdate = () => {
                const clockFont    = settings.get_string('clock-font-family') || 'Sans';
                const clockSize    = settings.get_int('clock-font-size') || 80;
                const clockColor   = settings.get_string('clock-color') || '#ffffff';
                const clockVisible = settings.get_boolean('clock-visible');
                const clockStyle   = settings.get_string('clock-style') || 'default';
                const clockMinutesColor = settings.get_string('clock-minutes-color') || '#ffffff';
                const clockSeparatorColor = settings.get_string('clock-separator-color') || '#ffffff';
                const analogClockSkin = settings.get_string('analog-clock-skin') || 'minimalist';
                const clockSecondHandEnabled = settings.get_boolean('clock-second-hand-enabled');
                const clockSecondHandColor = settings.get_string('clock-second-hand-color') || '#ff4444';
                const analogClockShowNumbers = settings.get_boolean('analog-clock-show-numbers');
                const analogClockSize = settings.get_int('analog-clock-size');
                const analogClockNumbersColor = settings.get_string('analog-clock-numbers-color') || '#ffffff';

                const dateFont    = settings.get_string('date-font-family') || 'Sans';
                const dateSize    = settings.get_int('date-font-size') || 24;
                const dateColor   = settings.get_string('date-color') || '#ffffff';
                const dateVisible = settings.get_boolean('date-visible');

                const customTextEnabled = settings.get_boolean('custom-text-enabled');
                const customTextVal     = settings.get_string('custom-text') || 'Welcome to Lockscreen Studio';
                const customTextFont    = settings.get_string('custom-text-font-family') || 'Sans';
                const customTextSize    = settings.get_int('custom-text-font-size') || 20;
                const customTextColor   = settings.get_string('custom-text-color') || '#ffffff';

                const enableBlur    = settings.get_boolean('enable-blur');
                const blurRadius    = settings.get_int('blur-radius') || 30;
                const enableBrightness = settings.get_boolean('enable-brightness');
                const blurBrightness = settings.get_double('blur-brightness');

                const overlayOpacity = enableBrightness ? Math.max(0.0, Math.min(1.0, 1.0 - blurBrightness)) : 0.0;

                // Wallpaper URI (read from GSettings, no disk I/O)
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

                // Load wallpaper only when URI changed (async + cached — never blocks)
                loadWallpaperPicture(wallpaperUri || null);

                // CSS — purely in-memory, no I/O
                const fallbackBg = wallpaperUri
                    ? ''
                    : 'background: linear-gradient(135deg, #4b1248, #9b2848, #d4682c);';

                // Scale fonts proportionally to preview width vs. real lockscreen width
                const scale = previewWidth / REFERENCE_WIDTH;
                const clockPx      = Math.max(9,  Math.round(clockSize      * scale));
                const datePx       = Math.max(7,  Math.round(dateSize       * scale));
                const customTextPx = Math.max(6,  Math.round(customTextSize * scale));
                const ampmPx       = Math.max(5,  Math.round(clockSize      * scale * 0.4));
                // Spacing also scales so the layout feels natural at any size
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
                        margin-top: ${marginTop}px;
                    }
                    .preview-clock-hr {
                        font-family: '${clockFont}';
                        font-size: ${clockPx}px;
                        color: ${clockColor};
                        font-weight: bold;
                        margin-top: ${marginTop}px;
                    }
                    .preview-clock-sep {
                        font-family: '${clockFont}';
                        font-size: ${clockPx}px;
                        color: ${clockSeparatorColor};
                        font-weight: bold;
                        margin-top: ${marginTop}px;
                        margin-left: 2px;
                        margin-right: 2px;
                    }
                    .preview-clock-min {
                        font-family: '${clockFont}';
                        font-size: ${clockPx}px;
                        color: ${clockMinutesColor};
                        font-weight: bold;
                        margin-top: ${marginTop}px;
                    }
                    .preview-clock-ampm {
                        font-family: '${clockFont}';
                        font-size: ${ampmPx}px;
                        color: ${clockColor};
                        margin-left: 4px;
                    }
                    .preview-clock-hr-stack {
                        font-family: '${clockFont}';
                        font-size: ${clockPx}px;
                        color: ${clockColor};
                        font-weight: bold;
                        margin-top: ${marginTop}px;
                        line-height: 1.0;
                    }
                    .preview-clock-min-stack {
                        font-family: '${clockFont}';
                        font-size: ${clockPx}px;
                        color: ${clockMinutesColor};
                        font-weight: bold;
                        line-height: 1.0;
                    }
                    .preview-date-label {
                        font-family: '${dateFont}';
                        font-size: ${datePx}px;
                        color: ${dateColor};
                        margin-top: ${marginSm}px;
                    }
                    .preview-custom-text-label {
                        font-family: '${customTextFont}';
                        font-size: ${customTextPx}px;
                        color: ${customTextColor};
                        margin-top: ${marginTop}px;
                        margin-bottom: ${marginSm}px;
                    }
                `);

                // Reset clockContainer
                while (clockContainer.get_first_child()) {
                    clockContainer.remove(clockContainer.get_first_child());
                }

                clockContainer.visible = clockVisible;

                if (clockVisible) {
                    if (clockStyle === 'default') {
                        const label = new Gtk.Label({
                            css_classes: ['preview-clock-label-default']
                        });
                        label.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                        clockContainer.append(label);
                    } else if (clockStyle === 'separated-colors') {
                        const hBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
                        const hrLabel = new Gtk.Label({ css_classes: ['preview-clock-hr'] });
                        const sepLabel = new Gtk.Label({ label: ':', css_classes: ['preview-clock-sep'] });
                        const minLabel = new Gtk.Label({ css_classes: ['preview-clock-min'] });
                        
                        hrLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                        sepLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                        minLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

                        hBox.append(hrLabel);
                        hBox.append(sepLabel);
                        hBox.append(minLabel);
                        clockContainer.append(hBox);
                    } else if (clockStyle === 'vertical-stack') {
                        const vBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, halign: Gtk.Align.CENTER });
                        const hrLabel = new Gtk.Label({ css_classes: ['preview-clock-hr-stack'] });
                        const minLabel = new Gtk.Label({ css_classes: ['preview-clock-min-stack'] });

                        hrLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                        minLabel.get_style_context().add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

                        vBox.append(hrLabel);
                        vBox.append(minLabel);
                        clockContainer.append(vBox);
                    } else if (clockStyle === 'analog') {
                        const dArea = new Gtk.DrawingArea({
                            halign: Gtk.Align.CENTER,
                            valign: Gtk.Align.CENTER
                        });
                        const diameter = Math.max(70, Math.round(analogClockSize * scale));
                        dArea.set_content_width(diameter);
                        dArea.set_content_height(diameter);

                        dArea.set_draw_func((area, cr, width, height) => {
                            const now = new Date();
                            const s = now.getSeconds();
                            const m = now.getMinutes();
                            const h = now.getHours();

                            const cx = width / 2;
                            const cy = height / 2;
                            const r = Math.min(width, height) / 2 - 4;

                            let bColor = new Gdk.RGBA(); bColor.parse(clockColor);
                            let mColor = new Gdk.RGBA(); mColor.parse(clockMinutesColor);
                            let sColor = new Gdk.RGBA(); sColor.parse(clockSecondHandColor);
                            let sepColor = new Gdk.RGBA(); sepColor.parse(clockSeparatorColor);

                            let faceBColor = bColor;
                            let borderWidth = 3;
                            let showNumbers = false;
                            let tickStyle = 'none';

                            if (analogClockSkin === 'accent') {
                                borderWidth = 3;
                                showNumbers = false;
                                tickStyle = 'bars';
                            } else if (analogClockSkin === 'minimalist') {
                                borderWidth = 1.5;
                                showNumbers = false;
                                tickStyle = 'dots';
                            } else if (analogClockSkin === 'classic') {
                                borderWidth = 3;
                                showNumbers = true;
                                tickStyle = 'none';
                            }

                            // Face background with skin-specific tint
                            if (analogClockSkin === 'accent') {
                                const aR = mColor.red;
                                const aG = mColor.green;
                                const aB = mColor.blue;
                                cr.setSourceRGBA(aR, aG, aB, 0.12);
                            } else {
                                cr.setSourceRGBA(1, 1, 1, 0.04);
                            }
                            cr.arc(cx, cy, r, 0, 2 * Math.PI);
                            cr.fill();

                            // Face border
                            cr.setLineWidth(borderWidth);
                            Gdk.cairo_set_source_rgba(cr, faceBColor);
                            cr.arc(cx, cy, r, 0, 2 * Math.PI);
                            cr.stroke();

                            // Ticks — only for Minimalist and Accent
                            if (tickStyle !== 'none') {
                                const tickColorRef = (analogClockSkin === 'accent') ? mColor : sepColor;

                                if (tickStyle === 'dots') {
                                Gdk.cairo_set_source_rgba(cr, bColor);
                                for (let i = 0; i < 12; i++) {
                                    const angle = (i * 30 - 90) * Math.PI / 180;
                                    const isMajor = (analogClockSkin === 'accent') ? true : (i % 3 === 0);
                                    const dotR = r * 0.84;
                                    const dotRadius = Math.max(1, r * (isMajor ? 0.035 : 0.02));
                                    const dx = cx + dotR * Math.cos(angle);
                                    const dy = cy + dotR * Math.sin(angle);
                                    cr.setSourceRGBA(bColor.red, bColor.green, bColor.blue, isMajor ? 1.0 : 0.5);
                                    cr.arc(dx, dy, dotRadius, 0, 2 * Math.PI);
                                    cr.fill();
                                }
                            } else {
                                Gdk.cairo_set_source_rgba(cr, tickColorRef);
                                for (let i = 0; i < 12; i++) {
                                    const angle = (i * 30 - 90) * Math.PI / 180;
                                    const isMajor = (analogClockSkin === 'accent') ? true : (i % 3 === 0);
                                    const innerR = r * 0.82;
                                    cr.setLineWidth(Math.max(1, r * (isMajor ? 0.04 : 0.025)));
                                    cr.setSourceRGBA(tickColorRef.red, tickColorRef.green, tickColorRef.blue, isMajor ? 1.0 : 0.6);
                                    const x1 = cx + innerR * Math.cos(angle);
                                    const y1 = cy + innerR * Math.sin(angle);
                                    const x2 = cx + r * Math.cos(angle);
                                    const y2 = cy + r * Math.sin(angle);
                                    cr.moveTo(x1, y1);
                                    cr.lineTo(x2, y2);
                                    cr.stroke();
                                }
                            }
                            }

                            // Number labels (1-12)
                            if (showNumbers) {
                                let numColor = new Gdk.RGBA(); numColor.parse(analogClockNumbersColor);
                                Gdk.cairo_set_source_rgba(cr, numColor);
                                const numRadius = r * 0.72;
                                const numFontSize = Math.round(r * 0.26);
                                const layout = PangoCairo.create_layout(cr);
                                const numDesc = Pango.font_description_from_string(`${clockFont} Bold ${numFontSize}`);
                                layout.set_font_description(numDesc);

                                for (let n = 1; n <= 12; n++) {
                                    const angle = (n * 30 - 90) * Math.PI / 180;
                                    layout.set_text(String(n), -1);
                                    const [textW, textH] = layout.get_pixel_size();
                                    const tx = cx + numRadius * Math.cos(angle) - textW / 2;
                                    const ty = cy + numRadius * Math.sin(angle) - textH / 2;
                                    cr.moveTo(tx, ty);
                                    PangoCairo.show_layout(cr, layout);
                                }
                            }

                            // Hour hand
                            cr.save();
                            cr.translate(cx, cy);
                            cr.rotate((h % 12 * 30 + m * 0.5) * Math.PI / 180);
                            Gdk.cairo_set_source_rgba(cr, bColor);
                            cr.setLineWidth(4);
                            cr.setLineCap(1);
                            cr.moveTo(0, 0);
                            cr.lineTo(0, -r * 0.44);
                            cr.stroke();
                            cr.restore();

                            // Minute hand
                            cr.save();
                            cr.translate(cx, cy);
                            cr.rotate((m * 6 + s * 0.1) * Math.PI / 180);
                            Gdk.cairo_set_source_rgba(cr, mColor);
                            cr.setLineWidth(3);
                            cr.setLineCap(1);
                            cr.moveTo(0, 0);
                            cr.lineTo(0, -r * 0.64);
                            cr.stroke();
                            cr.restore();

                            // Second hand
                            if (clockSecondHandEnabled) {
                                cr.save();
                                cr.translate(cx, cy);
                                cr.rotate((s * 6) * Math.PI / 180);
                                Gdk.cairo_set_source_rgba(cr, sColor);
                                cr.setLineWidth(1.5);
                                cr.moveTo(0, 10);
                                cr.lineTo(0, -r * 0.70);
                                cr.stroke();
                                cr.restore();
                            }

                            // Center pin
                            Gdk.cairo_set_source_rgba(cr, clockSecondHandEnabled ? sColor : mColor);
                            cr.arc(cx, cy, 4, 0, 2 * Math.PI);
                            cr.fill();
                        });

                        clockContainer.append(dArea);
                    }
                }

                dateLabel.visible = dateVisible;
                customTextLabel.visible = customTextEnabled;
                customTextLabel.label = customTextVal;
                wallpaper.blurRadius = (enableBlur && blurRadius > 0) ? blurRadius : 0.0;
            };

            // Debounced entry-point — all signals call this, never applyUpdate directly
            const updatePreview = () => {
                if (debounceTimerId) {
                    GLib.source_remove(debounceTimerId);
                    debounceTimerId = null;
                }
                debounceTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, DEBOUNCE_MS, () => {
                    debounceTimerId = null;
                    applyUpdate();
                    return GLib.SOURCE_REMOVE;
                });
            };

            // Connect settings changed signals
            const signals = [
                'clock-visible', 'clock-font-size', 'clock-font-family', 'clock-color',
                'date-visible', 'date-font-size', 'date-font-family', 'date-color',
                'custom-text-enabled', 'custom-text', 'custom-text-font-size', 'custom-text-font-family', 'custom-text-color',
                'enable-blur', 'blur-radius', 'enable-brightness', 'blur-brightness',
                'clock-style', 'clock-minutes-color', 'clock-separator-color', 'analog-clock-skin', 'clock-second-hand-enabled', 'clock-second-hand-color',
                'analog-clock-show-numbers', 'analog-clock-size', 'analog-clock-numbers-color'
            ];
            signals.forEach(sig => settings.connect(`changed::${sig}`, updatePreview));

            // System wallpaper changes
            if (bgSettings) {
                bgSettings.connect('changed::picture-uri', updatePreview);
                bgSettings.connect('changed::picture-uri-dark', updatePreview);
            }
            if (interfaceSettings)
                interfaceSettings.connect('changed::color-scheme', updatePreview);

            // Initial render (immediate — no debounce on first load)
            applyUpdate();

            const aspectFrame = new Gtk.AspectFrame({
                ratio: 16 / 9,
                obey_child: false,
                valign: Gtk.Align.START,
                halign: Gtk.Align.CENTER,
                margin_bottom: 12,
            });
            aspectFrame.set_child(overlay);

            const clamp = new Adw.Clamp({
                maximum_size: 480,
                tightening_threshold: 480,
            });
            clamp.set_child(aspectFrame);

            return clamp;
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

        // Switch to enable/disable brightness overlay
        const enableBrightnessRow = new Adw.SwitchRow({
            title: 'Enable Background Brightness',
            subtitle: 'Apply a brightness overlay to the lockscreen background',
        });
        settings.bind('enable-brightness', enableBrightnessRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        blurGroup.add(enableBrightnessRow);

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
        enableBrightnessRow.bind_property('active', blurBrightnessRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
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
            factory: createFontFactory(),
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

        // Clock Style Selection Row
        const clockStylesList = Gtk.StringList.new([
            'Default Digital',
            'Separated Colors (Horizontal)',
            'Vertical Stack',
            'Analog Clock'
        ]);
        const clockStyleRow = new Adw.ComboRow({
            title: 'Clock Style',
            model: clockStylesList,
        });
        const styleKeys = ['default', 'separated-colors', 'vertical-stack', 'analog'];
        const currentStyle = settings.get_string('clock-style') || 'default';
        const styleIdx = styleKeys.indexOf(currentStyle);
        if (styleIdx !== -1) {
            clockStyleRow.selected = styleIdx;
        }
        clockStyleRow.connect('notify::selected', () => {
            const selectedStyle = styleKeys[clockStyleRow.selected];
            if (selectedStyle && settings.get_string('clock-style') !== selectedStyle) {
                settings.set_string('clock-style', selectedStyle);
            }
        });
        settings.connect('changed::clock-style', () => {
            const current = settings.get_string('clock-style');
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
        settings.bind('clock-color', clockColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        clockVisibleRow.bind_property('active', clockColorRow, 'sensitive', GObject.BindingFlags.DEFAULT | GObject.BindingFlags.SYNC_CREATE);
        setupColorPicker(clockColorRow, 'clock-color');
        clockGroup.add(clockColorRow);

        // Clock Minutes Color
        const clockMinutesColorRow = new Adw.EntryRow({
            title: 'Minutes / Hand Color — Hex (e.g. #ffffff)',
        });
        settings.bind('clock-minutes-color', clockMinutesColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        setupColorPicker(clockMinutesColorRow, 'clock-minutes-color');
        clockGroup.add(clockMinutesColorRow);

        // Clock Separator Color
        const clockSeparatorColorRow = new Adw.EntryRow({
            title: 'Separator / Ticks Color — Hex (e.g. #ffffff)',
        });
        settings.bind('clock-separator-color', clockSeparatorColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        setupColorPicker(clockSeparatorColorRow, 'clock-separator-color');
        clockGroup.add(clockSeparatorColorRow);

        // Analog Clock Skin Selection
        const skinsList = Gtk.StringList.new([
            'Minimalist',
            'Classic',
            'Accent'
        ]);
        const analogClockSkinRow = new Adw.ComboRow({
            title: 'Analog Clock Skin',
            model: skinsList,
        });
        const skinKeys = ['minimalist', 'classic', 'accent'];
        const currentSkin = settings.get_string('analog-clock-skin') || 'minimalist';
        const skinIdx = skinKeys.indexOf(currentSkin);
        if (skinIdx !== -1) {
            analogClockSkinRow.selected = skinIdx;
        }
        analogClockSkinRow.connect('notify::selected', () => {
            const selectedSkin = skinKeys[analogClockSkinRow.selected];
            if (selectedSkin && settings.get_string('analog-clock-skin') !== selectedSkin) {
                settings.set_string('analog-clock-skin', selectedSkin);
            }
        });
        settings.connect('changed::analog-clock-skin', () => {
            const current = settings.get_string('analog-clock-skin');
            const idx = skinKeys.indexOf(current);
            if (idx !== -1 && analogClockSkinRow.selected !== idx) {
                analogClockSkinRow.selected = idx;
            }
        });
        clockGroup.add(analogClockSkinRow);

        // Numbers Color
        const analogClockNumbersColorRow = new Adw.EntryRow({
            title: 'Numbers Color — Hex (e.g. #ffffff)',
        });
        settings.bind('analog-clock-numbers-color', analogClockNumbersColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        setupColorPicker(analogClockNumbersColorRow, 'analog-clock-numbers-color');
        clockGroup.add(analogClockNumbersColorRow);

        // Show Second Hand Switch
        const clockSecondHandRow = new Adw.SwitchRow({
            title: 'Show Second Hand',
        });
        settings.bind('clock-second-hand-enabled', clockSecondHandRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(clockSecondHandRow);

        // Second Hand Color
        const clockSecondHandColorRow = new Adw.EntryRow({
            title: 'Second Hand Color — Hex (e.g. #ff4444)',
        });
        settings.bind('clock-second-hand-color', clockSecondHandColorRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        setupColorPicker(clockSecondHandColorRow, 'clock-second-hand-color');
        clockGroup.add(clockSecondHandColorRow);

        // Show Numbers Switch
        const analogClockShowNumbersRow = new Adw.SwitchRow({
            title: 'Show Hour Numbers',
            subtitle: 'Display numbers 1-12 on the analog clock face',
        });
        settings.bind('analog-clock-show-numbers', analogClockShowNumbersRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(analogClockShowNumbersRow);

        // Analog Clock Size
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
        settings.bind('analog-clock-size', analogClockSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        clockGroup.add(analogClockSizeRow);

        // Reset colors button
        const resetColorsButton = new Gtk.Button({
            label: 'Reset Colors to Defaults',
            halign: Gtk.Align.CENTER,
            margin_top: 8,
            css_classes: ['destructive-action'],
        });
        resetColorsButton.connect('clicked', () => {
            const defaults = {
                'clock-color': '#ffffff',
                'clock-minutes-color': '#bbbbbb',
                'clock-separator-color': '#777777',
                'clock-second-hand-color': '#ff5252',
                'analog-clock-numbers-color': '#ffffff',
            };
            for (const [key, value] of Object.entries(defaults)) {
                if (settings.get_string(key) !== value) {
                    settings.set_string(key, value);
                }
            }
        });
        clockGroup.add(resetColorsButton);

        // Helper function to update visibility/sensitivity of rows based on selected style
        const updateVisibility = () => {
            const active = clockVisibleRow.active;
            const style = settings.get_string('clock-style') || 'default';
            const isDigital = (style === 'default' || style === 'separated-colors' || style === 'vertical-stack');
            const isSeparated = (style === 'separated-colors');
            const isVertical = (style === 'vertical-stack');
            const isAnalog = (style === 'analog');

            clockFontSizeRow.sensitive = active;
            clockFontFamilyRow.sensitive = active && isDigital;
            clockColorRow.sensitive = active;
            clockColorRow.title = isAnalog ? 'Hour Hand / Primary Color' : 'Clock Text / Hour Color';

            clockMinutesColorRow.visible = isSeparated || isVertical || isAnalog;
            clockMinutesColorRow.sensitive = active;
            
            clockSeparatorColorRow.visible = isSeparated || isAnalog;
            clockSeparatorColorRow.sensitive = active;

            analogClockSkinRow.visible = isAnalog;
            analogClockSkinRow.sensitive = active;

            analogClockNumbersColorRow.visible = isAnalog;
            analogClockNumbersColorRow.sensitive = active;

            clockSecondHandRow.visible = isAnalog;
            clockSecondHandRow.sensitive = active;

            clockSecondHandColorRow.visible = isAnalog && settings.get_boolean('clock-second-hand-enabled');
            clockSecondHandColorRow.sensitive = active;

            analogClockShowNumbersRow.visible = isAnalog;
            analogClockShowNumbersRow.sensitive = active;

            analogClockSizeRow.visible = isAnalog;
            analogClockSizeRow.sensitive = active;
        };

        // Connect signals to update visibility
        clockVisibleRow.connect('notify::active', updateVisibility);
        settings.connect('changed::clock-style', updateVisibility);
        settings.connect('changed::clock-second-hand-enabled', updateVisibility);
        
        // Run initial update
        updateVisibility();

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
            factory: createFontFactory(),
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
            factory: createFontFactory(),
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
