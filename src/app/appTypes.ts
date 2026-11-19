export type ActiveView = 'doors' | 'bookshelf' | 'chapter_map' | 'subject_hub' | 'game' | 'author_studio' | 'question_bank';

export type SubjectViewMode = 'map' | 'topic_list';

export interface AppState {
  activeView: ActiveView;
  selectedGradeId: string;
  selectedSubjectId: string;
  subjectViewMode: SubjectViewMode;
  isMapExpanded: boolean;
  isProfileOpen: boolean;
}
