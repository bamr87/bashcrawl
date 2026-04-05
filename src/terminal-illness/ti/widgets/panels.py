"""Sidebar panel widgets used by the Textual app."""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from textual.widgets import Static

if TYPE_CHECKING:
    from ..game_state import GameState


class QuestPanel(Static):
    """Left sidebar: active quest + XP progress."""

    def refresh_quest(self, state: "GameState") -> None:
        from ..quests import quest_list

        quests = quest_list()
        total = len(quests)
        done = len(state.completed_quest_ids)
        xp = state.experience_points

        header = (
            f"[bold white on #1e1e3f] 📜 ACTIVE QUEST [/bold white on #1e1e3f]  "
            f"[dim]XP:{xp}  ✅{done}/{total}[/dim]"
        )
        divider = f"[dim]{'─' * 26}[/dim]"

        if state.current_quest_id >= total:
            body = "[bold green]✨ All quests complete![/bold green]\n\n[dim]Explore freely…[/dim]"
        else:
            q = quests[state.current_quest_id]
            body = (
                f"[bold yellow]{q.title}[/bold yellow]\n\n"
                f"[dim]{q.objective}[/dim]"
            )

        self.update(f"{header}\n{divider}\n{body}")


class InventoryPanel(Static):
    """Left sidebar: health bar + inventory items."""

    def refresh_inventory(self, state: "GameState") -> None:
        hp = state.hp
        inv = state.inventory

        if hp > 0:
            filled = max(0, min(10, hp // 10))
            bar = "█" * filled + "░" * (10 - filled)
            hp_color = "green" if hp > 50 else "yellow" if hp > 20 else "red"
            hp_text = f"[{hp_color}]{bar}[/{hp_color}] [dim]{hp}/100[/dim]"
        else:
            hp_text = "[dim]─────────── 0/100[/dim]"

        if inv:
            items_lines = "\n".join(f"  [green]◆[/green] {i.strip()}" for i in inv.split(",") if i.strip())
        else:
            items_lines = "  [dim](empty)[/dim]"

        header = "[bold white on #1e1e3f] 🎒 INVENTORY [/bold white on #1e1e3f]"
        divider = f"[dim]{'─' * 26}[/dim]"
        self.update(f"{header}\n{divider}\n[dim]HP:[/dim] {hp_text}\n\n[dim]Items:[/dim]\n{items_lines}")


class RoomPanel(Static):
    """Left sidebar: current location + directory listing."""

    def refresh_room(self, cwd: str, items: List[str]) -> None:
        lines: List[str] = []
        for item in items[:22]:
            if item.endswith("/"):
                lines.append(f"  [bold blue]📁 {item}[/bold blue]")
            elif item.endswith("*"):
                lines.append(f"  [bold green]⚡ {item}[/bold green]")
            else:
                lines.append(f"  [white]📄 {item}[/white]")

        content = "\n".join(lines) if lines else "  [dim](empty)[/dim]"
        header = "[bold white on #1e1e3f] 🗺️ LOCATION [/bold white on #1e1e3f]"
        divider = f"[dim]{'─' * 26}[/dim]"
        self.update(f"{header}\n{divider}\n[bold cyan]{cwd}[/bold cyan]\n\n{content}")
