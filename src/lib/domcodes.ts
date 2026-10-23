// KeyboardEvent.code -> ZMK keycode, for "press a key to assign"
const map: Record<string, string> = {
  Escape: 'ESC', Backquote: 'GRAVE', Minus: 'MINUS', Equal: 'EQUAL', Backspace: 'BSPC',
  Tab: 'TAB', BracketLeft: 'LBKT', BracketRight: 'RBKT', Backslash: 'BSLH',
  CapsLock: 'CAPS', Semicolon: 'SEMI', Quote: 'SQT', Enter: 'RET',
  Comma: 'COMMA', Period: 'DOT', Slash: 'FSLH', Space: 'SPACE',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  AltLeft: 'LALT', AltRight: 'RALT', MetaLeft: 'LGUI', MetaRight: 'RGUI', ContextMenu: 'K_APP',
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PG_UP', PageDown: 'PG_DN',
  PrintScreen: 'PSCRN', ScrollLock: 'SLCK', Pause: 'PAUSE_BREAK', NumLock: 'KP_NUM',
  NumpadDivide: 'KP_SLASH', NumpadMultiply: 'KP_MULTIPLY', NumpadSubtract: 'KP_MINUS',
  NumpadAdd: 'KP_PLUS', NumpadEnter: 'KP_ENTER', NumpadDecimal: 'KP_DOT', NumpadEqual: 'KP_EQUAL',
  IntlBackslash: 'NON_US_BSLH', IntlRo: 'INT1', IntlYen: 'INT3',
  AudioVolumeUp: 'C_VOL_UP', AudioVolumeDown: 'C_VOL_DN', AudioVolumeMute: 'C_MUTE',
  MediaPlayPause: 'C_PP', MediaTrackNext: 'C_NEXT', MediaTrackPrevious: 'C_PREV', MediaStop: 'C_STOP',
}
for (let i = 0; i < 26; i++) {
  const c = String.fromCharCode(65 + i)
  map['Key' + c] = c
}
for (let i = 0; i < 10; i++) {
  map['Digit' + i] = 'N' + i
  map['Numpad' + i] = 'KP_N' + i
}
for (let i = 1; i <= 24; i++) map['F' + i] = 'F' + i

export const domCodeToZmk = (code: string): string | undefined => map[code]
