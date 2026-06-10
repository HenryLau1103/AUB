import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-customer-search',
  templateUrl: './customer-search.component.html',
  styleUrls: ['./customer-search.component.scss'],
})
export class CustomerSearchComponent {
  constructor(private fb: FormBuilder) {}

  form = this.fb.group({
    customerId: ['', Validators.required],
    segment: [{ value: null, disabled: true }],
    createdAt: ['', Validators.pattern('^[0-9-]+$')],
  });

  query() {}
  clear() {}
  toggleAdvanced() {}
}
