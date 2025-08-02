from contextlib import contextmanager
from langchain.tools import tool
from src.backend.database import get_db
from src.backend.database import SpeedTestResult
from src.utlis.logging_config import get_logger
from typing import List, Dict, Any, Optional

logger = get_logger(__name__)


@tool
def get_speed_test_results(user_id: int) -> str:
    """
    Retrieves speed test results for the current user from the database.

    Args:
        user_id (int): the id of the user

    Returns:
        str: Formatted string with speed test results or an error/message.
    """
    if not user_id:
        return "Error: User ID not provided in context."

    with contextmanager(get_db)() as db:
        try:
            results = (
                db.query(SpeedTestResult.stream_speed, SpeedTestResult.unstable_rate, SpeedTestResult.timestamp,
                         SpeedTestResult.taps, SpeedTestResult.time)
                .filter(SpeedTestResult.user_id == user_id)
                .order_by(SpeedTestResult.timestamp.desc())
                # .limit(10)  # Ограничиваем до 10 результатов для оптимизации
                .all()
            )
            if not results:
                return "No speed test results found for your account."

            response_list = []
            for res in results:
                res_dict = {
                    "stream_speed": res[0],
                    "unstable_rate": res[1],
                    "timestamp": res[2].isoformat(),
                    "taps": res[3],
                    "time": res[4]
                }
                response_list.append(res_dict)

            # Форматируем результат в читаемую строку
            formatted = "Here are your speed test results:\n"
            for i, res in enumerate(response_list, 1):
                formatted += (
                    f"{i}. Timestamp: {res['timestamp']}, "
                    f"Stream Speed: {res['stream_speed']} BPM, "
                    f"Unstable Rate: {res['unstable_rate']}, "
                    f"Taps: {res['taps']}, "
                    f"Time: {res['time']} sec\n"
                )
            logger.info(
                f"Successfully retrieved {len(response_list)} speed test results for user_id={user_id}")
            return formatted
        except Exception as e:
            logger.error(
                f"Error retrieving speed test results for user_id={user_id}: {e}")
            return "Error: Could not retrieve speed test results."


if __name__ == "__main__":
    def _get_results(user_id: int) -> List[Dict[str, Any]]:
        with contextmanager(get_db)() as db:
            try:
                results = (
                    db.query(SpeedTestResult.stream_speed, SpeedTestResult.unstable_rate, SpeedTestResult.timestamp,
                             SpeedTestResult.taps, SpeedTestResult.time)
                    .filter(SpeedTestResult.user_id == user_id)
                    .order_by(SpeedTestResult.timestamp.desc())
                    .all()
                )
                if not results:
                    return {
                        "message": "No speed test results found for your account."}
                response_list = []
                for res in results:
                    res_dict = {
                        "stream_speed": res[0],  # stream_speed
                        "unstable_rate": res[1],  # unstable_rate
                        "timestamp": res[2].isoformat(),  # timestamp
                        "taps": res[3],  # taps
                        "time": res[4]  # time
                    }
                    response_list.append(res_dict)
                return response_list
            except Exception as e:
                logger.error(f"Error retrieving speed test results: {e}")
                return {"error": "Could not retrieve speed test results."}
    ky = _get_results(1)
    print(ky)
