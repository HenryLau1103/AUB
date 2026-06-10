import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-customer-results',
  templateUrl: './customer-results.component.html',
  styleUrls: ['./customer-results.component.scss'],
})
export class CustomerResultsComponent {
  @Input() rows = [];
  openCustomer() {}
  sortData() {}
}
