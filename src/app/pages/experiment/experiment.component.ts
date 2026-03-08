import { Component, ElementRef, ViewChild } from '@angular/core';
import { SessionService, Trial } from '../../core/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-experiment',
  templateUrl: './experiment.component.html',
  styleUrls: ['./experiment.component.scss']
})
export class ExperimentComponent {
  @ViewChild('imgContainer') imgContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('imgStage') imgStage!: ElementRef<HTMLDivElement>;
  @ViewChild('clickLayer') clickLayer!: ElementRef<HTMLDivElement>;
  @ViewChild('imgSharp') imgSharp!: ElementRef<HTMLImageElement>;

  trial: Trial | null = null;

  showTaskPopup = false;
  showNoClickPopup = false;

  clickCount = 0;
  showLimitWarning = false;

  // bubble ayarları
  bubbleRadiusPx = 80;
  bubbleMs = 450;
  private bubbleTimer: any = null;

  trialStartMs = 0;

  // ✅ click limit (literatüre yakın öneri)
  maxClicksFree = 8;
  maxClicksTask = 3;

  trialsPerParticipant?: number; // ör: 30 veya 32
  constructor(protected session: SessionService, private router: Router) {}

  get isLastTrial(): boolean {
    return this.session.isLast();
  }

  get progressLabel(): string {
    const i = this.session.currentIndex + 1;
    const total = this.session.trials.length;
    return `${i} / ${total}`;
  }

  ngOnInit() {
    const pid = this.session.getOrCreateParticipantId();

    this.session.initBalancedImages(pid, {
      basePath: 'assets/images',
      ext: 'jpg',
      requiredClicksPerTrial: 1
      
    });

    this.trial = this.session.current();
    this.trialStartMs = (this.trial?.condition === 'free') ? performance.now() : 0;
    this.clickCount = this.trial?.clicks?.length || 0;

    if (this.trial?.condition === 'task') {
      this.showTaskPopup = true;
    }
    this.logTrial();
  }

  ngAfterViewInit() {
    window.addEventListener('resize', () => this.scheduleLayout());
    this.scheduleLayout();
  }

  private scheduleLayout() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.updateClickableArea());
    });
  }

  // img load olunca gerçek görüntü alanına stage + clickLayer oturt
  onImgLoaded() {
    this.scheduleLayout();
  }

  startTask() {
  this.showTaskPopup = false;
  this.trialStartMs = performance.now(); // ✅ task zamanı burada başlar
}

  onReveal(event: MouseEvent) {
  if (!this.trial) return;
  if (this.showTaskPopup) return;

  // ✅ Koordinatı clickLayer’dan al
  const layer = this.clickLayer.nativeElement;
  const rect = layer.getBoundingClientRect();

  // raw normalize
  const xRaw = (event.clientX - rect.left) / rect.width;
  const yRaw = (event.clientY - rect.top) / rect.height;

  // ✅ clamp: 0..1 dışına taşmasın (kenar hissini azaltır)
  const xNorm = Math.max(0, Math.min(1, xRaw));
  const yNorm = Math.max(0, Math.min(1, yRaw));

  // click limit
  const limit = this.trial.condition === 'task' ? this.maxClicksTask : this.maxClicksFree;
  if (this.trial.clicks.length >= limit) {
    this.showLimitWarning = true;
    setTimeout(() => (this.showLimitWarning = false), 1200);
    return;
  }

  // kaydet
  const now = performance.now();
  if (this.trial.condition === 'task' && this.trialStartMs === 0) return; // ekstra güvenlik
  const t = now - this.trialStartMs; // ✅ RT (ms)
  this.session.saveClick(xNorm, yNorm, t);
  this.clickCount = this.trial.clicks.length;

  // TASK: blur yok, bubble yok
  if (this.trial.condition === 'task') return;

  // ✅ FREE: bubble (PIXEL ile merkez ver)
  const xPx = xNorm * rect.width;
  const yPx = yNorm * rect.height;

  const sharp = this.imgSharp.nativeElement;
  sharp.style.setProperty('--x', `${xPx}px`);
  sharp.style.setProperty('--y', `${yPx}px`);
  sharp.style.setProperty('--r', `${this.bubbleRadiusPx}px`);

  if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
  this.bubbleTimer = setTimeout(() => {
    sharp.style.setProperty('--r', `0px`);
    this.bubbleTimer = null;
  }, this.bubbleMs);

  // (opsiyonel) debug log:
 // console.log('CLICK', { id: this.trial.id, xNorm: xNorm.toFixed(3), yNorm: yNorm.toFixed(3), xPx: Math.round(xPx), yPx: Math.round(yPx) });
}

goNext() {
  if (this.trial && this.trial.clicks.length === 0) {
    this.showNoClickPopup = true;
    return;
  }

  this.session.saveTrial();

  // ✅ EKLENDİ: Eski bubble timer'ı temizle (yeni trial'a taşmasın)
  if (this.bubbleTimer) {
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = null;
  }

  if (this.session.isLast()) {
    this.router.navigateByUrl('/debrief');
    return;
  }

  this.session.next();
  this.trial = this.session.current();
  this.trialStartMs = (this.trial?.condition === 'free') ? performance.now() : 0;
  this.logTrial();
  this.clickCount = this.trial?.clicks?.length || 0;

  this.showNoClickPopup = false;
  this.showLimitWarning = false;

  if (this.trial?.condition === 'task') {
    this.showTaskPopup = true;
  }

  // bubble reset
  if (this.imgSharp) {
    this.imgSharp.nativeElement.style.setProperty('--r', '0px');
    this.imgSharp.nativeElement.style.setProperty('--x', '50%');
    this.imgSharp.nativeElement.style.setProperty('--y', '50%');
  }

  this.scheduleLayout();
}

  // ✅ contain/letterbox: stage + clickLayer’ı gerçek görüntü alanına oturtur
updateClickableArea() {
  if (!this.imgContainer || !this.imgSharp || !this.clickLayer || !this.imgStage) return;

  const container = this.imgContainer.nativeElement;
  const img = this.imgSharp.nativeElement;
  const layer = this.clickLayer.nativeElement;
  const stage = this.imgStage.nativeElement;

  const CW = container.clientWidth;
  const CH = container.clientHeight;

  const IW = img.naturalWidth;
  const IH = img.naturalHeight;
  if (!IW || !IH) return;

  const containerRatio = CW / CH;
  const imageRatio = IW / IH;

  let width: number, height: number, offsetX: number, offsetY: number;

  // contain mantığı: kenarlarda boşluk olabilir
  if (containerRatio > imageRatio) {
    height = CH;
    width = CH * imageRatio;
    offsetX = (CW - width) / 2;
    offsetY = 0;
  } else {
    width = CW;
    height = CW / imageRatio;
    offsetX = 0;
    offsetY = (CH - height) / 2;
  }

  // 🔥 0.5px padding: rounding kaynaklı “kısıt” hissini yok eder
  const pad = 0.5;

  const left = offsetX - pad;
  const top = offsetY - pad;
  const w = width + pad * 2;
  const h = height + pad * 2;

  stage.style.left = `${left}px`;
  stage.style.top = `${top}px`;
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;

  layer.style.left = `${left}px`;
  layer.style.top = `${top}px`;
  layer.style.width = `${w}px`;
  layer.style.height = `${h}px`;
}

  private logTrial() {
  if (!this.trial) return;
  console.log('🖼️ TRIAL LOADED:', {
    index: this.session.currentIndex + 1,
    total: this.session.trials.length,
    id: this.trial.id,
    kind: this.trial.kind,
    condition: this.trial.condition,
    src: this.trial.src
  });
}
}