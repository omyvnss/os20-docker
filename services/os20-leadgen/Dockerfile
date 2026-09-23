FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
RUN useradd --system --uid 10001 --no-create-home os20 && chown -R os20 /app
USER os20
EXPOSE 8120

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8120"]