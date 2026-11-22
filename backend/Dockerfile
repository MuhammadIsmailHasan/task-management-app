FROM python:3.15-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FLASK_APP=app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --uid 1000 --create-home app
USER app
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
CMD ["gunicorn", "--workers", "3", "--bind", "127.0.0.1:5001", "app:create_app()"]
