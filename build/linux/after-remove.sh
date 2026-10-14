#!/bin/sh
# Remove a regra udev ao desinstalar (não ao atualizar) o .deb
case "$1" in remove|purge) rm -f /etc/udev/rules.d/99-line6-hd500.rules; udevadm control --reload 2>/dev/null || true ;; esac
