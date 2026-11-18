import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface DismissProblemDialogData {
  icdCode: string;
  problemName: string;
}

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

  readonly displayIcdCode: string;

  constructor(
    private readonly dialogRef: MatDialogRef<DismissProblemDialog>,
    @Inject(MAT_DIALOG_DATA) readonly data: DismissProblemDialogData,
  ) {
    this.displayIcdCode = data.icdCode.replace(/^ICD-10\s*/i, '');
  }

  submit(): void {
    this.dialogRef.close({
      notes: this.form.controls.notes.value.trim(),
    } as DismissProblemDialogResult);
  }
}
