# ZMK Configurator

A visual keymap editor for [ZMK](https://zmk.dev) keyboards, modeled on the ZSA Oryx configurator.

**Live:** https://nolanking90.github.io/zmk-configurator/

- 110 in-tree ZMK keyboards (Corne, Sofle, Lily58, Kyria, Glove80, Sweep, Advantage 360, …) with real physical layouts
- Per-key tap / hold / double-tap / tap-and-hold (mod-tap, layer-tap, custom hold-tap, tap dance)
- Layers (32), layer colors, key colors and labels, drag to swap/copy, copy/paste, undo/redo
- Combos, macros (text, keys, delays, recorder), one-shot keys, Bluetooth/output/RGB/mouse/system behaviors
- OS keyboard language (de, fr, uk, …) for legends and text macros
- Global settings → hold-tap tuning and Kconfig (.conf)
- Revisions with diff and restore, share links, print view, typing trainer
- Import existing `.keymap` files; export a complete zmk-config repo, or push to GitHub and build firmware from the browser

## Privacy

There is no backend and no login. Layouts, revisions and settings live in each visitor's own browser
(IndexedDB/localStorage), so users never see each other's data. The only network calls go to
`api.github.com`, and only when a user supplies their own token to build firmware in their own repo
or create a gist. Share links carry the layout inside the URL.

## Development

```sh
npm install
npm run dev
npx vitest run
```

Data generators (take a local clone of zmkfirmware/zmk at the pinned revision):

```sh
node scripts/gen-keyboards.mjs ../zmk
node scripts/gen-default-keymaps.mjs ../zmk
```
