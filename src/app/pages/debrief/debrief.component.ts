import { Component } from '@angular/core';
import { SessionService, Trial } from '../../core/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-debrief',
  templateUrl: './debrief.component.html',
  styleUrls: ['./debrief.component.scss']
})
export class DebriefComponent {
  selectedAI = new Set<string>();
  resultsVisible = false;

  stats = {
    total: 0,
    correct: 0,
    accuracy: 0,
    tp: 0, fp: 0, fn: 0, tn: 0
  };

  constructor(public session: SessionService, private router: Router) {}

  toggleAI(id: string) {
    if (this.resultsVisible) return;
    if (this.selectedAI.has(id)) this.selectedAI.delete(id);
    else this.selectedAI.add(id);
  }

  // ✅ kind güvenli çıkar: önce kind, yoksa id prefix
  private truthIsAI(t: Trial): boolean {
    if (t.kind === 'ai') return true;
    if (t.kind === 'real') return false;
    return String(t.id).startsWith('ai_');
  }

  private computeStats() {
    const trials: Trial[] = this.session.trials || [];

    let tp = 0, fp = 0, fn = 0, tn = 0;

    for (const tr of trials) {
      const selected = this.selectedAI.has(tr.id);
      const truthAI = this.truthIsAI(tr);

      if (selected && truthAI) tp++;
      else if (selected && !truthAI) fp++;
      else if (!selected && truthAI) fn++;
      else tn++;
    }

    const total = trials.length;
    const correct = tp + tn;
    const accuracy = total ? correct / total : 0;

    this.stats = { total, correct, accuracy, tp, fp, fn, tn };
  }

  finish() {
    if (this.selectedAI.size === 0) {
      alert('Please select at least one image.');
      return;
    }

    this.session.setSuspectedAI(Array.from(this.selectedAI));

    this.computeStats();
    this.resultsVisible = true;

    this.session.uploadToServer();
  }

  goHome() {
    this.router.navigateByUrl('/');
  }

  // HTML yardımcıları (istersen kullan)
  isCorrect(tr: Trial): boolean {
    const selected = this.selectedAI.has(tr.id);
    const truthAI = this.truthIsAI(tr);
    return selected === truthAI;
  }

  truthLabel(tr: Trial): string {
    return this.truthIsAI(tr) ? 'AI' : 'REAL';
  }
}