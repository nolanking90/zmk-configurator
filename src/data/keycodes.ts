// ZMK keycode catalog.
//
// Source of truth: zmkfirmware/zmk @ v0.3, app/include/dt-bindings/zmk/keys.h.
// Every #define in that header appears here, either as an entry's `code` or in
// its `aliases`; entries are grouped by the HID usage they resolve to (so
// RET / ENTER / RETURN are one entry).
//
// Canonical names: for each key, `code` is the shortest non-deprecated name
// in keys.h (ties go to the name defined first), with these overrides:
//   LSHIFT / RSHIFT instead of LSHFT / RSHFT (these match the Mod names in
//   model/types.ts), ASTRK instead of STAR, KP_SLASH / KP_MULTIPLY / KP_NUM,
//   K_APP, PG_UP / PG_DN, C_BRI_UP / C_BRI_DN, C_RED / C_GREEN / ..., GLOBE.
// Examples: N1, EXCL, AT, HASH, LPAR, LBKT, LBRC, SQT, DQT, FSLH, BSLH, RET,
// BSPC, SPACE, ESC, DEL, INS, CAPS, PSCRN, LCTRL, LALT, LGUI, C_VOL_UP, C_PP.
//
// Aliases marked "WARNING: DEPRECATED (DO NOT USE)" in keys.h (LSFT, LCTL,
// BKSP, M_VOLU, ...) are still listed as aliases, so findKeycode() and
// canonicalCode() accept them, but they are never chosen as `code`.
//
// The body of KEYCODES is generated from keys.h; edit with care.

import type { Mod } from '../model/types'
import { LOCALE_TABLES, DEAD_KEYS } from './locales'

export type KeyCategory =
  | 'letters' | 'numbers' | 'symbols' | 'function' | 'navigation' | 'editing' | 'modifiers'
  | 'keypad' | 'media' | 'app' | 'international' | 'system' | 'other'

export interface KeycodeDef {
  /** canonical ZMK name, used when emitting the keymap */
  code: string
  /** every other name keys.h defines for the same value (deprecated ones included) */
  aliases: string[]
  /** short keycap legend (US layout) */
  label: string
  /** legend of the shifted symbol on a US layout, e.g. "!" for N1 */
  shiftLabel?: string
  /** human-readable description, used for search */
  name: string
  category: KeyCategory
  /** for implicitly shifted keycodes (EXCL = LS(N1)): the unshifted key */
  base?: string
}

export const KEY_CATEGORIES: { id: KeyCategory; name: string }[] = [
  { id: 'letters', name: 'Letters' },
  { id: 'numbers', name: 'Numbers' },
  { id: 'symbols', name: 'Symbols' },
  { id: 'function', name: 'Function keys' },
  { id: 'navigation', name: 'Navigation' },
  { id: 'editing', name: 'Editing' },
  { id: 'modifiers', name: 'Modifiers' },
  { id: 'keypad', name: 'Keypad' },
  { id: 'media', name: 'Media' },
  { id: 'app', name: 'Applications' },
  { id: 'international', name: 'International' },
  { id: 'system', name: 'System' },
  { id: 'other', name: 'Other' },
]

function k(
  code: string,
  aliases: string[],
  label: string,
  name: string,
  category: KeyCategory,
  shiftLabel?: string,
  base?: string,
): KeycodeDef {
  const def: KeycodeDef = { code, aliases, label, name, category }
  if (shiftLabel !== undefined) def.shiftLabel = shiftLabel
  if (base !== undefined) def.base = base
  return def
}

export const KEYCODES: KeycodeDef[] = [
  // ---- letters
  k('A', [], 'A', 'Letter A', 'letters'),
  k('B', [], 'B', 'Letter B', 'letters'),
  k('C', [], 'C', 'Letter C', 'letters'),
  k('D', [], 'D', 'Letter D', 'letters'),
  k('E', [], 'E', 'Letter E', 'letters'),
  k('F', [], 'F', 'Letter F', 'letters'),
  k('G', [], 'G', 'Letter G', 'letters'),
  k('H', [], 'H', 'Letter H', 'letters'),
  k('I', [], 'I', 'Letter I', 'letters'),
  k('J', [], 'J', 'Letter J', 'letters'),
  k('K', [], 'K', 'Letter K', 'letters'),
  k('L', [], 'L', 'Letter L', 'letters'),
  k('M', [], 'M', 'Letter M', 'letters'),
  k('N', [], 'N', 'Letter N', 'letters'),
  k('O', [], 'O', 'Letter O', 'letters'),
  k('P', [], 'P', 'Letter P', 'letters'),
  k('Q', [], 'Q', 'Letter Q', 'letters'),
  k('R', [], 'R', 'Letter R', 'letters'),
  k('S', [], 'S', 'Letter S', 'letters'),
  k('T', [], 'T', 'Letter T', 'letters'),
  k('U', [], 'U', 'Letter U', 'letters'),
  k('V', [], 'V', 'Letter V', 'letters'),
  k('W', [], 'W', 'Letter W', 'letters'),
  k('X', [], 'X', 'Letter X', 'letters'),
  k('Y', [], 'Y', 'Letter Y', 'letters'),
  k('Z', [], 'Z', 'Letter Z', 'letters'),
  // ---- numbers
  k('N1', ['NUMBER_1', 'NUM_1'], '1', 'Number 1', 'numbers', '!'),
  k('N2', ['NUMBER_2', 'NUM_2'], '2', 'Number 2', 'numbers', '@'),
  k('N3', ['NUMBER_3', 'NUM_3'], '3', 'Number 3', 'numbers', '#'),
  k('N4', ['NUMBER_4', 'NUM_4'], '4', 'Number 4', 'numbers', '$'),
  k('N5', ['NUMBER_5', 'NUM_5'], '5', 'Number 5', 'numbers', '%'),
  k('N6', ['NUMBER_6', 'NUM_6'], '6', 'Number 6', 'numbers', '^'),
  k('N7', ['NUMBER_7', 'NUM_7'], '7', 'Number 7', 'numbers', '&'),
  k('N8', ['NUMBER_8', 'NUM_8'], '8', 'Number 8', 'numbers', '*'),
  k('N9', ['NUMBER_9', 'NUM_9'], '9', 'Number 9', 'numbers', '('),
  k('N0', ['NUMBER_0', 'NUM_0'], '0', 'Number 0', 'numbers', ')'),
  // ---- symbols
  k('EXCL', ['EXCLAMATION', 'BANG'], '!', 'Exclamation mark', 'symbols', undefined, 'N1'),
  k('AT', ['AT_SIGN', 'ATSN'], '@', 'At sign', 'symbols', undefined, 'N2'),
  k('HASH', ['POUND'], '#', 'Hash / pound / number sign', 'symbols', undefined, 'N3'),
  k('DLLR', ['DOLLAR'], '$', 'Dollar sign', 'symbols', undefined, 'N4'),
  k('PRCNT', ['PERCENT', 'PRCT'], '%', 'Percent sign', 'symbols', undefined, 'N5'),
  k('CARET', ['CRRT'], '^', 'Caret / circumflex', 'symbols', undefined, 'N6'),
  k('AMPS', ['AMPERSAND'], '&', 'Ampersand', 'symbols', undefined, 'N7'),
  k('ASTRK', ['ASTERISK', 'STAR'], '*', 'Asterisk / star', 'symbols', undefined, 'N8'),
  k('LPAR', ['LEFT_PARENTHESIS', 'LPRN'], '(', 'Left parenthesis', 'symbols', undefined, 'N9'),
  k('RPAR', ['RIGHT_PARENTHESIS', 'RPRN'], ')', 'Right parenthesis', 'symbols', undefined, 'N0'),
  k('MINUS', [], '-', 'Minus / hyphen', 'symbols', '_'),
  k('UNDER', ['UNDERSCORE'], '_', 'Underscore', 'symbols', undefined, 'MINUS'),
  k('EQUAL', ['EQL'], '=', 'Equal sign', 'symbols', '+'),
  k('PLUS', [], '+', 'Plus sign', 'symbols', undefined, 'EQUAL'),
  k('LBKT', ['LEFT_BRACKET'], '[', 'Left bracket', 'symbols', '{'),
  k('LBRC', ['LEFT_BRACE', 'LCUR'], '{', 'Left brace / curly bracket', 'symbols', undefined, 'LBKT'),
  k('RBKT', ['RIGHT_BRACKET'], ']', 'Right bracket', 'symbols', '}'),
  k('RBRC', ['RIGHT_BRACE', 'RCUR'], '}', 'Right brace / curly bracket', 'symbols', undefined, 'RBKT'),
  k('BSLH', ['BACKSLASH'], '\\', 'Backslash', 'symbols', '|'),
  k('PIPE', [], '|', 'Pipe / vertical bar', 'symbols', undefined, 'BSLH'),
  k('NUHS', ['NON_US_HASH'], '#', 'Non-US hash (ISO key left of Enter)', 'symbols', '~'),
  k('TILDE2', [], '~', 'Tilde (non-US #/~ key, shifted)', 'symbols', undefined, 'NUHS'),
  k('SEMI', ['SEMICOLON', 'SCLN'], ';', 'Semicolon', 'symbols', ':'),
  k('COLON', ['COLN'], ':', 'Colon', 'symbols', undefined, 'SEMI'),
  k('SQT', ['SINGLE_QUOTE', 'APOSTROPHE', 'APOS', 'QUOT'], '\'', 'Single quote / apostrophe', 'symbols', '"'),
  k('DQT', ['DOUBLE_QUOTES'], '"', 'Double quote', 'symbols', undefined, 'SQT'),
  k('GRAVE', ['GRAV'], '`', 'Grave accent / backtick', 'symbols', '~'),
  k('TILDE', ['TILD'], '~', 'Tilde', 'symbols', undefined, 'GRAVE'),
  k('COMMA', ['CMMA'], ',', 'Comma', 'symbols', '<'),
  k('LT', ['LESS_THAN', 'LABT'], '<', 'Less than', 'symbols', undefined, 'COMMA'),
  k('DOT', ['PERIOD'], '.', 'Period / dot / full stop', 'symbols', '>'),
  k('GT', ['GREATER_THAN', 'RABT'], '>', 'Greater than', 'symbols', undefined, 'DOT'),
  k('FSLH', ['SLASH'], '/', 'Forward slash', 'symbols', '?'),
  k('QMARK', ['QUESTION'], '?', 'Question mark', 'symbols', undefined, 'FSLH'),
  k('NUBS', ['NON_US_BACKSLASH', 'NON_US_BSLH'], '\\', 'Non-US backslash (ISO key left of Z)', 'symbols', '|'),
  k('PIPE2', [], '|', 'Pipe (non-US \\ key, shifted)', 'symbols', undefined, 'NUBS'),
  // ---- function
  k('F1', [], 'F1', 'Function key F1', 'function'),
  k('F2', [], 'F2', 'Function key F2', 'function'),
  k('F3', [], 'F3', 'Function key F3', 'function'),
  k('F4', [], 'F4', 'Function key F4', 'function'),
  k('F5', [], 'F5', 'Function key F5', 'function'),
  k('F6', [], 'F6', 'Function key F6', 'function'),
  k('F7', [], 'F7', 'Function key F7', 'function'),
  k('F8', [], 'F8', 'Function key F8', 'function'),
  k('F9', [], 'F9', 'Function key F9', 'function'),
  k('F10', [], 'F10', 'Function key F10', 'function'),
  k('F11', [], 'F11', 'Function key F11', 'function'),
  k('F12', [], 'F12', 'Function key F12', 'function'),
  k('F13', [], 'F13', 'Function key F13', 'function'),
  k('F14', [], 'F14', 'Function key F14', 'function'),
  k('F15', [], 'F15', 'Function key F15', 'function'),
  k('F16', [], 'F16', 'Function key F16', 'function'),
  k('F17', [], 'F17', 'Function key F17', 'function'),
  k('F18', [], 'F18', 'Function key F18', 'function'),
  k('F19', [], 'F19', 'Function key F19', 'function'),
  k('F20', [], 'F20', 'Function key F20', 'function'),
  k('F21', [], 'F21', 'Function key F21', 'function'),
  k('F22', [], 'F22', 'Function key F22', 'function'),
  k('F23', [], 'F23', 'Function key F23', 'function'),
  k('F24', [], 'F24', 'Function key F24', 'function'),
  // ---- navigation
  k('HOME', [], 'Home', 'Home', 'navigation'),
  k('PG_UP', ['PAGE_UP', 'PGUP'], 'PgUp', 'Page up', 'navigation'),
  k('END', [], 'End', 'End', 'navigation'),
  k('PG_DN', ['PAGE_DOWN', 'PGDN'], 'PgDn', 'Page down', 'navigation'),
  k('RIGHT', ['RIGHT_ARROW', 'RARW'], '→', 'Right arrow', 'navigation'),
  k('LEFT', ['LEFT_ARROW', 'LARW'], '←', 'Left arrow', 'navigation'),
  k('DOWN', ['DOWN_ARROW', 'DARW'], '↓', 'Down arrow', 'navigation'),
  k('UP', ['UP_ARROW', 'UARW'], '↑', 'Up arrow', 'navigation'),
  // ---- editing
  k('RET', ['RETURN', 'ENTER'], '⏎', 'Return / Enter', 'editing'),
  k('ESC', ['ESCAPE'], 'Esc', 'Escape', 'editing'),
  k('BSPC', ['BACKSPACE', 'BKSP'], '⌫', 'Backspace', 'editing'),
  k('TAB', [], '⇥', 'Tab', 'editing'),
  k('SPACE', ['SPC'], '␣', 'Space bar', 'editing'),
  k('INS', ['INSERT'], 'Ins', 'Insert', 'editing'),
  k('DEL', ['DELETE'], '⌦', 'Delete (forward)', 'editing'),
  k('K_REDO', ['K_AGAIN'], 'Redo', 'Again / redo (HID keyboard usage)', 'editing'),
  k('K_UNDO', ['UNDO'], 'Undo', 'Undo (HID keyboard usage)', 'editing'),
  k('K_CUT', ['CUT'], 'Cut', 'Cut (HID keyboard usage)', 'editing'),
  k('K_COPY', ['COPY'], 'Copy', 'Copy (HID keyboard usage)', 'editing'),
  k('K_PASTE', ['PSTE'], 'Paste', 'Paste (HID keyboard usage)', 'editing'),
  k('K_FIND', [], 'Find', 'Find (HID keyboard usage)', 'editing'),
  k('ALT_ERASE', [], 'Erase', 'Alternate erase', 'editing'),
  k('RET2', ['RETURN2'], '⏎', 'Return (alternate usage 0x9E)', 'editing'),
  k('K_FIND2', [], 'Find', 'Find (alternate usage 0xF4)', 'editing'),
  k('K_EDIT', [], 'Edit', 'Edit', 'editing'),
  // ---- modifiers
  k('LCTRL', ['LEFT_CONTROL', 'LCTL'], 'Ctrl', 'Left Control', 'modifiers'),
  k('LSHIFT', ['LEFT_SHIFT', 'LSHFT', 'LSFT'], 'Shift', 'Left Shift', 'modifiers'),
  k('LALT', ['LEFT_ALT'], 'Alt', 'Left Alt / Option', 'modifiers'),
  k('LGUI', ['LEFT_GUI', 'LEFT_WIN', 'LWIN', 'LEFT_COMMAND', 'LCMD', 'LEFT_META', 'LMETA'], 'GUI', 'Left GUI (Windows / Command / Meta / Super)', 'modifiers'),
  k('RCTRL', ['RIGHT_CONTROL', 'RCTL'], 'RCtrl', 'Right Control', 'modifiers'),
  k('RSHIFT', ['RIGHT_SHIFT', 'RSHFT', 'RSFT'], 'RShift', 'Right Shift', 'modifiers'),
  k('RALT', ['RIGHT_ALT'], 'AltGr', 'Right Alt / AltGr / Option', 'modifiers'),
  k('RGUI', ['RIGHT_GUI', 'RIGHT_WIN', 'RWIN', 'RIGHT_COMMAND', 'RCMD', 'RIGHT_META', 'RMETA'], 'RGUI', 'Right GUI (Windows / Command / Meta / Super)', 'modifiers'),
  // ---- keypad
  k('KP_NUM', ['KP_NUMLOCK', 'KP_NLCK'], 'NumLk', 'Keypad Num Lock and Clear', 'keypad'),
  k('CLEAR2', [], 'Clear', 'Keypad Clear (shifted Num Lock)', 'keypad', undefined, 'KP_NUM'),
  k('KP_SLASH', ['KP_DIVIDE', 'KDIV'], '/', 'Keypad divide / slash', 'keypad'),
  k('KP_MULTIPLY', ['KP_ASTERISK', 'KMLT'], '*', 'Keypad multiply / asterisk', 'keypad'),
  k('KP_MINUS', ['KP_SUBTRACT', 'KMIN'], '-', 'Keypad minus / subtract', 'keypad'),
  k('KP_PLUS', ['KPLS'], '+', 'Keypad plus', 'keypad'),
  k('KP_ENTER', [], '⏎', 'Keypad Enter', 'keypad'),
  k('KP_N1', ['KP_NUMBER_1'], '1', 'Keypad 1', 'keypad'),
  k('KP_N2', ['KP_NUMBER_2'], '2', 'Keypad 2', 'keypad'),
  k('KP_N3', ['KP_NUMBER_3'], '3', 'Keypad 3', 'keypad'),
  k('KP_N4', ['KP_NUMBER_4'], '4', 'Keypad 4', 'keypad'),
  k('KP_N5', ['KP_NUMBER_5'], '5', 'Keypad 5', 'keypad'),
  k('KP_N6', ['KP_NUMBER_6'], '6', 'Keypad 6', 'keypad'),
  k('KP_N7', ['KP_NUMBER_7'], '7', 'Keypad 7', 'keypad'),
  k('KP_N8', ['KP_NUMBER_8'], '8', 'Keypad 8', 'keypad'),
  k('KP_N9', ['KP_NUMBER_9'], '9', 'Keypad 9', 'keypad'),
  k('KP_N0', ['KP_NUMBER_0'], '0', 'Keypad 0', 'keypad'),
  k('KP_DOT', [], '.', 'Keypad dot / decimal', 'keypad'),
  k('KP_EQUAL', [], '=', 'Keypad equal', 'keypad'),
  k('KP_COMMA', [], ',', 'Keypad comma', 'keypad'),
  k('KP_EQUAL_AS400', [], '=', 'Keypad equal (AS/400)', 'keypad'),
  k('KP_LPAR', ['KP_LEFT_PARENTHESIS'], '(', 'Keypad left parenthesis', 'keypad'),
  k('KP_RPAR', ['KP_RIGHT_PARENTHESIS'], ')', 'Keypad right parenthesis', 'keypad'),
  k('KSPC', [], '␣', 'Keypad space (deprecated, do not use)', 'keypad'),
  k('KP_CLEAR', [], 'Clear', 'Keypad Clear', 'keypad'),
  // ---- media
  k('K_MUTE', [], 'Mute', 'Mute (keyboard usage 0x7F, macOS/Linux)', 'media'),
  k('K_VOL_UP', ['K_VOLUME_UP', 'VOLU'], 'Vol+', 'Volume up (keyboard usage 0x80, macOS/Linux)', 'media'),
  k('K_VOL_DN', ['K_VOLUME_DOWN', 'VOLD'], 'Vol−', 'Volume down (keyboard usage 0x81, macOS/Linux)', 'media'),
  k('K_PP', ['K_PLAY_PAUSE'], '⏯', 'Play / pause (keyboard usage 0xE8)', 'media'),
  k('K_STOP2', [], '⏹', 'Stop (keyboard usage 0xE9)', 'media'),
  k('K_PREV', ['K_PREVIOUS'], '⏮', 'Previous track (keyboard usage 0xEA)', 'media'),
  k('K_NEXT', [], '⏭', 'Next track (keyboard usage 0xEB)', 'media'),
  k('K_EJECT', [], '⏏', 'Eject (keyboard usage 0xEC)', 'media'),
  k('K_VOL_UP2', ['K_VOLUME_UP2'], 'Vol+', 'Volume up (keyboard usage 0xED)', 'media'),
  k('K_VOL_DN2', ['K_VOLUME_DOWN2'], 'Vol−', 'Volume down (keyboard usage 0xEE)', 'media'),
  k('K_MUTE2', [], 'Mute', 'Mute (keyboard usage 0xEF)', 'media'),
  k('K_STOP3', [], '⏹', 'Stop (keyboard usage 0xF3)', 'media'),
  k('C_DATA_ON_SCREEN', [], 'OSD', 'Data on screen', 'media'),
  k('C_CAPTIONS', ['C_SUBTITLES'], 'CC', 'Closed captions / subtitles', 'media'),
  k('C_SNAPSHOT', [], 'Snap', 'Snapshot', 'media'),
  k('C_PIP', [], 'PiP', 'Picture-in-picture toggle', 'media'),
  k('C_RED', ['C_RED_BUTTON'], 'Red', 'Red menu button', 'media'),
  k('C_GREEN', ['C_GREEN_BUTTON'], 'Green', 'Green menu button', 'media'),
  k('C_BLUE', ['C_BLUE_BUTTON'], 'Blue', 'Blue menu button', 'media'),
  k('C_YELLOW', ['C_YELLOW_BUTTON'], 'Yellow', 'Yellow menu button', 'media'),
  k('C_ASPECT', [], 'Aspect', 'Aspect ratio', 'media'),
  k('C_BRI_UP', ['C_BRIGHTNESS_INC', 'C_BRI_INC'], '☀+', 'Display brightness up', 'media'),
  k('C_BRI_DN', ['C_BRIGHTNESS_DEC', 'C_BRI_DEC'], '☀−', 'Display brightness down', 'media'),
  k('C_BKLT_TOG', ['C_BACKLIGHT_TOGGLE'], '☀⏻', 'Display backlight toggle', 'media'),
  k('C_BRI_MIN', ['C_BRIGHTNESS_MINIMUM'], '☀min', 'Display brightness minimum', 'media'),
  k('C_BRI_MAX', ['C_BRIGHTNESS_MAXIMUM'], '☀max', 'Display brightness maximum', 'media'),
  k('C_BRI_AUTO', ['C_BRIGHTNESS_AUTO'], '☀auto', 'Display auto brightness', 'media'),
  k('C_MODE_STEP', ['C_MEDIA_STEP'], 'Mode', 'Media mode step', 'media'),
  k('C_CHAN_LAST', ['C_RECALL_LAST'], 'ChLast', 'Recall last channel', 'media'),
  k('C_CHAN_INC', ['C_CHANNEL_INC'], 'Ch+', 'Channel up', 'media'),
  k('C_CHAN_DEC', ['C_CHANNEL_DEC'], 'Ch−', 'Channel down', 'media'),
  k('C_MEDIA_VCR_PLUS', [], 'VCR+', 'VCR plus', 'media'),
  k('C_PLAY', [], '▶', 'Play', 'media'),
  k('C_PAUSE', [], '⏸', 'Pause', 'media'),
  k('C_REC', ['C_RECORD'], '⏺', 'Record', 'media'),
  k('C_FF', ['C_FAST_FORWARD'], '⏩', 'Fast forward', 'media'),
  k('C_RW', ['C_REWIND'], '⏪', 'Rewind', 'media'),
  k('C_NEXT', ['M_NEXT'], '⏭', 'Next track', 'media'),
  k('C_PREV', ['C_PREVIOUS', 'M_PREV'], '⏮', 'Previous track', 'media'),
  k('C_STOP', ['M_STOP'], '⏹', 'Stop', 'media'),
  k('C_EJECT', ['M_EJCT'], '⏏', 'Eject', 'media'),
  k('C_SHUFFLE', ['C_RANDOM_PLAY'], 'Shuffle', 'Random play / shuffle', 'media'),
  k('C_REPEAT', [], 'Repeat', 'Repeat', 'media'),
  k('C_SLOW2', ['C_SLOW_TRACKING'], 'SlowTr', 'Slow tracking', 'media'),
  k('C_STOP_EJECT', [], '⏹⏏', 'Stop / eject', 'media'),
  k('C_PP', ['C_PLAY_PAUSE', 'M_PLAY'], '⏯', 'Play / pause', 'media'),
  k('C_VOICE_COMMAND', [], 'Voice', 'Voice command / dictation', 'media'),
  k('C_MUTE', ['M_MUTE'], 'Mute', 'Mute', 'media'),
  k('C_BASS_BOOST', [], 'Bass', 'Bass boost', 'media'),
  k('C_VOL_UP', ['C_VOLUME_UP', 'M_VOLU'], 'Vol+', 'Volume up', 'media'),
  k('C_VOL_DN', ['C_VOLUME_DOWN', 'M_VOLD'], 'Vol−', 'Volume down', 'media'),
  k('C_SLOW', [], 'Slow', 'Slow', 'media'),
  k('C_ALT_AUDIO_INC', ['C_ALTERNATE_AUDIO_INCREMENT'], 'Audio+', 'Alternate audio increment', 'media'),
  // ---- app
  k('K_WWW', [], 'WWW', 'WWW (keyboard usage 0xF0)', 'app'),
  k('K_BACK', [], 'Back', 'Back (keyboard usage 0xF1)', 'app'),
  k('K_FORWARD', [], 'Fwd', 'Forward (keyboard usage 0xF2)', 'app'),
  k('K_SCROLL_UP', [], 'Scrl↑', 'Scroll up (keyboard usage 0xF5)', 'app'),
  k('K_SCROLL_DOWN', [], 'Scrl↓', 'Scroll down (keyboard usage 0xF6)', 'app'),
  k('K_REFRESH', [], 'Refresh', 'Refresh (keyboard usage 0xFA)', 'app'),
  k('K_CALC', ['K_CALCULATOR'], 'Calc', 'Calculator (keyboard usage 0xFB)', 'app'),
  k('C_AL_CCC', [], 'Config', 'Launch consumer control configuration', 'app'),
  k('C_AL_WORD', [], 'Word', 'Launch word processor', 'app'),
  k('C_AL_TEXT_EDITOR', [], 'Editor', 'Launch text editor', 'app'),
  k('C_AL_SHEET', ['C_AL_SPREADSHEET'], 'Sheet', 'Launch spreadsheet', 'app'),
  k('C_AL_GRAPHICS_EDITOR', [], 'Gfx', 'Launch graphics editor', 'app'),
  k('C_AL_PRESENTATION', [], 'Slides', 'Launch presentation app', 'app'),
  k('C_AL_DB', ['C_AL_DATABASE'], 'DB', 'Launch database app', 'app'),
  k('C_AL_MAIL', ['C_AL_EMAIL'], 'Mail', 'Launch email', 'app'),
  k('C_AL_NEWS', [], 'News', 'Launch newsreader', 'app'),
  k('C_AL_VOICEMAIL', [], 'VMail', 'Launch voicemail', 'app'),
  k('C_AL_CONTACTS', ['C_AL_ADDRESS_BOOK'], 'Contacts', 'Launch contacts / address book', 'app'),
  k('C_AL_CAL', ['C_AL_CALENDAR'], 'Cal', 'Launch calendar', 'app'),
  k('C_AL_TASK_MANAGER', [], 'Tasks', 'Launch task / project manager', 'app'),
  k('C_AL_JOURNAL', [], 'Journal', 'Launch log / journal', 'app'),
  k('C_AL_FINANCE', [], 'Finance', 'Launch finance app', 'app'),
  k('C_AL_CALC', ['C_AL_CALCULATOR'], 'Calc', 'Launch calculator', 'app'),
  k('C_AL_AV_CAPTURE_PLAYBACK', [], 'A/V', 'Launch A/V capture / playback', 'app'),
  k('C_AL_MY_COMPUTER', [], 'MyPC', 'Launch file manager (local machine browser)', 'app'),
  k('C_AL_WWW', [], 'WWW', 'Launch web browser', 'app'),
  k('C_AL_CHAT', ['C_AL_NETWORK_CHAT'], 'Chat', 'Launch network chat', 'app'),
  k('C_AL_HELP', [], 'Help', 'Launch help center', 'app'),
  k('C_AL_DOCS', ['C_AL_DOCUMENTS'], 'Docs', 'Launch documents', 'app'),
  k('C_AL_SPELL', ['C_AL_SPELLCHECK'], 'Spell', 'Launch spell check', 'app'),
  k('C_AL_FILES', ['C_AL_FILE_BROWSER'], 'Files', 'Launch file browser', 'app'),
  k('C_AL_IMAGES', ['C_AL_IMAGE_BROWSER'], 'Images', 'Launch image browser', 'app'),
  k('C_AL_AUDIO', ['C_AL_AUDIO_BROWSER', 'C_AL_MUSIC'], 'Music', 'Launch audio / music browser', 'app'),
  k('C_AL_MOVIES', ['C_AL_MOVIE_BROWSER'], 'Movies', 'Launch movie browser', 'app'),
  k('C_AL_IM', ['C_AL_INSTANT_MESSAGING'], 'IM', 'Launch instant messaging', 'app'),
  k('C_AL_TIPS', ['C_AL_OEM_FEATURES', 'C_AL_TUTORIAL'], 'Tips', 'Launch OEM features / tips / tutorial', 'app'),
  k('C_AC_NEW', [], 'New', 'App control: new', 'app'),
  k('C_AC_OPEN', [], 'Open', 'App control: open', 'app'),
  k('C_AC_CLOSE', [], 'Close', 'App control: close', 'app'),
  k('C_AC_EXIT', [], 'Exit', 'App control: exit', 'app'),
  k('C_AC_SAVE', [], 'Save', 'App control: save', 'app'),
  k('C_AC_PRINT', [], 'Print', 'App control: print', 'app'),
  k('C_AC_PROPS', ['C_AC_PROPERTIES'], 'Props', 'App control: properties', 'app'),
  k('C_AC_UNDO', [], 'Undo', 'App control: undo', 'app'),
  k('C_AC_COPY', [], 'Copy', 'App control: copy', 'app'),
  k('C_AC_CUT', [], 'Cut', 'App control: cut', 'app'),
  k('C_AC_PASTE', [], 'Paste', 'App control: paste', 'app'),
  k('C_AC_FIND', [], 'Find', 'App control: find', 'app'),
  k('C_AC_SEARCH', [], 'Search', 'App control: search', 'app'),
  k('C_AC_GOTO', [], 'GoTo', 'App control: go to', 'app'),
  k('C_AC_HOME', [], 'Home', 'App control: home (browser)', 'app'),
  k('C_AC_BACK', [], 'Back', 'App control: back (browser)', 'app'),
  k('C_AC_FORWARD', [], 'Fwd', 'App control: forward (browser)', 'app'),
  k('C_AC_STOP', [], 'Stop', 'App control: stop (browser)', 'app'),
  k('C_AC_REFRESH', [], 'Refresh', 'App control: refresh / reload', 'app'),
  k('C_AC_BOOKMARKS', ['C_AC_FAVORITES', 'C_AC_FAVOURITES'], 'Bkmk', 'App control: bookmarks / favorites', 'app'),
  k('C_AC_ZOOM_IN', [], 'Zoom+', 'App control: zoom in', 'app'),
  k('C_AC_ZOOM_OUT', [], 'Zoom−', 'App control: zoom out', 'app'),
  k('C_AC_ZOOM', [], 'Zoom', 'App control: zoom', 'app'),
  k('C_AC_VIEW_TOGGLE', [], 'View', 'App control: view toggle', 'app'),
  k('C_AC_SCROLL_UP', [], 'Scrl↑', 'App control: scroll up', 'app'),
  k('C_AC_SCROLL_DOWN', [], 'Scrl↓', 'App control: scroll down', 'app'),
  k('C_AC_EDIT', [], 'Edit', 'App control: edit', 'app'),
  k('C_AC_CANCEL', [], 'Cancel', 'App control: cancel', 'app'),
  k('C_AC_INS', ['C_AC_INSERT'], 'Ins', 'App control: insert mode', 'app'),
  k('C_AC_DEL', [], 'Del', 'App control: delete', 'app'),
  k('C_AC_REDO', [], 'Redo', 'App control: redo / repeat', 'app'),
  k('C_AC_REPLY', [], 'Reply', 'App control: reply (mail)', 'app'),
  k('C_AC_FORWARD_MAIL', [], 'FwdMail', 'App control: forward message', 'app'),
  k('C_AC_SEND', [], 'Send', 'App control: send', 'app'),
  // ---- international
  k('INT1', ['INTERNATIONAL_1', 'INT_RO'], 'Ro', 'International 1 (JIS Ro \\_ / ABNT /?)', 'international'),
  k('INT2', ['INTERNATIONAL_2', 'INT_KATAKANAHIRAGANA', 'INT_KANA'], 'Kana', 'International 2 (Katakana/Hiragana)', 'international'),
  k('INT3', ['INTERNATIONAL_3', 'INT_YEN'], '¥', 'International 3 (JIS Yen)', 'international'),
  k('INT4', ['INTERNATIONAL_4', 'INT_HENKAN'], 'Henkan', 'International 4 (Henkan / convert)', 'international'),
  k('INT5', ['INTERNATIONAL_5', 'INT_MUHENKAN'], 'Muhen', 'International 5 (Muhenkan / no convert)', 'international'),
  k('INT6', ['INTERNATIONAL_6', 'INT_KPJPCOMMA'], 'KP,', 'International 6 (JIS keypad comma)', 'international'),
  k('INT7', ['INTERNATIONAL_7'], 'Int7', 'International 7', 'international'),
  k('INT8', ['INTERNATIONAL_8'], 'Int8', 'International 8', 'international'),
  k('INT9', ['INTERNATIONAL_9'], 'Int9', 'International 9', 'international'),
  k('LANG1', ['LANGUAGE_1', 'LANG_HANGEUL'], '한/영', 'Language 1 (Hangeul / English, macOS Kana)', 'international'),
  k('LANG2', ['LANGUAGE_2', 'LANG_HANJA'], '漢字', 'Language 2 (Hanja, macOS Eisu)', 'international'),
  k('LANG3', ['LANGUAGE_3', 'LANG_KATAKANA'], 'Kata', 'Language 3 (Katakana)', 'international'),
  k('LANG4', ['LANGUAGE_4', 'LANG_HIRAGANA'], 'Hira', 'Language 4 (Hiragana)', 'international'),
  k('LANG5', ['LANGUAGE_5', 'LANG_ZENKAKUHANKAKU'], '半/全', 'Language 5 (Zenkaku/Hankaku)', 'international'),
  k('LANG6', ['LANGUAGE_6'], 'Lang6', 'Language 6', 'international'),
  k('LANG7', ['LANGUAGE_7'], 'Lang7', 'Language 7', 'international'),
  k('LANG8', ['LANGUAGE_8'], 'Lang8', 'Language 8', 'international'),
  k('LANG9', ['LANGUAGE_9'], 'Lang9', 'Language 9', 'international'),
  // ---- system
  k('SYS_PWR', ['SYSTEM_POWER'], 'Power', 'System power down', 'system'),
  k('SYS_SLEEP', ['SYSTEM_SLEEP'], 'Sleep', 'System sleep', 'system'),
  k('SYS_WAKE', ['SYSTEM_WAKE_UP'], 'Wake', 'System wake up', 'system'),
  k('CAPS', ['CAPSLOCK', 'CLCK'], 'Caps', 'Caps Lock', 'system'),
  k('PSCRN', ['PRINTSCREEN', 'PRSC'], 'PrtSc', 'Print Screen', 'system'),
  k('SLCK', ['SCROLLLOCK', 'SCLK'], 'ScrLk', 'Scroll Lock', 'system'),
  k('PAUSE_BREAK', ['PAUS'], 'Pause', 'Pause / Break', 'system'),
  k('K_APP', ['K_APPLICATION', 'K_CONTEXT_MENU', 'K_CMENU', 'GUI'], 'Menu', 'Application / context menu key', 'system'),
  k('K_PWR', ['K_POWER'], 'Power', 'Keyboard power (HID keyboard usage)', 'system'),
  k('LCAPS', ['LOCKING_CAPS'], 'Caps', 'Locking Caps Lock', 'system'),
  k('LNLCK', ['LOCKING_NUM'], 'NumLk', 'Locking Num Lock', 'system'),
  k('LSLCK', ['LOCKING_SCROLL'], 'ScrLk', 'Locking Scroll Lock', 'system'),
  k('SYSREQ', ['ATTENTION'], 'SysRq', 'SysReq / Attention', 'system'),
  k('K_SLEEP', [], 'Sleep', 'Sleep (keyboard usage 0xF8)', 'system'),
  k('K_LOCK', ['K_SCREENSAVER', 'K_COFFEE'], 'Lock', 'Lock screen / screensaver (keyboard usage 0xF9)', 'system'),
  k('C_PWR', ['C_POWER'], 'Power', 'Consumer power', 'system'),
  k('C_RESET', [], 'Reset', 'Consumer reset', 'system'),
  k('C_SLEEP', [], 'Sleep', 'Consumer sleep', 'system'),
  k('C_SLEEP_MODE', [], 'SlpMd', 'Consumer sleep mode', 'system'),
  k('C_AL_LOGOFF', [], 'LogOff', 'Log off', 'system'),
  k('C_AL_LOCK', ['C_AL_SCREENSAVER', 'C_AL_COFFEE'], 'Lock', 'Lock screen / screensaver', 'system'),
  k('C_AL_CONTROL_PANEL', [], 'CtlPnl', 'Control panel / settings', 'system'),
  k('C_AL_SELECT_TASK', [], 'Task', 'Select task / application', 'system'),
  k('C_AL_NEXT_TASK', [], 'Task▶', 'Next task / application', 'system'),
  k('C_AL_PREV_TASK', ['C_AL_PREVIOUS_TASK'], '◀Task', 'Previous task / application', 'system'),
  k('C_AL_KEYBOARD_LAYOUT', [], 'Layout', 'Keyboard layout', 'system'),
  k('C_AL_SCREEN_SAVER', [], 'ScrSvr', 'Screen saver', 'system'),
  k('C_AC_DESKTOP_SHOW_ALL_WINDOWS', [], 'Windows', 'Show all windows (Mission Control / Task View)', 'system'),
  k('C_AC_DESKTOP_SHOW_ALL_APPLICATIONS', [], 'Apps', 'Show all applications (Launchpad)', 'system'),
  k('GLOBE', ['C_AC_NEXT_KEYBOARD_LAYOUT_SELECT'], '🌐', 'Apple Globe / Fn key (next keyboard layout)', 'system'),
  // ---- other
  k('K_EXEC', ['K_EXECUTE'], 'Exec', 'Execute', 'other'),
  k('K_HELP', [], 'Help', 'Help', 'other'),
  k('K_MENU', [], 'Menu', 'Menu (keyboard usage 0x76)', 'other'),
  k('K_SELECT', [], 'Select', 'Select', 'other'),
  k('K_STOP', [], 'Stop', 'Stop (keyboard usage 0x78)', 'other'),
  k('K_CANCEL', [], 'Cancel', 'Cancel', 'other'),
  k('CLEAR', [], 'Clear', 'Clear', 'other'),
  k('PRIOR', [], 'Prior', 'Prior', 'other'),
  k('SEPARATOR', [], 'Sep', 'Separator', 'other'),
  k('OUT', [], 'Out', 'Out', 'other'),
  k('OPER', [], 'Oper', 'Oper', 'other'),
  k('CLEAR_AGAIN', [], 'ClrAg', 'Clear / again', 'other'),
  k('CRSEL', [], 'CrSel', 'CrSel / props', 'other'),
  k('EXSEL', [], 'ExSel', 'ExSel', 'other'),
  k('CURU', [], 'Curr', 'Currency unit (deprecated, do not use)', 'other'),
  k('C_MENU', [], 'Menu', 'Consumer menu', 'other'),
  k('C_MENU_PICK', ['C_MENU_SELECT'], 'Pick', 'Consumer menu pick / select', 'other'),
  k('C_MENU_UP', [], 'Menu↑', 'Consumer menu up', 'other'),
  k('C_MENU_DOWN', [], 'Menu↓', 'Consumer menu down', 'other'),
  k('C_MENU_LEFT', [], 'Menu←', 'Consumer menu left', 'other'),
  k('C_MENU_RIGHT', [], 'Menu→', 'Consumer menu right', 'other'),
  k('C_MENU_ESC', ['C_MENU_ESCAPE'], 'MenuEsc', 'Consumer menu escape', 'other'),
  k('C_MENU_INC', ['C_MENU_INCREASE'], 'Menu+', 'Consumer menu value increase', 'other'),
  k('C_MENU_DEC', ['C_MENU_DECREASE'], 'Menu−', 'Consumer menu value decrease', 'other'),
  k('C_MEDIA_COMPUTER', [], 'PC', 'Media select computer', 'other'),
  k('C_MEDIA_TV', [], 'TV', 'Media select TV', 'other'),
  k('C_MEDIA_WWW', [], 'WWW', 'Media select WWW', 'other'),
  k('C_MEDIA_DVD', [], 'DVD', 'Media select DVD', 'other'),
  k('C_MEDIA_PHONE', [], 'Phone', 'Media select telephone', 'other'),
  k('C_MEDIA_GUIDE', [], 'Guide', 'Media select program guide', 'other'),
  k('C_MEDIA_VIDEOPHONE', [], 'VPhone', 'Media select video phone', 'other'),
  k('C_MEDIA_GAMES', [], 'Games', 'Media select games', 'other'),
  k('C_MEDIA_MESSAGES', [], 'Msgs', 'Media select messages', 'other'),
  k('C_MEDIA_CD', [], 'CD', 'Media select CD', 'other'),
  k('C_MEDIA_VCR', [], 'VCR', 'Media select VCR', 'other'),
  k('C_MEDIA_TUNER', [], 'Tuner', 'Media select tuner', 'other'),
  k('C_QUIT', [], 'Quit', 'Consumer quit', 'other'),
  k('C_HELP', [], 'Help', 'Consumer help', 'other'),
  k('C_MEDIA_TAPE', [], 'Tape', 'Media select tape', 'other'),
  k('C_MEDIA_CABLE', [], 'Cable', 'Media select cable', 'other'),
  k('C_MEDIA_SATELLITE', [], 'Sat', 'Media select satellite', 'other'),
  k('C_MEDIA_HOME', [], 'Home', 'Media select home', 'other'),
  k('C_KBIA_PREV', ['C_KEYBOARD_INPUT_ASSIST_PREVIOUS'], 'IA←', 'Keyboard input assist previous', 'other'),
  k('C_KBIA_NEXT', ['C_KEYBOARD_INPUT_ASSIST_NEXT'], 'IA→', 'Keyboard input assist next', 'other'),
  k('C_KBIA_PREV_GRP', ['C_KEYBOARD_INPUT_ASSIST_PREVIOUS_GROUP'], 'IA⇤', 'Keyboard input assist previous group', 'other'),
  k('C_KBIA_NEXT_GRP', ['C_KEYBOARD_INPUT_ASSIST_NEXT_GROUP'], 'IA⇥', 'Keyboard input assist next group', 'other'),
  k('C_KBIA_ACCEPT', ['C_KEYBOARD_INPUT_ASSIST_ACCEPT'], 'IA✓', 'Keyboard input assist accept', 'other'),
  k('C_KBIA_CANCEL', ['C_KEYBOARD_INPUT_ASSIST_CANCEL'], 'IA✗', 'Keyboard input assist cancel', 'other'),
]

const BY_NAME = new Map<string, KeycodeDef>()
for (const def of KEYCODES) {
  BY_NAME.set(def.code, def)
  for (const a of def.aliases) BY_NAME.set(a, def)
}

/** Look up a keycode by its canonical name or any alias (case-sensitive, like ZMK). */
export function findKeycode(codeOrAlias: string): KeycodeDef | undefined {
  return BY_NAME.get(codeOrAlias)
}

/** Canonical name for a code or alias; unknown names are returned unchanged. */
export function canonicalCode(codeOrAlias: string): string {
  return BY_NAME.get(codeOrAlias)?.code ?? codeOrAlias
}

/** Canonical keycode for each modifier (each one is also a valid findKeycode() key). */
export const MOD_CODES: Record<Mod, string> = {
  LCTRL: 'LCTRL', LSHIFT: 'LSHIFT', LALT: 'LALT', LGUI: 'LGUI',
  RCTRL: 'RCTRL', RSHIFT: 'RSHIFT', RALT: 'RALT', RGUI: 'RGUI',
}

/** Modifier functions from dt-bindings/zmk/modifiers.h, e.g. LC(A). */
export const MOD_FUNCTIONS: Record<Mod, string> = {
  LCTRL: 'LC', LSHIFT: 'LS', LALT: 'LA', LGUI: 'LG',
  RCTRL: 'RC', RSHIFT: 'RS', RALT: 'RA', RGUI: 'RG',
}

const MOD_BY_CANON = new Map<string, Mod>(
  (Object.entries(MOD_CODES) as [Mod, string][]).map(([m, c]) => [c, m]),
)

/** If `code` (or an alias of it) is a modifier key, return its Mod. */
export function isModifierCode(code: string): Mod | undefined {
  return MOD_BY_CANON.get(canonicalCode(code))
}

// ---- text -> key presses -----------------------------------------------------

export interface CharKey {
  /** canonical keycode of the physical (US-named) key to press */
  code: string
  /** hold Shift */
  shift: boolean
  /** hold AltGr (RALT) */
  altgr?: boolean
  /** the OS layout treats this key as a dead key: follow it with SPACE to get the bare character */
  dead?: boolean
}

const CONTROL_CHARS: Record<string, string> = { '\n': 'RET', '\r': 'RET', '\t': 'TAB', ' ': 'SPACE', '\b': 'BSPC' }

const charMaps = new Map<string, Map<string, CharKey>>()

function charMap(locale: string): Map<string, CharKey> {
  let map = charMaps.get(locale)
  if (map) return map
  map = new Map()
  const table = LOCALE_TABLES[locale] ?? LOCALE_TABLES.us
  const dead = DEAD_KEYS[locale] ?? ''
  // Lowest layer wins: plain, then Shift, then AltGr, then Shift+AltGr.
  for (let layer = 0; layer < 4; layer++) {
    for (const [code, row] of Object.entries(table)) {
      const ch = row[layer]
      if (!ch || map.has(ch)) continue
      const key: CharKey = { code, shift: layer === 1 || layer === 3 }
      if (layer >= 2) key.altgr = true
      if (dead.includes(ch)) key.dead = true
      map.set(ch, key)
    }
  }
  charMaps.set(locale, map)
  return map
}

/**
 * Which key (plus Shift / AltGr) types `ch` when the host OS uses `locale`
 * (see LOCALES in ./locales). Shifted characters are returned as the base key
 * with `shift: true`, e.g. '!' -> { code: 'N1', shift: true } on US.
 * Returns undefined for characters the layout cannot type.
 */
export function charToKey(ch: string, locale: string = 'us'): CharKey | undefined {
  const ctl = CONTROL_CHARS[ch]
  if (ctl) return { code: ctl, shift: false }
  const hit = charMap(locale).get(ch)
  return hit ? { ...hit } : undefined
}

// ---- search --------------------------------------------------------------------

/**
 * Search the catalog. Ranking (case-insensitive): exact code, exact alias,
 * exact label, exact shifted label, code/alias prefix, label prefix, word prefix in name,
 * substring in name or code/alias. Ties keep catalog order.
 */
export function KEY_SEARCH(query: string): KeycodeDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return KEYCODES.slice()
  const scored: { def: KeycodeDef; score: number; i: number }[] = []
  KEYCODES.forEach((def, i) => {
    const code = def.code.toLowerCase()
    const aliases = def.aliases.map((a) => a.toLowerCase())
    const label = def.label.toLowerCase()
    const labels = def.shiftLabel ? [label, def.shiftLabel.toLowerCase()] : [label]
    const name = def.name.toLowerCase()
    let score = -1
    if (code === q) score = 0
    else if (aliases.includes(q)) score = 1
    else if (label === q) score = 2
    else if (labels.includes(q)) score = 2.5
    else if (code.startsWith(q) || aliases.some((a) => a.startsWith(q))) score = 3
    else if (labels.some((l) => l.startsWith(q))) score = 4
    else if (name.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) score = 5
    else if (name.includes(q)) score = 6
    else if (code.includes(q) || aliases.some((a) => a.includes(q))) score = 7
    if (score >= 0) scored.push({ def, score, i })
  })
  scored.sort((a, b) => a.score - b.score || a.i - b.i)
  return scored.map((s) => s.def)
}
