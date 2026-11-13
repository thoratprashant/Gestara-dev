import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SuggestiveOption } from '../../../../shared/components/suggestive-input/suggestive-input';

export interface AssignProblemDialogData {
  category: string;
  problem: string;
  resultId: string;
  task: string;
}

export type AssignProblemDialogResult = AssignProblemDialogData;

@Component({
  selector: 'app-assign-problem-dialog',
  standalone: false,
  templateUrl: './assign-problem-dialog.html',
  styleUrl: './assign-problem-dialog.scss',
})
export class AssignProblemDialog {
  private readonly dialogData = inject<AssignProblemDialogData>(MAT_DIALOG_DATA);

  readonly problemOptions: SuggestiveOption[] = [
    { value: 'Thyroid function', label: 'Endocrine assessment' },
    { value: 'Vitamin D deficiency', label: 'Nutritional deficiency' },
    { value: 'Iron deficiency anemia', label: 'Hematologic condition' },
  ];
  readonly categoryOptions: SuggestiveOption[] = [
    { value: 'Endocrine', label: 'Hormonal and metabolic disorders' },
    { value: 'Hematology', label: 'Blood and related disorders' },
    { value: 'Maternal health', label: 'Pregnancy and postpartum care' },
  ];
  readonly taskOptions: SuggestiveOption[] = [
    { value: 'Review lab results', label: 'Review and document findings' },
    { value: 'Repeat laboratory test', label: 'Schedule repeat testing' },
    { value: 'Patient follow-up', label: 'Contact patient and review plan' },
  ];

  readonly form = new FormGroup({
    problem: new FormControl(this.dialogData.problem, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    category: new FormControl(this.dialogData.category, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    task: new FormControl(this.dialogData.task, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor(
    private readonly dialogRef: MatDialogRef<AssignProblemDialog, AssignProblemDialogResult>,
  ) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({ resultId: this.dialogData.resultId, ...this.form.getRawValue() });
  }
}
