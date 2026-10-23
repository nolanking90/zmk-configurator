// OS keyboard-language support (Oryx's "keyboard language" setting).
//
// ZMK sends HID usages, which are named after the US layout. If the host OS
// uses another layout, the same usage types a different character, e.g. on
// German the key ZMK calls Y types "z". The tables below record, per OS
// layout, what each US-named key types: [plain, Shift, AltGr, Shift+AltGr].
//
// Data: generated from joelspadin/zmk-locale-generator v1.5.0 headers (which
// are built from Unicode CLDR keyboard data, Windows layouts). Uppercase
// letters are implied (Shift + letter). Hand-written: us, colemak (OS-level
// Colemak on a US base) and jp (JIS 106/109, alphanumeric mode).
// The ISO key left of Enter is listed under BSLH, the usage Windows and Linux
// treat identically to NUHS; lookups fall back between the two.

import { findKeycode } from './keycodes'

export interface LocaleDef {
  id: string
  name: string
}

export const LOCALES: LocaleDef[] = [
  { id: 'us', name: 'English (US)' },
  { id: 'uk', name: 'English (UK)' },
  { id: 'us-intl', name: 'English (US International)' },
  { id: 'de', name: 'German' },
  { id: 'ch-de', name: 'German (Swiss)' },
  { id: 'fr', name: 'French (AZERTY)' },
  { id: 'ch-fr', name: 'French (Swiss)' },
  { id: 'be', name: 'Belgian (AZERTY)' },
  { id: 'es', name: 'Spanish' },
  { id: 'es-la', name: 'Spanish (Latin America)' },
  { id: 'it', name: 'Italian' },
  { id: 'pt', name: 'Portuguese' },
  { id: 'pt-br', name: 'Portuguese (Brazil, ABNT2)' },
  { id: 'nl', name: 'Dutch' },
  { id: 'sv', name: 'Swedish / Nordic' },
  { id: 'fi', name: 'Finnish' },
  { id: 'no', name: 'Norwegian' },
  { id: 'da', name: 'Danish' },
  { id: 'pl', name: 'Polish (Programmers)' },
  { id: 'jp', name: 'Japanese (JIS)' },
  { id: 'dvorak', name: 'Dvorak (OS layout)' },
  { id: 'colemak', name: 'Colemak (OS layout)' },
]

/** Characters that are dead keys in each OS layout (type them followed by SPACE). */
export const DEAD_KEYS: Record<string, string> = {
  'us-intl': '\'"`~^',
  de: '^´`',
  'ch-de': '^`~¨´',
  'ch-fr': '^`~¨´',
  fr: '^¨~`',
  be: '^¨`~´',
  es: '`^´¨~',
  'es-la': '´¨^`',
  pt: '´`~^¨',
  'pt-br': '´`~^¨',
  nl: '¨^~´`',
  sv: '¨^~´`',
  fi: '¨^~´`',
  no: '¨^~´`',
  da: '¨^~´`',
}

/** keycode -> [plain, Shift, AltGr, Shift+AltGr]; missing / '' = nothing */
export const LOCALE_TABLES: Record<string, Record<string, string[]>> = {
  us: {
    GRAVE: ['`', '~'], N1: ['1', '!'], N2: ['2', '@'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'],
    N6: ['6', '^'], N7: ['7', '&'], N8: ['8', '*'], N9: ['9', '('], N0: ['0', ')'], MINUS: ['-', '_'],
    EQUAL: ['=', '+'], LBKT: ['[', '{'], RBKT: [']', '}'], BSLH: ['\\', '|'], SEMI: [';', ':'],
    SQT: ['\'', '"'], COMMA: [',', '<'], DOT: ['.', '>'], FSLH: ['/', '?'], NUBS: ['\\', '|'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'],
    I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'],
  },
  uk: {
    N1: ['1', '!'], N2: ['2', '"'], BSLH: ['#', '~'], N4: ['4', '$', '€'], N5: ['5', '%'], N7: ['7', '&'],
    SQT: ['\'', '@'], N9: ['9', '('], N0: ['0', ')'], N8: ['8', '*'], EQUAL: ['=', '+'], COMMA: [',', '<'],
    MINUS: ['-', '_'], DOT: ['.', '>'], FSLH: ['/', '?'], N3: ['3', '£'], N6: ['6', '^'], SEMI: [';', ':'],
    LBKT: ['[', '{'], NUBS: ['\\', '|'], RBKT: [']', '}'], GRAVE: ['`', '¬', '¦'], A: ['a', 'A', 'á'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', 'é'], F: ['f', 'F'], G: ['g', 'G'],
    H: ['h', 'H'], I: ['i', 'I', 'í'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'],
    N: ['n', 'N'], O: ['o', 'O', 'ó'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U', 'ú'], V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'],
    Z: ['z', 'Z'],
  },
  de: {
    N1: ['1', '!'], N2: ['2', '"', '²'], BSLH: ['#', '\''], N4: ['4', '$'], N5: ['5', '%'], N6: ['6', '&'],
    N8: ['8', '(', '['], N9: ['9', ')', ']'], RBKT: ['+', '*', '~'], COMMA: [',', ';'], FSLH: ['-', '_'],
    DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'], N3: ['3', '§', '³'], NUBS: ['<', '>', '|'],
    MINUS: ['ß', '?', '\\', 'ẞ'], Q: ['q', 'Q', '@'], GRAVE: ['^', '°'], EQUAL: ['´', '`'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'], F: ['f', 'F'], G: ['g', 'G'],
    H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M', 'µ'],
    N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'],
    V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Z: ['y', 'Y'], Y: ['z', 'Z'], SQT: ['ä', 'Ä'],
    SEMI: ['ö', 'Ö'], LBKT: ['ü', 'Ü'],
  },
  fr: {
    FSLH: ['!', '§'], N3: ['"', '3', '#'], RBKT: ['$', '£', '¤'], SQT: ['ù', '%'], N1: ['&', '1'],
    N4: ['\'', '4', '{'], N5: ['(', '5', '['], MINUS: [')', '°', ']'], BSLH: ['*', 'µ'], EQUAL: ['=', '+', '}'],
    M: [',', '?'], N6: ['-', '6', '|'], COMMA: [';', '.'], DOT: [':', '/'], N0: ['à', '0', '@'],
    N2: ['é', '2', '~'], N7: ['è', '7', '`'], N8: ['_', '8', '\\'], N9: ['ç', '9'], NUBS: ['<', '>'],
    LBKT: ['^', '¨'], Q: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'],
    F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'],
    SEMI: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], A: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], Z: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], W: ['z', 'Z'],
    GRAVE: ['²'],
  },
  es: {
    N1: ['1', '!', '|'], N2: ['2', '"', '@'], N3: ['3', '·', '#'], N4: ['4', '$', '~'], N5: ['5', '%', '€'],
    N6: ['6', '&', '¬'], MINUS: ['\'', '?'], N8: ['8', '('], N9: ['9', ')'], RBKT: ['+', '*', ']'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/'], N0: ['0', '='], NUBS: ['<', '>'],
    LBKT: ['`', '^', '['], GRAVE: ['º', 'ª', '\\'], A: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'],
    E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'],
    L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'],
    S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'],
    Z: ['z', 'Z'], SQT: ['´', '¨', '{'], BSLH: ['ç', 'Ç', '}'], EQUAL: ['¡', '¿'], SEMI: ['ñ', 'Ñ'],
  },
  'es-la': {
    N1: ['1', '!'], N2: ['2', '"'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'], N6: ['6', '&'],
    MINUS: ['\'', '?', '\\'], N8: ['8', '('], N9: ['9', ')'], RBKT: ['+', '*', '~'], COMMA: [',', ';'],
    FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/'], N0: ['0', '='], NUBS: ['<', '>'], Q: ['q', 'Q', '@'],
    SQT: ['{', '[', '^'], BSLH: ['}', ']', '`'], A: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'],
    E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'],
    L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'],
    GRAVE: ['|', '°', '¬'], EQUAL: ['¿', '¡'], LBKT: ['´', '¨'], SEMI: ['ñ', 'Ñ'],
  },
  it: {
    N1: ['1', '!'], N2: ['2', '"'], SQT: ['à', '°', '#'], N4: ['4', '$'], N5: ['5', '%', '€'], N6: ['6', '&'],
    MINUS: ['\'', '?'], N8: ['8', '('], N9: ['9', ')'], RBKT: ['+', '*', ']', '}'], COMMA: [',', ';'],
    FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/'], N0: ['0', '='], N3: ['3', '£'], NUBS: ['<', '>'],
    SEMI: ['ò', 'ç', '@'], LBKT: ['è', 'é', '[', '{'], GRAVE: ['\\', '|'], EQUAL: ['ì', '^'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'],
    I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], BSLH: ['ù', '§'],
  },
  sv: {
    N1: ['1', '!'], N2: ['2', '"', '@'], N3: ['3', '#', '£'], N4: ['4', '¤', '$'], N5: ['5', '%', '€'],
    N6: ['6', '&'], BSLH: ['\'', '*'], N8: ['8', '(', '['], N9: ['9', ')', ']'], MINUS: ['+', '?', '\\'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'],
    NUBS: ['<', '>', '|'], RBKT: ['¨', '^', '~'], EQUAL: ['´', '`'], A: ['a', 'A'], B: ['b', 'B'],
    C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'],
    J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M', 'µ'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], GRAVE: ['§', '½'], SQT: ['ä', 'Ä'],
    LBKT: ['å', 'Å'], SEMI: ['ö', 'Ö'],
  },
  fi: {
    N1: ['1', '!'], N2: ['2', '"', '@'], N3: ['3', '#', '£'], N4: ['4', '¤', '$'], N5: ['5', '%', '€'],
    N6: ['6', '&'], BSLH: ['\'', '*'], N8: ['8', '(', '['], N9: ['9', ')', ']'], MINUS: ['+', '?', '\\'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'],
    NUBS: ['<', '>', '|'], RBKT: ['¨', '^', '~'], EQUAL: ['´', '`'], A: ['a', 'A'], B: ['b', 'B'],
    C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'],
    J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M', 'µ'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], GRAVE: ['§', '½'], SQT: ['ä', 'Ä'],
    LBKT: ['å', 'Å'], SEMI: ['ö', 'Ö'],
  },
  no: {
    N1: ['1', '!'], N2: ['2', '"', '@'], N3: ['3', '#', '£'], N4: ['4', '¤', '$'], N5: ['5', '%', '€'],
    N6: ['6', '&'], BSLH: ['\'', '*'], N8: ['8', '(', '['], N9: ['9', ')', ']'], MINUS: ['+', '?'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'],
    NUBS: ['<', '>'], EQUAL: ['\\', '`', '´'], RBKT: ['¨', '^', '~'], A: ['a', 'A'], B: ['b', 'B'],
    C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'],
    J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M', 'µ'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], GRAVE: ['|', '§'], LBKT: ['å', 'Å'],
    SQT: ['æ', 'Æ'], SEMI: ['ø', 'Ø'],
  },
  da: {
    N1: ['1', '!'], N2: ['2', '"', '@'], N3: ['3', '#', '£'], N4: ['4', '¤', '$'], N5: ['5', '%', '€'],
    N6: ['6', '&'], BSLH: ['\'', '*'], N8: ['8', '(', '['], N9: ['9', ')', ']'], MINUS: ['+', '?'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'],
    NUBS: ['<', '>', '\\'], RBKT: ['¨', '^', '~'], EQUAL: ['´', '`', '|'], A: ['a', 'A'], B: ['b', 'B'],
    C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'],
    J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M', 'µ'], N: ['n', 'N'], O: ['o', 'O'],
    P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], GRAVE: ['½', '§'], LBKT: ['å', 'Å'],
    SEMI: ['æ', 'Æ'], SQT: ['ø', 'Ø'],
  },
  pt: {
    N1: ['1', '!'], N2: ['2', '"', '@'], N3: ['3', '#', '£'], N4: ['4', '$', '§'], N5: ['5', '%', '€'],
    N6: ['6', '&'], MINUS: ['\'', '?'], N8: ['8', '(', '['], N9: ['9', ')', ']'], LBKT: ['+', '*', '¨'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '{'], N0: ['0', '=', '}'],
    NUBS: ['<', '>'], GRAVE: ['\\', '|'], BSLH: ['~', '^'], RBKT: ['´', '`'], A: ['a', 'A'], B: ['b', 'B'],
    C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'],
    J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'],
    Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], W: ['w', 'W'],
    X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], SQT: ['º', 'ª'], EQUAL: ['«', '»'], SEMI: ['ç', 'Ç'],
  },
  'pt-br': {
    N1: ['1', '!', '¹'], GRAVE: ['\'', '"'], N3: ['3', '#', '³'], N4: ['4', '$', '£'], N5: ['5', '%', '¢'],
    N7: ['7', '&'], N9: ['9', '('], N0: ['0', ')'], N8: ['8', '*'], EQUAL: ['=', '+', '§'], COMMA: [',', '<'],
    MINUS: ['-', '_'], DOT: ['.', '>'], INT1: ['/'], N2: ['2', '@', '²'], N6: ['6', '¨', '¬'], FSLH: [';', ':'],
    W: ['w', 'W', '?'], RBKT: ['[', '{', 'ª'], NUBS: ['\\', '|'], BSLH: [']', '}', 'º'], SQT: ['~', '^'],
    LBKT: ['´', '`'], A: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C', '₢'], D: ['d', 'D'], E: ['e', 'E', '°'],
    F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'],
    M: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], SEMI: ['ç', 'Ç'],
  },
  'ch-de': {
    RBKT: ['¨', '!', ']'], N2: ['2', '"', '@'], N3: ['3', '*', '#'], BSLH: ['$', '£', '}'], N5: ['5', '%'],
    N6: ['6', '&', '¬'], MINUS: ['\'', '?', '´'], N8: ['8', '(', '¢'], N9: ['9', ')'], N1: ['1', '+', '¦'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '|'], N0: ['0', '='],
    N4: ['4', 'ç', '°'], NUBS: ['<', '>', '\\'], LBKT: ['ü', 'è', '['], EQUAL: ['^', '`', '~'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'], F: ['f', 'F'], G: ['g', 'G'],
    H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'],
    O: ['o', 'O'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'],
    V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Z: ['y', 'Y'], Y: ['z', 'Z'], SQT: ['ä', 'à', '{'],
    GRAVE: ['§'], SEMI: ['ö', 'é'],
  },
  'ch-fr': {
    RBKT: ['¨', '!', ']'], N2: ['2', '"', '@'], N3: ['3', '*', '#'], BSLH: ['$', '£', '}'], N5: ['5', '%'],
    N6: ['6', '&', '¬'], MINUS: ['\'', '?', '´'], N8: ['8', '(', '¢'], N9: ['9', ')'], N1: ['1', '+', '¦'],
    COMMA: [',', ';'], FSLH: ['-', '_'], DOT: ['.', ':'], N7: ['7', '/', '|'], N0: ['0', '='],
    N4: ['4', 'ç', '°'], NUBS: ['<', '>', '\\'], LBKT: ['è', 'ü', '['], EQUAL: ['^', '`', '~'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'], F: ['f', 'F'], G: ['g', 'G'],
    H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'],
    O: ['o', 'O'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'],
    V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Z: ['y', 'Y'], Y: ['z', 'Z'], SQT: ['à', 'ä', '{'],
    GRAVE: ['§'], SEMI: ['é', 'ö'],
  },
  be: {
    N8: ['!', '8'], N3: ['"', '3', '#'], RBKT: ['$', '*', ']'], SQT: ['ù', '%', '´'], N1: ['&', '1', '|'],
    N4: ['\'', '4', '{'], N5: ['(', '5', '['], MINUS: [')', '°'], FSLH: ['=', '+', '~'], M: [',', '?'],
    EQUAL: ['-', '_'], COMMA: [';', '.'], DOT: [':', '/'], N0: ['à', '0', '}'], N2: ['é', '2', '@'],
    N6: ['§', '6'], N7: ['è', '7'], N9: ['ç', '9'], NUBS: ['<', '>', '\\'], LBKT: ['^', '¨'],
    BSLH: ['µ', '£', '`'], Q: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'],
    F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'],
    SEMI: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], A: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], Z: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], W: ['z', 'Z'],
    GRAVE: ['²', '³'],
  },
  nl: {
    N8: ['!', '8'], N3: ['"', '3', '#'], RBKT: ['$', '*', ']'], SQT: ['ù', '%', '´'], N1: ['&', '1', '|'],
    N4: ['\'', '4', '{'], N5: ['(', '5', '['], MINUS: [')', '°'], FSLH: ['=', '+', '~'], M: [',', '?'],
    EQUAL: ['-', '_'], COMMA: [';', '.'], DOT: [':', '/'], N0: ['à', '0', '}'], N2: ['é', '2', '@'],
    N6: ['§', '6'], N7: ['è', '7'], N9: ['ç', '9'], NUBS: ['<', '>', '\\'], LBKT: ['^', '¨'],
    BSLH: ['µ', '£', '`'], Q: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E', '€'],
    F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'],
    SEMI: ['m', 'M'], N: ['n', 'N'], O: ['o', 'O'], P: ['p', 'P'], A: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'],
    T: ['t', 'T'], U: ['u', 'U'], V: ['v', 'V'], Z: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], W: ['z', 'Z'],
    GRAVE: ['²', '³'],
  },
  pl: {
    N1: ['1', '!'], SQT: ['\'', '"'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'], N7: ['7', '&'],
    N9: ['9', '('], N0: ['0', ')'], N8: ['8', '*'], EQUAL: ['=', '+'], COMMA: [',', '<'], MINUS: ['-', '_'],
    DOT: ['.', '>'], FSLH: ['/', '?'], N2: ['2', '@'], N6: ['6', '^'], SEMI: [';', ':'], LBKT: ['[', '{'],
    BSLH: ['\\', '|'], RBKT: [']', '}'], GRAVE: ['`', '~'], A: ['a', 'A', 'ą'], B: ['b', 'B'],
    C: ['c', 'C', 'ć'], D: ['d', 'D'], E: ['e', 'E', 'ę'], F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'],
    I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L', 'ł'], M: ['m', 'M'], N: ['n', 'N', 'ń'],
    O: ['o', 'O', 'ó'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S', 'ś'], T: ['t', 'T'],
    U: ['u', 'U', '€'], V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X', 'ź'], Y: ['y', 'Y'], Z: ['z', 'Z', 'ż'],
  },
  'us-intl': {
    N1: ['1', '!', '¡', '¹'], SQT: ['\'', '"', '´', '¨'], N3: ['3', '#', '³'], N4: ['4', '$', '¤', '£'],
    N5: ['5', '%', '€'], N7: ['7', '&', '½'], N9: ['9', '(', '‘'], N0: ['0', ')', '’'], N8: ['8', '*', '¾'],
    EQUAL: ['=', '+', '×', '÷'], COMMA: [',', '<', 'ç'], MINUS: ['-', '_', '¥'], DOT: ['.', '>'],
    FSLH: ['/', '?', '¿'], N2: ['2', '@', '²'], N6: ['6', '^', '¼'], SEMI: [';', ':', '¶', '°'],
    LBKT: ['[', '{', '«'], BSLH: ['\\', '|', '¬', '¦'], RBKT: [']', '}', '»'], GRAVE: ['`', '~'],
    A: ['a', 'A', 'á'], B: ['b', 'B'], C: ['c', 'C', '©', '¢'], D: ['d', 'D', 'ð'], E: ['e', 'E', 'é'],
    F: ['f', 'F'], G: ['g', 'G'], H: ['h', 'H'], I: ['i', 'I', 'í'], J: ['j', 'J'], K: ['k', 'K'],
    L: ['l', 'L', 'ø'], M: ['m', 'M', 'µ'], N: ['n', 'N', 'ñ'], O: ['o', 'O', 'ó'], P: ['p', 'P', 'ö'],
    Q: ['q', 'Q', 'ä'], R: ['r', 'R', '®'], S: ['s', 'S', 'ß', '§'], T: ['t', 'T', 'þ'], U: ['u', 'U', 'ú'],
    V: ['v', 'V'], W: ['w', 'W', 'å'], X: ['x', 'X'], Y: ['y', 'Y', 'ü'], Z: ['z', 'Z', 'æ'],
  },
  dvorak: {
    N1: ['1', '!'], Q: ['\'', '"'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'], N7: ['7', '&'],
    N9: ['9', '('], N0: ['0', ')'], N8: ['8', '*'], RBKT: ['=', '+'], W: [',', '<'], SQT: ['-', '_'],
    E: ['.', '>'], LBKT: ['/', '?'], N2: ['2', '@'], N6: ['6', '^'], Z: [';', ':'], MINUS: ['[', '{'],
    BSLH: ['\\', '|'], EQUAL: [']', '}'], GRAVE: ['`', '~'], A: ['a', 'A'], N: ['b', 'B'], I: ['c', 'C'],
    H: ['d', 'D'], D: ['e', 'E'], Y: ['f', 'F'], U: ['g', 'G'], J: ['h', 'H'], G: ['i', 'I'], C: ['j', 'J'],
    V: ['k', 'K'], P: ['l', 'L'], M: ['m', 'M'], L: ['n', 'N'], S: ['o', 'O'], R: ['p', 'P'], X: ['q', 'Q'],
    O: ['r', 'R'], SEMI: ['s', 'S'], K: ['t', 'T'], F: ['u', 'U'], DOT: ['v', 'V'], COMMA: ['w', 'W'],
    B: ['x', 'X'], T: ['y', 'Y'], FSLH: ['z', 'Z'],
  },
  colemak: {
    GRAVE: ['`', '~'], N1: ['1', '!'], N2: ['2', '@'], N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'],
    N6: ['6', '^'], N7: ['7', '&'], N8: ['8', '*'], N9: ['9', '('], N0: ['0', ')'], MINUS: ['-', '_'],
    EQUAL: ['=', '+'], LBKT: ['[', '{'], RBKT: [']', '}'], BSLH: ['\\', '|'], SEMI: ['o', 'O'],
    SQT: ['\'', '"'], COMMA: [',', '<'], DOT: ['.', '>'], FSLH: ['/', '?'], NUBS: ['\\', '|'], A: ['a', 'A'],
    B: ['b', 'B'], C: ['c', 'C'], D: ['s', 'S'], E: ['f', 'F'], F: ['t', 'T'], G: ['d', 'D'], H: ['h', 'H'],
    I: ['u', 'U'], J: ['n', 'N'], K: ['e', 'E'], L: ['i', 'I'], M: ['m', 'M'], N: ['k', 'K'], O: ['y', 'Y'],
    P: [';', ':'], Q: ['q', 'Q'], R: ['p', 'P'], S: ['r', 'R'], T: ['g', 'G'], U: ['l', 'L'], V: ['v', 'V'],
    W: ['w', 'W'], X: ['x', 'X'], Y: ['j', 'J'], Z: ['z', 'Z'],
  },
  jp: {
    A: ['a', 'A'], B: ['b', 'B'], C: ['c', 'C'], D: ['d', 'D'], E: ['e', 'E'], F: ['f', 'F'], G: ['g', 'G'],
    H: ['h', 'H'], I: ['i', 'I'], J: ['j', 'J'], K: ['k', 'K'], L: ['l', 'L'], M: ['m', 'M'], N: ['n', 'N'],
    O: ['o', 'O'], P: ['p', 'P'], Q: ['q', 'Q'], R: ['r', 'R'], S: ['s', 'S'], T: ['t', 'T'], U: ['u', 'U'],
    V: ['v', 'V'], W: ['w', 'W'], X: ['x', 'X'], Y: ['y', 'Y'], Z: ['z', 'Z'], N1: ['1', '!'], N2: ['2', '"'],
    N3: ['3', '#'], N4: ['4', '$'], N5: ['5', '%'], N6: ['6', '&'], N7: ['7', '\''], N8: ['8', '('],
    N9: ['9', ')'], N0: ['0'], MINUS: ['-', '='], EQUAL: ['^', '~'], INT3: ['¥', '|'], LBKT: ['@', '`'],
    RBKT: ['[', '{'], BSLH: [']', '}'], SEMI: [';', '+'], SQT: [':', '*'], COMMA: [',', '<'], DOT: ['.', '>'],
    FSLH: ['/', '?'], INT1: ['\\', '_'], GRAVE: ['半/全'],
  },
}

function rowFor(table: Record<string, string[]>, code: string): string[] | undefined {
  return table[code] ?? (code === 'NUHS' ? table.BSLH : code === 'BSLH' ? table.NUHS : undefined)
}

export interface LocaleLegend {
  label: string
  shiftLabel?: string
  altgrLabel?: string
}

/**
 * Keycap legend that a (US-named) ZMK keycode produces when the host OS uses
 * `locale`, e.g. localeLabel('Y', 'de') -> { label: 'Z' },
 * localeLabel('MINUS', 'de') -> { label: 'ß', shiftLabel: '?', altgrLabel: '\\' }.
 * Implicitly shifted codes (EXCL = LS(N1)) give the shifted character.
 * Returns undefined for unknown locales and for keys the table does not cover
 * (non-printing keys), so callers can fall back to the US label.
 */
export function localeLabel(code: string, locale: string): LocaleLegend | undefined {
  const table = LOCALE_TABLES[locale]
  const def = findKeycode(code)
  if (!table || !def) return undefined
  if (def.base) {
    const ch = rowFor(table, def.base)?.[1]
    return ch ? { label: ch } : undefined
  }
  const row = rowFor(table, def.code)
  if (!row || !row[0]) return undefined
  const [plain, shifted, altgr] = row
  const legend: LocaleLegend =
    shifted && plain.toUpperCase() === shifted && plain.toLowerCase() !== shifted
      ? { label: shifted }
      : { label: plain, ...(shifted ? { shiftLabel: shifted } : {}) }
  if (altgr) legend.altgrLabel = altgr
  return legend
}
