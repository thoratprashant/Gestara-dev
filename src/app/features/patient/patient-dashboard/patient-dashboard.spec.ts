import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { PatientDashboard } from './patient-dashboard';
import { PatientDashboardModule } from './patient-dashboard.module';
import { AddProblemDialog } from './add-problem-dialog/add-problem-dialog';
import { AssignProblemDialog } from './assign-problem-dialog/assign-problem-dialog';
import { DismissProblemDialog } from './dismiss-problem-dialog/dismiss-problem-dialog';
import { TimelineItemDialog } from './timeline-item-dialog/timeline-item-dialog';
import { TimelineTaskDialog } from './timeline-task-dialog/timeline-task-dialog';

describe('PatientDashboard timeline', () => {
  beforeAll(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientDashboardModule],
    }).compileComponents();
  });

  it('shows the empty state when there is no active pregnancy data', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    dashboard.pregnancyTimeline.set({ ...dashboard.pregnancyTimeline(), groups: [] });
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.pregnancy-empty-state') as HTMLElement;

    expect(emptyState).toBeTruthy();
    expect(emptyState.querySelector('img')?.getAttribute('src')).toBe('assets/not-found-img.png');
    expect(emptyState.querySelector('h1')?.textContent?.trim()).toBe('No Active Pregnancy');
    expect(fixture.nativeElement.querySelector('.patient-summary')).toBeNull();
  });

  it('starts with all four configured problem groups expanded and toggles each independently', () => {
    const dashboard = new PatientDashboard();
    const groups = dashboard.pregnancyTimeline().groups;

    expect(groups).toHaveLength(4);
    expect(groups.every((group) => dashboard.isTimelineGroupExpanded(group.id))).toBe(true);

    dashboard.toggleTimelineGroup(groups[3].id);
    expect(dashboard.isTimelineGroupExpanded(groups[3].id)).toBe(false);
    expect(dashboard.isTimelineGroupExpanded(groups[0].id)).toBe(true);

    dashboard.toggleTimelineGroup(groups[0].id);
    expect(dashboard.isTimelineGroupExpanded(groups[0].id)).toBe(false);
    expect(dashboard.isTimelineGroupExpanded(groups[3].id)).toBe(false);
  });

  it('uses the configured problem names and category labels without changing task chips', () => {
    const dashboard = new PatientDashboard();
    const groups = dashboard.pregnancyTimeline().groups;

    expect(groups.map((group) => group.label)).toEqual([
      'Routine Prenatal Care',
      'Elevated Blood Pressure Without Diagnosis of Hypertension',
      'Advanced Maternal Age',
      'Gestational Hypertension without Proteinuria',
    ]);
    expect(groups.map((group) => group.rows.map((row) => row.label))).toEqual([
      [
        'Routine Labs',
        'Routine Ultrasounds',
        'Aneuploidy screening',
        'Genetic screening',
        'Counseling',
        'Social/Behavioral Screening',
        'Immunizations',
        'Delivery planning',
      ],
      ['Home blood pressure monitoring', 'Screening pre-eclampsia labs'],
      ['Counseling', 'Ultrasounds', 'Antenatal surveillance'],
      [
        'Home blood pressure monitoring',
        'Screening pre-eclampsia labs',
        'Growth Ultrasound',
        'Antenatal surveillance',
      ],
    ]);
    expect(groups.flatMap((group) => group.rows).flatMap((row) => row.chips)).toHaveLength(42);
  });

  it('reorders timeline groups by drag and keyboard and keeps each change undoable', () => {
    const dashboard = new PatientDashboard();
    const originalGroupIds = dashboard.pregnancyTimeline().groups.map((group) => group.id);

    dashboard.reorderTimelineGroup({
      previousIndex: 0,
      currentIndex: 2,
    } as Parameters<PatientDashboard['reorderTimelineGroup']>[0]);

    expect(dashboard.pregnancyTimeline().groups.map((group) => group.id)).toEqual([
      originalGroupIds[1],
      originalGroupIds[2],
      originalGroupIds[0],
      ...originalGroupIds.slice(3),
    ]);
    expect(dashboard.canUndoTimeline()).toBe(true);

    dashboard.undoTimelineChange();
    expect(dashboard.pregnancyTimeline().groups.map((group) => group.id)).toEqual(originalGroupIds);

    const keyboardEvent = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    dashboard.moveTimelineGroupWithKeyboard(keyboardEvent, 0);

    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
    expect(
      dashboard
        .pregnancyTimeline()
        .groups.slice(0, 2)
        .map((group) => group.id),
    ).toEqual([originalGroupIds[1], originalGroupIds[0]]);
  });

  it('reorders rows within a timeline group by drag and keyboard and keeps changes undoable', () => {
    const dashboard = new PatientDashboard();
    const group = dashboard.pregnancyTimeline().groups[0];
    const originalRowIds = group.rows.map((row) => row.id);

    dashboard.reorderTimelineRow(group.id, {
      previousIndex: 0,
      currentIndex: 2,
    } as Parameters<PatientDashboard['reorderTimelineRow']>[1]);

    expect(dashboard.pregnancyTimeline().groups[0].rows.map((row) => row.id)).toEqual([
      originalRowIds[1],
      originalRowIds[2],
      originalRowIds[0],
      ...originalRowIds.slice(3),
    ]);
    expect(dashboard.canUndoTimeline()).toBe(true);

    dashboard.undoTimelineChange();
    expect(dashboard.pregnancyTimeline().groups[0].rows.map((row) => row.id)).toEqual(
      originalRowIds,
    );

    const keyboardEvent = {
      key: 'ArrowDown',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    dashboard.moveTimelineRowWithKeyboard(keyboardEvent, group.id, 0);

    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
    expect(
      dashboard
        .pregnancyTimeline()
        .groups[0].rows.slice(0, 2)
        .map((row) => row.id),
    ).toEqual([originalRowIds[1], originalRowIds[0]]);
  });

  it('opens the timeline dialog and flags duplicate categories within the selected problem', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.problem-timeline__group-add',
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    expect(dialog.openDialogs).toHaveLength(1);
    const dialogComponent = dialog.openDialogs[0].componentInstance as TimelineItemDialog;
    expect(dialogComponent.mode()).toBe('category');
    expect(
      Object.values(dialogComponent.categoryForm.controls).every((control) => control.enabled),
    ).toBe(true);

    dialogComponent.categoryForm.controls.name.setValue(' routine labs ');
    dialogComponent.submit();
    fixture.detectChanges();

    expect(dialogComponent.duplicateCategoryName()).toBe('Routine Labs');
    expect(
      dialog.openDialogs[0].componentRef?.location.nativeElement.querySelector(
        '.timeline-item-dialog__duplicate-error',
      )?.textContent,
    ).toContain('A category named "Routine Labs" already exists under this problem.');

    dialogComponent.setMode('medication');
    expect(dialogComponent.mode()).toBe('medication');
    expect(
      Object.values(dialogComponent.medicationForm.controls).every((control) => control.enabled),
    ).toBe(true);

    dialog.closeAll();
  });

  it('adds the submitted dialog item to the selected timeline group and keeps undo available', () => {
    const dialog = {
      open: vi.fn(() => ({
        afterClosed: () =>
          of({
            endWeek: 32.5,
            mode: 'category' as const,
            name: 'Weekly glucose review',
            startWeek: 28.5,
          }),
      })),
    } as unknown as MatDialog;
    const dashboard = new PatientDashboard(dialog);
    const group = dashboard.pregnancyTimeline().groups[0];
    const originalRowCount = group.rows.length;

    dashboard.openTimelineItemDialog(group.id);

    expect(dialog.open).toHaveBeenCalledWith(
      TimelineItemDialog,
      expect.objectContaining({ restoreFocus: false }),
    );
    const updatedGroup = dashboard.pregnancyTimeline().groups[0];
    expect(updatedGroup.rows).toHaveLength(originalRowCount + 1);
    expect(updatedGroup.rows.at(-1)?.label).toBe('Weekly glucose review');
    expect(updatedGroup.rows.at(-1)?.chips[0]).toMatchObject({
      startWeek: 28.5,
      endWeek: 32.5,
      status: 'future',
    });
    expect(dashboard.canUndoTimeline()).toBe(true);
  });

  it('opens the dismiss problem dialog and saves its notes after confirmation', () => {
    const dialog = {
      open: vi.fn(() => ({
        afterClosed: () => of({ notes: 'Blood pressure normalized after repeat testing.' }),
      })),
    } as unknown as MatDialog;
    const dashboard = new PatientDashboard(dialog);
    const problem = dashboard.suggestedProblems()[0];

    dashboard.declineSuggestedProblem(problem);

    expect(dialog.open).toHaveBeenCalledWith(
      DismissProblemDialog,
      expect.objectContaining({
        autoFocus: '#dismiss-problem-notes',
        data: {
          icdCode: problem.icdCode,
          problemName: problem.name,
        },
        panelClass: 'timeline-item-dialog-panel',
        restoreFocus: false,
        width: '422px',
      }),
    );
    expect(dashboard.suggestedProblems()).not.toContainEqual(problem);
    expect(dashboard.declinedProblems()).toContainEqual({
      ...problem,
      dismissalNotes: 'Blood pressure normalized after repeat testing.',
      id: `declined-${problem.id}`,
    });
  });

  it('shows saved dismissal notes below the declined problem metric', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    const problem = dashboard.declinedProblems()[0];

    dashboard.declinedProblems.set([
      { ...problem, dismissalNotes: 'Blood pressure normalized after repeat testing.' },
    ]);
    fixture.detectChanges();

    const notes = fixture.nativeElement.querySelector(
      '#declined-problems-list .problem-review__dismissal-notes',
    ) as HTMLElement;

    expect(notes.textContent).toContain('Notes:');
    expect(notes.textContent).toContain('Blood pressure normalized after repeat testing.');
  });

  it('edits a timeline row label and keeps the change undoable', () => {
    const dashboard = new PatientDashboard();
    const group = dashboard.pregnancyTimeline().groups[0];
    const row = group.rows[0];

    dashboard.beginTimelineRowEdit(group.id, row);
    dashboard.updateTimelineRowEditValue({
      target: { value: 'Updated screening' },
    } as unknown as Event);
    dashboard.saveTimelineRowEdit();

    expect(dashboard.pregnancyTimeline().groups[0].rows[0].label).toBe('Updated screening');
    expect(dashboard.editingTimelineRow()).toBeNull();
    expect(dashboard.canUndoTimeline()).toBe(true);

    dashboard.undoTimelineChange();
    expect(dashboard.pregnancyTimeline().groups[0].rows[0].label).toBe(row.label);
  });

  it('shows row edit controls and opens the add-task dialog from the row action', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const firstRow = fixture.nativeElement.querySelector('.problem-timeline__row') as HTMLElement;
    const dragHandle = firstRow.querySelector(
      '.problem-timeline__row-drag-handle',
    ) as HTMLButtonElement;
    const editButton = firstRow.querySelector(
      '.problem-timeline__label-action--edit',
    ) as HTMLButtonElement;
    const addButton = firstRow.querySelector(
      '.problem-timeline__label-action--add',
    ) as HTMLButtonElement;

    expect(dragHandle).toBeTruthy();
    expect(dragHandle.getAttribute('aria-label')).toContain('Use up and down arrow keys');
    expect(editButton).toBeTruthy();
    expect(addButton).toBeTruthy();

    editButton.click();
    fixture.detectChanges();
    expect(firstRow.querySelector('.problem-timeline__label-input')).toBeTruthy();
    expect(firstRow.querySelector('.problem-timeline__label-action--confirm')).toBeTruthy();

    fixture.componentInstance.cancelTimelineRowEdit();
    fixture.detectChanges();
    (firstRow.querySelector('.problem-timeline__label-action--add') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialog.openDialogs).toHaveLength(1);
    expect(dialog.openDialogs[0].componentInstance).toBeInstanceOf(TimelineTaskDialog);

    dialog.closeAll();
  });

  it('adds a submitted task to the selected row and keeps it undoable', () => {
    const dialog = {
      open: vi.fn(() => ({
        afterClosed: () =>
          of({
            endWeek: 34,
            name: 'Follow-up glucose screening',
            startWeek: 30,
          }),
      })),
    } as unknown as MatDialog;
    const dashboard = new PatientDashboard(dialog);
    const group = dashboard.pregnancyTimeline().groups[0];
    const row = group.rows[0];
    const originalChipCount = row.chips.length;

    dashboard.openTimelineTaskDialog(group.id, row.id);

    expect(dialog.open).toHaveBeenCalledWith(
      TimelineTaskDialog,
      expect.objectContaining({
        panelClass: 'timeline-task-dialog-panel',
        width: '422px',
      }),
    );
    const updatedRow = dashboard.pregnancyTimeline().groups[0].rows[0];
    expect(updatedRow.chips).toHaveLength(originalChipCount + 1);
    expect(updatedRow.chips.at(-1)).toMatchObject({
      endWeek: 34,
      label: 'Follow-up glucose screening',
      startWeek: 30,
    });
    expect(dashboard.canUndoTimeline()).toBe(true);
  });

  it('validates and submits the Add Task dialog fields', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.problem-timeline__label-action--add',
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    const dialogRef = dialog.openDialogs[0];
    const closeSpy = vi.spyOn(dialogRef, 'close');
    const taskDialog = dialog.openDialogs[0].componentInstance as TimelineTaskDialog;
    taskDialog.form.setValue({
      endWeek: 28,
      name: 'Glucose screening',
      startWeek: 30,
    });
    taskDialog.submit();
    fixture.detectChanges();
    expect(taskDialog.form.hasError('invalidWeekRange')).toBe(true);
    expect(dialog.openDialogs).toHaveLength(1);

    taskDialog.form.controls.endWeek.setValue(32);
    taskDialog.submit();
    expect(closeSpy).toHaveBeenCalledWith({
      endWeek: 32,
      name: 'Glucose screening',
      startWeek: 30,
    });
  });

  it('opens the Add Problem Material dialog with an enabled problem-name field', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addProblemButton = fixture.nativeElement.querySelector(
      '.problem-timeline__add-problem',
    ) as HTMLButtonElement;
    addProblemButton.click();
    fixture.detectChanges();

    expect(dialog.openDialogs).toHaveLength(1);
    const dialogComponent = dialog.openDialogs[0].componentInstance as AddProblemDialog;
    expect(dialogComponent.form.controls.name.enabled).toBe(true);

    dialog.closeAll();
  });

  it('toggles favorite and library selections and submits the active selection', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addProblemButton = fixture.nativeElement.querySelector(
      '.problem-timeline__add-problem',
    ) as HTMLButtonElement;
    addProblemButton.click();
    fixture.detectChanges();

    const dialogRef = dialog.openDialogs[0];
    const closeSpy = vi.spyOn(dialogRef, 'close');
    const dialogElement = dialogRef.componentRef?.location.nativeElement as HTMLElement;
    const dialogComponent = dialogRef.componentInstance as AddProblemDialog;
    const favorite = dialogElement.querySelector(
      '.add-problem-dialog__list--favorites .add-problem-dialog__problem-row',
    ) as HTMLButtonElement;
    const library = dialogElement.querySelector(
      '.add-problem-dialog__list--library .add-problem-dialog__problem-row',
    ) as HTMLButtonElement;

    favorite.click();
    fixture.detectChanges();
    expect(favorite.getAttribute('aria-pressed')).toBe('true');
    expect(favorite.querySelector('.add-problem-dialog__selected-check')).toBeTruthy();
    expect(dialogComponent.form.getRawValue()).toEqual({ name: '', icd10Code: '' });

    library.click();
    fixture.detectChanges();
    expect(favorite.getAttribute('aria-pressed')).toBe('false');
    expect(library.getAttribute('aria-pressed')).toBe('true');
    expect(dialogElement.querySelectorAll('.add-problem-dialog__selected-check')).toHaveLength(1);

    library.click();
    fixture.detectChanges();
    expect(library.getAttribute('aria-pressed')).toBe('false');
    expect(dialogElement.querySelector('.add-problem-dialog__selected-check')).toBeNull();

    library.click();
    fixture.detectChanges();

    dialogComponent.submit();
    expect(closeSpy).toHaveBeenCalledWith({
      icd10Code: 'J20.9',
      name: 'Acute Bronchitis',
      saveToFavorites: false,
    });
  });

  it('moves problems between My Favorites and Problem Library using each row star', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addProblemButton = fixture.nativeElement.querySelector(
      '.problem-timeline__add-problem',
    ) as HTMLButtonElement;
    addProblemButton.click();
    fixture.detectChanges();

    const dialogRef = dialog.openDialogs[0];
    const dialogElement = dialogRef.componentRef?.location.nativeElement as HTMLElement;
    const dialogComponent = dialogRef.componentInstance as AddProblemDialog;
    const favoriteRow = dialogElement.querySelector(
      '.add-problem-dialog__list--favorites .add-problem-dialog__problem-row',
    ) as HTMLElement;
    const initialFavoriteName = favoriteRow.querySelector(
      '.add-problem-dialog__problem-name',
    )?.textContent;
    const initialFavoriteStar = favoriteRow.querySelector(
      '.add-problem-dialog__problem-favorite',
    ) as HTMLButtonElement;

    initialFavoriteStar.click();
    fixture.detectChanges();

    expect(
      Array.from(
        dialogElement.querySelectorAll(
          '.add-problem-dialog__list--favorites .add-problem-dialog__problem-row',
        ),
      ).some((row) => row.textContent?.includes(initialFavoriteName ?? '')),
    ).toBe(false);
    const movedToLibrary = Array.from(
      dialogElement.querySelectorAll(
        '.add-problem-dialog__list--library .add-problem-dialog__problem-row',
      ),
    ).find((row) => row.textContent?.includes(initialFavoriteName ?? '')) as HTMLElement;
    expect(movedToLibrary).toBeTruthy();
    expect(
      movedToLibrary
        .querySelector('.add-problem-dialog__problem-favorite')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');

    const libraryRow = dialogElement.querySelector(
      '.add-problem-dialog__list--library .add-problem-dialog__problem-row',
    ) as HTMLElement;
    const libraryProblemName = libraryRow.querySelector(
      '.add-problem-dialog__problem-name',
    )?.textContent;
    const libraryStar = libraryRow.querySelector(
      '.add-problem-dialog__problem-favorite',
    ) as HTMLButtonElement;

    libraryStar.click();
    fixture.detectChanges();

    expect(dialogComponent.selectedProblem()).toBeNull();
    expect(
      Array.from(
        dialogElement.querySelectorAll(
          '.add-problem-dialog__list--library .add-problem-dialog__problem-row',
        ),
      ).some((row) => row.textContent?.includes(libraryProblemName ?? '')),
    ).toBe(false);

    const addedFavorite = Array.from(
      dialogElement.querySelectorAll(
        '.add-problem-dialog__list--favorites .add-problem-dialog__problem-row',
      ),
    ).find((row) => row.textContent?.includes(libraryProblemName ?? '')) as HTMLElement;
    expect(addedFavorite).toBeTruthy();
    const favoriteStar = addedFavorite.querySelector(
      '.add-problem-dialog__problem-favorite',
    ) as HTMLButtonElement;
    expect(favoriteStar.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteStar.querySelector('img')?.getAttribute('src')).toBe(
      'assets/problem-dialog/star-filled.svg',
    );

    favoriteStar.click();
    fixture.detectChanges();

    expect(dialogComponent.selectedProblem()).toBeNull();
    const returnedLibraryRow = Array.from(
      dialogElement.querySelectorAll(
        '.add-problem-dialog__list--library .add-problem-dialog__problem-row',
      ),
    ).find((row) => row.textContent?.includes(libraryProblemName ?? '')) as HTMLElement;
    expect(returnedLibraryRow).toBeTruthy();
    expect(
      returnedLibraryRow
        .querySelector('.add-problem-dialog__problem-favorite')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(returnedLibraryRow.querySelector('img')?.getAttribute('src')).toBe(
      'assets/problem-dialog/star-outline.svg',
    );
    expect(
      Array.from(
        dialogElement.querySelectorAll(
          '.add-problem-dialog__list--favorites .add-problem-dialog__problem-row',
        ),
      ).some((row) => row.textContent?.includes(libraryProblemName ?? '')),
    ).toBe(false);

    dialog.closeAll();
  });

  it('shows a configuration warning when the problem library has no matching problem', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const addProblemButton = fixture.nativeElement.querySelector(
      '.problem-timeline__add-problem',
    ) as HTMLButtonElement;
    addProblemButton.click();
    fixture.detectChanges();

    const dialogRef = dialog.openDialogs[0];
    const dialogElement = dialogRef.componentRef?.location.nativeElement as HTMLElement;
    const search = dialogElement.querySelector('#problem-library-search') as HTMLInputElement;

    search.value = 'Recurrent pelvic pressure';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const searchContainer = dialogElement.querySelector('.add-problem-dialog__search');
    const warning = dialogElement.querySelector('.add-problem-dialog__library-error');

    expect(searchContainer?.classList.contains('add-problem-dialog__search--invalid')).toBe(true);
    expect(search.getAttribute('aria-invalid')).toBe('true');
    expect(warning?.getAttribute('role')).toBe('alert');
    expect(warning?.textContent?.trim()).toBe('This Problem is not in the configuration list.');
    expect(dialogElement.querySelector('.add-problem-dialog__list--library')).toBeNull();
    expect(dialogElement.querySelector('.add-problem-dialog__hint')).toBeNull();

    dialog.closeAll();
  });

  it('opens the Assign Problem dialog with defaults for the selected Epic result', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();

    const assignButton = fixture.nativeElement.querySelector(
      '.unmatched-result__assign',
    ) as HTMLButtonElement;
    assignButton.click();
    fixture.detectChanges();

    expect(dialog.openDialogs).toHaveLength(1);
    const dialogComponent = dialog.openDialogs[0].componentInstance as AssignProblemDialog;
    expect(dialogComponent.form.getRawValue()).toEqual({
      problem: 'Thyroid function',
      category: 'Endocrine',
      task: 'Review lab results',
    });

    const dialogElement = dialog.openDialogs[0].componentRef?.location.nativeElement as HTMLElement;
    const suggestionInputs = dialogElement.querySelectorAll(
      'app-suggestive-input input[role="combobox"]',
    );
    expect(suggestionInputs).toHaveLength(3);

    const problemInput = suggestionInputs.item(0) as HTMLInputElement;
    problemInput.value = 'vitamin';
    problemInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const problemSuggestions = dialogElement.querySelectorAll(
      '#assign-problem-problem-suggestions .suggestive-input__option',
    );
    expect(problemSuggestions).toHaveLength(1);
    expect(problemSuggestions.item(0).textContent).toContain('Vitamin D deficiency');
    expect(problemSuggestions.item(0).textContent).toContain('Nutritional deficiency');
    expect(
      problemSuggestions.item(0).querySelector('.assign-problem-dialog__icd-code')?.textContent,
    ).toContain('E55.9');

    (problemSuggestions.item(0) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(dialogComponent.form.controls.problem.value).toBe('Vitamin D deficiency');
    expect(dialogElement.querySelector('#assign-problem-problem-suggestions')).toBeNull();

    dialog.closeAll();
  });

  it('shows a red outlined Ignore action before Assign for every unmatched result', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const results = Array.from(
      fixture.nativeElement.querySelectorAll('.unmatched-result'),
    ) as HTMLElement[];

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      const ignore = result.querySelector('.unmatched-result__ignore') as HTMLButtonElement;
      const assign = result.querySelector('.unmatched-result__assign') as HTMLButtonElement;

      expect(ignore.textContent?.trim()).toBe('Ignore');
      expect(assign.textContent?.trim()).toBe('Assign to Problem');
      expect(
        ignore.compareDocumentPosition(assign) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('removes an unmatched result from the list when Ignore is clicked', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('.unmatched-results__list') as HTMLElement;
    const firstResult = list.querySelector('.unmatched-result') as HTMLElement;
    expect(firstResult.textContent).toContain('Thyroid Panel');

    const ignore = firstResult.querySelector('.unmatched-result__ignore') as HTMLButtonElement;
    ignore.click();
    fixture.detectChanges();

    const remainingResults = list.querySelectorAll('.unmatched-result');
    expect(remainingResults).toHaveLength(2);
    expect(list.textContent).not.toContain('Thyroid Panel');
    expect(list.textContent).toContain('Vitamin D');
    expect(list.textContent).toContain('Ferritin');
  });

  it('places the Add Problem action after the timeline groups', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const groups = fixture.nativeElement.querySelectorAll(
      '.problem-timeline__group',
    ) as NodeListOf<HTMLElement>;
    const lastGroup = groups.item(groups.length - 1);
    const addProblemButton = fixture.nativeElement.querySelector(
      '.problem-timeline__add-problem',
    ) as HTMLButtonElement;

    expect(
      lastGroup.compareDocumentPosition(addProblemButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows condition-specific tooltip content from every timeline group toggle', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const dashboard = fixture.componentInstance;
    const groups = dashboard.pregnancyTimeline().groups;
    const toggles = Array.from(
      fixture.nativeElement.querySelectorAll('.problem-timeline__group-toggle'),
    ) as HTMLButtonElement[];

    expect(toggles).toHaveLength(groups.length);
    expect(new Set(groups.map((group) => group.condition.tags[0].label)).size).toBe(groups.length);

    toggles.forEach((toggle, index) => {
      toggle.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector(
        '#timeline-condition-tooltip',
      ) as HTMLElement;
      expect(tooltip.textContent).toContain(groups[index].label);
      expect(tooltip.textContent).toContain(groups[index].condition.tags[0].label);
      expect(tooltip.textContent).toContain(groups[index].condition.description);
      expect(fixture.nativeElement.querySelector('.tooltip-glass-overlay')).toBeNull();
    });
  });

  it('confirms before removing a timeline problem', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const dashboard = fixture.componentInstance;
    const group = dashboard.pregnancyTimeline().groups[0];
    const toggle = fixture.nativeElement.querySelector(
      '.problem-timeline__group-toggle',
    ) as HTMLButtonElement;

    toggle.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__delete',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip--remove',
    ) as HTMLElement;
    expect(confirmation.getAttribute('role')).toBe('alertdialog');
    expect(confirmation.textContent).toContain('Remove Problem?');
    expect(confirmation.textContent).toContain(`${group.condition.tags[0].label} - ${group.label}`);
    expect(dashboard.pregnancyTimeline().groups.some((item) => item.id === group.id)).toBe(true);

    const cancelButton = confirmation.querySelector(
      '.timeline-condition-tooltip__cancel',
    ) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.timeline-condition-tooltip--remove')).toBeNull();
    expect(dashboard.pregnancyTimeline().groups.some((item) => item.id === group.id)).toBe(true);

    const reopenedDeleteButton = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__delete',
    ) as HTMLButtonElement;
    reopenedDeleteButton.click();
    fixture.detectChanges();

    const removeButton = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__remove',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(dashboard.pregnancyTimeline().groups.some((item) => item.id === group.id)).toBe(false);
    expect(fixture.nativeElement.querySelector('#timeline-condition-tooltip')).toBeNull();
    expect(dashboard.canUndoTimeline()).toBe(true);
  });

  it('confirms resolution, saves notes, and moves the muted problem to the bottom', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const dashboard = fixture.componentInstance;
    const group = dashboard.pregnancyTimeline().groups[0];
    const toggle = fixture.nativeElement.querySelector(
      '.problem-timeline__group-toggle',
    ) as HTMLButtonElement;

    toggle.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const resolveButton = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__resolve',
    ) as HTMLButtonElement;
    resolveButton.click();
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip--resolve-confirmation',
    ) as HTMLElement;
    expect(confirmation.getAttribute('role')).toBe('alertdialog');
    expect(confirmation.textContent).toContain('Resolve Problem');
    expect(confirmation.textContent).toContain(`Mark “${group.label}” as resolved?`);

    const notes = confirmation.querySelector('textarea') as HTMLTextAreaElement;
    notes.value = 'Reviewed with the patient; no further follow-up is needed.';
    notes.dispatchEvent(new Event('input'));

    const confirmButton = confirmation.querySelector(
      '.timeline-condition-tooltip__confirm-resolve',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    const resolvedGroup = dashboard.pregnancyTimeline().groups.at(-1);
    expect(resolvedGroup).toMatchObject({
      id: group.id,
      resolutionNotes: 'Reviewed with the patient; no further follow-up is needed.',
      resolved: true,
    });

    const renderedGroups = fixture.nativeElement.querySelectorAll(
      '.problem-timeline__group',
    ) as NodeListOf<HTMLElement>;
    const renderedResolvedGroup = renderedGroups.item(renderedGroups.length - 1);
    expect(renderedResolvedGroup.classList.contains('problem-timeline__group--resolved')).toBe(
      true,
    );

    const resolvedToggle = renderedResolvedGroup.querySelector(
      '.problem-timeline__group-toggle',
    ) as HTMLButtonElement;
    resolvedToggle.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const description = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__description',
    ) as HTMLElement;
    const savedNotes = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__saved-notes',
    ) as HTMLElement;
    expect(
      description.compareDocumentPosition(savedNotes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(savedNotes.textContent).toContain(
      'Reviewed with the patient; no further follow-up is needed.',
    );

    const reactivateButton = fixture.nativeElement.querySelector(
      '.timeline-condition-tooltip__reactivate',
    ) as HTMLButtonElement;
    expect(reactivateButton.textContent?.trim()).toBe('Reactivate');
    reactivateButton.click();
    fixture.detectChanges();

    expect(dashboard.pregnancyTimeline().groups[0]).toMatchObject({
      id: group.id,
      resolved: false,
    });
    const restoredGroup = fixture.nativeElement.querySelector(
      '.problem-timeline__group',
    ) as HTMLElement;
    expect(restoredGroup.classList.contains('problem-timeline__group--resolved')).toBe(false);
    expect(fixture.nativeElement.querySelector('#timeline-condition-tooltip')).toBeNull();
    expect(dashboard.canUndoTimeline()).toBe(true);
  });

  it('keeps the full Figma tooltip visible by opening above groups near the viewport edge', () => {
    const dashboard = new PatientDashboard();
    const toggle = document.createElement('button');
    const icon = document.createElement('img');
    icon.className = 'problem-timeline__group-icon';
    toggle.appendChild(icon);
    const group = dashboard.pregnancyTimeline().groups[0];
    vi.spyOn(toggle, 'getBoundingClientRect').mockReturnValue({
      bottom: 740,
      height: 40,
      left: 120,
      right: 300,
      top: 700,
      width: 180,
    } as DOMRect);
    vi.spyOn(icon, 'getBoundingClientRect').mockReturnValue({
      bottom: 726,
      height: 14,
      left: 140,
      right: 154,
      top: 712,
      width: 14,
    } as DOMRect);

    dashboard.showTimelineGroupTooltip(group, { currentTarget: toggle } as unknown as Event);

    expect(dashboard.timelineGroupTooltipPosition()).toEqual({
      bottom: 72,
      left: 140,
      placement: 'above',
      top: null,
      width: 350,
    });
    expect(dashboard.timelineGroupTooltipMaxHeight()).toBe(360);
    expect(dashboard.tooltipGlassActive()).toBe(false);
  });

  it('keeps the condition tooltip inside narrow viewports', () => {
    const viewportWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
    const dashboard = new PatientDashboard();
    const toggle = document.createElement('button');
    const icon = document.createElement('img');
    icon.className = 'problem-timeline__group-icon';
    toggle.appendChild(icon);
    vi.spyOn(toggle, 'getBoundingClientRect').mockReturnValue({
      bottom: 240,
      height: 40,
      left: 270,
      right: 320,
      top: 200,
      width: 50,
    } as DOMRect);
    vi.spyOn(icon, 'getBoundingClientRect').mockReturnValue({
      bottom: 226,
      height: 14,
      left: 286,
      right: 300,
      top: 212,
      width: 14,
    } as DOMRect);

    dashboard.showTimelineGroupTooltip(dashboard.pregnancyTimeline().groups[0], {
      currentTarget: toggle,
    } as unknown as Event);
    dashboard.onWindowResize();

    expect(dashboard.timelineGroupTooltipPosition()).toMatchObject({
      left: 12,
      width: 296,
    });
    viewportWidth.mockRestore();
  });

  it('keeps the condition tooltip open while the pointer moves from its trigger', () => {
    vi.useFakeTimers();

    try {
      const dashboard = new PatientDashboard();
      const toggle = document.createElement('button');
      const group = dashboard.pregnancyTimeline().groups[0];

      dashboard.showTimelineGroupTooltip(group, {
        currentTarget: toggle,
      } as unknown as Event);
      dashboard.scheduleTimelineGroupTooltipHide();
      vi.advanceTimersByTime(250);
      dashboard.keepTimelineGroupTooltipOpen();
      vi.advanceTimersByTime(400);

      expect(dashboard.activeTimelineGroupTooltip()).toBe(group);
    } finally {
      vi.useRealTimers();
    }
  });

  it('adds a submitted problem as an expandable timeline group with undo support', () => {
    const dialog = {
      open: vi.fn(() => ({
        afterClosed: () => of({ name: 'Maternal anemia' }),
      })),
    } as unknown as MatDialog;
    const dashboard = new PatientDashboard(dialog);
    const originalGroupCount = dashboard.pregnancyTimeline().groups.length;

    dashboard.openAddProblemDialog();

    expect(dialog.open).toHaveBeenCalledWith(
      AddProblemDialog,
      expect.objectContaining({ restoreFocus: false }),
    );
    const addedGroup = dashboard.pregnancyTimeline().groups.at(-1);
    expect(dashboard.pregnancyTimeline().groups).toHaveLength(originalGroupCount + 1);
    expect(addedGroup).toMatchObject({ label: 'Maternal anemia', rows: [] });
    expect(addedGroup && dashboard.isTimelineGroupExpanded(addedGroup.id)).toBe(true);
    expect(dashboard.canUndoTimeline()).toBe(true);
  });

  it('uses the Figma legend statuses and keeps edge ticks centered inside the axis', () => {
    const dashboard = new PatientDashboard();

    expect(dashboard.timelineLegend.map((item) => item.label)).toEqual([
      'Completed/Reviewed',
      'Completed/Not Reviewed',
      'Ordered',
      'Due Soon',
      'Late',
      'Incomplete',
      'Future',
      'Declined',
    ]);
    expect(dashboard.weekTickPercent(0)).toBeGreaterThan(0);
    expect(dashboard.weekTicks).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42]);
    expect(dashboard.weekTickPercent(42)).toBeLessThan(100);
  });

  it('assigns the requested Routine Labs tasks and uses each task name as its tooltip title', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();
    const routineLabs = dashboard.pregnancyTimeline().groups[0].rows[0];

    expect(routineLabs).toMatchObject({
      label: 'Routine Labs',
      chips: [
        {
          label: 'First trimester labs',
          startWeek: 0,
          endWeek: 13,
          status: 'completed',
        },
        {
          label: 'Third trimester labs',
          startWeek: 24,
          endWeek: 30,
          status: 'due-soon',
        },
        { label: 'GBS', startWeek: 36, endWeek: 37, status: 'future' },
      ],
    });

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.problem-timeline__group:first-of-type .problem-timeline__row:first-of-type .problem-timeline__chip',
      ),
    ) as HTMLElement[];

    chips.forEach((chip, index) => {
      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector(
        '#timeline-status-tooltip h2, #due-soon-tooltip h2',
      ) as HTMLElement;
      expect(title.textContent?.trim()).toBe(routineLabs.chips[index].label);
    });
  });

  it('assigns the requested Routine Ultrasounds task and uses its name as the tooltip title', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();
    const routineUltrasounds = dashboard.pregnancyTimeline().groups[0].rows[1];

    expect(routineUltrasounds).toMatchObject({
      label: 'Routine Ultrasounds',
      chips: [
        {
          label: 'First trimester limited ultrasound',
          startWeek: 0,
          endWeek: 13,
          status: 'completed',
        },
      ],
    });

    const chip = fixture.nativeElement
      .querySelectorAll('.problem-timeline__group:first-of-type .problem-timeline__row')[1]
      .querySelector('.problem-timeline__chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('#timeline-status-tooltip h2')?.textContent?.trim(),
    ).toBe('First trimester limited ultrasound');

    expect(
      fixture.nativeElement
        .querySelector('.timeline-status-tooltip__result-title')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Test Name: OB first trimester limited ultrasound');
    expect(
      fixture.nativeElement.querySelector('.timeline-status-tooltip__result-notice')?.textContent,
    ).toContain('EDD updated to June 15, 2026');

    const resultHeaders = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.timeline-status-tooltip__result-table [role="columnheader"]',
      ),
    ).map((header) => (header as HTMLElement).textContent?.trim());
    expect(resultHeaders).toEqual(['Finding', 'Result', 'Reference / Interpretation']);

    const resultRows = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.timeline-status-tooltip__result-table .result-tooltip__table-row',
      ),
    ).map((row) => (row as HTMLElement).textContent?.replace(/\s+/g, ' ').trim());
    expect(resultRows).toHaveLength(9);
    expect(resultRows[0]).toContain('Gestational age (ultrasound) 8 weeks 4 days');
    expect(resultRows[1]).toContain('Estimated due date (EDD) June 15, 2026');
    expect(
      fixture.nativeElement
        .querySelector('.timeline-status-tooltip__result-table + .timeline-status-tooltip__notes')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toContain('Notes:');
    expect(
      fixture.nativeElement.querySelector(
        '.timeline-status-tooltip__result-table + .timeline-status-tooltip__notes textarea',
      )?.value,
    ).toContain('EDD updated to June 15, 2026');
  });

  it('shows the MaterniT21 result and notes only for the completed Cell free DNA task', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'aneuploidy-cell-free-dna',
        label: 'Cell free DNA',
        status: 'completed',
        startWeek: 10,
        endWeek: 20,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const headers = Array.from(tooltip.querySelectorAll('[role="columnheader"]')).map((header) =>
      (header as HTMLElement).textContent?.trim(),
    );
    const cells = Array.from(
      tooltip.querySelectorAll('.timeline-status-tooltip__result-table [role="cell"]'),
    ).map((cell) => (cell as HTMLElement).textContent?.replace(/\s+/g, ' ').trim());

    expect(headers).toEqual(['Finding', 'Result', 'Reference / Interpretation']);
    expect(cells).toEqual(['MaterniT21 testing', 'Negative for Trisomy 21, 13, 18;', '—']);
    expect(tooltip.querySelectorAll('.result-tooltip__table-row')).toHaveLength(1);
    expect(tooltip.querySelector('.timeline-status-tooltip__result-title')).toBeNull();
    expect(tooltip.querySelector('.timeline-status-tooltip__result-notice')).toBeNull();
    expect(
      (tooltip.querySelector('.timeline-status-tooltip__notes textarea') as HTMLTextAreaElement)
        .value,
    ).toContain('MaterniT21 cell-free DNA screening reviewed');
  });

  it('shows Maternal serum AFP in its initial declined state with notes', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'aneuploidy-maternal-serum-afp',
        label: 'Maternal serum AFP',
        status: 'declined',
        startWeek: 15,
        endWeek: 22,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const testSection = tooltip.querySelector(
      '.timeline-status-tooltip__tests[aria-label="Lab tests"]',
    ) as HTMLElement;
    const testRows = testSection.querySelectorAll('.timeline-status-tooltip__test');
    const notes = tooltip.querySelector(
      '.timeline-status-tooltip__notes--editable textarea',
    ) as HTMLTextAreaElement;

    expect(testRows).toHaveLength(1);
    expect(testRows[0].classList).toContain('timeline-status-tooltip__test--declined');
    expect(testRows[0].textContent).toContain('Maternal serum AFP');
    expect(testRows[0].textContent).toContain('Reactivate');
    expect(notes.placeholder).toBe(
      'Add clinical notes about why Maternal serum AFP was declined...',
    );

    (
      testRows[0].querySelector('.timeline-status-tooltip__reactivate') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      tooltip.querySelector(
        '.timeline-status-tooltip__tests[aria-label="Lab tests"] .timeline-status-tooltip__remove',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const removedOrders = tooltip.querySelector(
      '.timeline-status-tooltip__removed-orders',
    ) as HTMLElement;
    const permanentRemove = removedOrders.querySelector(
      '[aria-label="Remove Maternal serum AFP permanently"]',
    ) as HTMLButtonElement;

    expect(removedOrders.textContent).toContain('Maternal serum AFP');
    expect(permanentRemove).toBeTruthy();

    permanentRemove.click();
    fixture.detectChanges();

    expect(tooltip.querySelector('.timeline-status-tooltip__removed-orders')).toBeNull();
  });

  it('shows the three completed carrier results and notes for Genetic screening', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'genetic-screening-1',
        label: 'Genetic screening',
        status: 'completed',
        startWeek: 0,
        endWeek: 13,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const headers = Array.from(tooltip.querySelectorAll('[role="columnheader"]')).map((header) =>
      (header as HTMLElement).textContent?.trim(),
    );
    const rows = Array.from(
      tooltip.querySelectorAll('.timeline-status-tooltip__result-table .result-tooltip__table-row'),
    ).map((row) =>
      Array.from(row.querySelectorAll('[role="cell"]')).map((cell) =>
        (cell as HTMLElement).textContent?.replace(/\s+/g, ' ').trim(),
      ),
    );
    const notes = tooltip.querySelector(
      '.timeline-status-tooltip__notes textarea',
    ) as HTMLTextAreaElement;
    const resultTable = tooltip.querySelector(
      '.timeline-status-tooltip__result-table',
    ) as HTMLElement;
    const labTests = tooltip.querySelector(
      '.timeline-status-tooltip__result-table + .timeline-status-tooltip__tests[aria-label="Lab tests"]',
    ) as HTMLElement;
    const fragileX = labTests.querySelector('.timeline-status-tooltip__test') as HTMLElement;

    expect(headers).toEqual(['Test Name', 'Value', 'Ref. Range']);
    expect(rows).toEqual([
      ['Hemoglobin electrophoresis', 'Negative', '—'],
      ['Cystic fibrosis', 'Negative', '—'],
      ['Spinal muscular atrophy', 'Negative', '—'],
    ]);
    expect(resultTable.compareDocumentPosition(labTests)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(fragileX.classList).toContain('timeline-status-tooltip__test--declined');
    expect(fragileX.textContent).toContain('Fragile X');
    expect(fragileX.textContent).toContain('Reactivate');
    expect(notes.value).toContain('Genetic carrier screening results reviewed');

    (fragileX.querySelector('.timeline-status-tooltip__reactivate') as HTMLButtonElement).click();
    fixture.detectChanges();

    const activeFragileX = tooltip.querySelector(
      '.timeline-status-tooltip__result-table + .timeline-status-tooltip__tests .timeline-status-tooltip__test',
    ) as HTMLElement;
    expect(activeFragileX.textContent).toContain('Decline');
    expect(activeFragileX.textContent).not.toContain('Order');

    (activeFragileX.querySelector('.timeline-status-tooltip__remove') as HTMLButtonElement).click();
    fixture.detectChanges();

    const removedOrders = tooltip.querySelector(
      '.timeline-status-tooltip__result-table ~ .timeline-status-tooltip__removed-orders',
    ) as HTMLElement;
    const permanentRemove = removedOrders.querySelector(
      '[aria-label="Remove Fragile X permanently"]',
    ) as HTMLButtonElement;
    expect(removedOrders.textContent).toContain('Fragile X');
    expect(removedOrders.textContent).toContain('Decline');
    expect(removedOrders.querySelector('.timeline-status-tooltip__order')).toBeNull();
    expect(permanentRemove).toBeTruthy();

    permanentRemove.click();
    fixture.detectChanges();
    expect(
      tooltip.querySelector(
        '.timeline-status-tooltip__result-table ~ .timeline-status-tooltip__removed-orders',
      ),
    ).toBeNull();
  });

  it('shows the completed Home blood pressure monitor only in actionable Lab Tests', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'home-blood-pressure-monitor',
        label: 'Home blood pressure monitor',
        status: 'completed',
        startWeek: 0,
        endWeek: 13,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const labTests = tooltip.querySelector(
      '.timeline-status-tooltip__tests[aria-label="Lab tests"]',
    ) as HTMLElement;
    let labTest = labTests.querySelector('.timeline-status-tooltip__test') as HTMLElement;
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes--editable') as HTMLElement;
    const footer = tooltip.querySelector('.due-soon-tooltip__footer') as HTMLElement;

    expect(tooltip.querySelector('.timeline-status-tooltip__result-table')).toBeNull();
    expect(labTest.textContent).toContain('Ambulatory blood pressure monitor');
    expect(labTest.querySelector('.timeline-status-tooltip__order')).toBeTruthy();
    expect(labTest.querySelector('.timeline-status-tooltip__decline')).toBeTruthy();
    expect(labTest.querySelector('.timeline-status-tooltip__remove')).toBeTruthy();
    expect(notes.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((notes.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
    expect((notes.querySelector('textarea') as HTMLTextAreaElement).placeholder).toContain(
      'blood pressure items',
    );
    expect(footer.querySelector('button')?.textContent?.trim()).toBe('Submit');

    (labTest.querySelector('.timeline-status-tooltip__remove') as HTMLButtonElement).click();
    fixture.detectChanges();

    const removedOrders = tooltip.querySelector(
      '.timeline-status-tooltip__removed-orders',
    ) as HTMLElement;
    const updatedLabTests = tooltip.querySelector(
      '.timeline-status-tooltip__tests[aria-label="Lab tests"]',
    );
    let removedTest = removedOrders.querySelector('.timeline-status-tooltip__test') as HTMLElement;
    expect(updatedLabTests).toBeNull();
    expect(removedTest.textContent).toContain('Ambulatory blood pressure monitor');
    expect(removedTest.querySelector('.timeline-status-tooltip__order')).toBeTruthy();
    expect(removedTest.querySelector('.timeline-status-tooltip__decline')).toBeTruthy();
    expect(
      removedTest.querySelector(
        '[aria-label="Remove Ambulatory blood pressure monitor permanently"]',
      ),
    ).toBeTruthy();
    expect(removedOrders.compareDocumentPosition(notes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    (removedTest.querySelector('.timeline-status-tooltip__decline') as HTMLButtonElement).click();
    fixture.detectChanges();
    labTest = tooltip.querySelector(
      '.timeline-status-tooltip__tests[aria-label="Lab tests"] .timeline-status-tooltip__test',
    ) as HTMLElement;
    expect(labTest.classList).toContain('timeline-status-tooltip__test--declined');
    expect(labTest.querySelector('.timeline-status-tooltip__reactivate')).toBeTruthy();

    (labTest.querySelector('.timeline-status-tooltip__reactivate') as HTMLButtonElement).click();
    fixture.detectChanges();
    labTest = labTests.querySelector('.timeline-status-tooltip__test') as HTMLElement;
    expect(labTest.querySelector('.timeline-status-tooltip__order')).toBeTruthy();

    (footer.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#timeline-status-tooltip')).toBeNull();
  });

  it('shows the completed pre-eclampsia screening results with title and notes', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'screening-pre-eclampsia-labs',
        label: 'Screening pre-eclampsia labs',
        status: 'completed',
        startWeek: 26,
        endWeek: 27,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const title = tooltip.querySelector('.timeline-status-tooltip__result-title') as HTMLElement;
    const table = tooltip.querySelector('.timeline-status-tooltip__result-table') as HTMLElement;
    const headers = Array.from(table.querySelectorAll<HTMLElement>('[role="columnheader"]')).map(
      (header) => header.textContent?.trim(),
    );
    const rows = Array.from(table.querySelectorAll<HTMLElement>('.result-tooltip__table-row')).map(
      (row) =>
        Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]')).map((cell) =>
          cell.textContent?.replace(/\s+/g, ' ').trim(),
        ),
    );
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes') as HTMLElement;

    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Test Name: Pre-eclampsia Screening Labs',
    );
    expect(title.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(headers).toEqual(['Test Name', 'Value', 'Ref. Range']);
    expect(rows).toEqual([
      ['CBC (Hgb)', '12.6 g/dL', '≥11.0 (3rd trimester)'],
      ['CBC (Platelets)', '248 K/uL', '150 – 400'],
      ['CMP (Creatinine)', '0.72 mg/dL', '0.50 – 1.10'],
      ['CMP (AST)', '18 U/L', '10 – 40'],
      ['CMP (ALT)', '14 U/L', '7 – 56'],
      ['LDH', '169 U/L', '100 – 220'],
      ['Uric Acid', '4.2 mg/dL', '2.6 – 6.0'],
      ['Protein/Creatinine Ratio (Urine)', '0.11', '< 0.30'],
    ]);
    expect(table.compareDocumentPosition(notes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((notes.querySelector('textarea') as HTMLTextAreaElement).value).toContain(
      'Pre-eclampsia screening laboratory results reviewed',
    );
  });

  it('shows the completed First trimester counseling checklist without notes', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'counseling-first-trimester',
        label: 'First trimester counseling',
        status: 'completed',
        startWeek: 0,
        endWeek: 13,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const checklist = tooltip.querySelector(
      '.due-soon-tooltip__checklist[aria-label="Checklist items"]',
    ) as HTMLElement;
    const expectedLabels = [
      'Routine Care and Testing',
      'Diet/Exercise in Pregnancy',
      'Recommend Prenatal vitamins',
      'Safe Medications',
      'Substance Use',
      'Safety/Precautions',
      'Warning Signs',
    ];
    const labels = Array.from(
      checklist.querySelectorAll('.due-soon-tooltip__item label > span:last-child'),
    ).map((label) => (label as HTMLElement).textContent?.trim());
    const checkboxes = Array.from(
      checklist.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );

    expect(labels).toEqual(expectedLabels);
    expect(checkboxes).toHaveLength(7);
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
    expect(checklist.textContent).toContain('7 of 7 completed');
    expect(checklist.querySelector('button')).toBeNull();
    expect(checklist.querySelector('textarea')).toBeNull();
    expect(tooltip.querySelector('.timeline-status-tooltip__result-table')).toBeNull();
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes') as HTMLElement;
    expect(notes).toBeTruthy();
    expect((notes.querySelector('textarea') as HTMLTextAreaElement).value).toContain(
      'First trimester counseling completed',
    );

    checkboxes[0].click();
    fixture.detectChanges();

    let firstItem = checklist.querySelector('.due-soon-tooltip__item') as HTMLElement;
    let action = firstItem.querySelector('button') as HTMLButtonElement;
    expect(action.textContent?.trim()).toBe('Decline');
    expect(checklist.textContent).toContain('6 of 7 completed');

    action.click();
    fixture.detectChanges();
    firstItem = checklist.querySelector('.due-soon-tooltip__item') as HTMLElement;
    action = firstItem.querySelector('button') as HTMLButtonElement;
    expect(firstItem.classList).toContain('due-soon-tooltip__item--declined');
    expect(action.textContent?.trim()).toBe('Reactivate');

    action.click();
    fixture.detectChanges();
    firstItem = checklist.querySelector('.due-soon-tooltip__item') as HTMLElement;
    expect(firstItem.classList).not.toContain('due-soon-tooltip__item--declined');
    expect(firstItem.querySelector('button')?.textContent?.trim()).toBe('Decline');
    expect(checklist.querySelector('textarea')).toBeNull();
  });

  it('shows the completed influenza and COVID checklist in the shared checkbox layout', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'immunization-influenza-covid',
        label: 'influenza/COVID (Sept-April/May)',
        status: 'completed',
        startWeek: 0,
        endWeek: 13,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const checklist = tooltip.querySelector(
      '.due-soon-tooltip__checklist[aria-label="Checklist items"]',
    ) as HTMLElement;
    let items = Array.from(checklist.querySelectorAll<HTMLElement>('.due-soon-tooltip__item'));
    const labels = Array.from(
      checklist.querySelectorAll<HTMLElement>('.due-soon-tooltip__item label > span:last-child'),
    ).map((label) => label.textContent?.trim());
    let checkboxes = Array.from(
      checklist.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );

    expect(labels).toEqual(['Influenza', 'COVID']);
    expect(checkboxes.map((checkbox) => checkbox.checked)).toEqual([true, false]);
    expect(checklist.textContent).toContain('1 of 2 completed');
    expect(items[0].querySelector('button')).toBeNull();
    expect(items[1].querySelector('button')?.textContent?.trim()).toBe('Decline');
    expect(checklist.querySelector('textarea')).toBeNull();
    expect(tooltip.querySelector('.timeline-status-tooltip__result-table')).toBeNull();
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes') as HTMLElement;
    expect(notes).toBeTruthy();
    expect(checklist.compareDocumentPosition(notes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((notes.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      'Influenza immunization completed. COVID immunization remains pending and was reviewed with the patient.',
    );
    const footer = tooltip.querySelector('.due-soon-tooltip__footer') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(notes.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(footer.querySelector('button')?.textContent?.trim()).toBe('Submit');

    (items[1].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    items = Array.from(checklist.querySelectorAll<HTMLElement>('.due-soon-tooltip__item'));
    expect(items[1].classList).toContain('due-soon-tooltip__item--declined');
    expect(items[1].querySelector('button')?.textContent?.trim()).toBe('Reactivate');

    (items[1].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    items = Array.from(checklist.querySelectorAll<HTMLElement>('.due-soon-tooltip__item'));
    checkboxes = Array.from(checklist.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(items[1].querySelector('button')?.textContent?.trim()).toBe('Decline');

    checkboxes[1].click();
    fixture.detectChanges();
    items = Array.from(checklist.querySelectorAll<HTMLElement>('.due-soon-tooltip__item'));
    expect(items[1].querySelector('button')).toBeNull();
    expect(checklist.textContent).toContain('2 of 2 completed');
    expect(checklist.querySelector('textarea')).toBeNull();

    (footer.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#timeline-status-tooltip')).toBeNull();
  });

  it('shows Delivery planning Future checklists in Lab Tests without general fields', () => {
    const variants = [
      {
        id: 'delivery-planning-confirm-cephalic',
        label: 'Confirm cephalic',
        itemLabel: 'cephalic',
        startWeek: 36,
        endWeek: 37,
      },
      {
        id: 'delivery-planning-schedule-iol',
        label: 'Schedule IOL',
        itemLabel: 'scheduled',
        startWeek: 36,
        endWeek: 42,
      },
    ];

    for (const variant of variants) {
      const fixture = TestBed.createComponent(PatientDashboard);
      const dashboard = fixture.componentInstance;
      fixture.detectChanges();

      dashboard.showTimelineStatusTooltip(
        {
          id: variant.id,
          label: variant.label,
          status: 'future',
          startWeek: variant.startWeek,
          endWeek: variant.endWeek,
        },
        { currentTarget: document.createElement('button') } as unknown as Event,
      );
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector(
        '#timeline-status-tooltip',
      ) as HTMLElement;
      const labTests = tooltip.querySelector(
        '.timeline-status-tooltip__tests[aria-label="Lab tests"]',
      ) as HTMLElement;
      let item = labTests.querySelector('.due-soon-tooltip__item') as HTMLElement;
      let checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      let action = item.querySelector('button') as HTMLButtonElement;
      const footer = tooltip.querySelector('.timeline-status-tooltip__bulk-actions') as HTMLElement;

      expect(labTests.querySelector('h3')?.textContent?.trim()).toBe('Lab Tests:');
      expect(item.querySelector('label > span:last-child')?.textContent?.trim()).toBe(
        variant.itemLabel,
      );
      expect(checkbox.checked).toBe(false);
      expect(action.textContent?.trim()).toBe('Decline');
      expect(labTests.querySelector('textarea')).toBeNull();
      expect(tooltip.querySelector('.timeline-status-tooltip__field')).toBeNull();
      expect(tooltip.querySelector('.timeline-status-tooltip__notes--editable')).toBeNull();
      expect(tooltip.querySelector('.due-soon-tooltip__checklist')).toBeNull();
      expect(footer.querySelector('button')?.textContent?.trim()).toBe('Submit');
      expect((footer.querySelector('button') as HTMLButtonElement).disabled).toBe(false);

      action.click();
      fixture.detectChanges();
      item = labTests.querySelector('.due-soon-tooltip__item') as HTMLElement;
      action = item.querySelector('button') as HTMLButtonElement;
      expect(item.classList).toContain('due-soon-tooltip__item--declined');
      expect(action.textContent?.trim()).toBe('Reactivate');

      action.click();
      fixture.detectChanges();
      item = labTests.querySelector('.due-soon-tooltip__item') as HTMLElement;
      checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(item.querySelector('button')?.textContent?.trim()).toBe('Decline');

      checkbox.click();
      fixture.detectChanges();
      const itemNotes = labTests.querySelector('.due-soon-tooltip__notes') as HTMLElement;
      expect(itemNotes).toBeTruthy();
      expect((itemNotes.querySelector('textarea') as HTMLTextAreaElement).value).toBe('');
      expect(item.querySelector('button')).toBeNull();

      (footer.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#timeline-status-tooltip')).toBeNull();
      fixture.destroy();
    }
  });

  it('assigns the requested screening, counseling, and immunization tasks', () => {
    const dashboard = new PatientDashboard();
    const rows = dashboard.pregnancyTimeline().groups[0].rows;

    expect(rows.slice(2, 7).map((row) => ({ label: row.label, chips: row.chips }))).toMatchObject([
      {
        label: 'Aneuploidy screening',
        chips: [
          { label: 'Cell free DNA', startWeek: 10, endWeek: 20, status: 'completed' },
          { label: 'Maternal serum AFP', startWeek: 15, endWeek: 22, status: 'declined' },
        ],
      },
      {
        label: 'Genetic screening',
        chips: [{ label: 'Genetic screening', startWeek: 0, endWeek: 13, status: 'completed' }],
      },
      {
        label: 'Counseling',
        chips: [
          { label: 'First trimester counseling', startWeek: 0, endWeek: 13, status: 'completed' },
          {
            label: 'Third Trimester counseling',
            startWeek: 28,
            endWeek: 32,
            status: 'due-soon',
          },
        ],
      },
      {
        label: 'Social/Behavioral Screening',
        chips: [
          { label: 'First trimester screening', startWeek: 0, endWeek: 13, status: 'incomplete' },
          {
            label: 'Third trimester screening',
            startWeek: 28,
            endWeek: 32,
            status: 'due-soon',
          },
        ],
      },
      {
        label: 'Immunizations',
        chips: [
          {
            label: 'influenza/COVID (Sept-April/May)',
            startWeek: 0,
            endWeek: 13,
            status: 'completed',
          },
          { label: 'TDaP', startWeek: 27, endWeek: 36, status: 'due-soon' },
          { label: 'RSV', startWeek: 32, endWeek: 36, status: 'future' },
        ],
      },
    ]);
  });

  it('assigns the requested Delivery planning tasks', () => {
    const dashboard = new PatientDashboard();
    const deliveryPlanning = dashboard.pregnancyTimeline().groups[0].rows[7];

    expect(deliveryPlanning).toMatchObject({
      label: 'Delivery planning',
      chips: [
        { label: 'Confirm cephalic', startWeek: 36, endWeek: 37, status: 'future' },
        { label: 'Schedule IOL', startWeek: 36, endWeek: 42, status: 'future' },
      ],
    });
  });

  it('assigns the requested Elevated Blood Pressure tasks', () => {
    const dashboard = new PatientDashboard();
    const rows = dashboard.pregnancyTimeline().groups[1].rows;

    expect(rows).toMatchObject([
      {
        label: 'Home blood pressure monitoring',
        chips: [
          {
            label: 'Home blood pressure monitor',
            startWeek: 0,
            endWeek: 13,
            status: 'completed',
          },
        ],
      },
      {
        label: 'Screening pre-eclampsia labs',
        chips: [
          {
            label: 'Screening pre-eclampsia labs',
            startWeek: 26,
            endWeek: 27,
            status: 'completed',
          },
        ],
      },
    ]);
  });

  it('assigns the requested Advanced Maternal Age counseling and ultrasound tasks', () => {
    const dashboard = new PatientDashboard();
    const rows = dashboard.pregnancyTimeline().groups[2].rows;

    expect(rows.slice(0, 2)).toMatchObject([
      {
        label: 'Counseling',
        chips: [{ label: 'Counseling', startWeek: 0, endWeek: 13, status: 'completed' }],
      },
      {
        label: 'Ultrasounds',
        chips: [
          { label: 'Level II ultrasound', startWeek: 18, endWeek: 22, status: 'completed' },
          { label: 'Growth Ultrasound', startWeek: 27, endWeek: 29, status: 'not-reviewed' },
          { label: 'Growth Ultrasound', startWeek: 32, endWeek: 33, status: 'future' },
          { label: 'Growth Ultrasound', startWeek: 35, endWeek: 37, status: 'future' },
        ],
      },
    ]);
  });

  it('assigns weekly NST/BPP tasks to Advanced Maternal Age antenatal surveillance', () => {
    const dashboard = new PatientDashboard();
    const antenatalSurveillance = dashboard.pregnancyTimeline().groups[2].rows[2];

    expect(antenatalSurveillance).toMatchObject({
      label: 'Antenatal surveillance',
      chips: [
        { label: 'NST/BPP', startWeek: 36, endWeek: 37, status: 'future' },
        { label: 'NST/BPP', startWeek: 37, endWeek: 38, status: 'future' },
        { label: 'NST/BPP', startWeek: 38, endWeek: 39, status: 'future' },
        { label: 'NST/BPP', startWeek: 39, endWeek: 40, status: 'future' },
      ],
    });
  });

  it('assigns the requested Gestational Hypertension tasks', () => {
    const dashboard = new PatientDashboard();
    const rows = dashboard.pregnancyTimeline().groups[3].rows;

    expect(rows).toMatchObject([
      {
        label: 'Home blood pressure monitoring',
        chips: [
          {
            label: 'Home blood pressure monitor',
            startWeek: 0,
            endWeek: 13,
            status: 'completed',
          },
        ],
      },
      {
        label: 'Screening pre-eclampsia labs',
        chips: [
          {
            label: 'Screening pre-eclampsia labs',
            startWeek: 26,
            endWeek: 27,
            status: 'completed',
          },
        ],
      },
      {
        label: 'Growth Ultrasound',
        chips: [
          { label: 'Growth Ultrasound', startWeek: 27, endWeek: 29, status: 'not-reviewed' },
          { label: 'Growth Ultrasound', startWeek: 32, endWeek: 33, status: 'future' },
          { label: 'Growth Ultrasound', startWeek: 35, endWeek: 37, status: 'future' },
        ],
      },
      {
        label: 'Antenatal surveillance',
        chips: [
          { label: 'Twice weekly NST/BPP', startWeek: 28, endWeek: 29, status: 'due-soon' },
          { label: 'Twice weekly NST/BPP', startWeek: 29, endWeek: 30, status: 'due-soon' },
          { label: 'Twice weekly NST/BPP', startWeek: 30, endWeek: 31, status: 'due-soon' },
          { label: 'Twice weekly NST/BPP', startWeek: 31, endWeek: 32, status: 'due-soon' },
          { label: 'Twice weekly NST/BPP', startWeek: 32, endWeek: 33, status: 'future' },
          { label: 'Twice weekly NST/BPP', startWeek: 33, endWeek: 34, status: 'future' },
          { label: 'Twice weekly NST/BPP', startWeek: 34, endWeek: 35, status: 'future' },
          { label: 'Twice weekly NST/BPP', startWeek: 35, endWeek: 36, status: 'future' },
          { label: 'Twice weekly NST/BPP', startWeek: 36, endWeek: 37, status: 'future' },
          { label: 'Twice weekly NST/BPP', startWeek: 37, endWeek: 38, status: 'future' },
        ],
      },
    ]);
  });

  it('renders each timeline chip label from its data status', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const statusLabels: Record<string, string> = {
      completed: 'Completed/Reviewed',
      'not-reviewed': 'Completed/Not Reviewed',
      ordered: 'Ordered',
      'due-soon': 'Due Soon',
      late: 'Late',
      incomplete: 'Incomplete',
      future: 'Future',
      declined: 'Declined',
    };

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('.problem-timeline__chip'),
    ) as HTMLElement[];

    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => {
      const status = chip.dataset['status'] ?? '';
      expect(chip.querySelector('.problem-timeline__chip-label')?.textContent?.trim()).toBe(
        statusLabels[status],
      );
    });
  });

  it('opens the Future-style tooltip with dark-gray Declined status treatment', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();
    const trigger = document.createElement('div');
    document.body.append(trigger);

    dashboard.showTimelineStatusTooltip(
      {
        id: 'declined-test',
        label: 'Declined screening',
        status: 'declined',
        startWeek: 12,
        endWeek: 16,
      },
      { currentTarget: trigger } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector(
      '.timeline-status-tooltip[data-status="declined"]',
    ) as HTMLElement;

    expect(dashboard.timelineStatusLabel('declined')).toBe('Declined');
    expect(tooltip).toBeTruthy();
    expect(tooltip.querySelector('h2')?.textContent?.trim()).toBe('Declined screening');
    expect(tooltip.querySelector('.timeline-status-tooltip__badge')?.textContent?.trim()).toBe(
      'Declined',
    );
    expect(tooltip.querySelector('.timeline-status-tooltip__tests')).toBeTruthy();
    expect(tooltip.querySelector('#timeline-tooltip-other-test')).toBeTruthy();
    trigger.remove();
  });

  it('shows the matching custom status tooltip when each chip status is hovered', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const expectedBadges: Record<string, string> = {
      completed: 'Completed/Reviewed',
      declined: 'Declined',
      future: 'Future',
      incomplete: 'Incomplete',
      'not-reviewed': 'Completed/Not Reviewed',
    };

    Object.entries(expectedBadges).forEach(([status, badge]) => {
      const chip = fixture.nativeElement.querySelector(
        `.problem-timeline__chip[data-status="${status}"]`,
      ) as HTMLElement;

      expect(chip).toBeTruthy();
      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector(
        '.timeline-status-tooltip',
      ) as HTMLElement;
      expect(tooltip.dataset['status']).toBe(status);
      expect(tooltip.querySelector('.timeline-status-tooltip__badge')?.textContent?.trim()).toBe(
        badge,
      );
      expect(tooltip.style.maxHeight).not.toBe('');
      expect(tooltip.querySelector('.timeline-status-tooltip__test-list--scrollable')).toBeNull();
    });
  });

  it('shows due-soon details in a separate tooltip', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      '.problem-timeline__chip[data-status="due-soon"]',
    ) as HTMLElement;

    expect(chip).toBeTruthy();
    chip.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const dueSoonTooltip = fixture.nativeElement.querySelector('#due-soon-tooltip') as HTMLElement;
    expect(dueSoonTooltip).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#timeline-status-tooltip')).toBeNull();
    expect(dueSoonTooltip.textContent).toContain('Third trimester labs');
    expect(dueSoonTooltip.textContent).toContain('Scheduled: Week 24-30');
    expect(dueSoonTooltip.textContent).toContain('Lab Tests:');
    expect(dueSoonTooltip.textContent).toContain('1hr GTT');
    expect(dueSoonTooltip.textContent).toContain('CBC');
    expect(dueSoonTooltip.textContent).toContain('HIV antigen/antibody');
    expect(dueSoonTooltip.textContent).toContain('Syphilis antibody');
    expect(dueSoonTooltip.querySelector('.due-soon-tooltip__checklist')).toBeTruthy();
    expect(dueSoonTooltip.querySelector('.due-soon-tooltip__footer')).toBeTruthy();

    const firstOrderButton = Array.from(dueSoonTooltip.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Order',
    ) as HTMLButtonElement;
    firstOrderButton.click();
    fixture.detectChanges();

    expect(dueSoonTooltip.querySelector('.timeline-status-tooltip__test--ordered')).toBeTruthy();
  });

  it('shows the Third Trimester counseling checklist with conditional item notes', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'counseling-third-trimester',
        label: 'Third Trimester counseling',
        status: 'due-soon',
        startWeek: 28,
        endWeek: 32,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#due-soon-tooltip') as HTMLElement;
    const checklist = tooltip.querySelector(
      '.due-soon-tooltip__checklist[aria-label="Checklist items"]',
    ) as HTMLElement;
    const expectedLabels = [
      'Kick Counts',
      'Pre-eclampsia Signs/Symptoms',
      'Birth Plans (if applicable)',
      'Contraception plans',
    ];
    const labels = Array.from(
      checklist.querySelectorAll('.due-soon-tooltip__item label > span:last-child'),
    ).map((label) => (label as HTMLElement).textContent?.trim());
    const checkboxes = Array.from(
      checklist.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    );

    expect(labels).toEqual(expectedLabels);
    expect(checkboxes.every((checkbox) => !checkbox.checked)).toBe(true);
    expect(checklist.textContent).toContain('0 of 4 completed');
    expect(checklist.querySelectorAll('button')).toHaveLength(4);
    expect(checklist.querySelector('textarea')).toBeNull();
    expect(checklist.textContent).not.toContain('Lab Tests:');

    checkboxes[0].click();
    fixture.detectChanges();
    let items = checklist.querySelectorAll('.due-soon-tooltip__item');
    expect(items[0].querySelector('button')).toBeNull();
    expect(checklist.querySelector('textarea')).toBeNull();

    checkboxes[2].click();
    fixture.detectChanges();
    items = checklist.querySelectorAll('.due-soon-tooltip__item');
    const note = checklist.querySelector(
      '.due-soon-tooltip__notes textarea',
    ) as HTMLTextAreaElement;
    expect(items[2].querySelector('button')).toBeNull();
    expect(note).toBeTruthy();
    expect(note.value).toBe('');

    let secondAction = items[1].querySelector('button') as HTMLButtonElement;
    expect(secondAction.textContent?.trim()).toBe('Decline');
    secondAction.click();
    fixture.detectChanges();
    items = checklist.querySelectorAll('.due-soon-tooltip__item');
    secondAction = items[1].querySelector('button') as HTMLButtonElement;
    expect(secondAction.textContent?.trim()).toBe('Reactivate');

    secondAction.click();
    fixture.detectChanges();
    items = checklist.querySelectorAll('.due-soon-tooltip__item');
    expect(items[1].querySelector('button')?.textContent?.trim()).toBe('Decline');
  });

  it('shows the First trimester social and behavioral screening table with notes and footer', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'behavioral-screening-first-trimester',
        label: 'First trimester screening',
        status: 'incomplete',
        startWeek: 0,
        endWeek: 13,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#timeline-status-tooltip') as HTMLElement;
    const table = tooltip.querySelector(
      '.timeline-status-tooltip__screening-table[aria-label="Lab tests"]',
    ) as HTMLElement;
    const title = tooltip.querySelector('.timeline-status-tooltip__screening-title') as HTMLElement;
    const rows = Array.from(
      table.querySelectorAll<HTMLElement>('.timeline-status-tooltip__screening-row'),
    );
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes--editable') as HTMLElement;
    const footer = tooltip.querySelector('.timeline-status-tooltip__bulk-actions') as HTMLElement;
    const score = table.querySelector(
      '.timeline-status-tooltip__screening-score',
    ) as HTMLInputElement;

    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('Test Name: Prenatal Screening');
    expect(title.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(rows.map((row) => row.querySelector('strong')?.textContent?.trim())).toEqual([
      'EPDS (Edinburgh Postnatal Depression Scale)',
      'Intimate Partner Violence Screening',
      'Food Insecurity Screening',
      'Transportation Insecurity Screening',
      'Housing Insecurity Screening',
      'Substance Use Screening',
    ]);
    expect(score.value).toBe('3');
    expect(rows[0].textContent).toContain('(0–30; ≥10 consider further evaluation)');

    for (const row of rows.slice(1, 5)) {
      expect((row.querySelector('[aria-label$="negative"]') as HTMLInputElement).checked).toBe(
        true,
      );
      expect((row.querySelector('[aria-label$="positive"]') as HTMLInputElement).checked).toBe(
        false,
      );
    }
    expect(
      Array.from(rows[5].querySelectorAll<HTMLInputElement>('input')).every(
        (input) => !input.checked,
      ),
    ).toBe(true);

    expect(notes.querySelector('textarea')?.getAttribute('placeholder')).toBe(
      'Add clinical notes about the screening results...',
    );
    expect(notes.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      Array.from(footer.querySelectorAll('button')).map((button) => button.textContent?.trim()),
    ).toEqual(['Order All', 'Decline All']);
    expect(tooltip.querySelector('.timeline-status-tooltip__test-list')).toBeNull();

    (rows[5].querySelector('[aria-label$="positive"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect((rows[5].querySelector('[aria-label$="positive"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('reuses the Prenatal Screening table for the Due Soon Third trimester screening', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    dashboard.showTimelineStatusTooltip(
      {
        id: 'behavioral-screening-third-trimester',
        label: 'Third trimester screening',
        status: 'due-soon',
        startWeek: 28,
        endWeek: 32,
      },
      { currentTarget: document.createElement('button') } as unknown as Event,
    );
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#due-soon-tooltip') as HTMLElement;
    const checklistSection = tooltip.querySelector(
      '.due-soon-tooltip__checklist[aria-label="Checklist items"]',
    ) as HTMLElement;
    const title = checklistSection.querySelector(
      '.timeline-status-tooltip__screening-title',
    ) as HTMLElement;
    const table = checklistSection.querySelector(
      '.timeline-status-tooltip__screening-table[aria-label="Lab tests"]',
    ) as HTMLElement;
    const rows = Array.from(
      table.querySelectorAll<HTMLElement>('.timeline-status-tooltip__screening-row'),
    );
    const notes = checklistSection.querySelector(
      '.timeline-status-tooltip__notes--editable textarea',
    ) as HTMLTextAreaElement;
    const footer = tooltip.querySelector('.due-soon-tooltip__footer') as HTMLElement;

    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('Test Name: Prenatal Screening');
    expect(rows).toHaveLength(6);
    expect(
      (table.querySelector('.timeline-status-tooltip__screening-score') as HTMLInputElement).value,
    ).toBe('3');
    expect((rows[1].querySelector('[aria-label$="negative"]') as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      Array.from(rows[5].querySelectorAll<HTMLInputElement>('input')).every(
        (input) => !input.checked,
      ),
    ).toBe(true);
    expect(notes.placeholder).toBe('Add clinical notes about the screening results...');
    expect(footer.querySelector('button')?.textContent?.trim()).toBe('Submit');
    expect(checklistSection.textContent).not.toContain('Lab Tests:');

    (rows[5].querySelector('[aria-label$="positive"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect((rows[5].querySelector('[aria-label$="positive"]') as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('uses each task start and end week in every status tooltip Scheduled row', () => {
    const dashboard = new PatientDashboard();
    const trigger = document.createElement('div');

    for (const status of [
      'completed',
      'not-reviewed',
      'ordered',
      'late',
      'incomplete',
      'future',
      'declined',
    ] as const) {
      dashboard.showTimelineStatusTooltip(
        {
          id: `scheduled-${status}`,
          label: `${status} task`,
          status,
          startWeek: 12.5,
          endWeek: 13.75,
        },
        { currentTarget: trigger } as unknown as Event,
      );

      expect(
        dashboard
          .activeTimelineStatusTooltip()
          ?.tooltip.schedule.find((row) => row.label === 'Scheduled:')?.value,
      ).toBe('Week 12.5-13.75');
    }

    dashboard.showTimelineStatusTooltip(
      {
        id: 'scheduled-due-soon',
        label: 'due-soon task',
        status: 'due-soon',
        startWeek: 24,
        endWeek: 30,
      },
      { currentTarget: trigger } as unknown as Event,
    );

    expect(dashboard.activeDueSoonTooltip()?.scheduledWeekRange).toBe('Week 24-30');
  });

  it('adds an Other lab test for every status that displays the field', () => {
    for (const status of ['future', 'declined']) {
      const fixture = TestBed.createComponent(PatientDashboard);
      fixture.detectChanges();
      const dashboard = fixture.componentInstance;
      const chip = fixture.nativeElement.querySelector(
        `.problem-timeline__chip[data-status="${status}"]`,
      ) as HTMLElement;

      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector(
        '#timeline-tooltip-other-test',
      ) as HTMLInputElement;
      const addButton = fixture.nativeElement.querySelector(
        '.timeline-status-tooltip__enter-hint',
      ) as HTMLButtonElement;

      input.value = `${status} click test`;
      addButton.click();
      fixture.detectChanges();

      expect(dashboard.activeTimelineStatusTooltip()?.tooltip.tests?.at(-1)?.label).toBe(
        `${status} click test`,
      );
      expect(input.value).toBe('');

      input.value = `${status} keyboard test`;
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      fixture.detectChanges();

      expect(dashboard.activeTimelineStatusTooltip()?.tooltip.tests?.at(-1)?.label).toBe(
        `${status} keyboard test`,
      );
      expect(input.value).toBe('');
    }
  });

  it('uses the shared tests section for lab and screening content', () => {
    for (const status of ['incomplete', 'future', 'declined']) {
      const fixture = TestBed.createComponent(PatientDashboard);
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector(
        `.problem-timeline__chip[data-status="${status}"]`,
      ) as HTMLElement;

      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector(
        `.timeline-status-tooltip[data-status="${status}"]`,
      ) as HTMLElement;
      const testsSection = tooltip.querySelector(
        'section.timeline-status-tooltip__tests[aria-label="Lab tests"]',
      ) as HTMLElement;

      expect(testsSection).toBeTruthy();
      if (status === 'incomplete') {
        expect(testsSection.querySelector('.timeline-status-tooltip__screening-head')).toBeTruthy();
        expect(
          testsSection.querySelectorAll('.timeline-status-tooltip__screening-row'),
        ).toHaveLength(6);
      } else {
        expect(testsSection.querySelector('h3')?.textContent?.trim()).toBe('Lab Tests:');
        expect(testsSection.querySelector('.timeline-status-tooltip__test-list')).toBeTruthy();
        expect(testsSection.querySelector('.timeline-status-tooltip__test')).toBeTruthy();
      }
    }
  });

  it('uses the shared tooltip header for every status that displays it', () => {
    for (const status of ['completed', 'not-reviewed', 'incomplete', 'future', 'declined']) {
      const fixture = TestBed.createComponent(PatientDashboard);
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector(
        `.problem-timeline__chip[data-status="${status}"]`,
      ) as HTMLElement;

      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const tooltip = fixture.nativeElement.querySelector(
        `.timeline-status-tooltip[data-status="${status}"]`,
      ) as HTMLElement;
      const header = tooltip.querySelector('header.timeline-status-tooltip__header') as HTMLElement;
      const badge = header.querySelector('.timeline-status-tooltip__badge') as HTMLElement;

      expect(header).toBeTruthy();
      expect(header.querySelector('h2')?.textContent?.trim()).not.toBe('');
      expect(header.querySelector('p')?.textContent?.trim()).not.toBe('');
      expect(badge.textContent?.trim()).not.toBe('');
      expect(badge.getAttribute('data-status')).toBe(status);
    }
  });

  it('keeps each tooltip badge label identical to its timeline chip status', () => {
    for (const status of ['completed', 'not-reviewed', 'incomplete', 'future', 'declined']) {
      const fixture = TestBed.createComponent(PatientDashboard);
      fixture.detectChanges();
      const chip = fixture.nativeElement.querySelector(
        `.problem-timeline__chip[data-status="${status}"]`,
      ) as HTMLElement;
      const chipLabel = chip.querySelector('.problem-timeline__chip-label')?.textContent?.trim();

      chip.dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();

      const badgeLabel = fixture.nativeElement
        .querySelector('.timeline-status-tooltip__badge')
        ?.textContent?.trim();

      expect(badgeLabel).toBe(chipLabel);
    }
  });

  it('uses the shared header and schedule structure for the Due Soon tooltip', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      '.problem-timeline__chip[data-status="due-soon"]',
    ) as HTMLElement;

    chip.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#due-soon-tooltip') as HTMLElement;
    const badge = tooltip.querySelector('.timeline-status-tooltip__badge') as HTMLElement;

    expect(tooltip.querySelector('header.timeline-status-tooltip__header')).toBeTruthy();
    expect(tooltip.querySelector('.timeline-status-tooltip__schedule')).toBeTruthy();
    expect(tooltip.querySelectorAll('.timeline-status-tooltip__schedule-row')).toHaveLength(2);
    expect(badge.textContent?.trim()).toBe('Due Soon');
    expect(badge.textContent?.trim()).toBe(chip.textContent?.trim());
  });

  it('shows the CBC result table above Notes for Completed/Reviewed', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      '.problem-timeline__chip[data-status="completed"]',
    ) as HTMLElement;

    chip.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector(
      '.timeline-status-tooltip[data-status="completed"]',
    ) as HTMLElement;
    const table = tooltip.querySelector('.result-tooltip__table') as HTMLElement;
    const notes = tooltip.querySelector('.timeline-status-tooltip__notes') as HTMLElement;
    const rows = table.querySelectorAll('.result-tooltip__table-row');

    expect(table).toBeTruthy();
    expect(rows).toHaveLength(14);
    expect(table.querySelector('.result-tooltip__table-value--alert')?.textContent?.trim()).toBe(
      '11.2 g/dL L',
    );
    expect(table.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('expands tooltip notes according to their wrapped content', () => {
    const dashboard = new PatientDashboard();

    expect(dashboard.timelineStatusTooltipNoteRows('Short note')).toBe(2);
    expect(dashboard.timelineStatusTooltipNoteRows('A'.repeat(100))).toBe(3);
    expect(dashboard.timelineStatusTooltipNoteRows('First line\nSecond line\nThird line')).toBe(3);
  });

  it('keeps the status tooltip open while its controls are being used', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();
    const dashboard = fixture.componentInstance;
    const chip = fixture.nativeElement.querySelector(
      '.problem-timeline__chip[data-status="future"]',
    ) as HTMLElement;

    chip.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('.timeline-status-tooltip') as HTMLElement;
    const input = tooltip.querySelector('input') as HTMLInputElement;
    input.focus();
    dashboard.scheduleTimelineStatusTooltipHide();
    vi.advanceTimersByTime(200);

    expect(dashboard.activeTimelineStatusTooltip()).not.toBeNull();

    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    outsideButton.focus();
    dashboard.onTimelineStatusTooltipFocusOut({
      currentTarget: tooltip,
      relatedTarget: outsideButton,
    } as unknown as FocusEvent);
    vi.advanceTimersByTime(200);

    expect(dashboard.activeTimelineStatusTooltip()).toBeNull();
    outsideButton.remove();
    vi.useRealTimers();
  });

  it('shows the received-result summary and marks every result reviewed', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      '.problem-timeline__chip[data-status="future"]',
    ) as HTMLElement;

    chip.dispatchEvent(new MouseEvent('mouseenter'));
    const activeTooltip = dashboard.activeTimelineStatusTooltip();
    dashboard.activeTimelineStatusTooltip.set({
      ...activeTooltip!,
      tooltip: { ...activeTooltip!.tooltip, resultsSubmitted: true },
    });
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector(
      '.timeline-status-tooltip__review-summary',
    ) as HTMLElement;
    const rows = Array.from(
      summary.querySelectorAll('.timeline-status-tooltip__review-summary-row'),
    ) as HTMLElement[];

    expect(
      rows.map((row) => ({
        name: row.querySelector('strong')?.textContent?.trim(),
        result: row
          .querySelector('.timeline-status-tooltip__review-summary-content span')
          ?.textContent?.trim(),
      })),
    ).toEqual([
      {
        name: 'Hemoglobin Electrophoresis',
        result: 'Result: 12 g/dl (11.5 - 15.5)',
      },
      { name: 'Spinal Muscular Atrophy', result: 'Result: Negative' },
      { name: 'Fragile X', result: 'Result: Normal' },
    ]);
    expect(summary.querySelectorAll('.timeline-status-tooltip__reviewed-tick')).toHaveLength(0);

    const reviewButton = fixture.nativeElement.querySelector(
      '.timeline-status-tooltip__mark-reviewed',
    ) as HTMLButtonElement;
    reviewButton.click();
    fixture.detectChanges();

    expect(summary.querySelectorAll('.timeline-status-tooltip__reviewed-tick')).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('.timeline-status-tooltip__mark-reviewed'),
    ).toBeNull();
    expect(dashboard.activeTimelineStatusTooltip()?.tooltip.resultsReviewed).toBe(true);
  });

  it('limits the complete tooltip height only when vertical space is constrained', () => {
    const dashboard = new PatientDashboard();
    const trigger = document.createElement('div');
    const originalInnerHeight = window.innerHeight;
    const lateChip = dashboard.pregnancyTimeline().groups[3].rows[0].chips[0];
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 260 });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 20,
      left: 100,
      right: 200,
      top: 80,
      width: 100,
    } as DOMRect);

    dashboard.showTimelineStatusTooltip(lateChip, {
      currentTarget: trigger,
    } as unknown as Event);

    expect(dashboard.timelineStatusTooltipMaxHeight()).toBe(138);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('detects when a chip crosses the JSON current-week line without changing its status', () => {
    const dashboard = new PatientDashboard();
    const chip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[0];

    expect(dashboard.chipCrossesCurrentWeek(chip)).toBe(false);
    expect(dashboard.chipCrossesCurrentWeek({ ...chip, startWeek: 27, endWeek: 30 })).toBe(true);
  });

  it('moves a focused chip with the keyboard without leaving the 0 to 42 week range', () => {
    const dashboard = new PatientDashboard();
    const chip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[0];
    const keyboardEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });

    dashboard.moveChipWithKeyboard(keyboardEvent, 'routine-prenatal-care', 'labs', chip);

    const movedChip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[0];
    expect(movedChip.startWeek).toBe(0.5);
    expect(movedChip.endWeek).toBe(13.5);
  });

  it('uses the D3 week scale to drag and resize chips across the current-week line', () => {
    const dashboard = new PatientDashboard();
    const track = document.createElement('div');
    const chipElement = document.createElement('div');
    track.className = 'problem-timeline__track';
    track.append(chipElement);
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      width: 400,
    } as DOMRect);

    const chip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[1];
    dashboard.startChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 1,
        clientX: 100,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'routine-prenatal-care',
      'labs',
      chip,
      'move',
    );
    dashboard.onChipPointerMove({
      pointerId: 1,
      clientX: 120,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    dashboard.endChipInteraction({ pointerId: 1 } as PointerEvent);

    const movedChip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[1];
    expect(movedChip.startWeek).toBe(26);
    expect(movedChip.endWeek).toBe(32);
    expect(movedChip.status).toBe('due-soon');
    expect(dashboard.chipCrossesCurrentWeek(movedChip)).toBe(true);

    dashboard.startChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 2,
        clientX: 120,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'routine-prenatal-care',
      'labs',
      movedChip,
      'resize-end',
    );
    dashboard.onChipPointerMove({
      pointerId: 2,
      clientX: 140,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    const resizedChip = dashboard.pregnancyTimeline().groups[0].rows[0].chips[1];
    expect(resizedChip.endWeek).toBe(34);
  });

  it('moves and resizes the delivery chip within the timeline track', () => {
    const dashboard = new PatientDashboard();
    const track = document.createElement('div');
    const chipElement = document.createElement('div');
    track.className = 'problem-timeline__delivery-track';
    track.append(chipElement);
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect);

    dashboard.startDeliveryChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 10,
        clientX: 100,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'move',
    );
    dashboard.onChipPointerMove({
      pointerId: 10,
      clientX: 80,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    dashboard.endChipInteraction({ pointerId: 10 } as PointerEvent);

    expect(dashboard.pregnancyTimeline().deliveryChip).toMatchObject({
      startWeek: 37,
      endWeek: 38,
    });

    dashboard.startDeliveryChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 11,
        clientX: 100,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'resize-start',
    );
    dashboard.onChipPointerMove({
      pointerId: 11,
      clientX: 90,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    expect(dashboard.pregnancyTimeline().deliveryChip.startWeek).toBe(36);
    dashboard.undoTimelineChange();
    expect(dashboard.pregnancyTimeline().deliveryChip.startWeek).toBe(37);
  });

  it('shows and edits the delivery window tooltip from the delivery chip', () => {
    const dashboard = new PatientDashboard();
    const trigger = document.createElement('div');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 20,
      left: 800,
      right: 880,
      top: 100,
      width: 80,
    } as DOMRect);

    dashboard.showDeliveryChipTooltip({ currentTarget: trigger } as unknown as Event);

    expect(dashboard.deliveryChipTooltipOpen()).toBe(true);
    expect(dashboard.deliveryChipTooltipPosition().placement).toBe('below');
    expect(dashboard.formatGestationalWeek(36.25)).toBe('36w 2d');

    const startInput = document.createElement('input');
    startInput.value = '36w 2d';
    dashboard.updateDeliveryChipWeek('start', { target: startInput } as unknown as Event);
    expect(dashboard.pregnancyTimeline().deliveryChip.startWeek).toBeCloseTo(36 + 2 / 7);

    dashboard.cancelDeliveryChipTooltip();
    expect(dashboard.pregnancyTimeline().deliveryChip.startWeek).toBe(39);
    expect(dashboard.deliveryChipTooltipOpen()).toBe(false);
  });

  it('shows the delivery chip tooltip from the recommended delivery summary fact', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.summary-fact--delivery',
    ) as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 40,
      left: 720,
      right: 900,
      top: 80,
      width: 180,
    } as DOMRect);

    trigger.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(dashboard.deliveryChipTooltipOpen()).toBe(true);
    expect(dashboard.deliveryWindowTooltipOpen()).toBe(false);
    expect(trigger.getAttribute('aria-describedby')).toBe('delivery-chip-tooltip');
    expect(fixture.nativeElement.querySelector('#delivery-chip-tooltip')).toBeTruthy();
  });

  it('shows the pregnancy history tooltip from the summary fact', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      '.summary-fact--pregnancy-history',
    ) as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 40,
      left: 620,
      right: 760,
      top: 80,
      width: 140,
    } as DOMRect);

    trigger.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    expect(trigger.querySelector('small')?.textContent?.trim()).toBe('Pregnancy Details');
    expect(trigger.querySelector('strong')?.textContent?.trim()).toBe('G3 P1011');
    expect(dashboard.pregnancyHistoryTooltipOpen()).toBe(true);
    expect(trigger.getAttribute('aria-describedby')).toBe('pregnancy-history-tooltip');
    expect(fixture.nativeElement.querySelector('#pregnancy-history-tooltip')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelectorAll('.pregnancy-history-tooltip__table tbody tr').length,
    ).toBe(4);
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.pregnancy-history-tooltip__status'),
        (status: unknown) => (status as HTMLElement).getAttribute('data-status'),
      ),
    ).toEqual(['completed', 'late', 'ordered', 'future']);
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll('.pregnancy-history-tooltip__date'),
        (date: unknown) => (date as HTMLElement).getAttribute('data-status'),
      ),
    ).toEqual(['completed', 'late', 'ordered', 'future']);
    expect(fixture.nativeElement.querySelector('.summary-toggle')).toBeNull();
  });

  it('shows the final EDD and both dating methods in the EDD tooltip', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.summary-fact--edd') as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 120,
      height: 40,
      left: 620,
      right: 760,
      top: 80,
      width: 140,
    } as DOMRect);

    trigger.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('#edd-tooltip') as HTMLElement;
    expect(dashboard.eddTooltipOpen()).toBe(true);
    expect(tooltip.querySelector('.edd-tooltip__summary')?.textContent).toContain('Final EDD');
    expect(tooltip.querySelector('.edd-tooltip__summary')?.textContent).toContain('June 15, 2026');
    expect(
      Array.from(tooltip.querySelectorAll('.edd-tooltip__dating-card h3'), (heading: unknown) =>
        (heading as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['Dating by LMP', 'Dating by Ultrasound']);
  });

  it('groups the visit order library by its related problem names', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    fixture.detectChanges();

    const orderPicker = fixture.nativeElement.querySelector('.order-picker') as HTMLElement;
    expect(
      Array.from(orderPicker.querySelectorAll('.order-picker__category h4'), (heading: unknown) =>
        (heading as HTMLElement).textContent?.trim(),
      ),
    ).toEqual([
      'Routine Prenatal Care',
      'Elevated Blood Pressure Without Diagnosis of Hypertension',
      'Gestational Hypertension without Proteinuria',
    ]);
    expect(
      Array.from(
        orderPicker.querySelectorAll(
          '.order-picker__category-heading .problem-review__problem-title',
        ),
        (badge: unknown) => (badge as HTMLElement).textContent?.trim(),
      ),
    ).toEqual(['ICD-10 Z34.83', 'ICD-10 R03.0', 'ICD-10 O13.3']);
    expect(
      Array.from(
        orderPicker.querySelectorAll('.order-picker__category button'),
        (button: unknown) => (button as HTMLElement).textContent?.trim(),
      ),
    ).toEqual([
      '1hr GTT',
      'CBC',
      'HIV antigen/antibody',
      'Syphilis antibody',
      'Ambulatory blood pressure monitor',
      'Ambulatory blood pressure monitor',
    ]);
  });

  it('switches only late and future chips when they move across the current-week line', () => {
    const dashboard = new PatientDashboard();
    const track = document.createElement('div');
    const chipElement = document.createElement('div');
    track.className = 'problem-timeline__track';
    track.append(chipElement);
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect);

    const futureChip = dashboard.pregnancyTimeline().groups[3].rows[3].chips[4];
    dashboard.startChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 3,
        clientX: 100,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'gestational-hypertension',
      'patient-education-task',
      futureChip,
      'move',
    );
    dashboard.onChipPointerMove({
      pointerId: 3,
      clientX: 55,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);
    dashboard.endChipInteraction({ pointerId: 3 } as PointerEvent);

    const lateChip = dashboard.pregnancyTimeline().groups[3].rows[3].chips[4];
    expect(lateChip.startWeek).toBe(27.25);
    expect(lateChip.status).toBe('late');

    dashboard.startChipInteraction(
      {
        currentTarget: chipElement,
        pointerId: 4,
        clientX: 55,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as PointerEvent,
      'gestational-hypertension',
      'patient-education-task',
      lateChip,
      'move',
    );
    dashboard.onChipPointerMove({
      pointerId: 4,
      clientX: 65,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent);

    const futureAgainChip = dashboard.pregnancyTimeline().groups[3].rows[3].chips[4];
    expect(futureAgainChip.startWeek).toBe(28.25);
    expect(futureAgainChip.status).toBe('future');
  });

  it('opens the matching vital tooltip and generates its animated SVG path', () => {
    vi.useFakeTimers();
    const dashboard = new PatientDashboard();
    const section = document.createElement('section');
    const card = document.createElement('article');
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 100,
      width: 1000,
    } as DOMRect);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 120,
      right: 300,
      top: 180,
      bottom: 260,
      width: 180,
      height: 80,
    } as DOMRect);
    (
      dashboard as unknown as {
        vitalSigns: ElementRef<HTMLElement>;
      }
    ).vitalSigns = new ElementRef(section);

    dashboard.showVitalTooltip('heart-rate-1', {
      currentTarget: card,
    } as unknown as Event);

    const tooltip = dashboard.activeVitalTooltip();
    const chart = tooltip?.charts?.[0];
    expect(tooltip?.title).toBe('Fetal 1 - Heart Rate Trend');
    expect(chart?.unit).toBe('bpm');
    expect(dashboard.vitalTooltipPosition()).toEqual({
      bottom: null,
      left: 120,
      notchLeft: 90,
      placement: 'below',
      top: 270,
      width: 520,
    });
    expect(dashboard.vitalTooltipMaxHeight()).toBe(320);
    expect(dashboard.tooltipGlassActive()).toBe(false);
    expect(chart && dashboard.vitalChartPath(chart, chart.series[0])).toMatch(/^M42,/);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 420 } as DOMRect);
    if (chart) {
      dashboard.updateVitalChartHover(
        { currentTarget: svg, clientX: 402 } as unknown as MouseEvent,
        chart,
        0,
      );
      expect(dashboard.vitalChartHover()).toEqual({ chartIndex: 0, pointIndex: 5 });
      expect(dashboard.vitalChartTooltipHeading(chart.xLabels[5])).toBe('Week 28');
      expect(dashboard.vitalChartTooltipDate(chart, 5)).toBe('Feb 10, 2026');
      expect(
        dashboard.vitalChartTooltipDate(
          { ...chart, tooltipDates: [null, null, null, null, null, 'Feb 17, 2026'] },
          5,
        ),
      ).toBe('Feb 17, 2026');
      expect(dashboard.vitalChartTooltipLeft(5, chart.xLabels.length)).toBeCloseTo(86);
      expect(dashboard.vitalChartTooltipTop(chart, 5)).toBeGreaterThan(0);
      dashboard.clearVitalChartHover(0);
      expect(dashboard.vitalChartHover()).toBeNull();
    }

    dashboard.showVitalTooltip('blood-pressure', {
      currentTarget: card,
    } as unknown as Event);
    const bloodPressureChart = dashboard.activeVitalTooltip()?.charts?.[0];
    expect(bloodPressureChart?.unit).toBe('mmHg');
    expect(bloodPressureChart && dashboard.vitalChartViewBox(bloodPressureChart)).toBe(
      '0 0 420 120',
    );
    const abnormalThreshold = bloodPressureChart?.thresholds?.[0];
    const bloodPressureSeries = bloodPressureChart?.series[0];
    expect(
      bloodPressureChart &&
        bloodPressureSeries &&
        abnormalThreshold &&
        dashboard.vitalChartThresholdPath(
          bloodPressureChart,
          bloodPressureSeries,
          abnormalThreshold,
        ),
    ).toMatch(/^M342,/);
    expect(
      bloodPressureChart &&
        bloodPressureSeries &&
        dashboard.vitalChartPointColor(bloodPressureChart, bloodPressureSeries, 147),
    ).toBe('#ff595f');
    expect(
      bloodPressureChart &&
        bloodPressureSeries &&
        dashboard.vitalChartPointColor(bloodPressureChart, bloodPressureSeries, 136),
    ).toBe('#5b65ed');

    dashboard.scheduleVitalTooltipHide();
    vi.advanceTimersByTime(100);
    dashboard.keepVitalTooltipOpen();
    vi.advanceTimersByTime(200);
    expect(dashboard.activeVitalTooltip()).not.toBeNull();

    dashboard.scheduleVitalTooltipHide();
    vi.advanceTimersByTime(180);
    expect(dashboard.activeVitalTooltip()).toBeNull();
    vi.useRealTimers();
  });

  it('opens a vital tooltip above its card and keeps its pointer inside the viewport', () => {
    const dashboard = new PatientDashboard();
    const section = document.createElement('section');
    const card = document.createElement('article');
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 800,
      right: 980,
      top: 600,
      bottom: 700,
      width: 180,
      height: 100,
    } as DOMRect);
    (
      dashboard as unknown as {
        vitalSigns: ElementRef<HTMLElement>;
      }
    ).vitalSigns = new ElementRef(section);

    dashboard.showVitalTooltip('heart-rate-1', {
      currentTarget: card,
    } as unknown as Event);

    expect(dashboard.vitalTooltipPosition()).toEqual({
      bottom: 178,
      left: 492,
      notchLeft: 398,
      placement: 'above',
      top: null,
      width: 520,
    });
    expect(dashboard.vitalTooltipMaxHeight()).toBe(320);
  });

  it('opens each Figma result tooltip at the top-right edge of its result card', () => {
    vi.useFakeTimers();
    const dashboard = new PatientDashboard();
    const card = document.createElement('article');
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 120,
      right: 600,
      top: 200,
      bottom: 360,
    } as DOMRect);

    dashboard.showResultTooltip('cbc', { currentTarget: card } as unknown as Event);

    expect(dashboard.activeResultTooltip()?.title).toBe('Complete Blood Count (CBC)');
    expect(dashboard.activeResultTooltip()?.rows).toHaveLength(14);
    expect(dashboard.resultTooltipPosition()).toEqual({
      bottom: null,
      left: 180,
      notchLeft: 180,
      placement: 'below',
      top: 368,
      width: 420,
    });
    expect(dashboard.resultTooltipMaxHeight()).toBe(388);
    expect(dashboard.tooltipGlassActive()).toBe(true);
    expect(dashboard.tooltipGlassFocusRect()).toEqual({
      left: 114,
      right: 606,
      top: 194,
      bottom: 366,
    });

    dashboard.showResultTooltip('home-bp', { currentTarget: card } as unknown as Event);
    expect(dashboard.activeResultTooltip()?.chart?.series.map((series) => series.label)).toEqual([
      'Systolic',
      'Diastolic',
    ]);
    const bloodPressureChart = dashboard.activeResultTooltip()?.chart;
    expect(bloodPressureChart?.unit).toBe('mmHg');
    expect(bloodPressureChart?.tooltipContexts?.[2]).toBe('Week 28');
    expect(bloodPressureChart?.tooltipDates?.[2]).toBe('Mar 24, 2026');
    expect(dashboard.resultTooltipPosition()).toEqual({
      bottom: null,
      left: 80,
      notchLeft: 280,
      placement: 'below',
      top: 368,
      width: 520,
    });

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 472 } as DOMRect);
    if (bloodPressureChart) {
      dashboard.updateResultChartHover(
        {
          currentTarget: svg,
          clientX: dashboard.resultChartX(2, bloodPressureChart.xLabels.length),
        } as unknown as MouseEvent,
        bloodPressureChart,
      );
      expect(dashboard.resultChartHover()).toBe(2);
      expect(
        dashboard.resultChartTooltipHeading(
          bloodPressureChart.xLabels[2],
          bloodPressureChart.tooltipYear,
        ),
      ).toBe('Mar 24, 2026');
      expect(dashboard.resultChartTooltipDate(bloodPressureChart, 2)).toBe('Mar 24, 2026');
      expect(
        dashboard.resultChartTooltipDate({ ...bloodPressureChart, tooltipDates: undefined }, 2),
      ).toBe('Feb 10, 2026');
      expect(dashboard.resultChartTooltipValue(bloodPressureChart, 2)).toBe('128/82');
      dashboard.clearResultChartHover();
      expect(dashboard.resultChartHover()).toBeNull();
    }

    dashboard.showResultTooltip('blood-glucose', { currentTarget: card } as unknown as Event);
    expect(dashboard.activeResultTooltip()?.footer.map((item) => item.message)).toEqual([
      'Elevated fasting readings: 50%',
      'Elevated post-prandial readings: 0%',
    ]);
    expect(dashboard.resultTooltipPosition()).toEqual({
      bottom: null,
      left: 80,
      notchLeft: 280,
      placement: 'below',
      top: 368,
      width: 520,
    });

    dashboard.scheduleResultTooltipHide();
    vi.advanceTimersByTime(180);
    expect(dashboard.activeResultTooltip()).toBeNull();
    vi.useRealTimers();
  });

  it('marks each result reviewed once and keeps the reviewed state', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.result-card .reviewed-button'),
    ) as HTMLButtonElement[];
    const cbcButton = buttons[0];

    expect(cbcButton.textContent?.trim()).toBe('Mark Reviewed');

    cbcButton.click();
    fixture.detectChanges();

    const firstResultCard = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    const reviewedLabel = firstResultCard.querySelector('.result-reviewed-label') as HTMLElement;

    expect(firstResultCard.querySelector('.reviewed-button')).toBeNull();
    expect(reviewedLabel.textContent?.trim()).toBe('Reviewed');
    expect(reviewedLabel.getAttribute('role')).toBe('status');
    expect(reviewedLabel.querySelector('img')?.getAttribute('src')).toBe(
      'assets/timeline-status-tooltip/reviewed-check.svg',
    );
    expect(dashboard.reviewedResultIds()).toEqual(new Set(['cbc']));

    dashboard.markResultReviewed('cbc', new Event('click'));
    fixture.detectChanges();

    expect(firstResultCard.querySelector('.result-reviewed-label')?.textContent?.trim()).toBe(
      'Reviewed',
    );
    expect(dashboard.reviewedResultIds()).toEqual(new Set(['cbc']));
    expect(buttons[1].textContent?.trim()).toBe('Mark Reviewed');
  });

  it('opens a result tooltip above a card near the viewport bottom', () => {
    const dashboard = new PatientDashboard();
    const card = document.createElement('article');
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 500,
      right: 980,
      top: 600,
      bottom: 700,
      width: 480,
      height: 100,
    } as DOMRect);

    dashboard.showResultTooltip('home-bp', { currentTarget: card } as unknown as Event);

    expect(dashboard.resultTooltipPosition()).toEqual({
      bottom: 176,
      left: 460,
      notchLeft: 280,
      placement: 'above',
      top: null,
      width: 520,
    });
    expect(dashboard.resultTooltipMaxHeight()).toBe(430);
  });

  it('opens the pre-eclampsia assessment below the high-risk summary fact', () => {
    vi.useFakeTimers();
    const dashboard = new PatientDashboard();
    const riskFact = document.createElement('button');
    vi.spyOn(riskFact, 'getBoundingClientRect').mockReturnValue({
      left: 760,
      right: 900,
      top: 80,
      bottom: 120,
      width: 140,
      height: 40,
    } as DOMRect);

    dashboard.showRiskAssessment({ currentTarget: riskFact } as unknown as Event);

    expect(dashboard.riskAssessmentOpen()).toBe(true);
    expect(dashboard.riskAssessmentPosition()).toEqual({
      bottom: null,
      left: 300,
      notchLeft: 530,
      placement: 'below',
      top: 128,
      width: 600,
    });
    expect(dashboard.tooltipGlassFocusRect()).toEqual({
      left: 754,
      right: 906,
      top: 74,
      bottom: 126,
    });
    expect(
      dashboard.highRiskFactors.filter((factor) => factor.selected).map((factor) => factor.label),
    ).toEqual([]);
    expect(dashboard.moderateRiskFactors).toHaveLength(5);
    expect(dashboard.recommendedProblemState()).toBe('pending');

    dashboard.addRecommendedProblem();
    expect(dashboard.recommendedProblemState()).toBe('added');

    dashboard.dismissRecommendedProblem();
    expect(dashboard.recommendedProblemState()).toBe('dismissed');

    dashboard.scheduleRiskAssessmentHide();
    vi.advanceTimersByTime(100);
    dashboard.keepRiskAssessmentOpen();
    vi.advanceTimersByTime(200);
    expect(dashboard.riskAssessmentOpen()).toBe(true);

    dashboard.scheduleRiskAssessmentHide();
    vi.advanceTimersByTime(180);
    expect(dashboard.riskAssessmentOpen()).toBe(false);
    expect(dashboard.tooltipGlassActive()).toBe(false);
    vi.useRealTimers();
  });

  it('shows the high-risk summary and recommendations only for selected high-risk factors', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    dashboard.riskAssessmentOpen.set(true);
    fixture.detectChanges();

    const banner = () =>
      fixture.nativeElement.querySelector('.risk-assessment-tooltip__banner') as HTMLElement | null;
    const recommendation = () =>
      fixture.nativeElement.querySelector(
        '.risk-assessment-tooltip__recommendation',
      ) as HTMLElement | null;

    expect(banner()).toBeNull();
    expect(recommendation()).toBeNull();

    dashboard.updateRiskFactorSelection(dashboard.moderateRiskFactors[0], true);
    fixture.detectChanges();
    expect(banner()).toBeNull();
    expect(recommendation()).toBeNull();

    dashboard.updateRiskFactorSelection(dashboard.highRiskFactors[0], true);
    fixture.detectChanges();
    expect(banner()?.textContent).toContain('High Risk Detected (1 High Factor)');
    expect(recommendation()).toBeTruthy();

    dashboard.updateRiskFactorSelection(dashboard.highRiskFactors[1], true);
    fixture.detectChanges();
    expect(banner()?.textContent).toContain('High Risk Detected (2 High Factors)');

    dashboard.updateRiskFactorSelection(dashboard.highRiskFactors[0], false);
    dashboard.updateRiskFactorSelection(dashboard.highRiskFactors[1], false);
    fixture.detectChanges();
    expect(banner()).toBeNull();
    expect(recommendation()).toBeNull();
  });

  it('does not recommend Advanced Maternal Age when it is already on the problem list', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const recommendation = fixture.nativeElement.querySelector(
      '.patient-summary__recommendation',
    ) as HTMLElement | null;

    expect(recommendation).toBeNull();
    expect(
      dashboard.pregnancyTimeline().groups.some((group) => group.label === 'Advanced Maternal Age'),
    ).toBe(true);
  });

  it('renders each pre-eclampsia risk summary variant', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    const variants = [
      ['update', 'Update Risk', 'assets/risk-update.svg'],
      ['low', 'Low Risk', 'assets/risk-low.svg'],
      ['moderate', 'Moderate Risk', 'assets/risk-moderate.svg'],
      ['high', 'High Risk', 'assets/warn-red.svg'],
    ] as const;

    for (const [status, label, icon] of variants) {
      dashboard.preEclampsiaRiskStatus.set(status);
      fixture.detectChanges();

      const riskFact = fixture.nativeElement.querySelector(
        '.summary-fact--risk',
      ) as HTMLButtonElement;

      expect(riskFact.classList.contains(`summary-fact--risk-${status}`)).toBe(true);
      expect(riskFact.querySelector('strong')?.textContent?.trim()).toBe(label);
      expect(riskFact.querySelector('img')?.getAttribute('src')).toBe(icon);
    }
  });

  it('updates the pre-eclampsia status from selected risk factors', () => {
    const dashboard = new PatientDashboard();
    const moderateFactor = dashboard.moderateRiskFactors[0];
    const highFactor = dashboard.highRiskFactors[0];

    expect(dashboard.preEclampsiaRiskStatus()).toBe('update');

    dashboard.updateRiskFactorSelection(moderateFactor, true);
    expect(dashboard.preEclampsiaRiskStatus()).toBe('moderate');

    dashboard.updateRiskFactorSelection(highFactor, true);
    expect(dashboard.preEclampsiaRiskStatus()).toBe('high');

    dashboard.updateRiskFactorSelection(highFactor, false);
    expect(dashboard.preEclampsiaRiskStatus()).toBe('moderate');

    dashboard.updateRiskFactorSelection(moderateFactor, false);
    expect(dashboard.preEclampsiaRiskStatus()).toBe('update');

    dashboard.saveRiskAssessment();
    expect(dashboard.preEclampsiaRiskStatus()).toBe('low');
  });

  it('opens the delivery window tooltip below the recommended delivery summary fact', () => {
    vi.useFakeTimers();
    const dashboard = new PatientDashboard();
    const deliveryFact = document.createElement('button');
    vi.spyOn(deliveryFact, 'getBoundingClientRect').mockReturnValue({
      left: 620,
      right: 860,
      top: 80,
      bottom: 120,
      width: 240,
      height: 40,
    } as DOMRect);

    dashboard.showDeliveryWindowTooltip({ currentTarget: deliveryFact } as unknown as Event);

    expect(dashboard.deliveryWindowTooltipOpen()).toBe(true);
    expect(dashboard.deliveryWindowTooltipPosition()).toEqual({ left: 560, top: 128, width: 300 });
    expect(dashboard.tooltipGlassActive()).toBe(true);
    expect(dashboard.tooltipGlassFocusRect()).toEqual({
      left: 614,
      right: 866,
      top: 74,
      bottom: 126,
    });

    dashboard.scheduleDeliveryWindowTooltipHide();
    vi.advanceTimersByTime(100);
    dashboard.keepDeliveryWindowTooltipOpen();
    vi.advanceTimersByTime(200);
    expect(dashboard.deliveryWindowTooltipOpen()).toBe(true);

    dashboard.scheduleDeliveryWindowTooltipHide();
    vi.advanceTimersByTime(180);
    expect(dashboard.deliveryWindowTooltipOpen()).toBe(false);
    expect(dashboard.tooltipGlassActive()).toBe(false);
    vi.useRealTimers();
  });

  it('counts each numeric vital from zero to its assigned value on load', () => {
    const dashboard = new PatientDashboard();
    const originalMatchMedia = window.matchMedia;
    let animationFrame: FrameRequestCallback | undefined;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        animationFrame = callback;
        return 1;
      });

    dashboard.ngAfterViewInit();
    expect(dashboard.vitalCounts().systolic).toBe(0);

    animationFrame?.(100);
    animationFrame?.(650);
    expect(dashboard.vitalCounts().systolic).toBeGreaterThan(0);
    expect(dashboard.vitalCounts().systolic).toBeLessThan(148);

    animationFrame?.(1200);
    expect(dashboard.vitalCounts()).toEqual({
      bmi: 26.3,
      currentWeight: 165,
      diastolic: 92,
      fundalHeight: 28,
      heartRate: 142,
      systolic: 148,
      weightGain: 22,
    });

    requestAnimationFrame.mockRestore();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  it('displays a dash for zero vital values and restores values with their units', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    const vitalCard = (title: string): HTMLElement =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.vital-card') as NodeListOf<HTMLElement>,
      ).find((card) => card.querySelector('h3')?.textContent?.trim() === title) as HTMLElement;

    fixture.detectChanges();

    for (const title of [
      'Blood Pressure',
      'Fetal Heart Rate',
      'Fundal Height',
      'BMI',
      'Current Weight',
      'Weight Gain',
    ]) {
      expect(vitalCard(title).querySelector('p')?.textContent?.trim()).toBe('-');
    }

    dashboard.vitalCounts.set({
      bmi: 26.3,
      currentWeight: 165,
      diastolic: 92,
      fundalHeight: 28,
      heartRate: 142,
      systolic: 148,
      weightGain: 22,
    });
    fixture.detectChanges();

    expect(vitalCard('Blood Pressure').querySelector('p')?.textContent).toContain('148/92');
    expect(vitalCard('Blood Pressure').querySelector('p span')?.textContent?.trim()).toBe('mmHg');
    expect(vitalCard('Fetal Heart Rate').querySelector('p span')?.textContent?.trim()).toBe('bpm');
    expect(vitalCard('Fundal Height').querySelector('p span')?.textContent?.trim()).toBe('cm');
    expect(vitalCard('BMI').querySelector('.vital-card__value')?.textContent?.trim()).toBe('26.3');
    expect(vitalCard('Current Weight').querySelector('p span')?.textContent?.trim()).toBe('lbs');
    expect(vitalCard('Weight Gain').querySelector('.vital-card__value')?.textContent?.trim()).toBe(
      '+22',
    );
  });

  it('uses scroll hysteresis when switching the summary to sticky mode', () => {
    const dashboard = new PatientDashboard();
    const summary = document.createElement('section');
    vi.spyOn(summary, 'getBoundingClientRect').mockReturnValue({
      top: 70,
      height: 286.4,
    } as DOMRect);
    (
      dashboard as unknown as {
        patientSummary: ElementRef<HTMLElement>;
      }
    ).patientSummary = new ElementRef(summary);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 5 });
    dashboard.onWindowScroll();

    expect(dashboard.summarySticky()).toBe(false);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 12 });

    dashboard.onWindowScroll();

    expect(dashboard.summarySticky()).toBe(true);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    dashboard.onWindowScroll();

    expect(dashboard.summarySticky()).toBe(false);
  });

  it('uses the rendered sticky section heights for the timeline offsets', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    fixture.detectChanges();

    const dashboardElement = fixture.nativeElement.querySelector(
      '.patient-dashboard',
    ) as HTMLElement;
    const summary = fixture.nativeElement.querySelector('.patient-summary') as HTMLElement;
    const timeline = fixture.nativeElement.querySelector('.problem-timeline') as HTMLElement;
    const timelineHeader = fixture.nativeElement.querySelector(
      '.problem-timeline__header',
    ) as HTMLElement;

    vi.spyOn(summary, 'getBoundingClientRect').mockReturnValue({
      height: 224,
      top: 70,
    } as DOMRect);
    vi.spyOn(timelineHeader, 'getBoundingClientRect').mockReturnValue({
      height: 72,
    } as DOMRect);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 12 });

    dashboard.onWindowScroll();

    expect(dashboardElement.style.getPropertyValue('--patient-summary-sticky-height')).toBe(
      '224px',
    );
    expect(timeline.style.getPropertyValue('--problem-timeline-header-height')).toBe('72px');
  });

  it('switches the assessment and plan between abbreviated and full versions', () => {
    const fixture = TestBed.createComponent(PatientDashboard);
    const dashboard = fixture.componentInstance;
    dashboard.progressNoteState.set('submitted');
    fixture.detectChanges();

    const versionButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.assessment-plan__version-toggle button'),
    ) as HTMLButtonElement[];
    const assessmentPlan = () =>
      fixture.nativeElement.querySelector('#assessment-plan-content') as HTMLElement;

    expect(versionButtons).toHaveLength(2);
    expect(versionButtons[0].getAttribute('aria-pressed')).toBe('true');
    expect(assessmentPlan().textContent).toContain('Routine Prenatal Care');
    expect(assessmentPlan().textContent).toContain('Third Trimester Labs: Ordered Today');
    expect(assessmentPlan().textContent).not.toContain('Gestational Hypertension');

    versionButtons[1].click();
    fixture.detectChanges();

    expect(versionButtons[0].getAttribute('aria-pressed')).toBe('false');
    expect(versionButtons[1].getAttribute('aria-pressed')).toBe('true');
    expect(assessmentPlan().textContent).toContain('Routine Prenatal Care');
    expect(assessmentPlan().textContent).toContain('First Trimester Labs');
    expect(assessmentPlan().textContent).toContain('Aneuploidy Screening');
    expect(assessmentPlan().textContent).toContain('Anatomy Ultrasound');
    expect(assessmentPlan().textContent).toContain('Third Trimester Counseling');
    expect(assessmentPlan().querySelectorAll('strong')).toHaveLength(3);
  });
});
