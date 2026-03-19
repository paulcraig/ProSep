FROM python:3.12-slim

RUN apt-get update && apt-get install --no-install-recommends nodejs curl git \
    libxrender1 libxext6 -y \
    && curl -L https://npmjs.org/install.sh | /bin/bash
WORKDIR /app
COPY requirements.txt .
ENV RUNNING_DEVCONTAINER=true
RUN rm -rf /var/lib/apt/lists/*
