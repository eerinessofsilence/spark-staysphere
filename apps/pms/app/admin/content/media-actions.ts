"use server";

import { contentService } from "@/lib/application/container";
import { MAX_PHOTO_BYTES } from "@/lib/domain/photo-upload";
import { getAdminT } from "@/lib/i18n/admin/server";
import { requirePermission } from "@/lib/application/admin-session";

export async function uploadPhotoAction(formData: FormData) {
  await requirePermission("team.permEditContent");
  const t = await getAdminT();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false as const, error: t("upload.invalid") };
  }
  const result = await contentService.uploadPhoto(file.name, file.type, await file.arrayBuffer());
  if (!result.ok) return { ok: false as const, error: t("upload.failed") };
  return { ok: true as const, asset: result.value };
}
