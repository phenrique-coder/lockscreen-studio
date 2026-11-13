// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const controllers = new WeakMap();

// Allocation coordinates exclude the scale and translation used by UnlockDialog.
export function contentBounds(actor, roots, container) {
    let top = Infinity;
    let bottom = -Infinity;
    for (const root of roots) {
        if (!root?.visible || !root.has_allocation())
            continue;
        let current = root;
        let y = 0;
        let valid = true;
        while (current && current !== container) {
            if (!current.has_allocation()) {
                valid = false;
                break;
            }
            y += current.get_y();
            current = current.get_parent();
        }
        if (valid && current === container && actor.contains(root)) {
            const height = root.get_height();
            if (Number.isFinite(y) && Number.isFinite(height) && height > 0) {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y + height);
            }
        }
    }
    return top === Infinity ? null : {top, bottom};
}

export function centerAllocation(actor, roots, container, height, offset) {
    if (!actor?.visible || !actor.has_allocation())
        return;
    const bounds = contentBounds(actor, roots, container);
    if (!bounds)
        return;
    const shift = height / 2 + offset - (bounds.top + bounds.bottom) / 2;
    if (Number.isFinite(shift) && Math.abs(shift) > 0.01) {
        const box = actor.get_allocation_box();
        box.y1 += shift;
        box.y2 += shift;
        actor.allocate(box);
    }
}

const CenteredLayout = GObject.registerClass(
class LockscreenStudioCenteredLayout extends Clutter.LayoutManager {
    _init(original, dialog) {
        super._init();
        this.original = original;
        this.dialog = dialog;
        this.clockOffset = 0;
        this.authOffset = 0;
    }

    vfunc_get_preferred_width(container, height) {
        return this.original.get_preferred_width(container, height);
    }

    vfunc_get_preferred_height(container, width) {
        return this.original.get_preferred_height(container, width);
    }

    vfunc_allocate(container, box) {
        // GNOME retains ownership of notification, button and stack layout.
        this.original.allocate(container, box);
        const dialog = this.dialog;
        const [, height] = box.get_size();
        centerAllocation(dialog._clock, [
            dialog._clock?._time,
            dialog._customClockContainer,
            dialog._clock?._date,
            dialog._customTextLabel,
        ], container, height, this.clockOffset);
        // Resolve the prompt each allocation: GNOME recreates it on demand.
        centerAllocation(dialog._promptBox, [dialog._authPrompt],
            container, height, this.authOffset);
    }
});

export function updateVerticalPosition(dialog, clockOffset, authOffset) {
    const container = dialog?._stack?.get_parent();
    if (!container?.layout_manager)
        return;
    let state = controllers.get(dialog);
    if (!state) {
        const original = container.layout_manager;
        const layout = new CenteredLayout(original, dialog);
        const destroyId = container.connect('destroy', () => {
            layout.dialog = null;
            controllers.delete(dialog);
        });
        state = {container, original, layout, destroyId};
        controllers.set(dialog, state);
        container.layout_manager = layout;
    }
    state.layout.clockOffset = clockOffset;
    state.layout.authOffset = authOffset;
    state.container.queue_relayout();
}

export function resetVerticalPosition(dialog) {
    const state = dialog ? controllers.get(dialog) : null;
    if (state) {
        state.container.disconnect(state.destroyId);
        state.container.layout_manager = state.original;
        state.layout.dialog = null;
        dialog._clock?.queue_relayout();
        dialog._promptBox?.queue_relayout();
        dialog._stack?.queue_relayout();
        state.container.queue_relayout();
        controllers.delete(dialog);
    }
}
