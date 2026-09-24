from toptrainers_api.modules.media.models import ExerciseThumbnailJob


def test_thumbnail_job_starts_pending_with_no_attempts() -> None:
    """A newly confirmed cover must be claimable by a worker exactly once."""
    job = ExerciseThumbnailJob(source_media_id="m" * 36, status="PENDING")

    assert job.source_media_id == "m" * 36
    assert job.status == "PENDING"
    assert job.attempt_count in (None, 0)
    assert job.lease_expires_at is None
    assert job.last_error_code is None
