#!/usr/bin/env bash
NODE="/Users/sungjin/.local/share/mise/installs/node/lts/bin/node"
VITE="/Users/sungjin/dev/personal/dungeon md/dungeon-phaser/node_modules/.bin/vite"
cd "/Users/sungjin/dev/personal/dungeon md/dungeon-phaser"
exec "$NODE" "$VITE" --port 8083
