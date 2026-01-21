FROM python:3.12-slim

RUN apt-get update && apt-get install --no-install-recommends nodejs curl git supervisor \
    libxrender1 libxext6 -y \
    && curl -L https://npmjs.org/install.sh | /bin/bash
COPY .devcontainer/supervisord.conf /etc/supervisor/
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt && rm -rf /var/lib/apt/lists/*