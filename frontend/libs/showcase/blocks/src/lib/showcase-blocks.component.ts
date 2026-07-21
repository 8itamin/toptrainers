import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type {
  AboutBlock,
  ContactsCtaBlock,
  CredentialsBlock,
  HeroBlock,
  ProgramListBlock,
  ShowcaseBlock,
  ShowcaseDocument,
} from './showcase-document';

const EMPTY_DOCUMENT: ShowcaseDocument = { schema_version: 1, blocks: [] };

@Component({
  selector: 'tt-showcase-blocks',
  standalone: true,
  template: `
    @for (block of document.blocks; track block.id) {
      @if (block.visible) {
        @switch (block.type) {
          @case ('hero') {
            <section class="block hero">
              @if (hero(block).props.image_url; as imageUrl) {
                <img class="hero__image" [src]="imageUrl" alt="" />
              }
              <div class="hero__content">
                <p class="eyebrow">TopTrainers</p>
                <h1>{{ hero(block).props.headline }}</h1>
                @if (hero(block).props.subheadline; as subheadline) {
                  <p>{{ subheadline }}</p>
                }
                @if (hero(block).props.cta_label; as ctaLabel) {
                  <a class="button" href="#contacts">{{ ctaLabel }}</a>
                }
              </div>
            </section>
          }
          @case ('about') {
            <section class="block prose">
              <h2>{{ about(block).props.heading }}</h2>
              <p>{{ about(block).props.body }}</p>
            </section>
          }
          @case ('credentials') {
            <section class="block credentials">
              <h2>{{ credentials(block).props.heading }}</h2>
              <ul>
                @for (item of credentials(block).props.items; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </section>
          }
          @case ('program-list') {
            <section class="block programs">
              <h2>{{ programList(block).props.heading }}</h2>
              @if (programList(block).props.program_ids.length > 0) {
                <ul>
                  @for (programId of programList(block).props.program_ids; track programId) {
                    <li>Программа {{ programId }}</li>
                  }
                </ul>
              } @else {
                <p>Программы появятся после публикации тренером.</p>
              }
            </section>
          }
          @case ('contacts-cta') {
            <section id="contacts" class="block contacts">
              <h2>{{ contacts(block).props.heading }}</h2>
              @if (contacts(block).props.body; as body) {
                <p>{{ body }}</p>
              }
              <a class="button" href="#contacts">{{ contacts(block).props.cta_label }}</a>
            </section>
          }
        }
      }
    }
  `,
  styles: `
    :host { display: grid; gap: 1rem; }
    .block { overflow: hidden; padding: clamp(1.25rem, 4vw, 3rem); border: 1px solid #dce4ee; border-radius: 1.25rem; background: #fff; }
    .hero { display: grid; grid-template-columns: minmax(0, 1fr); background: #0d2235; color: #fff; }
    .hero__image { width: 100%; max-height: 22rem; object-fit: cover; border-radius: 0.875rem; }
    .hero__content { max-width: 44rem; }
    .hero h1 { margin: 0.25rem 0 0.75rem; font-size: clamp(2.2rem, 7vw, 4.5rem); line-height: 1.02; }
    .hero p:not(.eyebrow) { max-width: 38rem; color: rgb(255 255 255 / 78%); font-size: 1.1rem; }
    h2 { margin: 0 0 0.75rem; font-size: clamp(1.4rem, 4vw, 2rem); }
    p { margin: 0; line-height: 1.6; }
    ul { display: grid; gap: 0.625rem; margin: 0; padding-left: 1.2rem; }
    .eyebrow { color: #1eb980; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
    .button { display: inline-flex; min-height: 2.75rem; align-items: center; margin-top: 1.25rem; padding: 0 1rem; border-radius: 0.625rem; background: #1eb980; color: #0d2235; font-weight: 800; text-decoration: none; }
    .contacts { background: #eafaf3; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseBlocksComponent {
  @Input({ required: true }) public document: ShowcaseDocument = EMPTY_DOCUMENT;

  protected hero(block: ShowcaseBlock): HeroBlock {
    return block as HeroBlock;
  }

  protected about(block: ShowcaseBlock): AboutBlock {
    return block as AboutBlock;
  }

  protected credentials(block: ShowcaseBlock): CredentialsBlock {
    return block as CredentialsBlock;
  }

  protected programList(block: ShowcaseBlock): ProgramListBlock {
    return block as ProgramListBlock;
  }

  protected contacts(block: ShowcaseBlock): ContactsCtaBlock {
    return block as ContactsCtaBlock;
  }
}
