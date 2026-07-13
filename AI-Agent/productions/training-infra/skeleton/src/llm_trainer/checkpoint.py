"""Checkpoint saving, resuming, and artifact upload."""

import shutil
import threading
from pathlib import Path
from typing import Any

import torch

from llm_trainer.config import CheckpointConfig
from llm_trainer.tracking import WandbTracker


class CheckpointManager:
    """Manage local checkpoints and optional Wandb artifact uploads."""

    def __init__(self, config: CheckpointConfig, tracker: WandbTracker):
        self.config = config
        self.tracker = tracker
        self.save_dir = Path(config.save_dir)
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self._upload_threads: list[threading.Thread] = []

    def save(
        self,
        step: int,
        model: torch.nn.Module,
        optimizer: torch.optim.Optimizer,
        scheduler: Any,
        epoch: int | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> Path:
        """Save checkpoint to local disk."""
        checkpoint_name = f"checkpoint-step-{step}"
        if epoch is not None:
            checkpoint_name = f"checkpoint-epoch-{epoch}-step-{step}"

        checkpoint_path = self.save_dir / checkpoint_name
        checkpoint_path.mkdir(parents=True, exist_ok=True)

        state = {
            "step": step,
            "epoch": epoch,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict(),
            "metrics": metrics or {},
        }

        torch.save(state, checkpoint_path / "pytorch_model.bin")

        # Keep only the most recent N checkpoints
        self._cleanup_old_checkpoints()

        if self.config.upload_to_wandb:
            if self.config.async_upload:
                self._upload_async(checkpoint_name, checkpoint_path)
            else:
                self.tracker.log_model_artifact(
                    name=checkpoint_name,
                    path=checkpoint_path,
                    aliases=["latest"],
                    metadata={"step": step, "epoch": epoch, **(metrics or {})},
                )

        return checkpoint_path

    def _cleanup_old_checkpoints(self) -> None:
        checkpoints = sorted(
            [p for p in self.save_dir.iterdir() if p.is_dir() and p.name.startswith("checkpoint-")],
            key=lambda p: p.stat().st_mtime,
        )
        if len(checkpoints) > self.config.save_total_limit:
            for old_ckpt in checkpoints[: -self.config.save_total_limit]:
                shutil.rmtree(old_ckpt, ignore_errors=True)

    def _upload_async(self, name: str, path: Path) -> None:
        def _upload() -> None:
            self.tracker.log_model_artifact(name=name, path=path, aliases=["latest"])

        t = threading.Thread(target=_upload, daemon=True)
        t.start()
        self._upload_threads.append(t)

    def find_latest_checkpoint(self) -> Path | None:
        checkpoints = sorted(
            [p for p in self.save_dir.iterdir() if p.is_dir() and p.name.startswith("checkpoint-")],
            key=lambda p: p.stat().st_mtime,
        )
        return checkpoints[-1] if checkpoints else None

    def load_checkpoint(
        self,
        checkpoint_path: Path,
        model: torch.nn.Module,
        optimizer: torch.optim.Optimizer,
        scheduler: Any,
    ) -> dict[str, Any]:
        """Load checkpoint and return metadata."""
        state = torch.load(checkpoint_path / "pytorch_model.bin", map_location="cpu")
        model.load_state_dict(state["model_state_dict"])
        optimizer.load_state_dict(state["optimizer_state_dict"])
        scheduler.load_state_dict(state["scheduler_state_dict"])
        return state

    def wait_for_uploads(self) -> None:
        for t in self._upload_threads:
            t.join(timeout=300)
