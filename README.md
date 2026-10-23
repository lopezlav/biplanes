# Bluetooth Biplanes (web port)

A port of the J2ME phone game **Bluetooth Biplanes** (Morpheme Ltd., 2004) to JavaScript. It runs in the browser.

Play it: **https://biplanes.chope.dev**

The game logic is a line-by-line translation of the original Java bytecode. The physics, the computer pilots, the menus, the taunts, the scores, the records and the two-player packets work as in the original. It is not an emulator: there is no Java VM.

## Controls

| Desktop | Phone | Action |
| --- | --- | --- |
| W A S D / arrow keys | joystick (left half of the screen) | fly, move in menus |
| Space | FIRE | fire, select in menus |
| E | EJECT | eject; press again to open the parachute |
| Enter | OK | left soft key (Select, Next, Help) |
| Esc | ☰ | right soft key (Back, pause, Close) |
| F | ⛶ | full screen |

## Two players

The original game uses Bluetooth. Browsers have no Bluetooth serial link, so this port connects two tabs of the same browser:

1. In one tab, choose *Two Player Game → Start Bluetooth Game*.
2. In the other tab, choose *Join Bluetooth Game*.

The message format and the timing are the same as in the original.

## How it is built

- `web/res/` holds the original resource files from the JAR: `r` (packed images, menu data and music), `f`/`fzr`/`fzb` (bitmap fonts) and `tg`/`tt`/`tm` (text).
  - The game rebuilds its PNG images from `r` at start, the same way the original does.
- `web/res/music.wav` is the game's own MIDI file, rendered to audio with the GeneralUser GS soundfont. Browsers cannot play MIDI. The game plays clips of it at the original times.
- `web/js/` is the port, one file per original class:
  - `game.js` = `b` (game, screens, input, packets)
  - `entities.js` = `e` (plane and pilot), `f` (bullet), `d` (debris)
  - `font.js` = `c` (bitmap font), `menu.js` = `g` (menus), `sound.js` = `h`, `input.js` = `i`, `link.js` = `j` (the two-player link)
  - Field names are the original ones; methods have readable names, with the original signature in a comment above each one.
- `web/js/midp.js` is a small copy of the phone APIs the game uses: Graphics, Image, data streams, `java.util.Random` and RecordStore (here it saves to `localStorage`).
- The screen is 128×128, the size the game was made for, scaled up to fill the window.

### Changes for the web

- The main menu has no "Quit" item.
- Keyboard, joystick and touch buttons replace the phone keypad.
- The two-player link goes between browser tabs (see above).

## Run it locally

Any static file server works:

```sh
python3 -m http.server 8642 --directory web
```

Then open http://localhost:8642. `tools/devserver.py` is the same server, with an extra endpoint that saves canvas screenshots for testing.

## Deploy

```sh
npx wrangler deploy
```

This uploads `web/` as a static Cloudflare Worker. The domain is set in `wrangler.jsonc`.

## Tools

`tools/extract.py <jar dir> <out dir>` unpacks the images, fonts, strings and MIDI from an extracted JAR, to look at them.

## Credits

Bluetooth Biplanes © Morpheme Ltd. 2004. The game, its art, its text and its music belong to their owners. This port is a fan project, made to keep the game playable.

The joystick is [nipplejs](https://github.com/yoannmoinet/nipplejs) (MIT License).
