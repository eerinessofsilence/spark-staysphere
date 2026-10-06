/** Accounts use the existing demo-admin authentication, not an external identity provider. */
export interface StoredTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}
