import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IntroComponent } from './pages/intro/intro.component';
import { ExperimentComponent } from './pages/experiment/experiment.component';
import { DebriefComponent } from './pages/debrief/debrief.component';

const routes: Routes = [
  {path: '', component: IntroComponent},
  {path: 'experiment', component: ExperimentComponent },
  {path: 'debrief', component: DebriefComponent},
  {path: '**', redirectTo: ''}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
