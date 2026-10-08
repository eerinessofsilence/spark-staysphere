"use client";

import * as React from "react";
import { UserPlus } from "@phosphor-icons/react/dist/ssr";
import { createMemberAction } from "@/app/admin/settings/team/actions";
import { Modal } from "@/components/site/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamRoleDefinition } from "@/lib/domain/schemas";
import { useAdminT } from "@/lib/i18n/admin/context";
import { fieldClass, pill } from "@/lib/ui";
import { roleLabel, type TeamMember } from "./team-data";

export function CreateUser({
  roles,
  hotels,
  onCreated,
}: {
  roles: TeamRoleDefinition[];
  hotels: Array<{ id: string; name: string }>;
  onCreated: (member: TeamMember, message: string) => void;
}) {
  const t = useAdminT();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("Front desk");
  const [hotelIds, setHotelIds] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const [error, setError] = React.useState("");
  const close = React.useCallback(() => {
    if (!lock.current) setOpen(false);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await createMemberAction({ name, email, role, hotelIds });
      if (!result.ok || !result.member) {
        setError(result.message);
        return;
      }
      onCreated(result.member, result.message);
      setOpen(false);
      setName("");
      setEmail("");
      setRole("Front desk");
      setHotelIds([]);
    } catch {
      setError(t("team.userFailed"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={pill("primary")}
      >
        <UserPlus weight="fill" className="size-4" aria-hidden="true" />
        {t("team.createUser")}
      </button>
      <Modal open={open} onClose={close} title={t("team.createUser")}>
        <form onSubmit={submit} className="grid gap-4" aria-busy={busy}>
          <p className="text-sm text-muted-foreground">{t("team.createUserBody")}</p>
          <label className="grid gap-1.5 text-sm">
            {t("team.userName")}
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              autoComplete="name"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            {t("team.email")}
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              autoComplete="email"
              className={fieldClass}
            />
          </label>
          <div>
            <label htmlFor="create-user-role" className="mb-1.5 block text-sm">
              {t("team.role")}
            </label>
            <Select
              disabled={busy}
              value={role}
              onValueChange={(next) => {
                if (next) setRole(next);
              }}
              items={roles.map((option) => ({
                value: option.id,
                label: roleLabel(option.id, roles, t),
              }))}
            >
              <SelectTrigger id="create-user-role" className={fieldClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {roleLabel(option.id, roles, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'Hotelier' ? <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Доступ к отелям</legend>
            {hotels.map((hotel) => <label key={hotel.id} className="flex min-h-10 items-center gap-3 text-sm">
              <input type="checkbox" checked={hotelIds.includes(hotel.id)} disabled={busy} onChange={(event) => setHotelIds((current) => event.target.checked ? [...current, hotel.id] : current.filter((id) => id !== hotel.id))} />
              {hotel.name}
            </label>)}
          </fieldset> : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={pill("primary")}>
              {t(busy ? "team.userCreating" : "team.createUser")}
            </button>
            <button type="button" disabled={busy} onClick={close} className={pill("secondary")}>
              {t("team.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
