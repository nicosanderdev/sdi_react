import { useEffect } from "react";
import authService from "../../services/AuthService";
import { useNavigate } from "react-router-dom";

export function LogoutPage() {

  const navigate = useNavigate();

  useEffect(() => {
    const logout = async () => {
      try {
        await authService.logout();
      } catch (error) {
        console.error("Logout failed:", error);
      } finally {
        navigate('/login');
      }
    };
    logout();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold text-gray-800">Logging out...</h1>
    </div>
  );
}