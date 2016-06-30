import { Component, Input } from '@angular/core';

import { Blueprint } from '../../services/api/api';

@Component({
  selector: 'blueprint-details',
  templateUrl: 'app/components/blueprint-details/blueprint-details.html',
})

export class BlueprintDetailsComponent {
  @Input()
  blueprint: Blueprint;
}