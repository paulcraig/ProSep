FROM python:3.12-slim

RUN apt-get update && apt-get install --no-install-recommends nodejs curl git -y && curl -L https://npmjs.org/install.sh | /bin/bash
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
WORKDIR workspaces/RITSimulationofProteinSeparations/frontend/jbio-web-app
COPY frontend/jbio-web-app/*.json .
RUN npm install