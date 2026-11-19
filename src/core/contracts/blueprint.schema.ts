import { z } from 'zod';

export const BlueprintSchema = z.object({
  id: z.string().min(1, 'ID креслення є обов’язковим'),
  title: z.string().min(1, 'Назва об’єкта чи конструкції обов’язкова'),
  subjectId: z.string().optional(),
  gradeId: z.union([z.string(), z.number()]).optional(),
  category: z.enum(['bridge', 'cannon', 'abacus', 'plane', 'fortress', 'gate', 'custom']).default('custom'),
  description: z.string().default('Інженерне креслення або схема побудови.'),
  totalSpanMeters: z.number().optional(),
  loadCapacityTons: z.number().optional(),
  material: z.string().optional(),
  geometry: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  materials: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  hints: z.array(z.string()).default([]),
  dimensions: z.object({
    width: z.number().optional(),
    height: z.number().optional(),
    length: z.number().optional(),
  }).optional(),
  components: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().default(1),
    material: z.string().default('wood'),
  })).default([]),
  assets: z.array(z.string()).default([]),
  rawText: z.string().optional(),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;
