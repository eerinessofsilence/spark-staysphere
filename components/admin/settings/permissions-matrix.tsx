import { CheckIcon, MinusIcon } from '@heroicons/react/24/outline';
import { permissions, teamRoles } from './team-data';

export function PermissionsMatrix() {
  return (
    <section aria-labelledby="roles-heading" className="mt-12">
      <h2 id="roles-heading" className="text-display text-3xl">
        Roles & permissions
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What each role can change. Enforced once sign-in for the admin ships.
      </p>
      <div className="relative mt-5 overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-3 font-normal text-muted-foreground">
                Permission
              </th>
              {teamRoles.map((role) => (
                <th key={role} scope="col" className="px-4 py-3 text-center font-normal text-muted-foreground">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {permission.label}
                </th>
                {teamRoles.map((role) => {
                  const allowed = permission.allowed.includes(role);
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      {allowed ? (
                        <CheckIcon className="mx-auto size-5 text-success" aria-hidden="true" />
                      ) : (
                        <MinusIcon className="mx-auto size-5 text-muted-foreground/60" aria-hidden="true" />
                      )}
                      <span className="sr-only">{allowed ? 'Allowed' : 'Not allowed'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
