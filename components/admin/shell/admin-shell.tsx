import type { ReactNode } from 'react';
import {
  AdminBrand,
  AdminMobileMenu,
  AdminNav,
  DemoAccount,
  PropertyCard,
  ViewSiteLink,
} from './admin-nav';
import { UnsavedChangesGuard } from './unsaved-changes';

interface AdminShellProps {
  hotelName: string;
  location: string;
  children: ReactNode;
}

export function AdminShell({ hotelName, location, children }: AdminShellProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside aria-label="Hotel admin" className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="flex h-full flex-col rounded-[28px] bg-card p-3 shadow-soft">
          <AdminBrand />
          <div className="mt-3">
            <PropertyCard hotelName={hotelName} location={location} />
          </div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <AdminNav />
          </div>
          <div className="mt-3 grid gap-1 border-t border-border pt-3">
            <ViewSiteLink />
            <DemoAccount />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-40 p-3 lg:hidden">
          <div className="flex h-14 items-center gap-2 rounded-full bg-card pr-2 pl-3 shadow-soft">
            <AdminBrand />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{hotelName}</span>
            <AdminMobileMenu hotelName={hotelName} location={location} />
          </div>
        </div>
        {children}
      </div>
      <UnsavedChangesGuard />
    </div>
  );
}
