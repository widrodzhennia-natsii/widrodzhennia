import { unzipSync, strFromU8 } from 'fflate';
import { CampaignManifest, CampaignManifestSchema } from '../contracts/campaign.schema';
import { StoryBlockZod } from '../contracts/blocks.schema';
import { Blueprint } from '../contracts/blueprint.schema';
import { YamlCurriculumParser, YamlBlueprintParser, ParsedCharacterYaml } from '../../services/yamlCurriculumParser';
import { TextShorthandParser } from './text-shorthand-parser';
import { db } from '../storage/db';

const ALLOWED_EXTENSIONS = new Set([
  'yaml', 'yml', 'json', 'txt', 'md',
  'svg', 'webp', 'png', 'jpg', 'jpeg', 'gif',
  'html', 'css', 'js',
]);

const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'bin', 'msi', 'com', 'scr', 'vbs',
]);

export interface ExtractedLessonItem {
  fileName: string;
  relativePath?: string;
  id: string;
  title: string;
  description?: string;
  islandStageName?: string;
  fileType: 'lesson' | 'world_map' | 'manifest' | 'avatar' | 'voice_config' | 'blueprint' | 'media';
  pipeline: StoryBlockZod[];
  mapData?: any;
  blueprintData?: Blueprint;
  characterData?: ParsedCharacterYaml | ParsedCharacterYaml[];
  manifestData?: Record<string, any>;
  mediaBlob?: Blob;
  mediaMimeType?: string;
  textContent?: string;
}

export interface ExtractedArchiveResult {
  manifest?: CampaignManifest;
  lessons: ExtractedLessonItem[];
  assetsCount: number;
  ignoredFiles: string[];
}

export class ArchiveExtractor {
  /**
   * In-memory extraction of .zip or .edupack package with automatic type recognition
   */
  public static async extract(file: File): Promise<ExtractedArchiveResult> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const unzipped = unzipSync(bytes);

    let manifest: CampaignManifest | undefined = undefined;
    const lessons: ExtractedLessonItem[] = [];
    let assetsCount = 0;
    const ignoredFiles: string[] = [];

    const fileEntries = Object.entries(unzipped).sort(([pathA], [pathB]) =>
      YamlCurriculumParser.naturalCompare(pathA, pathB)
    );

    for (const [relativePath, contentBytes] of fileEntries) {
      if (relativePath.endsWith('/') || relativePath.startsWith('__MACOSX')) {
        continue;
      }

      const parts = relativePath.split('.');
      const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
      const fileNameOnly = relativePath.split('/').pop() || relativePath;
      const lowerPath = relativePath.toLowerCase();

      if (EXECUTABLE_EXTENSIONS.has(ext)) {
        ignoredFiles.push(`${relativePath} (Заблоковано виконуваний файл)`);
        continue;
      }

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        ignoredFiles.push(relativePath);
        continue;
      }

      // Handle YAML, JSON, TXT, MD files
      if (ext === 'yaml' || ext === 'yml' || ext === 'json' || ext === 'txt' || ext === 'md') {
        const textContent = strFromU8(contentBytes);
        const lowerName = fileNameOnly.toLowerCase();

        const hasLessonStructure =
          /(?:^|\n)\s*(?:blocks|pipeline|steps|stages|scenes|tasks|sections|slides|episodes|activities|items|elements)\s*:/i.test(textContent) ||
          /(?:^|\n)\s*(?:lesson|chapter|scenario|quest|module|unit|course)\s*:/i.test(textContent) ||
          /(?:^|\n)\s*-\s+(?:type|id|theory|fact|rule|dialogue|quiz|task|question)\s*:/i.test(textContent);

        // 1. Detect World Map File (only when NOT a lesson scenario with embedded mapTopology)
        if (
          !hasLessonStructure &&
          (lowerName === 'map.yaml' ||
            lowerName === 'map.yml' ||
            lowerName.includes('world_map') ||
            textContent.includes('[МАПА]') ||
            textContent.includes('type: map') ||
            textContent.includes('type: "world_map"') ||
            ((textContent.includes('mapTitle:') || textContent.includes('"mapTitle"') || textContent.includes('nodes:')) &&
              !textContent.includes('blocks:')))
        ) {
          try {
            const parsedMap = YamlCurriculumParser.parseWorldMapContent(textContent, 'Сюжетна мапа курсу');
            const idMatch = textContent.match(/(?:#\s*)?(?:id|айді)\s*[:=]\s*["']?([^"'\s\]]+)["']?/i);
            const mapId = idMatch ? TextShorthandParser.sanitizeId(idMatch[1]) : TextShorthandParser.sanitizeId(fileNameOnly);
            lessons.push({
              fileName: fileNameOnly,
              relativePath,
              id: mapId,
              title: parsedMap.mapTitle || 'Сюжетна мапа курсу',
              description: 'Топологія локацій та сюжетних вузлів.',
              fileType: 'world_map',
              pipeline: [],
              mapData: parsedMap,
              textContent,
            });
            continue;
          } catch {
            // Fallback to other detectors
          }
        }

        // 2. Detect Blueprint File (`blueprints/*.yaml`, `*.blueprint.yaml`, `totalSpanMeters:`, standalone `geometry:`)
        if (
          !hasLessonStructure &&
          (lowerPath.includes('/blueprints/') ||
            lowerName.includes('blueprint') ||
            textContent.includes('totalSpanMeters:') ||
            textContent.includes('geometry:'))
        ) {
          try {
            const bp = YamlBlueprintParser.parseBlueprintContent(textContent, fileNameOnly);
            lessons.push({
              fileName: fileNameOnly,
              relativePath,
              id: bp.id,
              title: bp.title,
              description: bp.description || 'Технічні геометричні параметри та матеріали об’єкта.',
              fileType: 'blueprint',
              pipeline: [],
              blueprintData: bp,
              textContent,
            });
            continue;
          } catch {
            // Fallback
          }
        }

        // 3. Detect Campaign / Subject Manifest File
        if (
          !hasLessonStructure &&
          (lowerName === 'subject.yaml' ||
            lowerName === 'subject.yml' ||
            lowerName.includes('campaign') ||
            lowerName.includes('manifest'))
        ) {
          try {
            let manifestObj: Record<string, any> | undefined = undefined;
            if (ext === 'json') {
              const parsed = JSON.parse(textContent);
              manifest = CampaignManifestSchema.parse(parsed);
              manifestObj = manifest;
            } else {
              manifestObj = YamlCurriculumParser.parseSubjectManifest(textContent, TextShorthandParser.sanitizeId(fileNameOnly));
            }
            const manifestId = manifestObj?.id || TextShorthandParser.sanitizeId(fileNameOnly);
            lessons.push({
              fileName: fileNameOnly,
              relativePath,
              id: manifestId,
              title: manifestObj?.name || manifestObj?.title || 'Маніфест навчального курсу',
              description: manifestObj?.description || 'Параметри та структура навчального курсу.',
              fileType: 'manifest',
              pipeline: [],
              manifestData: manifestObj,
              textContent,
            });
            continue;
          } catch {
            // Fallback
          }
        }

        // 4. Detect Character / Avatar / Voice Definition File
        if (
          !hasLessonStructure &&
          (lowerPath.includes('/characters/') ||
            lowerName.includes('character') ||
            lowerName.includes('speaker') ||
            lowerName.includes('voice') ||
            lowerName.includes('avatar') ||
            textContent.includes('pitchMultiplier:') ||
            textContent.includes('basePitch:'))
        ) {
          try {
            const charProf = YamlCurriculumParser.parseCharacterYaml(textContent);
            const firstProf = Array.isArray(charProf) ? charProf[0] : charProf;
            lessons.push({
              fileName: fileNameOnly,
              relativePath,
              id: firstProf?.id || TextShorthandParser.sanitizeId(fileNameOnly),
              title: Array.isArray(charProf)
                ? `Персонажі (${charProf.length})`
                : `Персонаж: ${firstProf?.name || fileNameOnly}`,
              description: firstProf?.description,
              fileType: lowerName.includes('avatar') ? 'avatar' : 'voice_config',
              pipeline: [],
              characterData: charProf,
              textContent,
            });
            continue;
          } catch {
            // Fallback
          }
        }

        // 5. Detect Story Lesson Files
        try {
          if (ext === 'yaml' || ext === 'yml' || ext === 'json' || YamlCurriculumParser.looksLikeYaml(textContent)) {
            const parsedQuest = YamlCurriculumParser.parseQuestYaml(textContent, fileNameOnly);
            lessons.push({
              fileName: fileNameOnly,
              relativePath,
              id: parsedQuest.id,
              title: parsedQuest.title,
              description: parsedQuest.description,
              islandStageName: parsedQuest.islandStageName,
              fileType: 'lesson',
              pipeline: parsedQuest.pipeline as StoryBlockZod[],
              mapData: parsedQuest.mapTopology,
              textContent,
            });
          } else if (ext === 'txt' || ext === 'md') {
            const chapterResults = TextShorthandParser.parseMultiChapterBook(textContent, fileNameOnly);
            chapterResults.forEach((parsed) => {
              lessons.push({
                fileName: fileNameOnly,
                relativePath,
                id: parsed.id,
                title: parsed.title,
                description: parsed.description,
                islandStageName: parsed.islandStageName,
                fileType: parsed.fileType,
                pipeline: parsed.blocks,
                mapData: parsed.fileType === 'world_map' ? YamlCurriculumParser.parseWorldMapContent(textContent, parsed.title) : undefined,
                textContent,
              });
            });
          }
        } catch (err) {
          console.warn(`Failed to parse lesson file ${relativePath}:`, err);
        }
      }

      // Handle Media & HTML5 Sandbox Assets
      if (['svg', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'html', 'css', 'js'].includes(ext)) {
        const mimeType = this.getMimeType(ext);
        const blob = new Blob([contentBytes], { type: mimeType });
        await db.saveAssetBlob(relativePath, blob, mimeType, manifest?.id);
        lessons.push({
          fileName: fileNameOnly,
          relativePath,
          id: TextShorthandParser.sanitizeId(fileNameOnly),
          title: `Медіа-ресурс: ${fileNameOnly}`,
          description: mimeType,
          fileType: 'media',
          pipeline: [],
          mediaBlob: blob,
          mediaMimeType: mimeType,
        });
        assetsCount++;
      }
    }

    lessons.sort((a, b) => {
      if (a.fileType === 'lesson' && b.fileType === 'lesson') {
        return YamlCurriculumParser.naturalCompare(
          a.relativePath || a.fileName || a.id,
          b.relativePath || b.fileName || b.id
        );
      }
      if (a.fileType === 'manifest' && b.fileType !== 'manifest') return -1;
      if (a.fileType !== 'manifest' && b.fileType === 'manifest') return 1;
      return 0;
    });

    if (!manifest) {
      const lessonItems = lessons.filter((l) => l.fileType === 'lesson');
      manifest = {
        id: `campaign_${Date.now()}`,
        title: file.name.replace(/\.(zip|edupack)$/i, ''),
        grade: 5,
        subject: 'custom',
        description: 'Навчальний курс із практичними завданнями.',
        version: '1.0.0',
        author: 'Автор курсу',
        chapters: lessonItems.map((l) => ({
          id: l.id,
          title: l.title,
          islandStageName: l.islandStageName || undefined,
          description: l.description || '',
          pipeline: l.pipeline,
        })),
      };
    }

    return { manifest, lessons, assetsCount, ignoredFiles };
  }

  public static getMimeType(ext: string): string {
    switch (ext) {
      case 'svg': return 'image/svg+xml';
      case 'webp': return 'image/webp';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'html': return 'text/html';
      case 'css': return 'text/css';
      case 'js': return 'application/javascript';
      default: return 'application/octet-stream';
    }
  }
}
