#!/bin/sh
# Libera o acesso ao POD HD500 sem root (regra udev) ao instalar o .deb
RULE=/etc/udev/rules.d/99-line6-hd500.rules
cat > "$RULE" <<'RULES'
SUBSYSTEM=="usb", ATTR{idVendor}=="0e41", ATTR{idProduct}=="414d", MODE="0666", TAG+="uaccess"
RULES
udevadm control --reload 2>/dev/null || true
udevadm trigger --subsystem-match=usb --attr-match=idVendor=0e41 2>/dev/null || true
