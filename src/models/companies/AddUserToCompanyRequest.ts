export interface AddUserToCompanyRequest {
  email: string;
  role?: 'Admin' | 'Manager' | 'Member';
}
