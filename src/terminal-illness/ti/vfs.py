from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class FileNode:
    name: str
    content: str = ""


@dataclass
class DirNode:
    name: str
    children: Dict[str, "DirEntry"] = field(default_factory=dict)


DirEntry = DirNode | FileNode


class VirtualFileSystem:
    def __init__(self) -> None:
        self.root = DirNode(name="/")
        self._seed()

    def _seed(self) -> None:
        self.mkdir("/home")
        self.mkdir("/home/hero")
        self.touch("/home/hero/readme.txt", "Welcome to Terminal Illness! Use 'help' to see commands.")
        self.mkdir("/dungeon")
        self.mkdir("/forest")
        self.touch("/forest/scroll.txt", "Whispers: The 'pwd' spell reveals your place in the realm.")

    # Path helpers
    def _split(self, path: str) -> List[str]:
        if path == "/":
            return []
        return [p for p in path.strip("/").split("/") if p]

    def _resolve(self, cwd: str, path: str) -> Tuple[DirNode, str]:
        if path.startswith("/"):
            parts = self._split(path)
        else:
            parts = self._split(cwd) + self._split(path)

        stack: List[str] = []
        for part in parts:
            if part == ".":
                continue
            if part == "..":
                if stack:
                    stack.pop()
                continue
            stack.append(part)
        node: DirNode = self.root
        for idx, segment in enumerate(stack):
            entry = node.children.get(segment)
            if entry is None or isinstance(entry, FileNode):
                if idx < len(stack):
                    # Return parent dir and remaining tail
                    return node, "/" + "/".join(stack[idx:])
            node = entry  # type: ignore[assignment]
        return node, "/"

    def _traverse(self, path: str) -> Optional[DirEntry]:
        if path == "/":
            return self.root
        node: DirNode = self.root
        for segment in self._split(path):
            entry = node.children.get(segment)
            if entry is None:
                return None
            if isinstance(entry, FileNode):
                if segment == self._split(path)[-1]:
                    return entry
                return None
            node = entry
        return node

    # Operations
    def ls(self, cwd: str, path: Optional[str] = None) -> List[str]:
        target_path = path or cwd
        entry = self._traverse(self.abspath(cwd, target_path))
        if entry is None:
            raise FileNotFoundError(target_path)
        if isinstance(entry, FileNode):
            return [entry.name]
        return sorted(entry.children.keys())

    def mkdir(self, path: str) -> None:
        parent_path, name = self.dirname_basename(path)
        parent = self._traverse(parent_path)
        if not isinstance(parent, DirNode):
            raise FileNotFoundError(parent_path)
        if name in parent.children:
            return
        parent.children[name] = DirNode(name=name)

    def touch(self, path: str, content: str | None = None) -> None:
        parent_path, name = self.dirname_basename(path)
        parent = self._traverse(parent_path)
        if not isinstance(parent, DirNode):
            raise FileNotFoundError(parent_path)
        existing = parent.children.get(name)
        if isinstance(existing, FileNode):
            if content is not None:
                existing.content = content
            return
        parent.children[name] = FileNode(name=name, content=content or "")

    def read_file(self, cwd: str, path: str) -> str:
        entry = self._traverse(self.abspath(cwd, path))
        if not isinstance(entry, FileNode):
            raise FileNotFoundError(path)
        return entry.content

    def write_file(self, cwd: str, path: str, content: str) -> None:
        entry = self._traverse(self.abspath(cwd, path))
        if not isinstance(entry, FileNode):
            raise FileNotFoundError(path)
        entry.content = content

    def cd(self, cwd: str, path: str) -> str:
        abspath = self.abspath(cwd, path)
        entry = self._traverse(abspath)
        if not isinstance(entry, DirNode):
            raise NotADirectoryError(path)
        return abspath

    def abspath(self, cwd: str, path: str) -> str:
        if path.startswith("/"):
            base_parts: List[str] = []
        else:
            base_parts = self._split(cwd)
        parts = base_parts + self._split(path)
        stack: List[str] = []
        for part in parts:
            if part in ("", "."):
                continue
            if part == "..":
                if stack:
                    stack.pop()
                continue
            stack.append(part)
        return "/" + "/".join(stack)

    def dirname_basename(self, path: str) -> tuple[str, str]:
        parts = self._split(path)
        if not parts:
            return "/", ""
        return "/" + "/".join(parts[:-1]) if len(parts) > 1 else "/", parts[-1]

    def match_paths(self, cwd: str, prefix: str) -> List[str]:
        # For autocompletion
        base_dir_path, partial = self.dirname_basename(self.abspath(cwd, prefix))
        base_dir = self._traverse(base_dir_path)
        if not isinstance(base_dir, DirNode):
            return []
        return [name for name in base_dir.children.keys() if name.startswith(partial)]

