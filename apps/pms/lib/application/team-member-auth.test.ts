import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieState = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: cookieState.token }),
    set: (_name: string, value: string) => {
      cookieState.token = value;
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/i18n/admin/server", () => ({ getAdminT: async () => (key: string) => key }));
vi.mock("./container", async () => {
  const { TeamService } = await import("./team-service");
  const { mockRoleStore } = await import("../infrastructure/role-store-mock");
  return {
    teamService: new TeamService(mockRoleStore),
    adminAuthConfig: () => ({ password: "test-password", sessionSecret: "test-session-secret" }),
  };
});

import { createMemberAction } from "@/app/admin/settings/team/actions";
import { getAdminMember, requirePermission, signIn } from "./admin-session";

describe("created member authentication and authorization", () => {
  beforeEach(() => {
    cookieState.token = "";
  });

  it("creates through the authorized action and signs in with the stored email and assigned role", async () => {
    await signIn("elena.markou@asteriacove.example", "test-password");
    const result = await createMemberAction({
      name: "New colleague",
      email: "new-colleague@example.com",
      role: "Front desk",
    });
    expect(result.ok).toBe(true);
    cookieState.token = "";
    expect(await signIn("NEW-COLLEAGUE@example.com", "wrong-password")).toBeNull();
    expect(await signIn("NEW-COLLEAGUE@example.com", "test-password")).toMatchObject({
      memberId: result.member?.id,
    });
    expect(await getAdminMember()).toMatchObject({
      name: "New colleague",
      role: "Front desk",
      status: "active",
    });
    await expect(requirePermission("team.permViewBookings")).resolves.toBeDefined();
    await expect(requirePermission("team.permTeamRoles")).rejects.toThrow(
      "Your role doesn't include this.",
    );
    expect(
      await createMemberAction({
        name: "Not allowed",
        email: "no-access@example.com",
        role: "Owner",
      }),
    ).toMatchObject({ ok: false });
    expect(await signIn("no-access@example.com", "test-password")).toBeNull();
  });

  it("does not create an account without a signed-in administrator", async () => {
    await expect(
      createMemberAction({ name: "No session", email: "no-session@example.com", role: "Owner" }),
    ).rejects.toThrow("Sign in to continue.");
    expect(await signIn("no-session@example.com", "test-password")).toBeNull();
  });
});
