import { Component, Input } from "@angular/core";

@Component({
  selector: "app-domain-card",
  template: "<article><h2>{{ title }}</h2><strong>{{ value }}</strong></article>",
})
export class DomainCardComponent {
  @Input() title = "";
  @Input() value = "";
}
