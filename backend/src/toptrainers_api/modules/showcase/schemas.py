from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl

ShowcaseBlockType = Literal["hero", "about", "credentials", "program-list", "contacts-cta"]
SHOWCASE_BLOCK_TYPES: tuple[ShowcaseBlockType, ...] = (
    "hero",
    "about",
    "credentials",
    "program-list",
    "contacts-cta",
)
CredentialItem = Annotated[str, Field(min_length=1, max_length=300)]
ProgramId = Annotated[str, Field(min_length=1, max_length=80)]


class ShowcaseBlockBase(BaseModel):
    """Shared immutable shape for every public showcase block."""

    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    schema_version: int = Field(default=1, ge=1)
    visible: bool = True
    order: int = Field(ge=0)


class HeroProps(BaseModel):
    headline: str = Field(min_length=1, max_length=120)
    subheadline: str | None = Field(default=None, max_length=280)
    cta_label: str | None = Field(default=None, max_length=48)
    image_url: HttpUrl | None = None


class HeroBlock(ShowcaseBlockBase):
    type: Literal["hero"]
    props: HeroProps


class AboutProps(BaseModel):
    heading: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=2_000)


class AboutBlock(ShowcaseBlockBase):
    type: Literal["about"]
    props: AboutProps


class CredentialsProps(BaseModel):
    heading: str = Field(default="Квалификация", min_length=1, max_length=100)
    items: list[CredentialItem] = Field(min_length=1, max_length=12)


class CredentialsBlock(ShowcaseBlockBase):
    type: Literal["credentials"]
    props: CredentialsProps


class ProgramListProps(BaseModel):
    heading: str = Field(default="Программы", min_length=1, max_length=100)
    program_ids: list[ProgramId] = Field(default_factory=list, max_length=24)
    show_prices: bool = True


class ProgramListBlock(ShowcaseBlockBase):
    type: Literal["program-list"]
    props: ProgramListProps


class ContactsCtaProps(BaseModel):
    heading: str = Field(min_length=1, max_length=100)
    body: str | None = Field(default=None, max_length=500)
    cta_label: str = Field(min_length=1, max_length=48)


class ContactsCtaBlock(ShowcaseBlockBase):
    type: Literal["contacts-cta"]
    props: ContactsCtaProps


ShowcaseBlock = Annotated[
    HeroBlock | AboutBlock | CredentialsBlock | ProgramListBlock | ContactsCtaBlock,
    Field(discriminator="type"),
]


class ShowcaseDocument(BaseModel):
    """Versioned, safe content document; arbitrary HTML/CSS/JS is never accepted."""

    schema_version: int = Field(default=1, ge=1)
    blocks: list[ShowcaseBlock] = Field(default_factory=list, max_length=40)
