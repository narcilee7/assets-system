"""Configuration management using OmegaConf + Pydantic."""

from pathlib import Path
from typing import Any, Optional

from omegaconf import DictConfig, OmegaConf
from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    name_or_path: str
    torch_dtype: str = "bfloat16"
    attn_implementation: Optional[str] = "flash_attention_2"
    use_lora: bool = False
    load_in_4bit: bool = False
    load_in_8bit: bool = False


class LoRAConfig(BaseModel):
    r: int = 8
    lora_alpha: int = 16
    target_modules: list[str] = Field(default_factory=lambda: ["q_proj", "v_proj"])
    lora_dropout: float = 0.05
    bias: str = "none"
    task_type: str = "CAUSAL_LM"
    use_rslora: bool = False


class DataConfig(BaseModel):
    path: str
    format: str = "jsonl"  # jsonl | parquet | huggingface
    chat_template: Optional[str] = None
    text_column: Optional[str] = "text"
    max_seq_length: int = 2048
    streaming: bool = False
    batch_size: int = 4
    num_workers: int = 4
    packing: bool = False
    eval_split_ratio: float = 0.0


class TrainingConfig(BaseModel):
    output_dir: str = "outputs"
    num_epochs: int = 1
    max_steps: int = -1
    learning_rate: float = 1e-4
    min_lr_ratio: float = 0.0
    warmup_steps: int = 0
    warmup_ratio: float = 0.0
    lr_scheduler_type: str = "cosine"
    weight_decay: float = 0.01
    max_grad_norm: float = 1.0
    gradient_accumulation_steps: int = 1
    gradient_checkpointing: bool = False
    mixed_precision: Optional[str] = "bf16"
    seed: int = 42
    logging_steps: int = 10
    eval_steps: int = 500
    save_steps: int = 1000
    save_total_limit: int = 3
    dataloader_num_workers: int = 4


class DistributedConfig(BaseModel):
    backend: str = "fsdp"  # ddp | fsdp | deepspeed | megatron
    world_size: int = 1
    local_rank: int = 0
    sharding_strategy: Optional[str] = "FULL_SHARD"
    auto_wrap_policy: Optional[str] = "TRANSFORMER_BASED_WRAP"
    cpu_offload: bool = False
    backward_prefetch: Optional[str] = "BACKWARD_PRE"


class WandbConfig(BaseModel):
    project: str
    entity: Optional[str] = None
    group: Optional[str] = None
    run_name: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    log_artifacts: bool = True
    offline: bool = False


class CheckpointConfig(BaseModel):
    save_dir: str = "checkpoints"
    upload_to_wandb: bool = True
    async_upload: bool = True
    resume_from_checkpoint: Optional[str] = None


class WeaveConfig(BaseModel):
    project: str
    enabled: bool = True
    eval_dataset: Optional[str] = None
    eval_steps: int = 500
    scorers: list[str] = Field(default_factory=list)


class OptimizerConfig(BaseModel):
    name: str = "adamw_torch"
    betas: tuple[float, float] = (0.9, 0.999)
    eps: float = 1e-8


class DPOConfig(BaseModel):
    beta: float = 0.1
    label_smoothing: float = 0.0
    loss_type: str = "sigmoid"
    f_divergence_type: Optional[str] = None
    f_divergence_params: Optional[dict[str, Any]] = None
    reference_free: bool = False
    reference_model: Optional[str] = None


class ExperimentConfig(BaseModel):
    stage: str  # pretrain | sft | dpo | posttrain
    run_name: str
    model: ModelConfig
    data: DataConfig
    training: TrainingConfig
    distributed: DistributedConfig
    wandb: WandbConfig
    checkpoint: CheckpointConfig
    weave: WeaveConfig
    optimizer: OptimizerConfig
    lora: Optional[LoRAConfig] = None
    dpo: Optional[DPOConfig] = None


def load_config(config_path: str) -> ExperimentConfig:
    """Load and validate configuration from YAML."""
    cfg = OmegaConf.load(config_path)
    # Allow CLI overrides via OmegaConf merge if needed
    resolved = OmegaConf.to_container(cfg, resolve=True)
    return ExperimentConfig.model_validate(resolved)


def save_config(config: ExperimentConfig, output_path: str) -> None:
    """Save validated config back to YAML."""
    OmegaConf.save(config.model_dump(), output_path)


def log_config_to_wandb(config: ExperimentConfig) -> dict[str, Any]:
    """Convert config to flat dict for Wandb logging."""
    return OmegaConf.to_container(
        OmegaConf.create(config.model_dump()), resolve=True
    )
