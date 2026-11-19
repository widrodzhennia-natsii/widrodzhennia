import * as yaml from 'js-yaml';
import { zipSync, strToU8 } from 'fflate';
import { ContentLoaderService } from '../../services/contentLoaderService';

export interface LessonExportPayload {
  id: string;
  title: string;
  subjectId?: string;
  gradeId?: string;
  description?: string;
  islandStageName?: string;
  blocks: any[];
}

const slugifyFilePart = (raw: string, fallback: string): string => {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
};

export const serializeLessonToYaml = (payload: LessonExportPayload): string => {
  const doc: Record<string, any> = {
    id: payload.id,
    title: payload.title,
    subjectId: payload.subjectId || 'math',
    gradeId: payload.gradeId || 'grade-05',
    description: payload.description || 'Навчальний урок НУШ.',
  };

  if (payload.islandStageName) {
    doc.islandStageName = payload.islandStageName;
  }

  doc.blocks = payload.blocks || [];

  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
  });
};

export const downloadTextFile = (filename: string, content: string, mime = 'text/yaml;charset=utf-8') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportLessonYamlDownload = (payload: LessonExportPayload): void => {
  const yamlText = serializeLessonToYaml(payload);
  const filename = `${slugifyFilePart(payload.id || payload.title, 'lesson')}.yaml`;
  downloadTextFile(filename, yamlText, 'text/yaml;charset=utf-8');
};

export const exportCourseToZipDownload = (subjectId: string, gradeId?: string): boolean => {
  const subject = ContentLoaderService.getSubjectById(subjectId, gradeId);
  if (!subject) return false;

  const chapters = ContentLoaderService.getChaptersForSubject(subjectId, gradeId);
  const mapSchema = ContentLoaderService.getWorldMapSchemaForSubject(subjectId, gradeId);
  const customVolumes = ContentLoaderService.getStoredCustomVolumes();
  const customVol = customVolumes.find((v) => v.id === subjectId);

  const files: Record<string, Uint8Array> = {};

  const subjectManifest = {
    id: subject.id,
    name: subject.name,
    subjectCategory: subject.subjectCategory || subject.id,
    gradeId: subject.gradeId || gradeId || 'grade-05',
    description: subject.description || 'Навчальний курс НУШ.',
    iconName: subject.iconName || '📘',
    authorLabel: subject.authorLabel || 'Авторський курс',
    isAvailable: true,
  };
  files['subject.yaml'] = strToU8(yaml.dump(subjectManifest, { indent: 2, noRefs: true }));

  if (mapSchema && mapSchema.nodes.length > 0) {
    files['map.yaml'] = strToU8(yaml.dump(mapSchema, { indent: 2, noRefs: true }));
  }

  chapters.forEach((ch, idx) => {
    const blocks = ContentLoaderService.getPipelineForChapter(ch.id) || [];
    const lessonYaml = serializeLessonToYaml({
      id: ch.id,
      title: ch.title,
      subjectId: subject.subjectCategory || subject.id,
      gradeId: subject.gradeId || 'grade-05',
      description: ch.description,
      islandStageName: ch.islandStageName,
      blocks,
    });
    const orderPrefix = String(idx + 1).padStart(2, '0');
    const safeName = slugifyFilePart(ch.id || ch.title, `lesson-${orderPrefix}`);
    files[`chapters/${orderPrefix}-${safeName}.yaml`] = strToU8(lessonYaml);
  });

  if (customVol?.blueprints) {
    Object.values(customVol.blueprints).forEach((bp, idx) => {
      files[`blueprints/${slugifyFilePart(bp.id, `blueprint-${idx + 1}`)}.yaml`] = strToU8(
        yaml.dump(bp, { indent: 2, noRefs: true })
      );
    });
  }

  if (customVol?.characters && customVol.characters.length > 0) {
    files['characters/characters.yaml'] = strToU8(
      yaml.dump({ characters: customVol.characters }, { indent: 2, noRefs: true })
    );
  }

  const zipped = zipSync(files, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  const blob = new Blob([copy], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugifyFilePart(subject.name || subject.id, 'nush-course')}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
};
