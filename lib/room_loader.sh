#!/usr/bin/env bash
# ============================================================================
# Bashcrawl Room/Encounter/Item Loader — lib/room_loader.sh
#
# Parses YAML registry files (rooms.yaml, encounters.yaml, items.yaml,
# quests.yaml) into shell variables so the UI and engine layers can look
# up room metadata, encounter info, and item icons without hardcoded case
# statements.
#
# Bash 3.2 compatible — uses _REG_<type>_<key>_<field> variables instead
# of associative arrays (which require bash 4+).
#
# Expects BASHCRAWL_ROOT to be set before sourcing.
# ============================================================================

[[ "${_BC_ROOM_LOADER_LOADED:-}" == "$$" ]] && return 0
_BC_ROOM_LOADER_LOADED="$$"

_REGISTRY_LOADED=false
_DATA_DIR="${BASHCRAWL_ROOT}/src/help/data"

# Quest IDs array (populated by loader)
QUEST_IDS=()

# ============================================================================
# Python-based YAML loader (preferred — handles all YAML correctly)
# ============================================================================

_load_via_python() {
    local py_script
    py_script=$(cat <<'PYEOF'
import sys, yaml, os, re

data_dir = sys.argv[1]

def load(name):
    path = os.path.join(data_dir, name)
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return yaml.safe_load(f) or {}

def safe_key(s):
    """Convert a room/item name to a valid shell variable fragment."""
    return re.sub(r'[^A-Za-z0-9_]', '_', str(s))

def q(s):
    """Quote a value for shell — escape single quotes."""
    if s is None:
        return ""
    return str(s).replace("'", "'\\''")

# ── Rooms ──────────────────────────────────────────────────────────────
rooms = load("rooms.yaml")
for name, info in rooms.get("rooms", {}).items():
    k = safe_key(name)
    print(f"_REG_ROOM_{k}_emoji='{q(info.get('emoji',''))}'")
    print(f"_REG_ROOM_{k}_title='{q(info.get('title', name))}'")
    print(f"_REG_ROOM_{k}_label='{q(info.get('prompt_label','exploring'))}'")
    print(f"_REG_ROOM_{k}_hint='{q(info.get('context_hint',''))}'")
    print(f"_REG_ROOM_{k}_path='{q(info.get('path',''))}'")
    print(f"_REG_ROOM_{k}_hidden='{q(info.get('hidden', False))}'")
    print(f"_REG_ROOM_{k}_unlocked_by='{q(info.get('unlocked_by',''))}'")
    print(f"_REG_ROOM_{k}_parent='{q(info.get('parent',''))}'")
    on_enter = info.get('on_enter') or ''
    on_exit = info.get('on_exit') or ''
    print(f"_REG_ROOM_{k}_on_enter='{q(on_enter)}'")
    print(f"_REG_ROOM_{k}_on_exit='{q(on_exit)}'")

# ── Encounters ─────────────────────────────────────────────────────────
enc = load("encounters.yaml")
enc_keys = []
for key, info in enc.get("encounters", {}).items():
    k = safe_key(key)
    enc_keys.append(k)
    print(f"_REG_ENC_{k}_script='{q(info.get('script',''))}'")
    print(f"_REG_ENC_{k}_room='{q(info.get('room',''))}'")
    print(f"_REG_ENC_{k}_type='{q(info.get('type',''))}'")
    print(f"_REG_ENC_{k}_desc='{q(info.get('description',''))}'")
    print(f"_REG_ENC_{k}_icon='{q(info.get('icon','⚡'))}'")
    req = ','.join(info.get('requires_items', []))
    rec = ','.join(info.get('recommended_items', []))
    gra = ','.join(info.get('grants_items', []))
    unl = ','.join(info.get('unlocks_rooms', []))
    print(f"_REG_ENC_{k}_requires='{q(req)}'")
    print(f"_REG_ENC_{k}_recommends='{q(rec)}'")
    print(f"_REG_ENC_{k}_grants='{q(gra)}'")
    print(f"_REG_ENC_{k}_unlocks='{q(unl)}'")
    print(f"_REG_ENC_{k}_damage='{q(info.get('damage', 0))}'")
print(f"_REG_ENC_KEYS='{' '.join(enc_keys)}'")

# ── Items ──────────────────────────────────────────────────────────────
items = load("items.yaml")
for name, info in items.get("items", {}).items():
    k = safe_key(name)
    print(f"_REG_ITEM_{k}_icon='{q(info.get('icon','✦'))}'")
    print(f"_REG_ITEM_{k}_type='{q(info.get('type',''))}'")
    print(f"_REG_ITEM_{k}_bonus='{q(info.get('combat_bonus', 0))}'")
    print(f"_REG_ITEM_{k}_desc='{q(info.get('description',''))}'")

# ── Quests ─────────────────────────────────────────────────────────────
quests = load("quests.yaml")
ids = []
for qdata in quests.get("quests", []):
    qid = str(qdata["id"])
    ids.append(qid)
    print(f"_REG_QUEST_{qid}_title='{q(qdata.get('title',''))}'")
    print(f"_REG_QUEST_{qid}_obj='{q(qdata.get('objective',''))}'")
    print(f"_REG_QUEST_{qid}_hint='{q(qdata.get('hint',''))}'")
    rn = qdata.get('reward_name', qdata.get('reward',''))
    print(f"_REG_QUEST_{qid}_reward='{q(rn)}'")
    print(f"_REG_QUEST_{qid}_xp='{q(qdata.get('xp', 0))}'")
    cmds = ','.join(qdata.get('required_commands', []))
    print(f"_REG_QUEST_{qid}_cmds='{q(cmds)}'")
    comp = qdata.get('completion', {}) or {}
    print(f"_REG_QUEST_{qid}_comp_cmd='{q(comp.get('command',''))}'")
    print(f"_REG_QUEST_{qid}_comp_loc='{q(comp.get('location',''))}'")
    print(f"_REG_QUEST_{qid}_comp_args='{q(comp.get('args',''))}'")
    print(f"_REG_QUEST_{qid}_comp_item='{q(comp.get('item_check',''))}'")
    nq = qdata.get('next_quest')
    print(f"_REG_QUEST_{qid}_next='{q(nq if nq is not None else '')}'")
    print(f"_REG_QUEST_{qid}_prereq='{q(qdata.get('prerequisites',''))}'")

print(f"QUEST_IDS=({' '.join(ids)})")

# Room name list for iteration
room_names = list(rooms.get("rooms", {}).keys())
print(f"_REG_ROOM_NAMES='{' '.join(safe_key(n) for n in room_names)}'")
PYEOF
)
    local output
    output=$(python3 -c "$py_script" "$_DATA_DIR" 2>/dev/null) || return 1
    eval "$output"
    return 0
}

# ============================================================================
# Fallback loader (no python3/pyyaml — uses hardcoded defaults)
# ============================================================================

_load_fallback() {
    # Minimal hardcoded defaults for critical rooms so the game still works
    _REG_ROOM_bashcrawl_emoji="🏠"; _REG_ROOM_bashcrawl_label="lobby"; _REG_ROOM_bashcrawl_hint="You are in the main lobby. Type 'cd entrance' to begin your adventure."
    _REG_ROOM_entrance_emoji="🚪"; _REG_ROOM_entrance_label="starting hall"; _REG_ROOM_entrance_hint="You stand at the entrance to the catacombs. Read the 'scroll' for guidance."
    _REG_ROOM_cellar_emoji="🏰"; _REG_ROOM_cellar_label="underground"; _REG_ROOM_cellar_hint="You are in the underground cellar. Use ls -F to distinguish file types."
    _REG_ROOM_armoury_emoji="🗡️"; _REG_ROOM_armoury_label="weapons hall"; _REG_ROOM_armoury_hint="You have entered the armoury. Master chmod and ./script for combat!"
    _REG_ROOM_chamber_emoji="💎"; _REG_ROOM_chamber_label="treasure room"; _REG_ROOM_chamber_hint="The treasure chamber! Run ./treasure, ./statue, or ./spell for rewards."
    _REG_ROOM_chapel_emoji="⛪"; _REG_ROOM_chapel_label="hidden sanctuary"; _REG_ROOM_chapel_hint="Chapel path: Discover hidden commands and the ancient library tome."
    _REG_ROOM_unknown_emoji="🗺️"; _REG_ROOM_unknown_label="exploring"; _REG_ROOM_unknown_hint=""

    _REG_ITEM_sword_icon="🗡️"; _REG_ITEM_amulet_icon="📿"; _REG_ITEM_coins_icon="🪙"
    _REG_ITEM_diamonds_icon="💎"; _REG_ITEM_goblet_icon="🏆"; _REG_ITEM_crystal_icon="🔮"

    _REG_ENC_KEYS=""
    return 0
}

# ============================================================================
# Public API — accessor functions (bash 3.2 compatible via eval)
# ============================================================================

load_registries() {
    [[ "$_REGISTRY_LOADED" == true ]] && return 0

    if [[ ! -d "$_DATA_DIR" ]]; then
        _load_fallback
        _REGISTRY_LOADED=true
        return 0
    fi

    if command -v python3 &>/dev/null && python3 -c "import yaml" 2>/dev/null; then
        _load_via_python || _load_fallback
    else
        _load_fallback
    fi

    _REGISTRY_LOADED=true
    return 0
}

_reg_get() {
    local var_name="$1"
    eval "echo \"\${${var_name}:-}\""
}

room_emoji() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    local val
    val=$(_reg_get "_REG_ROOM_${key}_emoji")
    echo "${val:-$(_reg_get '_REG_ROOM_unknown_emoji')}"
}

room_label() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    local val
    val=$(_reg_get "_REG_ROOM_${key}_label")
    echo "${val:-$(_reg_get '_REG_ROOM_unknown_label')}"
}

room_hint() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    _reg_get "_REG_ROOM_${key}_hint"
}

room_on_enter() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    _reg_get "_REG_ROOM_${key}_on_enter"
}

room_on_exit() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    _reg_get "_REG_ROOM_${key}_on_exit"
}

room_path() {
    local dir="$1"
    local key
    key=$(echo "$dir" | sed 's/[^A-Za-z0-9_]/_/g')
    _reg_get "_REG_ROOM_${key}_path"
}

item_icon() {
    local name="$1"
    local key
    key=$(echo "$name" | sed 's/[^A-Za-z0-9_]/_/g')
    local val
    val=$(_reg_get "_REG_ITEM_${key}_icon")
    echo "${val:-✦}"
}

# Look up encounter info by script name + room
enc_lookup_by_script() {
    local script="$1"
    local room="$2"
    local enc_key enc_script enc_room
    for enc_key in $_REG_ENC_KEYS; do
        enc_script=$(_reg_get "_REG_ENC_${enc_key}_script")
        enc_room=$(_reg_get "_REG_ENC_${enc_key}_room")
        if [[ "$enc_script" == "$script" && "$enc_room" == "$room" ]]; then
            echo "$enc_key"
            return 0
        fi
    done
    # Fallback: match script name only
    for enc_key in $_REG_ENC_KEYS; do
        enc_script=$(_reg_get "_REG_ENC_${enc_key}_script")
        if [[ "$enc_script" == "$script" ]]; then
            echo "$enc_key"
            return 0
        fi
    done
    return 1
}

enc_icon() {
    local key="$1"
    local val
    val=$(_reg_get "_REG_ENC_${key}_icon")
    echo "${val:-⚡}"
}

enc_desc() {
    local key="$1"
    local val
    val=$(_reg_get "_REG_ENC_${key}_desc")
    echo "${val:-Interactive element}"
}

enc_type() {
    local key="$1"
    _reg_get "_REG_ENC_${key}_type"
}

# Quest accessors for the generic evaluator in quests.sh
quest_comp_cmd() { _reg_get "_REG_QUEST_${1}_comp_cmd"; }
quest_comp_loc() { _reg_get "_REG_QUEST_${1}_comp_loc"; }
quest_comp_args() { _reg_get "_REG_QUEST_${1}_comp_args"; }
quest_comp_item() { _reg_get "_REG_QUEST_${1}_comp_item"; }
