import { Directive, ElementRef, OnChanges, OnDestroy, input, output } from '@angular/core';
import Hls from 'hls.js';

@Directive({ selector: 'video[ttExerciseHlsPlayer]', standalone: true })
export class ExerciseHlsPlayerDirective implements OnChanges, OnDestroy {
  readonly manifestUrl = input<string | null>(null);
  readonly manifestExpired = output<void>();
  private hls: Hls | null = null;
  private refreshed = false;

  constructor(private readonly element: ElementRef<HTMLVideoElement>) {}

  ngOnChanges(): void {
    this.hls?.destroy();
    this.hls = null;
    const url = this.manifestUrl();
    if (!url) return;
    const video = this.element.nativeElement;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    if (!Hls.isSupported()) return;
    const hls = new Hls();
    this.hls = hls;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!this.refreshed && data.fatal && (data.response?.code === 401 || data.response?.code === 403)) {
        this.refreshed = true;
        this.manifestExpired.emit();
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
  }

  ngOnDestroy(): void { this.hls?.destroy(); }
}
