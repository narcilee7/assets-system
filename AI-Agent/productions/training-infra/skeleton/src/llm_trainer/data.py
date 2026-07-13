"""Data loading and preprocessing for pretrain / SFT / DPO / post-train."""

from typing import Any, Callable, Iterator

from datasets import load_dataset
from torch.utils.data import DataLoader, Dataset, IterableDataset

from llm_trainer.config import DataConfig


class TextDataset(Dataset):
    """Simple map-style dataset for pretraining text."""

    def __init__(self, data_path: str, tokenizer: Any, max_length: int):
        self.raw = load_dataset("json", data_files=data_path, split="train")
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.raw)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        text = self.raw[idx]["text"]
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": encoding["input_ids"].squeeze(0),
        }


class ChatDataset(Dataset):
    """Map-style dataset for SFT / post-train chat data."""

    def __init__(
        self,
        data_path: str,
        tokenizer: Any,
        max_length: int,
        chat_template: str | None = None,
    ):
        self.raw = load_dataset("json", data_files=data_path, split="train")
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.chat_template = chat_template

    def __len__(self) -> int:
        return len(self.raw)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        messages = self.raw[idx]["messages"]
        if self.chat_template and hasattr(self.tokenizer, "apply_chat_template"):
            text = self.tokenizer.apply_chat_template(messages, tokenize=False)
        else:
            text = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "labels": encoding["input_ids"].squeeze(0),
        }


class PreferenceDataset(Dataset):
    """Map-style dataset for DPO preference data."""

    def __init__(
        self,
        data_path: str,
        tokenizer: Any,
        max_length: int,
        chat_template: str | None = None,
    ):
        self.raw = load_dataset("json", data_files=data_path, split="train")
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.chat_template = chat_template

    def _encode_pair(self, prompt: str, response: str) -> dict[str, Any]:
        text = prompt + response
        encoding = self.tokenizer(
            text,
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
        }

    def __len__(self) -> int:
        return len(self.raw)

    def __getitem__(self, idx: int) -> dict[str, Any]:
        item = self.raw[idx]
        return {
            "prompt": item["prompt"],
            "chosen": self._encode_pair(item["prompt"], item["chosen"]),
            "rejected": self._encode_pair(item["prompt"], item["rejected"]),
        }


class DataModule:
    """Unified data module that selects dataset based on stage."""

    def __init__(self, config: DataConfig, tokenizer: Any, stage: str):
        self.config = config
        self.tokenizer = tokenizer
        self.stage = stage
        self.train_dataset: Dataset | None = None
        self.eval_dataset: Dataset | None = None

    def setup(self) -> None:
        if self.stage == "pretrain":
            self.train_dataset = TextDataset(
                self.config.path, self.tokenizer, self.config.max_seq_length
            )
        elif self.stage in ("sft", "posttrain"):
            self.train_dataset = ChatDataset(
                self.config.path,
                self.tokenizer,
                self.config.max_seq_length,
                self.config.chat_template,
            )
        elif self.stage == "dpo":
            self.train_dataset = PreferenceDataset(
                self.config.path,
                self.tokenizer,
                self.config.max_seq_length,
                self.config.chat_template,
            )
        else:
            raise ValueError(f"Unknown stage: {self.stage}")

        # TODO: build eval split if eval_split_ratio > 0

    def train_dataloader(self) -> DataLoader:
        if self.train_dataset is None:
            self.setup()
        return DataLoader(
            self.train_dataset,  # type: ignore[arg-type]
            batch_size=self.config.batch_size,
            shuffle=not self.config.streaming,
            num_workers=self.config.num_workers,
            pin_memory=True,
        )

    def eval_dataloader(self) -> DataLoader | None:
        if self.eval_dataset is None:
            return None
        return DataLoader(
            self.eval_dataset,
            batch_size=self.config.batch_size,
            shuffle=False,
            num_workers=self.config.num_workers,
            pin_memory=True,
        )
