"""Distributed training backend abstraction."""

import os
from typing import Any

import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

from llm_trainer.config import DistributedConfig


class DistributedBackend:
    """Unified interface for DDP / FSDP / DeepSpeed / Megatron-LM."""

    def __init__(self, config: DistributedConfig):
        self.config = config
        self._setup_process_group()
        self.device = torch.device(f"cuda:{config.local_rank}" if torch.cuda.is_available() else "cpu")

    def _setup_process_group(self) -> None:
        if not dist.is_initialized():
            if "RANK" in os.environ and "WORLD_SIZE" in os.environ:
                dist.init_process_group(backend="nccl")
                local_rank = int(os.environ.get("LOCAL_RANK", self.config.local_rank))
                torch.cuda.set_device(local_rank)
            else:
                # Single-process fallback
                pass

    @property
    def world_size(self) -> int:
        return dist.get_world_size() if dist.is_initialized() else 1

    @property
    def rank(self) -> int:
        return dist.get_rank() if dist.is_initialized() else 0

    @property
    def is_main_process(self) -> bool:
        return self.rank == 0

    def prepare_model(self, model: torch.nn.Module) -> torch.nn.Module:
        backend = self.config.backend.lower()
        if backend == "ddp":
            return DDP(model.to(self.device), device_ids=[self.config.local_rank])
        if backend == "fsdp":
            return self._wrap_fsdp(model)
        if backend == "deepspeed":
            return self._wrap_deepspeed(model)
        if backend == "megatron":
            raise NotImplementedError("Megatron-LM backend not implemented in skeleton.")
        # Single GPU / CPU
        return model.to(self.device)

    def _wrap_fsdp(self, model: torch.nn.Module) -> torch.nn.Module:
        from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
        from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
        from transformers import PreTrainedModel

        auto_wrap_policy = transformer_auto_wrap_policy(
            model, layer_cls=[type(model.model.model.layers[0])] if hasattr(model, "model") else []
        )
        return FSDP(
            model.to(self.device),
            auto_wrap_policy=auto_wrap_policy,
            mixed_precision=torch.bfloat16,
            device_id=self.device,
            limit_all_gathers=True,
        )

    def _wrap_deepspeed(self, model: torch.nn.Module) -> torch.nn.Module:
        # DeepSpeed integration would be implemented here.
        # Return model for now; actual usage requires deepspeed.initialize().
        return model.to(self.device)

    def barrier(self) -> None:
        if dist.is_initialized():
            dist.barrier()

    def cleanup(self) -> None:
        if dist.is_initialized():
            dist.destroy_process_group()
