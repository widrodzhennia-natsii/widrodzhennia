import Dexie, { type Table } from 'dexie';

export interface StoredCampaign {
  id: string;
  title: string;
  grade: string | number;
  subject: string;
  description: string;
  version: string;
  author: string;
  createdAt: number;
}

export interface StoredLesson {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  islandStageName: string;
  pipeline: any[];
  order: number;
}

export interface StoredAsset {
  path: string;
  campaignId?: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export interface StoredGlossaryTerm {
  id: string;
  term: string;
  subjectId: string;
  category: 'formula' | 'orthogram' | 'term' | 'rule';
  summary: string;
  example?: string;
  feynmanPrompt?: string;
  keywords?: string;
  updatedAt: number;
}

export interface StoredSrsCard {
  id: string;
  termId: string;
  termTitle: string;
  subjectId: string;
  intervalDays: 1 | 3 | 7;
  repetitions: number;
  feynmanNote: string;
  checklistDoneCount: number;
  lastReviewedAt: number;
  nextReviewAt: number;
}

export class EduCombineDatabase extends Dexie {
  campaigns!: Table<StoredCampaign, string>;
  lessons!: Table<StoredLesson, string>;
  assets!: Table<StoredAsset, string>;
  glossaryTerms!: Table<StoredGlossaryTerm, string>;
  srsCards!: Table<StoredSrsCard, string>;

  constructor() {
    super('EduCombineDatabase');
    this.version(1).stores({
      campaigns: 'id, title, grade, subject, version',
      lessons: 'id, campaignId, title, order',
      assets: 'path, campaignId, mimeType, createdAt',
    });
    this.version(2).stores({
      campaigns: 'id, title, grade, subject, version',
      lessons: 'id, campaignId, title, order',
      assets: 'path, campaignId, mimeType, createdAt',
      glossaryTerms: 'id, term, subjectId, category, updatedAt',
      srsCards: 'id, termId, subjectId, intervalDays, nextReviewAt',
    });
  }

  public async saveAssetBlob(path: string, blob: Blob, mimeType: string, campaignId?: string): Promise<string> {
    const cleanPath = path.replace(/^\.\//, '');
    await this.assets.put({
      path: cleanPath,
      campaignId,
      mimeType,
      blob,
      createdAt: Date.now(),
    });
    return cleanPath;
  }

  public async getAssetBlob(path: string): Promise<Blob | null> {
    const cleanPath = path.replace(/^\.\//, '');
    const record = await this.assets.get(cleanPath);
    return record ? record.blob : null;
  }

  public async saveCampaignData(campaign: StoredCampaign, lessons: StoredLesson[]): Promise<void> {
    await this.transaction('rw', this.campaigns, this.lessons, async () => {
      await this.campaigns.put(campaign);
      for (const lesson of lessons) {
        await this.lessons.put(lesson);
      }
    });
  }

  public async upsertGlossaryTerms(terms: StoredGlossaryTerm[]): Promise<void> {
    if (!terms.length) return;
    await this.glossaryTerms.bulkPut(terms);
  }

  public async getAllGlossaryTerms(): Promise<StoredGlossaryTerm[]> {
    return this.glossaryTerms.toArray();
  }

  public async getAllSrsCards(): Promise<StoredSrsCard[]> {
    return this.srsCards.orderBy('nextReviewAt').toArray();
  }

  public async upsertSrsCard(card: StoredSrsCard): Promise<void> {
    await this.srsCards.put(card);
  }
}

export const db = new EduCombineDatabase();
