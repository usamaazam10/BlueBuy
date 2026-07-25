/**
 * CMS repositories — the single gateway to the marketing-content collections
 * (`site_settings`, `homepage`, `footer`, `contact_information`, `navigation`,
 * `banners`, `social_links`).
 *
 * Two shapes are supported, both built from small factories so every CMS
 * collection behaves identically:
 *
 *  - **Singletons** — exactly one document (`{collection}/main`). `get()` reads
 *    it, deep-merged over the model defaults so an absent doc or a newly-added
 *    field always resolves to a sensible value. `save()` validates and writes
 *    the whole object (merge:true preserves `createdAt`).
 *
 *  - **Item collections** — many ordered documents with full CRUD, mirroring
 *    {@link CategoryRepository}: unordered reads (sorted client-side by
 *    `sortOrder`) so they stay on the automatic single-field index.
 *
 * Components never touch Firestore directly — every read/write goes through
 * here, and every failure is normalised to an `AppError`.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { z, ZodType } from 'zod';
import { getDb, withAppError } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import {
  siteSettingsSchema,
  homepageSchema,
  footerSchema,
  contactInformationSchema,
  navItemCreateSchema,
  navItemUpdateSchema,
  bannerCreateSchema,
  bannerUpdateSchema,
  socialLinkCreateSchema,
  socialLinkUpdateSchema,
} from '@/lib/validations';
import {
  DEFAULT_SITE_SETTINGS,
  DEFAULT_HOMEPAGE,
  DEFAULT_FOOTER,
  DEFAULT_CONTACT_INFORMATION,
  type SiteSettings,
  type Homepage,
  type Footer,
  type ContactInformation,
  type NavItem,
  type Banner,
  type SocialLink,
} from '@/types/cms';

/** The id every singleton document uses. */
const SINGLETON_ID = 'main';

/** True for a non-null, non-array object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Fill `base` with values from `override`, key by key. Only keys present in
 * `base` are kept (so Firestore's `createdAt`/`updatedAt` are dropped), nested
 * objects are merged recursively, and arrays/scalars from `override` win
 * wholesale. This is what makes stored CMS docs forward-compatible: a field
 * added to a model after a doc was written still resolves to its default.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : (override as T);
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (key in override) {
      result[key] = deepMerge((base as Record<string, unknown>)[key], override[key]);
    }
  }
  return result as T;
}

/** Build a get/save repository for a singleton CMS document. */
function createSingletonRepository<S extends ZodType>(
  collectionName: string,
  schema: S,
  defaults: z.infer<S>
) {
  type T = z.infer<S>;
  return {
    /** Read the document, deep-merged over defaults (never rejects on absence). */
    async get(): Promise<T> {
      return withAppError(async () => {
        const snap = await getDoc(doc(getDb(), collectionName, SINGLETON_ID));
        return snap.exists() ? deepMerge(defaults, snap.data()) : defaults;
      }, `load ${collectionName}`);
    },
    /** Validate and persist the whole document (preserves `createdAt`). */
    async save(input: T): Promise<T> {
      const data = schema.parse(input) as T;
      return withAppError(async () => {
        await setDoc(
          doc(getDb(), collectionName, SINGLETON_ID),
          {
            ...(data as Record<string, unknown>),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        return data;
      }, `save ${collectionName}`);
    },
  };
}

/** Minimum shape every CMS collection item shares. */
interface CmsItem {
  id: string;
  sortOrder: number;
  active: boolean;
}

/** Build a full-CRUD repository for an ordered CMS item collection. */
function createCollectionRepository<TItem extends CmsItem, SC extends ZodType, SU extends ZodType>(
  collectionName: string,
  createSchema: SC,
  updateSchema: SU
) {
  function ref() {
    return collection(getDb(), collectionName);
  }
  function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): TItem {
    return { ...(snapshot.data() as Omit<TItem, 'id'>), id: snapshot.id } as TItem;
  }
  function bySortOrder(a: TItem, b: TItem) {
    return a.sortOrder - b.sortOrder;
  }

  return {
    /** Every item (active + inactive), sorted client-side by `sortOrder`. */
    async list(): Promise<TItem[]> {
      return withAppError(async () => {
        const snap = await getDocs(ref());
        return snap.docs.map(fromSnapshot).sort(bySortOrder);
      }, `list ${collectionName}`);
    },
    /** Active items only, sorted by `sortOrder`. */
    async listActive(): Promise<TItem[]> {
      const all = await this.list();
      return all.filter((item) => item.active);
    },
    /** Create an item. */
    async create(input: z.infer<SC>): Promise<TItem> {
      const data = createSchema.parse(input) as Record<string, unknown>;
      return withAppError(async () => {
        const created = await addDoc(ref(), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        const snap = await getDoc(created);
        return fromSnapshot(snap as QueryDocumentSnapshot<DocumentData>);
      }, `create ${collectionName}`);
    },
    /** Update an item. */
    async update(id: string, input: z.infer<SU>): Promise<TItem> {
      const data = updateSchema.parse(input) as Record<string, unknown>;
      return withAppError(async () => {
        const target = doc(getDb(), collectionName, id);
        await updateDoc(target, { ...data, updatedAt: serverTimestamp() });
        const snap = await getDoc(target);
        return fromSnapshot(snap as QueryDocumentSnapshot<DocumentData>);
      }, `update ${collectionName}`);
    },
    /** Delete an item. */
    async remove(id: string): Promise<void> {
      return withAppError(async () => {
        await deleteDoc(doc(getDb(), collectionName, id));
      }, `delete ${collectionName}`);
    },
  };
}

// ─────────────────────────────── singleton repos ─────────────────────────────

export const SiteSettingsRepository = createSingletonRepository<typeof siteSettingsSchema>(
  COLLECTIONS.siteSettings,
  siteSettingsSchema,
  DEFAULT_SITE_SETTINGS as SiteSettings
);

export const HomepageRepository = createSingletonRepository<typeof homepageSchema>(
  COLLECTIONS.homepage,
  homepageSchema,
  DEFAULT_HOMEPAGE as Homepage
);

export const FooterRepository = createSingletonRepository<typeof footerSchema>(
  COLLECTIONS.footer,
  footerSchema,
  DEFAULT_FOOTER as Footer
);

export const ContactRepository = createSingletonRepository<typeof contactInformationSchema>(
  COLLECTIONS.contactInformation,
  contactInformationSchema,
  DEFAULT_CONTACT_INFORMATION as ContactInformation
);

// ─────────────────────────────── collection repos ────────────────────────────

export const NavigationRepository = createCollectionRepository<
  NavItem,
  typeof navItemCreateSchema,
  typeof navItemUpdateSchema
>(COLLECTIONS.navigation, navItemCreateSchema, navItemUpdateSchema);

export const BannerRepository = createCollectionRepository<
  Banner,
  typeof bannerCreateSchema,
  typeof bannerUpdateSchema
>(COLLECTIONS.banners, bannerCreateSchema, bannerUpdateSchema);

export const SocialLinkRepository = createCollectionRepository<
  SocialLink,
  typeof socialLinkCreateSchema,
  typeof socialLinkUpdateSchema
>(COLLECTIONS.socialLinks, socialLinkCreateSchema, socialLinkUpdateSchema);

export type SiteSettingsRepositoryType = typeof SiteSettingsRepository;
export type HomepageRepositoryType = typeof HomepageRepository;
export type FooterRepositoryType = typeof FooterRepository;
export type ContactRepositoryType = typeof ContactRepository;
export type NavigationRepositoryType = typeof NavigationRepository;
export type BannerRepositoryType = typeof BannerRepository;
export type SocialLinkRepositoryType = typeof SocialLinkRepository;
