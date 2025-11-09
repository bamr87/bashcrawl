#!/usr/bin/env bash
#
# Bashcrawl Refactoring Cleanup Script
# Archives old launcher files and cleans up the root directory
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/.legacy_launchers"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🗂️  Bashcrawl Refactoring Cleanup"
echo "─────────────────────────────────────────────────────────────────────"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📦 Archiving legacy launcher files..."

# Files to archive
legacy_files=(
    "start-adventure.sh"
    "demo-terminal.sh"
    "help.sh"
)

# Archive each legacy file
for file in "${legacy_files[@]}"; do
    if [[ -f "${SCRIPT_DIR}/$file" ]]; then
        echo "   📄 Archiving $file"
        mv "${SCRIPT_DIR}/$file" "${BACKUP_DIR}/${file}.${TIMESTAMP}"
    else
        echo "   ⚠️  $file not found (already moved?)"
    fi
done

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "📋 Summary:"
echo "   • Legacy files archived to: $BACKUP_DIR"
echo "   • New main launcher: ./main.sh"
echo "   • Updated setup script: ./setup.sh"
echo ""
echo "🚀 Next steps:"
echo "   1. Run './setup.sh' to initialize the new system"
echo "   2. Launch with './main.sh' to start your adventure"
echo ""
echo "🔧 To restore legacy files if needed:"
echo "   mv $BACKUP_DIR/*.${TIMESTAMP} ."
echo ""
