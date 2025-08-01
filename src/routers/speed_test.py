from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from src.backend.database import (get_db, SpeedTestResult as SpeedTestResultDB)
from src.backend.models import SpeedTestPayload, SpeedTestResultGet
from src.utlis.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/speed-test", response_model=SpeedTestResultGet)
def save_speed_test_result(
    payload: SpeedTestPayload, db: Session = Depends(get_db)
):
    try:
        chart_data_dict = [item.model_dump() for item in payload.chart_data]

        db_result = SpeedTestResultDB(
            user_id=payload.user_id,
            taps=payload.taps,
            time=payload.time,
            stream_speed=payload.bpm,
            unstable_rate=payload.unstable_rate,
            chart_data=chart_data_dict
        )
        db.add(db_result)
        db.commit()
        db.refresh(db_result)
        response_data = db_result.__dict__
        response_data['timestamp'] = db_result.timestamp.isoformat()
        return response_data
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving speed test result: {e}")
        raise HTTPException(status_code=500,
                            detail="Could not save speed test result.")


@router.get("/speed-test/{user_id}", response_model=List[SpeedTestResultGet])
def get_speed_test_results_for_user(
    user_id: int, db: Session = Depends(get_db)
):
    try:
        results = (
            db.query(SpeedTestResultDB)
            .filter(SpeedTestResultDB.user_id == user_id)
            .order_by(SpeedTestResultDB.timestamp.desc())
            .all()
        )
        response_list = []
        for res in results:
            res_dict = res.__dict__
            res_dict['timestamp'] = res.timestamp.isoformat()
            response_list.append(res_dict)
        return response_list
    except Exception as e:
        logger.error(f"Error getting speed test results: {e}")
        raise HTTPException(status_code=500,
                            detail="Could not retrieve speed test results.")
