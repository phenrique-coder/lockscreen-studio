// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Lockscreen Studio - BlurredBox Widget
 * Custom GTK4 Box that applies snapshot blur rendering to its contents.
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

export const BlurredBox = GObject.registerClass({
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
