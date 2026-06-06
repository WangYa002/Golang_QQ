import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import Chat from './pages/Chat';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return isAuthenticated ? <Chat /> : <Login />;
}
