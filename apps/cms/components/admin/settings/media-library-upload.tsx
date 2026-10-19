"use client";

import { useRouter } from "next/navigation";
import { PhotoUpload } from "@/components/admin/content/photo-upload";

export function MediaLibraryUpload() {
  const router = useRouter();
  return (
    <div className="mt-6">
      <PhotoUpload count={0} publishOnSave={false} onUploaded={() => router.refresh()} />
    </div>
  );
}
