from __future__ import annotations

from pathlib import Path

import yaml


def test_compose_declares_single_video_worker_with_tmpfs() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    compose = yaml.safe_load((repository_root / "infra" / "compose" / "compose.yaml").read_text())

    worker = compose["services"]["video-worker"]
    assert worker["image"] == compose["services"]["api"]["image"] == "toptrainers-api"
    assert worker["command"] == ["python", "-m", "toptrainers_api.workers.exercise_video_streams"]
    assert worker["read_only"] is True
    assert worker["tmpfs"] == ["/tmp"]
    assert worker["deploy"]["resources"]["limits"]["cpus"] == "1.0"
