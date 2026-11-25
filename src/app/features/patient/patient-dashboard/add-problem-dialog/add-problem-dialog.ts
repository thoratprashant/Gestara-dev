import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { SuggestiveOption } from '../../../../shared/components/suggestive-input/suggestive-input';

interface ProblemOption {
  name: string;
  code: string;
}

export interface AddProblemDialogResult {
  name: string;
  icd10Code?: string;
  saveToFavorites?: boolean;
}

@Component({
  selector: 'app-add-problem-dialog',
  standalone: false,
  templateUrl: './add-problem-dialog.html',
  styleUrl: './add-problem-dialog.scss',
})
export class AddProblemDialog {
  readonly favorites: ProblemOption[] = [
    { name: 'Gestational hypertension', code: 'ICD-10 O13.3' },
    { name: 'Gestational diabetes', code: 'ICD-10 O24.4' },
    { name: 'Obesity in Pregnancy', code: 'ICD-10 O99.21' },
    { name: 'Fetal growth restriction', code: 'ICD-10 O36.59' },
    { name: 'Chronic Hypertension', code: 'ICD-10 O10.019' },
  ];

  readonly problemLibrary: ProblemOption[] = [
    { name: 'Acute Bronchitis', code: 'ICD-10 J20.9' },
    { name: 'Chronic Obstructive Pulmonary Disease', code: 'ICD-10 J44.1' },
    { name: 'Asthma, Unspecified', code: 'ICD-10 J45.909' },
    { name: 'Mild Intermittent Asthma', code: 'ICD-10 J45.20' },
    { name: 'Mild Persistent Asthma', code: 'ICD-10 J45.30' },
    { name: 'Community Acquired Pneumonia', code: 'ICD-10 J18.9' },
  ];

  readonly icd10Suggestions: SuggestiveOption[] = [
    { value: 'J45.20', label: 'Mild intermittent asthma, uncomplicated' },
    { value: 'J45.30', label: 'Mild persistent asthma, uncomplicated' },
    { value: 'J45.909', label: 'Unspecified asthma, uncomplicated' },
    { value: 'I10', label: 'Essential (primary) hypertension' },
    { value: 'E11.9', label: 'Type 2 diabetes mellitus without complications' },
    { value: 'F33.0', label: 'Major depressive disorder, recurrent, mild' },
  ];

  filteredProblemLibrary = [...this.problemLibrary];
  favoritesExpanded = true;
  saveToFavorites = false;
  readonly selectedProblem = signal<ProblemOption | null>(null);
  private problemLibraryQuery = '';

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    icd10Code: new FormControl('', { nonNullable: true }),
  });

  constructor(private readonly dialogRef: MatDialogRef<AddProblemDialog>) {}

  filterProblemLibrary(event: Event): void {
    this.problemLibraryQuery = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase();
    this.refreshFilteredProblemLibrary();
  }

  private refreshFilteredProblemLibrary(): void {
    this.filteredProblemLibrary = this.problemLibrary.filter((problem) =>
      `${problem.name} ${problem.code}`.toLocaleLowerCase().includes(this.problemLibraryQuery),
    );
  }

  toggleFavorites(): void {
    this.favoritesExpanded = !this.favoritesExpanded;
  }

  toggleSaveToFavorites(): void {
    this.saveToFavorites = !this.saveToFavorites;
  }

  selectProblem(problem: ProblemOption): void {
    if (this.selectedProblem()?.code === problem.code) {
      this.clearProblemSelection();
      return;
    }

    this.selectedProblem.set(problem);
    this.form.reset({ name: '', icd10Code: '' });
  }

  isFavorite(problem: ProblemOption): boolean {
    return this.favorites.some((favorite) => favorite.code === problem.code);
  }

  toggleProblemFavorite(event: Event, problem: ProblemOption): void {
    event.stopPropagation();

    const favoriteIndex = this.favorites.findIndex((favorite) => favorite.code === problem.code);

    if (favoriteIndex >= 0) {
      this.favorites.splice(favoriteIndex, 1);
      if (!this.problemLibrary.some((libraryProblem) => libraryProblem.code === problem.code)) {
        this.problemLibrary.push(problem);
      }
      this.refreshFilteredProblemLibrary();
      return;
    }

    this.favorites.push(problem);
    const libraryIndex = this.problemLibrary.findIndex(
      (libraryProblem) => libraryProblem.code === problem.code,
    );
    if (libraryIndex >= 0) {
      this.problemLibrary.splice(libraryIndex, 1);
    }
    this.refreshFilteredProblemLibrary();
  }

  handleProblemRowKeydown(event: KeyboardEvent, problem: ProblemOption): void {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.selectProblem(problem);
  }

  clearProblemSelection(): void {
    this.selectedProblem.set(null);
  }

  submit(): void {
    const selectedProblem = this.selectedProblem();

    if (selectedProblem) {
      this.dialogRef.close({
        name: selectedProblem.name,
        icd10Code: selectedProblem.code,
        saveToFavorites: this.saveToFavorites,
      });
      return;
    }

    const name = this.form.controls.name.value.trim();
    const icd10Code = this.form.controls.icd10Code.value.trim();

    if (this.form.invalid || !name) {
      this.form.controls.name.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      name,
      ...(icd10Code ? { icd10Code } : {}),
      saveToFavorites: this.saveToFavorites,
    });
  }
}
