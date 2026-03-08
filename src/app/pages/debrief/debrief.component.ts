import { Component } from '@angular/core';
import { SessionService } from '../../core/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-debrief',
  templateUrl: './debrief.component.html',
  styleUrls: ['./debrief.component.scss']
})
export class DebriefComponent {

  // Seçilen AI olduğu düşünülen video ID'leri
  selectedAI = new Set<string>();

  constructor(public session: SessionService, private router: Router) {}

  // Görsele tıklayınca seç / bırak
  toggleAI(id: string) {
    if (this.selectedAI.has(id)) {
      this.selectedAI.delete(id);
    } else {
      this.selectedAI.add(id);
    }
  }

  finish() {
    if (this.selectedAI.size === 0) {
      alert('Please select at least one image.');
      return;
    }

    // seçimi kaydet
    this.session.setSuspectedAI(Array.from(this.selectedAI));

    // 🔥 ARTIK UPLOAD BURADA
    this.session.uploadToServer();

    this.router.navigateByUrl('/');
  }
}
