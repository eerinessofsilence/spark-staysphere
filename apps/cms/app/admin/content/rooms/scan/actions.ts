'use server';

import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { catalogService, contentService, hotelRepository, roomRecognizer } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { MAX_PHOTO_BYTES } from '@/lib/domain/photo-upload';
import type { MediaAsset } from '@/lib/domain/ports';
import type { RoomGuess } from '@/lib/domain/room-recognition';
import { kebabSuggestion } from '@/lib/domain/slug';
import { getAdminT } from '@/lib/i18n/admin/server';
import { formStateFromError } from '../../_lib/form-state';
import { revalidateContent } from '../../_lib/revalidate';

export type RecognizeRoomResult = { ok: true; asset: MediaAsset; guess: RoomGuess | null } | { ok: false; message: string };

/**
 * One photo in, a draft out: the photo is saved to the media library first
 * (it becomes the room type's cover), then shown to the recognizer. A `null`
 * guess is not an error — it is the form arriving empty.
 */
export async function recognizeRoomAction(formData: FormData): Promise<RecognizeRoomResult> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permEditContent');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: t('upload.invalid') };
  }
  const bytes = await file.arrayBuffer();
  const upload = await contentService.uploadPhoto(file.name, file.type, bytes);
  if (!upload.ok) return { ok: false, message: formStateFromError(upload.error, t).message };

  const hotelSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(hotelSlug);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const guess = await roomRecognizer.recognize({
    imageBase64: Buffer.from(bytes).toString('base64'),
    mimeType: file.type,
    hotelName: hotel.name,
    existingNames: rooms.map((room) => room.name),
  });
  return { ok: true, asset: upload.value, guess };
}

/** The stitched 360° tour, filed as a panorama so the room's gallery can show it as one. */
export async function uploadRoomPanoramaAction(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const t = await getAdminT();
  try {
    await requirePermission('team.permEditContent');
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false, message: t('team.permissionDenied') };
    throw error;
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) return { ok: false, message: t('upload.invalid') };
  const upload = await contentService.uploadPhoto(file.name, file.type, await file.arrayBuffer(), 'panorama');
  if (!upload.ok) return { ok: false, message: formStateFromError(upload.error, t).message };
  return { ok: true, url: upload.value.url };
}

export type AttachScanResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * The scan joins a room type that already exists instead of making a new
 * one: the photo and, when there is one, the tour go on the end of its
 * gallery, and nothing else about the type changes. A type with no photo
 * yet gets this one as its cover.
 */
export async function attachScanToRoomAction(input: { roomId: string; photoUrl: string; panoramaUrl?: string | null }): Promise<AttachScanResult> {
  const t = await getAdminT();
  const current = await contentService.getRoomContent(input.roomId);
  if (!current) return { ok: false, message: t('scanRoom.attachNotFound') };
  const { version, hidden: _hidden, id: _id, hotelId: _hotelId, slug: _slug, ...fields } = current;
  const result = await contentService.updateRoom(
    input.roomId,
    {
      ...fields,
      // Seed types can predate these lists; the update schema wants them present.
      amenities: fields.amenities ?? [],
      facilities: fields.facilities ?? [],
      // A tour is what was recorded, so a tour is what joins the gallery; the
      // single frame it was recognised from only goes in when there is no tour.
      media: [
        ...current.media.map((item) => ({ type: item.type, url: item.url, label: item.label })),
        input.panoramaUrl
          ? { type: '360', url: input.panoramaUrl, label: `${current.name} · 360°` }
          : { type: 'image', url: input.photoUrl, label: `${current.name} · ${t('scanRoom.scanLabel')}` },
      ],
    },
    version,
  );
  if (!result.ok) {
    const state = formStateFromError(result.error, t);
    const first = Object.values(state.fieldErrors ?? {}).flat()[0];
    return { ok: false, message: first ? `${state.message} ${first}` : state.message };
  }
  revalidateContent();
  return { ok: true, id: input.roomId };
}

export type CreateScannedRoomResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * The confirmed draft becomes a room type, through the same `createRoom` the
 * form uses, so it starts hidden until it has rooms, a rate and is put on
 * sale. The page address comes from the name; a taken one gets a counter,
 * the way the desk would have typed it.
 */
export async function createScannedRoomAction(input: {
  name: string;
  description: string;
  areaM2: number;
  floor: number;
  capacity: number;
  bedType: string;
  view: string;
  amenities: string[];
  photoUrl: string;
  /** The recorded 360° tour, when one was taken — it joins the gallery after the cover. */
  panoramaUrl?: string | null;
}): Promise<CreateScannedRoomResult> {
  const t = await getAdminT();
  const hotelSlug = await getSelectedHotelSlug();
  const hotel = await catalogService.getHotel(hotelSlug);
  const taken = new Set((await hotelRepository.listRooms(hotel.id)).map((room) => room.slug));
  const base = kebabSuggestion(input.name) || 'room';
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

  const result = await contentService.createRoom({
    slug,
    name: input.name,
    description: input.description,
    areaM2: input.areaM2,
    floor: input.floor,
    capacity: input.capacity,
    bedType: input.bedType,
    view: input.view,
    amenities: input.amenities,
    facilities: [],
    // The cover's label is what guests see as the name of this view.
    media: [
      { type: 'image', url: input.photoUrl, label: input.name },
      ...(input.panoramaUrl ? [{ type: '360', url: input.panoramaUrl, label: `${input.name} · 360°` }] : []),
    ],
  });
  if (!result.ok) {
    const state = formStateFromError(result.error, t);
    // The draft has no per-field error slots, so the first field's message rides in the toast.
    const first = Object.values(state.fieldErrors ?? {}).flat()[0];
    return { ok: false, message: first ? `${state.message} ${first}` : state.message };
  }
  revalidateContent();
  return { ok: true, id: result.value.id };
}
