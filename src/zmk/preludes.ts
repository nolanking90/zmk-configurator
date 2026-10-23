// Macro definitions for headers commonly included by real-world keymaps, so the
// importer can expand them without the actual files. These are written to be
// behaviourally equivalent to ZMK's macros.dtsi and urob's zmk-helpers.

/** ZMK_MACRO & co from app/dts/behaviors/macros.dtsi (pulled in by behaviors.dtsi). */
export const ZMK_BEHAVIORS_PRELUDE = String.raw`
#define MACRO_PLACEHOLDER 0
#define ZMK_MACRO(name,...) name: name { compatible = "zmk,behavior-macro"; #binding-cells = <0>; __VA_ARGS__ };
#define ZMK_MACRO1(name,...) name: name { compatible = "zmk,behavior-macro-one-param"; #binding-cells = <1>; __VA_ARGS__ };
#define ZMK_MACRO2(name,...) name: name { compatible = "zmk,behavior-macro-two-param"; #binding-cells = <2>; __VA_ARGS__ };
`

/** zmk-helpers/helper.h (https://github.com/urob/zmk-helpers), re-implemented. */
export const ZMK_HELPERS_PRELUDE = String.raw`
#define ZMK_HELPER_STRINGIFY(x) #x
#define VARGS_(_10, _9, _8, _7, _6, _5, _4, _3, _2, _1, N, ...) N
#define VARGS(...) VARGS_(__VA_ARGS__, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0)
#define CONCAT_(a, b) a##b
#define CONCAT(a, b) CONCAT_(a, b)

#define ZMK_BEHAVIOR(name, type, ...) / { behaviors { name: name { ZMK_BEHAVIOR_CORE_ ## type; __VA_ARGS__ }; }; };

#define ZMK_BEHAVIOR_CORE_caps_word       compatible = "zmk,behavior-caps-word";       #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_hold_tap        compatible = "zmk,behavior-hold-tap";        #binding-cells = <2>
#define ZMK_BEHAVIOR_CORE_input_two_axis  compatible = "zmk,behavior-input-two-axis";  #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_key_repeat      compatible = "zmk,behavior-key-repeat";      #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_key_toggle      compatible = "zmk,behavior-key-toggle";      #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_layer_toggle    compatible = "zmk,behavior-layer-toggle";    #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_macro           compatible = "zmk,behavior-macro";           #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_macro_one_param compatible = "zmk,behavior-macro-one-param"; #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_macro_two_param compatible = "zmk,behavior-macro-two-param"; #binding-cells = <2>
#define ZMK_BEHAVIOR_CORE_mod_morph       compatible = "zmk,behavior-mod-morph";       #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_momentary_layer compatible = "zmk,behavior-momentary-layer"; #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_sticky_key      compatible = "zmk,behavior-sticky-key";      #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_tap_dance       compatible = "zmk,behavior-tap-dance";       #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_to_layer        compatible = "zmk,behavior-to-layer";        #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_adaptive_key    compatible = "zmk,behavior-adaptive-key";    #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_auto_layer      compatible = "zmk,behavior-auto-layer";      #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_dynamic_macro   compatible = "zmk,behavior-dynamic-macro";   #binding-cells = <1>
#define ZMK_BEHAVIOR_CORE_tri_state       compatible = "zmk,behavior-tri-state";       #binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_sensor_rotate     compatible = "zmk,behavior-sensor-rotate";     #sensor-binding-cells = <0>
#define ZMK_BEHAVIOR_CORE_sensor_rotate_var compatible = "zmk,behavior-sensor-rotate-var"; #sensor-binding-cells = <2>

#define ZMK_CAPS_WORD(name, ...) ZMK_BEHAVIOR(name, caps_word, __VA_ARGS__)
#define ZMK_HOLD_TAP(name, ...) ZMK_BEHAVIOR(name, hold_tap, __VA_ARGS__)
#define ZMK_INPUT_TWO_AXIS(name, ...) ZMK_BEHAVIOR(name, input_two_axis, __VA_ARGS__)
#define ZMK_KEY_REPEAT(name, ...) ZMK_BEHAVIOR(name, key_repeat, __VA_ARGS__)
#define ZMK_KEY_TOGGLE(name, ...) ZMK_BEHAVIOR(name, key_toggle, __VA_ARGS__)
#define ZMK_LAYER_TOGGLE(name, ...) ZMK_BEHAVIOR(name, layer_toggle, __VA_ARGS__)
#undef ZMK_MACRO
#define ZMK_MACRO(name, ...) ZMK_BEHAVIOR(name, macro, __VA_ARGS__)
#define ZMK_MACRO_ONE_PARAM(name, ...) ZMK_BEHAVIOR(name, macro_one_param, __VA_ARGS__)
#define ZMK_MACRO_TWO_PARAM(name, ...) ZMK_BEHAVIOR(name, macro_two_param, __VA_ARGS__)
#define ZMK_MOD_MORPH(name, ...) ZMK_BEHAVIOR(name, mod_morph, __VA_ARGS__)
#define ZMK_MOMENTARY_LAYER(name, ...) ZMK_BEHAVIOR(name, momentary_layer, __VA_ARGS__)
#define ZMK_STICKY_KEY(name, ...) ZMK_BEHAVIOR(name, sticky_key, __VA_ARGS__)
#define ZMK_TAP_DANCE(name, ...) ZMK_BEHAVIOR(name, tap_dance, __VA_ARGS__)
#define ZMK_TO_LAYER(name, ...) ZMK_BEHAVIOR(name, to_layer, __VA_ARGS__)
#define ZMK_SENSOR_ROTATE(name, ...) ZMK_BEHAVIOR(name, sensor_rotate, __VA_ARGS__)
#define ZMK_SENSOR_ROTATE_VAR(name, ...) ZMK_BEHAVIOR(name, sensor_rotate_var, __VA_ARGS__)
#define ZMK_ADAPTIVE_KEY(name, ...) ZMK_BEHAVIOR(name, adaptive_key, __VA_ARGS__)
#define ZMK_AUTO_LAYER(name, ...) ZMK_BEHAVIOR(name, auto_layer, __VA_ARGS__)
#define ZMK_DYNAMIC_MACRO(name, ...) ZMK_BEHAVIOR(name, dynamic_macro, __VA_ARGS__)
#define ZMK_TRI_STATE(name, ...) ZMK_BEHAVIOR(name, tri_state, __VA_ARGS__)

#define ZMK_LAYER(...) CONCAT(ZMK_LAYER_, VARGS(__VA_ARGS__))(__VA_ARGS__)
#define ZMK_LAYER_2(_name, layout) / { keymap { compatible = "zmk,keymap"; layer_ ## _name { display-name = ZMK_HELPER_STRINGIFY(_name); bindings = <layout>; }; }; };
#define ZMK_LAYER_3(_name, layout, sensors) / { keymap { compatible = "zmk,keymap"; layer_ ## _name { display-name = ZMK_HELPER_STRINGIFY(_name); bindings = <layout>; sensor-bindings = <sensors>; }; }; };

#ifndef COMBO_TERM
#define COMBO_TERM 30
#endif
#define ZMK_COMBO(...) CONCAT(ZMK_COMBO_, VARGS(__VA_ARGS__))(__VA_ARGS__)
#define ZMK_COMBO_3(name, combo_bindings, keypos) / { combos { compatible = "zmk,combos"; combo_ ## name { timeout-ms = <COMBO_TERM>; bindings = <combo_bindings>; key-positions = <keypos>; }; }; };
#define ZMK_COMBO_4(name, combo_bindings, keypos, combo_layers) ZMK_COMBO_5(name, combo_bindings, keypos, combo_layers, COMBO_TERM)
#define ZMK_COMBO_5(name, combo_bindings, keypos, combo_layers, combo_timeout) ZMK_COMBO_6(name, combo_bindings, keypos, combo_layers, combo_timeout, 0)
#define ZMK_COMBO_6(name, combo_bindings, keypos, combo_layers, combo_timeout, combo_idle) ZMK_COMBO_7(name, combo_bindings, keypos, combo_layers, combo_timeout, combo_idle, )
#define ZMK_COMBO_7(name, combo_bindings, keypos, combo_layers, combo_timeout, combo_idle, combo_vaargs) / { combos { compatible = "zmk,combos"; combo_ ## name { timeout-ms = <combo_timeout>; bindings = <combo_bindings>; key-positions = <keypos>; layers = <combo_layers>; require-prior-idle-ms = <combo_idle>; combo_vaargs }; }; };

#define ZMK_LEADER_SEQUENCE(...) CONCAT(ZMK_LEADER_SEQUENCE_, VARGS(__VA_ARGS__))(__VA_ARGS__)
#define ZMK_LEADER_SEQUENCE_3(name, leader_bindings, sequence) / { leader_sequences { compatible = "zmk,leader-sequences"; leader_sequence_ ## name { bindings = <leader_bindings>; key-positions = <sequence>; }; }; };
#define ZMK_LEADER_SEQUENCE_4(name, leader_bindings, sequence, leader_layers) ZMK_LEADER_SEQUENCE_5(name, leader_bindings, sequence, leader_layers, )
#define ZMK_LEADER_SEQUENCE_5(name, leader_bindings, sequence, leader_layers, leader_vaargs) / { leader_sequences { compatible = "zmk,leader-sequences"; leader_sequence_ ## name { bindings = <leader_bindings>; key-positions = <sequence>; layers = <leader_layers>; leader_vaargs }; }; };

#define ZMK_CONDITIONAL_LAYER(name, if_layers, then_layer) / { conditional_layers { compatible = "zmk,conditional-layers"; tri_layer_ ## name { if-layers = <if_layers>; then-layer = <then_layer>; }; }; };
#define ZMK_APPLY_MATRIX_TRANSFORM(transform) / { chosen { zmk,matrix_transform = &transform; }; };
`



