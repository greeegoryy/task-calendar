
FROM python:3.12-slim

# Application working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application
COPY app ./app

# Copy Alembic configuration and migrations
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
