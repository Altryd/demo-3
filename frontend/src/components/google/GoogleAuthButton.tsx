import React, { useState, useContext } from 'react';
import axios from 'axios';
// import { toast } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';
// import { AuthContext } from '../context/AuthContext'; // Предполагаемый контекст для JWT

const API_BASE = "http://localhost:8000";

interface GoogleAuthProps {
  currentUserId: number;
}

const GoogleAuthButton: React.FC<GoogleAuthProps> = ({
  currentUserId,
}) => {
  const [loading, setLoading] = useState(false);
  // const { userId, token } = useContext(AuthContext); // Получаем userId и JWT из контекста
  // const userId = 1;

  const handleGoogleAuth = async () => {
    if (!currentUserId) {
      alert('Пожалуйста, войдите в систему');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/auth/google?user_id=${currentUserId}`, {
        });
      const { authorization_url } = response.data;
      window.location.href = authorization_url; // Перенаправляем на Google
    } catch (error) {
      setLoading(false);
      const message = error.response?.data?.detail || 'Ошибка авторизации';
      alert(message);
    }
  };

  return (
    <div>
      <button onClick={handleGoogleAuth} disabled={loading}>
        {loading ? 'Загрузка...' : 'Подключить Google Calendar'}
      </button>
    </div>
  );
};

export default GoogleAuthButton;