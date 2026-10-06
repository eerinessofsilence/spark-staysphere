import { z } from "zod";
import { revalidatePath } from "next/cache";
import { availableHotels, catalogService, guestImportService } from "@/lib/application/container";
import {
  AdminAuthError,
  AdminPermissionError,
  requirePermission,
} from "@/lib/application/admin-session";
import { GUEST_IMPORT_BATCH_SIZE } from "@/lib/domain/guest-import";

const rowSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
});
const bodySchema = z.object({
  hotelSlug: z.string(),
  rows: z
    .array(z.object({ rowNumber: z.number().int().positive(), guest: rowSchema }))
    .min(1)
    .max(GUEST_IMPORT_BATCH_SIZE),
});

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requirePermission("team.permViewBookings");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success || !availableHotels.some((hotel) => hotel.slug === body.data.hotelSlug)) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    // The selected-property cookie is scoped to /admin, so the API receives an explicit property.
    const hotel = await catalogService.getHotel(body.data.hotelSlug);
    const results = await guestImportService.import(hotel.id, body.data.rows);
    revalidatePath("/admin/guests");
    return Response.json({ results });
  } catch (error) {
    if (error instanceof AdminAuthError)
      return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof AdminPermissionError)
      return Response.json({ error: "forbidden" }, { status: 403 });
    console.error("Guest import request failed", { route: "/api/admin/guests/import", code: "internal_error", requestId }, error);
    return Response.json({ error: "failed", requestId }, { status: 500 });
  }
}
