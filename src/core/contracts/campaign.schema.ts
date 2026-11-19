import { z } from 'zod';
import { BlockSchema } from './blocks.schema';

export const ChapterManifestSchema = z.object({
  id: z.string().min(1, 'ID епізоду є обов’язковим'),
  title: z.string().min(1, 'Назва епізоду обов’язкова'),
  islandStageName: z.string().optional(),
  description: z.string().default('Сценарій та інтерактивний квест.'),
  pipeline: z.array(z.any()).min(1, 'Епізод має містити хоча б один блоковий крок'),
});

export const CampaignManifestSchema = z.object({
  id: z.string().min(1, 'ID кампанії є обов’язковим'),
  title: z.string().min(1, 'Назва курсу/кампанії обов’язкова'),
  grade: z.union([z.number(), z.string()]).default(5),
  subject: z.string().default('math'),
  description: z.string().default('Інтерактивна програма НУШ.'),
  version: z.string().default('1.0.0'),
  author: z.string().default('Учитель/Волонтер'),
  chapters: z.array(ChapterManifestSchema).default([]),
});

export type ChapterManifest = z.infer<typeof ChapterManifestSchema>;
export type CampaignManifest = z.infer<typeof CampaignManifestSchema>;
