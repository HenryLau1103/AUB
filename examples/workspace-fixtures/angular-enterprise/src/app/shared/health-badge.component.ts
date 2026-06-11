import { Component, Input } from "@angular/core";

@Component({
  selector: "app-health-badge",
  template: "<span>{{ status }}</span>",
})
export class HealthBadgeComponent {
  @Input() status = "";
}
