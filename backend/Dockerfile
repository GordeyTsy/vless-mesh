FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY backend /app/backend

WORKDIR /app/backend
RUN python manage.py collectstatic --noinput

EXPOSE 8001

CMD ["gunicorn", "--workers=3", "--bind=0.0.0.0:8001", "meshbackend.wsgi:application"]
