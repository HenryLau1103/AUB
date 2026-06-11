import { Component, Input } from "@angular/core";

@Component({
  selector: "app-operations-table",
  template: "<table><tr><th>Name</th><th>Status</th></tr></table>",
})
export class OperationsTableComponent {
  @Input() rows = [];
}
