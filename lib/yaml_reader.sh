#!/usr/bin/env bash
# ============================================================================
# Bashcrawl YAML Reader — lib/yaml_reader.sh
#
# Minimal YAML key-value reader for the help data layer.
# No external dependencies (no yq, no python).
#
# Supports:
#   - Simple key: value pairs
#   - Nested keys via dot notation (rooms.entrance.title)
#   - Multi-line block scalars (|)
#   - Sequence items (- item)
#
# Usage:
#   source "${BASHCRAWL_ROOT}/lib/yaml_reader.sh"
#   yaml_get "src/help/data/rooms.yaml" "rooms.entrance.title"
#   yaml_get_block "src/help/data/map.yaml" "map_display"
#   yaml_list "src/help/data/rooms.yaml" "rooms.entrance.teaches"
# ============================================================================

# Guard: only define once per shell
[[ "${_BC_YAML_LOADED:-}" == "true" ]] && return 0
_BC_YAML_LOADED="true"

# ---------------------------------------------------------------------------
# yaml_get <file> <dotted.key>
#
# Returns the scalar value for a dotted key path.
# Example: yaml_get rooms.yaml "rooms.entrance.title"
#          → "THE ENTRANCE HALL"
# ---------------------------------------------------------------------------
yaml_get() {
    local file="$1"
    local key_path="$2"

    # Resolve relative to BASHCRAWL_ROOT if not absolute
    if [[ "$file" != /* ]]; then
        file="${BASHCRAWL_ROOT}/$file"
    fi

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    # Split dotted key into array
    IFS='.' read -ra keys <<< "$key_path"
    local depth=${#keys[@]}

    # Track current indentation level for each key
    local target_indent=0
    local current_key_idx=0
    local found=false

    while IFS= read -r line; do
        # Skip comments and blank lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// /}" ]] && continue

        # Calculate indentation (number of leading spaces)
        local stripped="${line#"${line%%[! ]*}"}"
        local indent=$(( ${#line} - ${#stripped} ))

        # Reset if we've backed out of the current scope
        if [[ $indent -lt $target_indent && $current_key_idx -gt 0 ]]; then
            # Went back above our target depth — no match
            if $found; then
                return 0
            fi
            # Reset search if we backed out above current key level
            local expected_indent=$(( (current_key_idx) * 2 ))
            if [[ $indent -lt $expected_indent ]]; then
                current_key_idx=0
                target_indent=0
            fi
        fi

        # Check if this line matches the current target key
        local target_key="${keys[$current_key_idx]}"
        local expected_indent=$(( current_key_idx * 2 ))

        if [[ $indent -eq $expected_indent ]]; then
            # Check for key match — handle both "key: value" and "key:"
            if [[ "$stripped" =~ ^${target_key}:[[:space:]]*(.*) ]]; then
                local value="${BASH_REMATCH[1]}"
                current_key_idx=$((current_key_idx + 1))
                target_indent=$(( current_key_idx * 2 ))

                # If we've matched all keys, return the value
                if [[ $current_key_idx -eq $depth ]]; then
                    # Strip surrounding quotes if present
                    value="${value#\"}"
                    value="${value%\"}"
                    value="${value#\'}"
                    value="${value%\'}"
                    echo "$value"
                    return 0
                fi
            fi
        fi
    done < "$file"

    return 1
}

# ---------------------------------------------------------------------------
# yaml_get_block <file> <dotted.key>
#
# Returns a multi-line block scalar value (indicated by | in YAML).
# Example: yaml_get_block map.yaml "map_display"
# ---------------------------------------------------------------------------
yaml_get_block() {
    local file="$1"
    local key_path="$2"

    if [[ "$file" != /* ]]; then
        file="${BASHCRAWL_ROOT}/$file"
    fi

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    IFS='.' read -ra keys <<< "$key_path"
    local depth=${#keys[@]}

    local current_key_idx=0
    local in_block=false
    local block_indent=0

    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        local stripped="${line#"${line%%[! ]*}"}"
        local indent=$(( ${#line} - ${#stripped} ))

        if $in_block; then
            # We're reading block content
            if [[ -z "${line// /}" ]]; then
                echo ""
                continue
            fi
            if [[ $indent -ge $block_indent ]]; then
                # Strip the block indentation
                echo "${line:$block_indent}"
            else
                # Block ended
                return 0
            fi
            continue
        fi

        local target_key="${keys[$current_key_idx]}"
        local expected_indent=$(( current_key_idx * 2 ))

        if [[ $indent -eq $expected_indent ]]; then
            if [[ "$stripped" =~ ^${target_key}:[[:space:]]*(.*) ]]; then
                local value="${BASH_REMATCH[1]}"
                current_key_idx=$((current_key_idx + 1))

                if [[ $current_key_idx -eq $depth ]]; then
                    if [[ "$value" == "|" || "$value" == "|+" || "$value" == "|-" ]]; then
                        in_block=true
                        block_indent=$(( current_key_idx * 2 ))
                    else
                        echo "$value"
                        return 0
                    fi
                fi
            fi
        fi
    done < "$file"

    $in_block && return 0
    return 1
}

# ---------------------------------------------------------------------------
# yaml_list <file> <dotted.key>
#
# Returns sequence items (one per line) for a key containing a YAML list.
# Example: yaml_list rooms.yaml "rooms.entrance.teaches"
#          → "Basic navigation (cd, ls, pwd)"
#            "Reading files with cat"
# ---------------------------------------------------------------------------
yaml_list() {
    local file="$1"
    local key_path="$2"

    if [[ "$file" != /* ]]; then
        file="${BASHCRAWL_ROOT}/$file"
    fi

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    IFS='.' read -ra keys <<< "$key_path"
    local depth=${#keys[@]}

    local current_key_idx=0
    local in_list=false
    local list_indent=0

    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// /}" ]] && continue

        local stripped="${line#"${line%%[! ]*}"}"
        local indent=$(( ${#line} - ${#stripped} ))

        if $in_list; then
            if [[ $indent -lt $list_indent ]]; then
                return 0
            fi
            if [[ "$stripped" =~ ^-[[:space:]]+(.*) ]]; then
                local item="${BASH_REMATCH[1]}"
                # Strip quotes
                item="${item#\"}"
                item="${item%\"}"
                item="${item#\'}"
                item="${item%\'}"
                echo "$item"
            fi
            continue
        fi

        local target_key="${keys[$current_key_idx]}"
        local expected_indent=$(( current_key_idx * 2 ))

        if [[ $indent -eq $expected_indent ]]; then
            if [[ "$stripped" =~ ^${target_key}:[[:space:]]*(.*) ]]; then
                current_key_idx=$((current_key_idx + 1))

                if [[ $current_key_idx -eq $depth ]]; then
                    in_list=true
                    list_indent=$(( current_key_idx * 2 ))
                fi
            fi
        fi
    done < "$file"

    return 0
}

# ---------------------------------------------------------------------------
# yaml_keys <file> <dotted.key>
#
# Returns the sub-keys under a given key path (one per line).
# Example: yaml_keys rooms.yaml "rooms"
#          → entrance
#            cellar
#            armoury
#            ...
# ---------------------------------------------------------------------------
yaml_keys() {
    local file="$1"
    local key_path="$2"

    if [[ "$file" != /* ]]; then
        file="${BASHCRAWL_ROOT}/$file"
    fi

    if [[ ! -f "$file" ]]; then
        return 1
    fi

    IFS='.' read -ra keys <<< "$key_path"
    local depth=${#keys[@]}

    local current_key_idx=0
    local in_section=false
    local section_indent=0

    while IFS= read -r line; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// /}" ]] && continue

        local stripped="${line#"${line%%[! ]*}"}"
        local indent=$(( ${#line} - ${#stripped} ))

        if $in_section; then
            if [[ $indent -lt $section_indent ]]; then
                return 0
            fi
            if [[ $indent -eq $section_indent ]] && [[ "$stripped" =~ ^([a-zA-Z0-9_-]+): ]]; then
                echo "${BASH_REMATCH[1]}"
            fi
            continue
        fi

        local target_key="${keys[$current_key_idx]}"
        local expected_indent=$(( current_key_idx * 2 ))

        if [[ $indent -eq $expected_indent ]]; then
            if [[ "$stripped" =~ ^${target_key}:[[:space:]]*(.*) ]]; then
                current_key_idx=$((current_key_idx + 1))

                if [[ $current_key_idx -eq $depth ]]; then
                    in_section=true
                    section_indent=$(( current_key_idx * 2 ))
                fi
            fi
        fi
    done < "$file"

    return 0
}
