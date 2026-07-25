"""Model construction with optional LoRA/QLoRA."""

import torch
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, AutoTokenizer

from llm_trainer.config import ExperimentConfig, LoRAConfig, ModelConfig


def build_tokenizer(model_config: ModelConfig) -> AutoTokenizer:
    """Build and configure tokenizer."""
    tokenizer = AutoTokenizer.from_pretrained(model_config.name_or_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    return tokenizer


def build_model(
    model_config: ModelConfig,
    lora_config: LoRAConfig | None = None,
) -> AutoModelForCausalLM:
    """Build base model with optional LoRA/QLoRA."""
    load_kwargs = {
        "torch_dtype": getattr(torch, model_config.torch_dtype),
        "trust_remote_code": True,
    }
    if model_config.attn_implementation:
        load_kwargs["attn_implementation"] = model_config.attn_implementation

    # QLoRA 4-bit / 8-bit loading
    if model_config.load_in_4bit:
        load_kwargs["load_in_4bit"] = True
        load_kwargs["device_map"] = "auto"
    elif model_config.load_in_8bit:
        load_kwargs["load_in_8bit"] = True
        load_kwargs["device_map"] = "auto"

    model = AutoModelForCausalLM.from_pretrained(
        model_config.name_or_path,
        **load_kwargs,
    )

    if model_config.load_in_4bit or model_config.load_in_8bit:
        model = prepare_model_for_kbit_training(model)

    if model_config.use_lora and lora_config is not None:
        peft_config = LoraConfig(
            r=lora_config.r,
            lora_alpha=lora_config.lora_alpha,
            target_modules=lora_config.target_modules,
            lora_dropout=lora_config.lora_dropout,
            bias=lora_config.bias,
            task_type=lora_config.task_type,
            use_rslora=lora_config.use_rslora,
        )
        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()

    return model


def build_model_and_tokenizer(
    config: ExperimentConfig,
) -> tuple[AutoModelForCausalLM, AutoTokenizer]:
    """Convenience builder for model + tokenizer."""
    tokenizer = build_tokenizer(config.model)
    model = build_model(config.model, config.lora)
    return model, tokenizer
