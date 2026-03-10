#!/bin/zsh

if [[ $1 == "-c" ]]; then
    ditto "src-tauri/target/release/bundle/macos/wyd2.app" "/Applications/wyd2.app"
else
    bun run tauri build
    ditto "src-tauri/target/release/bundle/macos/wyd2.app" "/Applications/wyd2.app"
fi