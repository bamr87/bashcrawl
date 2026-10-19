// One-line syntax reminders (command → [syntax, note]) for the inline hint
// under the prompt and the concept spotlight.
export const SYNTAX_HINTS: Record<string, [string, string]> = {
    pwd: ["pwd", "print the full path of where you stand"],
    ls: ["ls [-F|-la|-a] [dir]", "-F marks types · -a shows dotfiles · -la long form"],
    cd: ["cd <dir> · cd .. · cd -", "descend · go up · jump to previous room"],
    cat: ["cat <file>", "print a whole file"],
    less: ["less <file>", "page through a file"],
    head: ["head [-n N] <file>", "first N lines (default 10)"],
    tail: ["tail [-n N] <file>", "last N lines (default 10)"],
    wc: ["wc [-l] <file>", "count lines / words / characters"],
    grep: ["grep [-rilnvc] PATTERN [file...]", "-r search tree · -i any case · -l names only · -c count"],
    find: ["find <dir> -name \"GLOB\" [-type f|d]", "quote the glob so the shell doesn't eat it"],
    sort: ["sort [-r|-n|-u] <file>", "-r reverse · -n numeric · -u unique"],
    uniq: ["uniq [-c|-d]", "adjacent dupes — sort first! -c counts"],
    cut: ["cut -d DELIM -f LIST", "or cut -c LIST for characters"],
    tr: ["tr SET1 SET2 · tr -d SET", "translate or delete characters (pipe into it)"],
    sed: ["sed 's/old/new/g' [file]", "replace text on every line"],
    nl: ["nl <file>", "number lines"],
    rev: ["rev <file>", "mirror each line"],
    mkdir: ["mkdir <name>", "conjure a new room"],
    touch: ["touch <name>", "create an empty file"],
    cp: ["cp <src> <dest>", "duplicate a file"],
    mv: ["mv <src> <dest>", "move or rename"],
    rm: ["rm <file>", "destroy a file (no undo!)"],
    chmod: ["chmod +x <file>", "make a file executable"],
    echo: ["echo $VAR · echo text", "print text or a variable's value"],
    export: ["export NAME=value", "set a variable for later commands"],
    let: ["let \"HP=HP-5\"", "shell arithmetic"],
    env: ["env", "list every environment variable"],
    man: ["man <command>", "read a command's manual"],
    tree: ["tree [dir]", "draw the directory layout"],
    history: ["history", "your past incantations"],
    ln: ["ln -s TARGET NAME", "forge a symbolic link"],
    alias: ["alias name='command'", "shorthand for a longer spell"],
};

export function hintFor(line: string): [string, string] | null {
    const value = line.trimStart();
    const base = value.split(/\s+/)[0];
    const hint = base ? SYNTAX_HINTS[base] : undefined;
    return hint && value.length >= base.length ? hint : null;
}
