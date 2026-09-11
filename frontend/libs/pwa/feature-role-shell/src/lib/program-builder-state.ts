import type { ProgramCreate, ProgramSlotWrite } from '@toptrainers/shared/contracts';
import { finalize, type Observable } from 'rxjs';

export const TRAINER_PROGRAM_BUILDER_NAVIGATION = [
  { path: '/trainer', label: 'Сегодня', icon: '⌂' },
  { path: '/trainer/clients', label: 'Клиенты', icon: '♙' },
  { path: '/trainer/programs', label: 'Программы', icon: '▦' },
  { path: '/trainer/chats', label: 'Чаты', icon: '◌' },
  { path: '/trainer/competitions', label: 'Ещё', icon: '♜' },
] as const;

export interface ProgramDraft {
  id: string | null;
  title: string;
  description: string;
  durationWeeks: number;
  slots: ProgramSlotWrite[];
}

export function createProgramDraft(): ProgramDraft {
  return { id: null, title: '', description: '', durationWeeks: 1, slots: [] };
}

export function programDraftPayload(draft: ProgramDraft): ProgramCreate {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    duration_weeks: draft.durationWeeks,
    slots: draft.slots,
  };
}

export function setProgramDraftDuration(draft: ProgramDraft, durationWeeks: number): ProgramDraft {
  return {
    ...draft,
    durationWeeks,
    slots: draft.slots.filter((slot) => slot.week_number <= durationWeeks),
  };
}

export function setProgramDraftSlot(
  draft: ProgramDraft,
  weekNumber: number,
  dayNumber: number,
  workoutId: string | null,
): ProgramDraft {
  const slotsWithoutDay = draft.slots.filter(
    (slot) => slot.week_number !== weekNumber || slot.day_number !== dayNumber,
  );
  const slots = workoutId
    ? [
        ...slotsWithoutDay,
        { week_number: weekNumber, day_number: dayNumber, workout_id: workoutId },
      ]
    : slotsWithoutDay;

  return {
    ...draft,
    slots: slots.sort(
      (left, right) => left.week_number - right.week_number || left.day_number - right.day_number,
    ),
  };
}

export function nextProgramIssueRequestId(
  currentRequestId: string | null,
  createRequestId: () => string,
): string {
  return currentRequestId ?? createRequestId();
}

export function releaseBusyOnFinalize<T>(source: Observable<T>, release: () => void): Observable<T> {
  return source.pipe(finalize(release));
}
