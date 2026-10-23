// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - Constants and Schema Keys
 */

export const SCHEMA_ID = 'org.gnome.shell.extensions.lockscreen-studio';

export const SETTINGS_KEYS = {
    // Blur & Brightness
    ENABLE_BLUR: 'enable-blur',
    BLUR_RADIUS: 'blur-radius',
    ENABLE_BRIGHTNESS: 'enable-brightness',
    BLUR_BRIGHTNESS: 'blur-brightness',

    // Clock & Date
    CLOCK_VISIBLE: 'clock-visible',
    CLOCK_STYLE: 'clock-style',
    CLOCK_FONT_SIZE: 'clock-font-size',
    CLOCK_FONT_FAMILY: 'clock-font-family',
    CLOCK_COLOR: 'clock-color',
    CLOCK_MINUTES_COLOR: 'clock-minutes-color',
    CLOCK_SEPARATOR_COLOR: 'clock-separator-color',

    // Analog Clock
    ANALOG_CLOCK_SKIN: 'analog-clock-skin',
    ANALOG_CLOCK_SIZE: 'analog-clock-size',
    ANALOG_CLOCK_SHOW_NUMBERS: 'analog-clock-show-numbers',
    ANALOG_CLOCK_NUMBERS_COLOR: 'analog-clock-numbers-color',
    CLOCK_SECOND_HAND_ENABLED: 'clock-second-hand-enabled',
    CLOCK_SECOND_HAND_COLOR: 'clock-second-hand-color',

    // Date
    DATE_VISIBLE: 'date-visible',
    DATE_FONT_SIZE: 'date-font-size',
    DATE_FONT_FAMILY: 'date-font-family',
    DATE_COLOR: 'date-color',

    // Custom Message
    CUSTOM_TEXT_ENABLED: 'custom-text-enabled',
    CUSTOM_TEXT: 'custom-text',
    CUSTOM_TEXT_FONT_SIZE: 'custom-text-font-size',
    CUSTOM_TEXT_FONT_FAMILY: 'custom-text-font-family',
    CUSTOM_TEXT_COLOR: 'custom-text-color',

    // User Avatar & Auth Prompt (Issue #2)
    AUTH_CUSTOM_STYLE_ENABLED: 'auth-custom-style-enabled',
    AUTH_AVATAR_SIZE: 'auth-avatar-size',
    AUTH_USERNAME_FONT_SIZE: 'auth-username-font-size',
    AUTH_USERNAME_FONT_FAMILY: 'auth-username-font-family',
    AUTH_USERNAME_COLOR: 'auth-username-color',
    AUTH_ENTRY_FONT_SIZE: 'auth-entry-font-size',
    AUTH_ENTRY_COLOR: 'auth-entry-color',
    AUTH_MESSAGE_FONT_SIZE: 'auth-message-font-size',
    AUTH_MESSAGE_COLOR: 'auth-message-color',

    // Lockscreen Top Bar / Panel Scaling (Issue #2)
    PANEL_CUSTOM_STYLE_ENABLED: 'panel-custom-style-enabled',
    PANEL_HEIGHT: 'panel-height',
    PANEL_FONT_SIZE: 'panel-font-size',
};

export const CLOCK_STYLES = {
    DEFAULT: 'default',
    SEPARATED_COLORS: 'separated-colors',
    VERTICAL_STACK: 'vertical-stack',
    ANALOG: 'analog',
};

export const ANALOG_SKINS = {
    MINIMALIST: 'minimalist',
    CLASSIC: 'classic',
    ACCENT: 'accent',
};
