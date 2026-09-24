from __future__ import annotations

import pytest

from toptrainers_api.modules.media.hls import render_signed_hls_manifest


class FakeStorage:
    def create_hls_segment_read_url(self, object_key: str) -> str:
        return f"https://signed.example/{object_key}"


def test_renderer_replaces_only_relative_hls_artifacts_with_signed_urls() -> None:
    rendered = render_signed_hls_manifest(
        '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\nsegment_000.m4s\n',
        "exercise-hls/m1",
        FakeStorage(),  # type: ignore[arg-type]
    )

    assert 'https://signed.example/exercise-hls/m1/init.mp4' in rendered
    assert 'https://signed.example/exercise-hls/m1/segment_000.m4s' in rendered


@pytest.mark.parametrize("unsafe_line", ["../secret.m4s", "https://evil.example/segment.m4s"])
def test_renderer_rejects_parent_paths_and_external_urls(unsafe_line: str) -> None:
    with pytest.raises(ValueError, match="Unsafe HLS filename"):
        render_signed_hls_manifest(
            unsafe_line,
            "exercise-hls/m1",
            FakeStorage(),  # type: ignore[arg-type]
        )
