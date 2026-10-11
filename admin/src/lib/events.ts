import { ApiError, api } from './api';
import { attempt } from './result';
import type { Edition, Partner, PublishInfo, Series } from './types';

export type SeriesInput = Omit<Series, 'id' | 'edition_count'>;
export type EditionInput = Omit<Edition, 'id' | 'series_name'>;
export type PartnerInput = Pick<Partner, 'name' | 'role'> & Partial<Pick<Partner, 'series_id' | 'edition_id' | 'sort_order'>>;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const listSeries = () => api.get<Series[]>('/series');
export const getSeries = (id: string) => api.get<Series>(`/series/${id}`);
export const saveSeries = (id: string | null, input: Partial<SeriesInput>) =>
  attempt(() => (id ? api.patch<Series>(`/series/${id}`, input) : api.post<Series>('/series', input)), "The series couldn't be saved. Try again.");
export const deleteSeries = (id: string) => attempt(() => api.del(`/series/${id}`), "The series couldn't be deleted. Try again.");

export const listEditions = (seriesId?: string) => api.get<Edition[]>(seriesId ? `/editions?series_id=${seriesId}` : '/editions');
export const getEdition = (id: string) => api.get<Edition>(`/editions/${id}`);
export const saveEdition = (id: string | null, input: Partial<EditionInput>) =>
  attempt(() => (id ? api.patch<Edition>(`/editions/${id}`, input) : api.post<Edition>('/editions', input)), "The edition couldn't be saved. Try again.");
export const deleteEdition = (id: string) => attempt(() => api.del(`/editions/${id}`), "The edition couldn't be deleted. Try again.");

export const listPartners = (filter: { series_id?: string; edition_id?: string }) =>
  api.get<Partner[]>(`/partners?${new URLSearchParams(filter as Record<string, string>)}`);
export const savePartner = (id: string | null, input: PartnerInput) =>
  attempt(() => (id ? api.patch<Partner>(`/partners/${id}`, input) : api.post<Partner>('/partners', input)), "The partner couldn't be saved. Try again.");
export const deletePartner = (id: string) => attempt(() => api.del(`/partners/${id}`), "The partner couldn't be removed. Try again.");

// Checks type and size in the browser first; the server checks again
export function checkImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Upload a JPG, PNG or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

export const uploadBanner = (file: File) =>
  attempt(async () => {
    const problem = checkImage(file);
    if (problem) throw new ApiError(400, problem);
    return api.upload<{ id: string }>(`/files?filename=${encodeURIComponent(file.name)}`, file);
  }, "The image couldn't be uploaded. Try again.");

export const fileUrl = (id: string) => `/api/files/${id}`;

export const latestPublish = () => api.get<PublishInfo | null>('/publish/latest');
export const publish = () =>
  attempt(
    () => api.post<{ published_at: string; series: number; events: number; deploy_hook: 'sent' | 'failed' | 'not_configured' }>('/publish'),
    "The website couldn't be updated. Try again.",
  );

export const STATUS_LABELS: Record<Edition['status'], string> = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' };
