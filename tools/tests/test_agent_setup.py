from __future__ import annotations

import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


class AgentSetupTests(unittest.TestCase):
    def setUp(self) -> None:
        self.opencode_path = ROOT / "opencode.json"
        self.workflow_path = ROOT / "tools" / "workflow.json"

    def test_opencode_defines_exact_worker_profiles(self) -> None:
        config = json.loads(self.opencode_path.read_text(encoding="utf-8"))

        self.assertEqual(
            set(config["agent"]),
            {"qwen-worker-1", "qwen-worker-2", "glm-worker"},
        )

    def test_qwen_workers_share_the_configured_token_router_model(self) -> None:
        config = json.loads(self.opencode_path.read_text(encoding="utf-8"))

        self.assertEqual(
            config["agent"]["qwen-worker-1"]["model"],
            "tokenrouter/qwen/qwen3.8-max-free",
        )
        self.assertEqual(
            config["agent"]["qwen-worker-2"]["model"],
            "tokenrouter/qwen/qwen3.8-max-free",
        )

    def test_kira_provider_uses_base_url_and_documented_glm_model(self) -> None:
        config = json.loads(self.opencode_path.read_text(encoding="utf-8"))
        kira = config["provider"]["kiraai"]

        self.assertEqual(kira["options"]["baseURL"], "https://kiraai.vn/api/v1")
        self.assertEqual(config["agent"]["glm-worker"]["model"], "kiraai/glm-5.3")
        self.assertIn("glm-5.3", kira["models"])

    def test_repository_configuration_contains_no_api_key_literal(self) -> None:
        opencode_raw = self.opencode_path.read_text(encoding="utf-8").casefold()
        workflow_raw = self.workflow_path.read_text(encoding="utf-8").casefold()

        self.assertNotIn('"apikey"', opencode_raw)
        self.assertNotIn("bearer ", opencode_raw)
        self.assertNotIn("sk-", opencode_raw)
        self.assertNotIn("bearer ", workflow_raw)
        self.assertNotIn("sk-", workflow_raw)

    def test_workflow_declares_all_five_terminal_workers(self) -> None:
        config = json.loads(self.workflow_path.read_text(encoding="utf-8"))

        self.assertEqual(
            set(config["workers"]),
            {"codex", "claude", "qwen-1", "qwen-2", "glm"},
        )
        self.assertEqual(config["workers"]["qwen-1"]["command"], "opencode.cmd")
        self.assertEqual(config["workers"]["qwen-2"]["command"], "opencode.cmd")
        self.assertEqual(config["workers"]["glm"]["command"], "opencode.cmd")


if __name__ == "__main__":
    unittest.main()
