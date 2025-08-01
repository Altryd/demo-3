import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGoogleAuth } from "../../contexts/GoogleAuthContext";

const Callback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useGoogleAuth();

  useEffect(() => {
    const status = searchParams.get("status");
    const userId = searchParams.get("user_id");
    const error = searchParams.get("error");

    const handleLoginAndRedirect = async (id: string) => {
      try {
        // ЖДЕМ, пока промис из функции login не выполнится
        // Это гарантирует, что данные пользователя загружены и состояние обновлено
        await login(parseInt(id, 10));

        // И ТОЛЬКО ПОСЛЕ ЭТОГО переходим на главную страницу
        navigate("/");
      } catch (e) {
        console.error("Failed during login process:", e);
        alert("Произошла ошибка при получении данных пользователя.");
        navigate("/");
      }
    };

    if (status === "success" && userId) {
      handleLoginAndRedirect(userId);
    } else if (status === "error" && error) {
      alert(`Ошибка авторизации: ${error}`);
      navigate("/");
    } else {
      alert("Неизвестная ошибка при авторизации");
      navigate("/");
    }
    // Мы добавляем `login` в массив зависимостей, так как используем его в эффекте
  }, [searchParams, navigate, login]);

  return (
    <div>
      <h2>Обработка авторизации...</h2>
    </div>
  );
};

export default Callback;
