import { Chapter } from '../curriculum/types';
import { StoryBlock } from '../core/contracts/campaign.contract';
import { useSessionStore } from '../core/state/useSessionStore';
import { ContentLoaderService } from './contentLoaderService';

export class ScenarioBuilderService {
  /**
   * Constructs the StoryBlock[] queue for a given chapter from YAML content,
   * resolving any referenced blueprints from the subject / grade / cache.
   */
  public static buildStepsForChapter(chapter?: Chapter, subjectId?: string): StoryBlock[] {
    if (!chapter) {
      return [
        {
          type: 'block_dialogue',
          id: 'error_no_chapter',
          speaker: 'Система',
          avatar: 'ℹ️',
          text: 'Навчальний розділ не знайдено або ще не завантажено.',
          emote: 'idea',
        },
      ];
    }

    const activeSubjectId = subjectId || chapter.subjectId;
    const rawPipeline = ContentLoaderService.getPipelineForChapter(chapter.id, activeSubjectId);

    if (rawPipeline && rawPipeline.length > 0) {
      const { blocks: cleanPipeline } = ContentLoaderService.sanitizePipelineBlocks(rawPipeline, chapter.id);
      return cleanPipeline.map((block: any) => {
        const bpId = block.blueprintId || block.blueprintRef;
        if (bpId && !block.blueprint) {
          const resolvedBp = ContentLoaderService.getBlueprintById(bpId, activeSubjectId);
          if (resolvedBp) {
            return { ...block, blueprint: resolvedBp };
          }
        }
        return block;
      });
    }

    // Minimal clean fallback if lesson metadata exists without blocks yet
    return [
      {
        type: 'block_anchor_fact',
        id: `intro_${chapter.id}`,
        headline: chapter.title,
        contentSummary:
          chapter.description ||
          chapter.lesson?.storyText ||
          'Цей навчальний розділ ще не містить інтерактивних блоків. Додайте блоки сценарію через YAML або текстовий імпорт.',
        locationLabel: 'Матеріали розділу',
      },
    ];
  }

  /**
   * Loads a chapter scenario directly into the active session store
   */
  public static loadChapterScenario(chapter: Chapter, subjectId?: string): void {
    const steps = this.buildStepsForChapter(chapter, subjectId);
    useSessionStore.getState().setQuest(chapter.id, steps);
  }
}
