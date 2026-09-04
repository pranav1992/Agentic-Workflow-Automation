FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        libsndfile1 \
        libportaudio2 \
        libasound2-dev \
        libffi-dev \
        libssl-dev \
        libpq-dev \
        libpq5 \
        pkg-config \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
