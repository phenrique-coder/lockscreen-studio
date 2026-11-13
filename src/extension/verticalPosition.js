// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Keep only one pending positioning operation per actor.
const pendingUpdates = new WeakMap();

/**
 * Center an actor vertically after its layout becomes stable.
 *
 * offset = 0: vertically centered
 * offset < 0: move upward
 * offset > 0: move downward
 */
export function setCenteredVerticalPosition(actor, offset) {
    if (!actor)
        return;

    // Cancel any previous pending calculation for this actor.
    const previousSource = pendingUpdates.get(actor);

    if (previousSource)
        GLib.source_remove(previousSource);

    pendingUpdates.delete(actor);

    let previousGeometry = null;
    let stableChecks = 0;
    let attempts = 0;

    const sourceId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        80,
        () => {
            attempts++;

            if (!actor.get_stage()) {
                pendingUpdates.delete(actor);
                return GLib.SOURCE_REMOVE;
            }

            const monitor = Main.layoutManager.primaryMonitor;

            if (!monitor) {
                pendingUpdates.delete(actor);
                return GLib.SOURCE_REMOVE;
            }

            const [, transformedY] = actor.get_transformed_position();
            const [, height] = actor.get_transformed_size();

            if (height <= 0) {
                if (attempts < 40)
                    return GLib.SOURCE_CONTINUE;

                pendingUpdates.delete(actor);
                return GLib.SOURCE_REMOVE;
            }

            // Recover the position before our own translation.
            const originalY = transformedY - actor.translation_y;

            const geometry = {
                y: originalY,
                height,
            };

            if (
                previousGeometry &&
                Math.abs(geometry.y - previousGeometry.y) < 0.5 &&
                Math.abs(geometry.height - previousGeometry.height) < 0.5
            ) {
                stableChecks++;
            } else {
                stableChecks = 0;
            }

            previousGeometry = geometry;

            // Require several consecutive stable measurements.
            if (stableChecks < 4 && attempts < 40)
                return GLib.SOURCE_CONTINUE;

            const monitorCenterY = monitor.y + monitor.height / 2;
            const actorCenterY = originalY + height / 2;

            actor.translation_y =
                monitorCenterY - actorCenterY + offset;

            pendingUpdates.delete(actor);

            return GLib.SOURCE_REMOVE;
        }
    );

    pendingUpdates.set(actor, sourceId);
}

/**
 * Cancel pending positioning and restore the original translation.
 */
export function resetCenteredVerticalPosition(actor) {
    if (!actor)
        return;

    const sourceId = pendingUpdates.get(actor);

    if (sourceId)
        GLib.source_remove(sourceId);

    pendingUpdates.delete(actor);
    actor.translation_y = 0;
}