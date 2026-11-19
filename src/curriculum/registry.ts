import { GradeConfig } from './types';
import { ContentLoaderService } from '../services/contentLoaderService';

export const getCurriculumRegistry = (): GradeConfig[] => {
  return ContentLoaderService.getGrades();
};

export const curriculumRegistry: GradeConfig[] = ContentLoaderService.getGrades();
