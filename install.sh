#!/bin/bash

# Target installation directory
UUID="lockscreen-studio@pedro.projects"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Lockscreen Studio extension ($UUID)..."

# Create directories
mkdir -p "$DEST_DIR/schemas"

# Copy files
cp metadata.json "$DEST_DIR/"
cp extension.js "$DEST_DIR/"
cp prefs.js "$DEST_DIR/"
cp schemas/org.gnome.shell.extensions.lockscreen-studio.gschema.xml "$DEST_DIR/schemas/"
cp schemas/gschemas.compiled "$DEST_DIR/schemas/" 2>/dev/null || true

# Compile GSettings schemas in the target directory
glib-compile-schemas "$DEST_DIR/schemas/"

echo "------------------------------------------------------------"
echo "Installation complete!"
echo "To enable Lockscreen Studio, you can:"
echo "1. Run: gnome-extensions enable $UUID"
echo "2. Or open the 'Extension Manager' / 'Extensions' app and enable it."
echo ""
echo "Note: If you are on Wayland (default in modern GNOME), you will"
echo "need to log out and log back in for GNOME to see the new extension."
echo "If you are on X11, you can restart GNOME Shell with Alt+F2, type 'r', and press Enter."
echo "------------------------------------------------------------"
