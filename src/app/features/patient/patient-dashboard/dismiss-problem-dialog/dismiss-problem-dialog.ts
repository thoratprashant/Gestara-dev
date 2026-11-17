import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

export interface DismissProblemDialogResult {
  notes: string;
}

@Component({
  selector: 'app-dismiss-problem-dialog',
  standalone: false,
  templateUrl: './dismiss-problem-dialog.html',
  styleUrl: './dismiss-problem-dialog.scss',
})
export class DismissProblemDialog {
  readonly form = new FormGroup({
    notes: new FormControl('', { nonNullable: true }),
  });

  constructor(private readonly dialogRef: MatDialogRef<DismissProblemDialog>) {}

  submit(): void {
    this.dialogRef.close({
      notes: this.form.controls.notes.value.trim(),
    } as DismissProblemDialogResult);
  }
}
