import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from 'src/app/core/session.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.scss']
})
export class IntroComponent {
  participantId: string = '';

  constructor(
    private router: Router,
    public session: SessionService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // ✅ PID'i SessionService üretsin/okusun (reset=1 desteği var)
    this.participantId = this.session.getOrCreateParticipantId();

    // ✅ images.json'u assets'ten çek (import hatası yok)
    this.http.get<any[]>('assets/images/images.json').subscribe({
      next: (data) => {
        (window as any).imagesJson = data;

        // ✅ Intro yüklenince init (20 image + 4 grup)
        if (!this.session.counterbalanceInfo) {
          this.session.initBalancedImages(this.participantId, {
            basePath: 'assets/images',
            ext: 'jpg',               // png ise 'png'
            requiredClicksPerTrial: 1
          });
        }

        console.log('🎯 Katılımcı ID:', this.participantId);
        console.log('🧪 Condition:', this.session.counterbalanceInfo?.condition);
        console.log('🧩 Group:', this.session.counterbalanceInfo?.group);
        console.log('🧩 Set:', this.session.counterbalanceInfo?.imageSet);
      },
      error: (err) => {
        console.error('❌ images.json yüklenemedi:', err);
        // JSON gelmese bile deney başlasın istersen, init'i burada da çağırabiliriz.
      }
    });
  }

  startExperiment() {
    this.router.navigateByUrl('/experiment');
  }
}