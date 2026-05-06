FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN bash download_ephemeris.sh

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
