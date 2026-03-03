#!/usr/bin/env bash

# Test JSON building
_build_json() {
    local json="{"
    local first=true

    while [[ $# -gt 0 ]]; do
        local key="$1"
        local value="$2"
        shift 2

        if [[ "$first" == "true" ]]; then
            first=false
        else
            json="${json},"
        fi

        # Escape quotes in value
        value="${value//\\/\\\\}"  # escape backslashes first
        value="${value//\"/\\\"}"   # escape quotes

        # Determine if numeric (no quotes) or string (with quotes)
        if [[ "$value" =~ ^-?[0-9]+$ ]] && [[ "$key" != "env_vars" ]]; then
            json="${json}\"$key\":$value"
        else
            json="${json}\"$key\":\"$value\""
        fi
    done

    json="${json}}"
    echo "$json"
}

_build_json current_quest_id 0 inventory "amulet,key"
