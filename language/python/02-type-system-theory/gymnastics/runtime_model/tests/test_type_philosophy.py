import unittest

from ..agent_protocol import ExecutableAgent, LegacyScript, OpenAIAgent
from ..safe_transformer import EAPFTransformer, Serializeble


class CustomSerializable:
    def to_dict(self) -> dict:
        return {"source": "custom"}


class PlainObject:
    def __init__(self) -> None:
        self.data = 42
        self._internal = "hidden"


class TestTypeSystemAndPhilosophy(unittest.TestCase):
    def test_eafp_transformer_success_routes(self):
        self.assertEqual(
            EAPFTransformer.extract_payload(CustomSerializable()), {"source": "custom"}
        )

        dict_input = {"key": "value"}
        self.assertEqual(EAPFTransformer.extract_payload(dict_input), dict_input)

        self.assertEqual(EAPFTransformer.extract_payload(PlainObject()), {"data": 42})

    def test_eafp_transformer_failure(self):
        with self.assertRaises(TypeError) as ctx:
            EAPFTransformer.extract_payload(12345)

        self.assertIn("expected a dict or Serializeble", str(ctx.exception))

    def test_protocol_static_and_runtime_duck(self):
        openai_agent = OpenAIAgent(tags=["llm", "gpt4"])
        self.assertIsInstance(openai_agent, ExecutableAgent)

        self.assertTrue(isinstance(openai_agent, ExecutableAgent))

        bad_duck = LegacyScript()

        self.assertFalse(isinstance(bad_duck, ExecutableAgent))


if __name__ == "__main__":
    unittest.main()
