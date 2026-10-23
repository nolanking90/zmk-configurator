#!/usr/bin/env bash
# Build ZMK firmware for a generated zmk-config repo inside the official ZMK
# Docker build image, following ZMK's documented local build process:
#   west init -l config && west update && west zephyr-export
#   west build -s zmk/app -b <board> -- -DSHIELD=<shield> -DZMK_CONFIG=<config>
#
# Usage:
#   scripts/verify-build.sh <generated-config-dir> <board> [shield] [-- extra cmake args]
#   scripts/verify-build.sh <generated-config-dir> --all
#
# --all builds every target listed in the repo's build.yaml (board, shield,
# snippet and cmake-args are honoured), like the GitHub Actions workflow does.
#
# <generated-config-dir> is the root of a zmk-config repo (it must contain
# config/west.yml). The west workspace (zmk + zephyr + modules, ~2-3 GB) is
# cached per ZMK revision under $ZMK_WS (default ~/.cache/zmk-configurator/ws)
# so only the first run downloads anything.
#
# Environment:
#   ZMK_WS        workspace cache dir
#   ZMK_IMAGE     docker image (default: zephyr 3.5 image for v0.3*, else :stable)
#   SNIPPET       zephyr snippet to apply, e.g. studio-rpc-usb-uart
#   ZMK_BUILD_OUT where to copy the resulting zmk.uf2 (default <config-dir>/build)
#
# Examples:
#   scripts/verify-build.sh out/my-config nice_nano_v2 corne_left
#   SNIPPET=studio-rpc-usb-uart scripts/verify-build.sh out/my-config nice_nano_v2 corne_left -- -DCONFIG_ZMK_STUDIO=y
#   scripts/verify-build.sh out/my-config glove80_lh
set -euo pipefail

if [[ $# -lt 2 ]]; then
  sed -n '2,30p' "$0"; exit 2
fi

if [[ $2 == "--all" ]]; then
  CFG=$1
  [[ -f $CFG/build.yaml ]] || { echo "error: $CFG/build.yaml not found" >&2; exit 2; }
  # minimal parser for the flat `include:` list ZMK's build.yaml uses
  mapfile -t ENTRIES < <(awk '
    /^[[:space:]]*-[[:space:]]*board:/ { if (b != "") print b "|" sh "|" sn "|" ca; b=$NF; sh=""; sn=""; ca=""; next }
    /^[[:space:]]*shield:/ { sh=$2 }
    /^[[:space:]]*snippet:/ { sn=$2 }
    /^[[:space:]]*cmake-args:/ { sub(/^[[:space:]]*cmake-args:[[:space:]]*/, ""); ca=$0 }
    END { if (b != "") print b "|" sh "|" sn "|" ca }' "$CFG/build.yaml")
  rc=0
  for e in "${ENTRIES[@]}"; do
    IFS='|' read -r b sh sn ca <<<"$e"
    echo "=== building $b ${sh:+($sh)} ${sn:+snippet=$sn} $ca"
    # shellcheck disable=SC2086
    SNIPPET=$sn "$0" "$CFG" "$b" $sh -- $ca || rc=1
  done
  exit $rc
fi

CFG_DIR=$(cd "$1" && pwd); shift
BOARD=$1; shift
SHIELD=""
if [[ $# -gt 0 && $1 != "--" ]]; then SHIELD=$1; shift; fi
[[ ${1:-} == "--" ]] && shift
EXTRA_ARGS=("$@")

MANIFEST="$CFG_DIR/config/west.yml"
[[ -f $MANIFEST ]] || { echo "error: $MANIFEST not found" >&2; exit 2; }

# revision of the zmk project in west.yml
REV=$(awk '/name: *zmk *$/{f=1} f && /revision:/{print $2; exit}' "$MANIFEST")
REV=${REV:-main}
case $REV in
  v0.1*|v0.2*|v0.3*) DEFAULT_IMAGE=zmkfirmware/zmk-build-arm:3.5 ;;
  *) DEFAULT_IMAGE=zmkfirmware/zmk-build-arm:stable ;;
esac
IMAGE=${ZMK_IMAGE:-$DEFAULT_IMAGE}

WS_ROOT=${ZMK_WS:-$HOME/.cache/zmk-configurator/ws}
WS="$WS_ROOT/$(echo "$REV" | tr '/:' '__')"
mkdir -p "$WS/config"
OUT=${ZMK_BUILD_OUT:-$CFG_DIR/build}
mkdir -p "$OUT"

NAME="${BOARD}${SHIELD:+-$SHIELD}"
CMAKE_ARGS=(-DZMK_CONFIG=/zmk-config/config)
[[ -n $SHIELD ]] && CMAKE_ARGS+=("-DSHIELD=$SHIELD")
CMAKE_ARGS+=("${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}")
SNIPPET_ARGS=""
[[ -n ${SNIPPET:-} ]] && SNIPPET_ARGS="-S $SNIPPET"

# Workspace manifest = the generated west.yml (same remotes/revision as CI).
if ! cmp -s "$MANIFEST" "$WS/config/west.yml"; then
  cp "$MANIFEST" "$WS/config/west.yml"
  rm -f "$WS/.updated"
fi

printf -v CMAKE_Q '%q ' "${CMAKE_ARGS[@]}"

docker run --rm \
  --user "$(id -u):$(id -g)" -e HOME=/tmp/home \
  -v "$WS:/ws" -v "$CFG_DIR:/zmk-config:ro" -v "$OUT:/out" \
  -w /ws "$IMAGE" bash -euo pipefail -c "
    mkdir -p /tmp/home
    git config --global --add safe.directory '*'
    [[ -d .west ]] || west init -l config
    if [[ ! -f .updated ]]; then west update --narrow --fetch-opt=--filter=tree:0 && touch .updated; fi
    west zephyr-export >/dev/null
    west build -p -s zmk/app -d build/$NAME -b $BOARD $SNIPPET_ARGS -- $CMAKE_Q
    cp build/$NAME/zephyr/zmk.uf2 /out/$NAME.uf2 2>/dev/null || cp build/$NAME/zephyr/zmk.hex /out/$NAME.hex
    echo \"OK: /out/$NAME firmware built\"
  "
echo "Firmware written to $OUT/"
