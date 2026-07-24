---
created: 2023-09-18
updated: 2026-07-24
---
# MacOS setting preferences

#Mac

## 01. System Preferences

- **Function keys:** Keyboard → Keyboard Shortcuts → Function Keys.
- **Keyboard controls:** Keyboard → Keyboard Shortcuts → use keyboard navigation to move focus between controls.
- **Tap to click:** Trackpad → Point & Click → Tap to click.
- **Three-finger drag:** Accessibility → Pointer Control → Trackpad Options → Enable dragging.
- **Hot corners:** Desktop & Dock → Hot Corners.

Drag a window from anywhere, not just the title bar:

```shell
defaults write -g NSWindowShouldDragOnGesture -bool true
```

Make the automatically hidden Dock respond faster:

```shell
defaults write com.apple.dock autohide-time-modifier -float 0.5
defaults write com.apple.dock autohide-delay -int 0
killall Dock
```

Restore the Dock defaults:

```shell
defaults delete com.apple.dock autohide-time-modifier
defaults delete com.apple.dock autohide-delay
killall Dock
```

## 02. Finder

- Show all filename extensions.
- Search the current folder by default.
- Show the status bar, path bar and tab bar.

## 03. Homebrew

```shell
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

This sample deliberately uses fenced Markdown code blocks. The Apple Notes shortcut must export a Note’s Monospaced blocks this way if it should render consistently on GitHub Pages.
