export interface CompanyUser {
  /** CompanyMembers.Id (membership row) */
  id: string;
  /** Members.Id */
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  joinDate: string;
  avatarUrl?: string;
}

