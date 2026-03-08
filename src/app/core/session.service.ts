// src/app/core/session.service.ts
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export type Condition = 'free' | 'task';
export type Kind = 'real' | 'ai';

export interface ClickEvent {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  t: number; // ms (RT)
}

export interface Trial {
  id: string;                 // e.g. "real_01" or "ai_32"
  src: string;                // asset path
  kind: Kind;                 // ground-truth
  condition: Condition;       // free/task (between-subject)
  instruction?: string | null;
  clicks: ClickEvent[];
  replayCount?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  // ===== STATE =====
  condition: Condition = 'free';
  trials: Trial[] = [];
  currentIndex = 0;
  participantId: string | number = 'P001';

  allImages: any[] = (window as any).imagesJson || [];
  counterbalanceInfo: any = null;

  suspectedAIImages: string[] = [];
  requiredClicksPerTrial = 1;

  constructor(private http: HttpClient) {}

  setSuspectedAI(ids: string[]) {
    this.suspectedAIImages = ids;
  }

  // ===== PARTICIPANT ID (auto) =====
  getOrCreateParticipantId(): string {
    const key = 'cmpe490_participant_id';
    let pid = localStorage.getItem(key);

    const url = new URL(window.location.href);
    if (url.searchParams.get('reset') === '1') {
      localStorage.removeItem(key);
      localStorage.removeItem('cmpe490_group');
      localStorage.removeItem('cmpe490_forced_group');
      pid = null;
    }

    if (!pid) {
      pid = 'P' + Math.floor(100000 + Math.random() * 900000);
      localStorage.setItem(key, pid);
      console.log('🆕 New participant ID generated:', pid);
    } else {
      console.log('♻️ Existing participant ID:', pid);
    }

    return pid;
  }

  // ===== STORAGE KEY =====
  private storageKey(): string {
    return `experimentData_${this.participantId}`;
  }

  // ===== instruction lookup (opsiyonel) =====
  private findInstructionById(id: string): string | null {
    const match = this.allImages.find((v) => v.id === id);
    return match?.instruction ?? null;
  }

  // ===== GROUP (MANUAL ONLY) =====
  // Uses ?g=1..4. If missing, defaults to 1 (you can change to throw if you prefer).
  private getOrCreateGroup(): number {
    const url = new URL(window.location.href);
    const g = Number(url.searchParams.get('g'));

    if ([1, 2, 3, 4].includes(g)) {
      localStorage.setItem('cmpe490_group', String(g));
      localStorage.setItem('cmpe490_forced_group', String(g));
      return g;
    }

    const saved = Number(localStorage.getItem('cmpe490_group'));
    if ([1, 2, 3, 4].includes(saved)) return saved;

    const fallback = 1;
    localStorage.setItem('cmpe490_group', String(fallback));
    localStorage.setItem('cmpe490_forced_group', String(fallback));
    return fallback;

    // strict istersen:
    // throw new Error('Group not provided. Open with ?g=1..4');
  }

  // ===== INIT (32 IMAGES, SET SAME, ORDER SHUFFLED) =====
  initBalancedImages(
    participantId: string | number,
    opts?: {
      basePath?: string;            // default: assets/images
      ext?: 'jpg' | 'png' | 'jpeg' | 'webp';
      requiredClicksPerTrial?: number; // default: 1
    }
  ) {
    this.participantId = participantId;
    this.allImages = (window as any).imagesJson || [];

    const basePath = opts?.basePath ?? 'assets/images';
    const ext = opts?.ext ?? 'jpg';
    this.requiredClicksPerTrial = opts?.requiredClicksPerTrial ?? 1;

    // ✅ manual group
    const group = this.getOrCreateGroup(); // 1..4

    // group -> condition + set
    const participantCondition: Condition = (group === 1 || group === 2) ? 'free' : 'task';
    const imageSet: 'A' | 'B' = (group === 1 || group === 3) ? 'A' : 'B';
    this.condition = participantCondition;

    const nn = (n: number) => String(n).padStart(2, '0');

    const buildRealSrc = (n: number) => `${basePath}/real/real_${nn(n)}.${ext}`;
    const buildAiSrc = (n: number) => `${basePath}/ai/ai_${nn(n)}.${ext}`;

    const trials: Trial[] = [];

    const pushReal = (n: number) => {
      const id = `real_${nn(n)}`;
      trials.push({
        id,
        src: buildRealSrc(n),
        kind: 'real',
        condition: participantCondition,
        instruction: participantCondition === 'task' ? this.findInstructionById(id) : null,
        clicks: [],
      });
    };

    const pushAi = (n: number) => {
      const id = `ai_${nn(n)}`;
      trials.push({
        id,
        src: buildAiSrc(n),
        kind: 'ai',
        condition: participantCondition,
        instruction: participantCondition === 'task' ? this.findInstructionById(id) : null,
        clicks: [],
      });
    };

    // ✅ set seçimi (senin istediğin aralıklar)
    if (imageSet === 'A') {
      // Set A: Real 01..16, AI 32..17
      for (let i = 1; i <= 16; i++) pushReal(i);
      for (let i = 32; i >= 17; i--) pushAi(i);
    } else {
      // Set B: Real 17..32, AI 16..01
      for (let i = 17; i <= 32; i++) pushReal(i);
      for (let i = 16; i >= 1; i--) pushAi(i);
    }

    // ✅ ORDER SHUFFLE (real/ai karışık gelsin) + max 2 aynı tür art arda
    const pidNum = this.hashToNumber(this.participantId);
    const rng = this.mulberry32(pidNum ^ (group * 99991));
    this.trials = this.shuffleNoLongRuns(trials, rng, 2);

    this.counterbalanceInfo = {
      group,
      condition: participantCondition,
      imageSet,
      design: '4group_between_subjects_manual_shuffled',
      requiredClicksPerTrial: this.requiredClicksPerTrial,
      aiCount: this.trials.filter(t => t.kind === 'ai').length,
      realCount: this.trials.filter(t => t.kind === 'real').length,
      totalTrials: this.trials.length,
      maxRunSameKind: 2
    };

    const savedIndex = localStorage.getItem(`progress_${this.participantId}`);
    this.currentIndex = savedIndex !== null ? Number(savedIndex) : 0;

    this.restoreSavedTrials();
  }

  // ===== FLOW =====
  current(): Trial | null {
    return this.trials[this.currentIndex] ?? null;
  }

  canProceed(): boolean {
    const t = this.current();
    if (!t) return false;
    return (t.clicks?.length ?? 0) >= this.requiredClicksPerTrial;
  }

  next(): Trial | null {
    if (!this.canProceed()) return this.current();

    this.saveTrial();

    if (this.currentIndex < this.trials.length - 1) {
      this.currentIndex++;
      this.saveProgress();
      return this.current();
    }
    return null;
  }

  isLast(): boolean {
    return this.currentIndex >= this.trials.length - 1;
  }

  // ===== RECORD =====
  saveClick(x: number, y: number, t: number) {
    const trial = this.current();
    if (!trial) return;
    trial.clicks.push({ x, y, t });
   // console.log(`Click @ x:${x.toFixed(3)}, y:${y.toFixed(3)}, t:${t.toFixed(2)}`);
  }

  saveTrial() {
    const trial = this.current();
    if (!trial) return;

    const key = this.storageKey();
    const saved: Trial[] = JSON.parse(localStorage.getItem(key) || '[]');

    const idx = saved.findIndex((t) => t.id === trial.id);
    if (idx >= 0) saved[idx] = trial;
    else saved.push(trial);

    localStorage.setItem(key, JSON.stringify(saved, null, 2));
  }

  exportAll() {
    const key = this.storageKey();
    const all = JSON.parse(localStorage.getItem(key) || '[]');
    const payload = {
      participantId: this.participantId,
      counterbalance: this.counterbalanceInfo,
      trials: all as Trial[],
      suspectedAIImages: this.suspectedAIImages
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `participant_${this.participantId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== Upload (Formspree) =====
  async uploadToServer() {
    const key = this.storageKey();

    const payload = {
      participantId: this.participantId,
      createdAt: new Date().toISOString(),
      counterbalance: this.counterbalanceInfo,
      trials: JSON.parse(localStorage.getItem(key) || '[]'),
      suspectedAIImages: this.suspectedAIImages
    };

    try {
      const res = await lastValueFrom(
        this.http.post(
          'https://formspree.io/f/mpwvkwdo',
          payload,
          { headers: { 'Accept': 'application/json' } }
        )
      );
      console.log('✅ Veri Formspree’ye gönderildi:', res);
    } catch (err) {
      console.error('❌ Formspree veri gönderimi başarısız:', err);
    }
  }

  saveProgress() {
    localStorage.setItem(`progress_${this.participantId}`, this.currentIndex.toString());
  }

  private restoreSavedTrials() {
    if (!this.trials.length) return;
    const key = this.storageKey();
    const saved: Trial[] = JSON.parse(localStorage.getItem(key) || '[]');

    for (const savedTrial of saved) {
      const idx = this.trials.findIndex(t => t.id === savedTrial.id);
      if (idx >= 0) {
        this.trials[idx].clicks = savedTrial.clicks || [];
        this.trials[idx].replayCount = savedTrial.replayCount || 0;
      }
    }
    console.log('✅ Restored trials:', saved.length);
  }

  // ===== HELPERS =====
  private mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private shuffle<T>(arr: T[], rng: () => number): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // maxRun kadar aynı kind üst üste gelmesin (ör: 2)
  private shuffleNoLongRuns(trials: Trial[], rng: () => number, maxRun = 2): Trial[] {
    const ok = (arr: Trial[]) => {
      let run = 1;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].kind === arr[i - 1].kind) run++;
        else run = 1;
        if (run > maxRun) return false;
      }
      return true;
    };

    for (let attempt = 0; attempt < 200; attempt++) {
      const candidate = this.shuffle(trials, rng);
      if (ok(candidate)) return candidate;
    }

    return this.shuffle(trials, rng);
  }

  private hashToNumber(id: string | number): number {
    if (typeof id === 'number') return id;
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}