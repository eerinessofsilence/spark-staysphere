import { prepareHousekeepingPhoto } from './housekeeping-photo';

export interface MaintenanceAttachment {
  file: File;
  view: 'photo' | '360';
}

export async function appendMaintenancePhotos(form: FormData, photos: MaintenanceAttachment[]): Promise<void> {
  for (const photo of photos) {
    const dataUrl = await prepareHousekeepingPhoto(photo.file, photo.view === '360' ? 2048 : 1200);
    const blob = await (await fetch(dataUrl)).blob();
    form.append('photos', new File([blob], 'maintenance-photo.jpg', { type: 'image/jpeg' }));
    form.append('photoViews', photo.view);
  }
}

export function maintenancePhotoViews(form: FormData, count: number): ('photo' | '360')[] | null {
  const views = form.getAll('photoViews');
  if (!views.length) return Array.from({ length: count }, () => 'photo');
  if (views.length !== count || views.some((view) => view !== 'photo' && view !== '360')) return null;
  return views as ('photo' | '360')[];
}
