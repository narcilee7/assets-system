"""Wandb experiment tracking integration."""

import os
from pathlib import Path
from typing import Any

import wandb

from llm_trainer.config import WandbConfig


class WandbTracker:
    """Lightweight wrapper around wandb for training infra."""

    def __init__(self, config: WandbConfig, run_name: str):
        self.config = config
        self.run_name = run_name or config.run_name or run_name
        self.run: wandb.sdk.wandb_run.Run | None = None

    def init(self, config_dict: dict[str, Any] | None = None) -> None:
        """Initialize wandb run."""
        if self.config.offline:
            os.environ["WANDB_MODE"] = "offline"

        self.run = wandb.init(
            project=self.config.project,
            entity=self.config.entity,
            group=self.config.group,
            name=self.run_name,
            tags=self.config.tags,
            config=config_dict,
            reinit=True,
        )

    def log_metrics(self, metrics: dict[str, Any], step: int | None = None) -> None:
        if self.run is None:
            return
        self.run.log(metrics, step=step)

    def log_system_metrics(self) -> None:
        """Log system-level metrics (GPU/CPU)."""
        # Wandb already logs system metrics by default.
        # This is a hook for custom system metrics.
        pass

    def log_artifact(
        self,
        name: str,
        artifact_type: str,
        path: str | Path,
        aliases: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if self.run is None or not self.config.log_artifacts:
            return
        artifact = wandb.Artifact(name=name, type=artifact_type, metadata=metadata)
        local_path = Path(path)
        if local_path.is_dir():
            artifact.add_dir(str(local_path))
        else:
            artifact.add_file(str(local_path))
        self.run.log_artifact(artifact, aliases=aliases or ["latest"])

    def log_dataset_artifact(
        self, name: str, path: str | Path, metadata: dict[str, Any] | None = None
    ) -> None:
        self.log_artifact(name, "dataset", path, metadata=metadata)

    def log_model_artifact(
        self,
        name: str,
        path: str | Path,
        aliases: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.log_artifact(name, "model", path, aliases=aliases, metadata=metadata)

    def finish(self) -> None:
        if self.run is not None:
            self.run.finish()
            self.run = None
