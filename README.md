# Bluetooth Biplanes (web port)

A port of the J2ME phone game **Bluetooth Biplanes** (Morpheme Ltd., 2004) to JavaScript. It runs in the browser.

Play it: **https://biplanes.chope.dev**

The game logic is a line-by-line translation of the original Java bytecode. The physics, the computer pilots, the menus, the taunts, the scores, the records and the two-player packets work as in the original. It is not an emulator: there is no Java VM.

## Controls

| Desktop | Phone | Action |
| --- | --- | --- |
| W A S D / arrow keys | joystick (left side) | fly, move in menus |
| Space | FIRE | fire, select in menus |
| E | EJECT | eject; press again to open the parachute |
| Enter | the left menu button, or tap the "Select" / "Next" / "Help" label | left soft key |
| Esc | ❚❚, the "Back" menu button, or tap the "Back" / "Close" label | right soft key (Back, pause, Close) |
| F | | full screen |

On a phone the game uses the whole screen and the controls show over it. The joystick is always there. While you fly, FIRE, EJECT and ❚❚ show on the right. In menus, two small buttons show there instead. They have the same labels as the game's soft keys (Select, Back, Next, Close, ...) and do the same thing.

In menus you can tap or click an item to choose it. On desktop the mouse also highlights the item under it. A tap on a message, a help page, a result page or the score board goes on.

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
- `web/js/render.js` is a display layer. It changes how the game looks, not how it plays:
  - **Screen shape:** the game's screen size follows the window. In landscape it is 128 px tall and up to 255 px wide, which is the whole arena. In portrait it is 128 px wide and up to 208 px tall. The game already reads its screen size from the phone, so the logic does not change.
  - **Sharp pixels:** the game draws at full device resolution, in whole steps, so the pixel art stays sharp.
  - **Smooth motion:** the game still runs at 20 ticks per second. Each tick is kept as a list of draw commands, and the screen draws it again at 60 fps. The camera and the moving sprites slide smoothly between ticks.
  - **Parallax:** the original sky and ground strips are split by colour into far clouds, trees and ground. These scroll at different speeds over a sky gradient.
  - **Side bars:** a blurred copy of the picture fills the space beside the screen.
  - `?w=128&h=128` in the address gives the original square screen.

### Changes for the web

- The main menu has no "Quit" item.
- The 128×128 title and advert pictures are centered over a blurred copy of themselves.
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
