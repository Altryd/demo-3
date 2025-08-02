#!/bin/bash

cd src/backend || { echo "ERROR: Failed to change to src/backend directory."; exit 1; }

docker-compose --env-file ../../.env up -d
# $? - это код выхода предыдущей инструкции
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start Docker Compose."
    exit 1
fi

cd ../.. || { echo "ERROR: Failed to return to project root directory."; exit 1; }

if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python is not found. Ensure Python 3.11 is installed and added to PATH."
    exit 1
fi

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create virtual environment."
        exit 1
    }
fi

source .venv/bin/activate
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to activate virtual environment."
    exit 1
fi

python -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install requirements."
    exit 1
fi

python -m src.server
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start the server."
    exit 1
fi