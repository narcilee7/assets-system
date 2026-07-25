"""Training loop abstraction for pretrain / SFT / DPO."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import torch
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader
from transformers import AutoModelForCausalLM, AutoTokenizer, get_scheduler

from llm_trainer.checkpoint import CheckpointManager
from llm_trainer.config import ExperimentConfig, TrainingConfig
from llm_trainer.distributed import DistributedBackend
from llm_trainer.tracking import WandbTracker


class BaseTrainer(ABC):
    """Abstract base trainer for all LLM training stages."""

    def __init__(
        self,
        config: ExperimentConfig,
        model: AutoModelForCausalLM,
        tokenizer: AutoTokenizer,
        train_dataloader: DataLoader,
        eval_dataloader: DataLoader | None,
        tracker: WandbTracker,
        checkpoint_manager: CheckpointManager,
        distributed: DistributedBackend,
    ):
        self.config = config
        self.model = model
        self.tokenizer = tokenizer
        self.train_dataloader = train_dataloader
        self.eval_dataloader = eval_dataloader
        self.tracker = tracker
        self.checkpoint_manager = checkpoint_manager
        self.distributed = distributed

        self.device = distributed.device
        self.global_step = 0
        self.epoch = 0

        self.optimizer = self._build_optimizer()
        self.lr_scheduler = self._build_scheduler()

    def _build_optimizer(self) -> torch.optim.Optimizer:
        cfg = self.config.training
        opt_cfg = self.config.optimizer
        no_decay = ["bias", "LayerNorm.weight", "layernorm.weight"]
        optimizer_grouped_parameters = [
            {
                "params": [
                    p
                    for n, p in self.model.named_parameters()
                    if not any(nd in n for nd in no_decay) and p.requires_grad
                ],
                "weight_decay": cfg.weight_decay,
            },
            {
                "params": [
                    p
                    for n, p in self.model.named_parameters()
                    if any(nd in n for nd in no_decay) and p.requires_grad
                ],
                "weight_decay": 0.0,
            },
        ]
        return AdamW(
            optimizer_grouped_parameters,
            lr=cfg.learning_rate,
            betas=opt_cfg.betas,
            eps=opt_cfg.eps,
        )

    def _build_scheduler(self) -> Any:
        cfg = self.config.training
        num_training_steps = self._estimate_total_steps()
        num_warmup_steps = (
            cfg.warmup_steps
            if cfg.warmup_steps > 0
            else int(num_training_steps * cfg.warmup_ratio)
        )
        return get_scheduler(
            name=cfg.lr_scheduler_type,
            optimizer=self.optimizer,
            num_warmup_steps=num_warmup_steps,
            num_training_steps=num_training_steps,
        )

    def _estimate_total_steps(self) -> int:
        cfg = self.config.training
        if cfg.max_steps > 0:
            return cfg.max_steps
        return len(self.train_dataloader) * cfg.num_epochs

    @abstractmethod
    def compute_loss(self, batch: dict[str, Any]) -> tuple[torch.Tensor, dict[str, float]]:
        """Compute loss and return auxiliary metrics."""
        pass

    def train(self) -> None:
        cfg = self.config.training
        self.model.train()
        total_steps = self._estimate_total_steps()

        for epoch in range(cfg.num_epochs):
            self.epoch = epoch
            for batch in self.train_dataloader:
                self.model.train()
                batch = self._move_to_device(batch)

                loss, metrics = self.compute_loss(batch)
                loss = loss / cfg.gradient_accumulation_steps
                loss.backward()

                if (self.global_step + 1) % cfg.gradient_accumulation_steps == 0:
                    torch.nn.utils.clip_grad_norm_(
                        self.model.parameters(), cfg.max_grad_norm
                    )
                    self.optimizer.step()
                    self.lr_scheduler.step()
                    self.optimizer.zero_grad()

                self.global_step += 1

                if self.global_step % cfg.logging_steps == 0:
                    self.tracker.log_metrics(
                        {
                            "train/loss": metrics.get("loss", loss.item()),
                            "train/learning_rate": self.lr_scheduler.get_last_lr()[0],
                            "train/epoch": self.epoch,
                            "train/global_step": self.global_step,
                        },
                        step=self.global_step,
                    )

                if cfg.max_steps > 0 and self.global_step >= cfg.max_steps:
                    break

                if self.global_step % cfg.save_steps == 0:
                    self.checkpoint_manager.save(
                        self.global_step, self.model, self.optimizer, self.lr_scheduler
                    )

            # Epoch end
            if cfg.max_steps <= 0:
                self.checkpoint_manager.save(
                    self.global_step, self.model, self.optimizer, self.lr_scheduler, epoch=epoch
                )

        self.tracker.finish()

    def _move_to_device(self, batch: dict[str, Any]) -> dict[str, Any]:
        """Recursively move tensors to device."""
        if isinstance(batch, dict):
            return {k: self._move_to_device(v) for k, v in batch.items()}
        if isinstance(batch, torch.Tensor):
            return batch.to(self.device)
        return batch


class PretrainTrainer(BaseTrainer):
    """Standard causal LM pretraining."""

    def compute_loss(self, batch: dict[str, Any]) -> tuple[torch.Tensor, dict[str, float]]:
        outputs = self.model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            labels=batch["labels"],
        )
        return outputs.loss, {"loss": outputs.loss.item()}


class SFTTrainer(BaseTrainer):
    """Supervised fine-tuning with teacher forcing."""

    def compute_loss(self, batch: dict[str, Any]) -> tuple[torch.Tensor, dict[str, float]]:
        outputs = self.model(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"],
            labels=batch["labels"],
        )
        return outputs.loss, {"loss": outputs.loss.item()}


class DPOTrainer(BaseTrainer):
    """Direct Preference Optimization trainer (simplified)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.beta = self.config.dpo.beta if self.config.dpo else 0.1

    def _dpo_loss(
        self,
        policy_chosen_logps: torch.Tensor,
        policy_rejected_logps: torch.Tensor,
        reference_chosen_logps: torch.Tensor,
        reference_rejected_logps: torch.Tensor,
    ) -> tuple[torch.Tensor, dict[str, float]]:
        pi_logratios = policy_chosen_logps - policy_rejected_logps
        ref_logratios = reference_chosen_logps - reference_rejected_logps
        logits = pi_logratios - ref_logratios
        losses = -torch.nn.functional.logsigmoid(self.beta * logits)
        chosen_rewards = self.beta * (policy_chosen_logps - reference_chosen_logps)
        rejected_rewards = self.beta * (policy_rejected_logps - reference_rejected_logps)
        return losses.mean(), {
            "loss": losses.mean().item(),
            "rewards/chosen": chosen_rewards.mean().item(),
            "rewards/rejected": rejected_rewards.mean().item(),
            "rewards/margin": (chosen_rewards - rejected_rewards).mean().item(),
        }

    def _get_batch_logps(
        self, logits: torch.Tensor, labels: torch.Tensor
    ) -> torch.Tensor:
        """Compute average log-probability per sequence."""
        log_probs = torch.nn.functional.log_softmax(logits, dim=-1)
        per_token_logps = torch.gather(
            log_probs, dim=2, index=labels.unsqueeze(2)
        ).squeeze(2)
        mask = labels != -100
        return (per_token_logps * mask).sum(-1) / mask.sum(-1)

    def compute_loss(self, batch: dict[str, Any]) -> tuple[torch.Tensor, dict[str, float]]:
        chosen_logits = self.model(
            input_ids=batch["chosen"]["input_ids"],
            attention_mask=batch["chosen"]["attention_mask"],
        ).logits
        rejected_logits = self.model(
            input_ids=batch["rejected"]["input_ids"],
            attention_mask=batch["rejected"]["attention_mask"],
        ).logits

        policy_chosen_logps = self._get_batch_logps(
            chosen_logits[:, :-1, :], batch["chosen"]["input_ids"][:, 1:]
        )
        policy_rejected_logps = self._get_batch_logps(
            rejected_logits[:, :-1, :], batch["rejected"]["input_ids"][:, 1:]
        )

        # In real implementation, reference model logps should be computed separately.
        # Here we use a placeholder: policy == reference (reference-free DPO).
        reference_chosen_logps = policy_chosen_logps.detach()
        reference_rejected_logps = policy_rejected_logps.detach()

        return self._dpo_loss(
            policy_chosen_logps,
            policy_rejected_logps,
            reference_chosen_logps,
            reference_rejected_logps,
        )


def build_trainer(
    config: ExperimentConfig,
    model: AutoModelForCausalLM,
    tokenizer: AutoTokenizer,
    train_dataloader: DataLoader,
    eval_dataloader: DataLoader | None,
    tracker: WandbTracker,
    checkpoint_manager: CheckpointManager,
    distributed: DistributedBackend,
) -> BaseTrainer:
    """Factory for stage-specific trainers."""
    if config.stage == "pretrain":
        return PretrainTrainer(
            config, model, tokenizer, train_dataloader, eval_dataloader, tracker, checkpoint_manager, distributed
        )
    if config.stage == "sft":
        return SFTTrainer(
            config, model, tokenizer, train_dataloader, eval_dataloader, tracker, checkpoint_manager, distributed
        )
    if config.stage == "dpo":
        return DPOTrainer(
            config, model, tokenizer, train_dataloader, eval_dataloader, tracker, checkpoint_manager, distributed
        )
    raise ValueError(f"Unsupported stage: {config.stage}")
