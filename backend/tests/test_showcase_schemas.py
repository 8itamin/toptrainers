from pydantic import ValidationError

from toptrainers_api.modules.showcase.schemas import ShowcaseDocument


def test_showcase_document_uses_a_registered_typed_block() -> None:
    document = ShowcaseDocument.model_validate(
        {
            "blocks": [
                {
                    "id": "hero-01",
                    "type": "hero",
                    "order": 0,
                    "props": {"headline": "Тренировки с результатом"},
                }
            ]
        }
    )

    assert document.blocks[0].type == "hero"


def test_showcase_document_rejects_unregistered_block_types() -> None:
    payload = {
        "blocks": [
            {
                "id": "unsafe-html",
                "type": "raw-html",
                "order": 0,
                "props": {"html": "<script>alert(1)</script>"},
            }
        ]
    }

    try:
        ShowcaseDocument.model_validate(payload)
    except ValidationError:
        pass
    else:
        raise AssertionError("An unregistered showcase block must be rejected")
