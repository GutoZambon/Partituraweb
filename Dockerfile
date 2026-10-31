# Usa uma imagem base do Node.js
FROM node:22-slim

# Evita perguntas interativas durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instala Python 3, pip, venv, MuseScore 3, Xvfb para modo headless e fontes musicais
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    musescore3 \
    xvfb \
    xauth \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Cria um ambiente virtual Python e instala o music21
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir music21

# Configura o diretório de trabalho
WORKDIR /app

# Copia os arquivos de dependência do Node
COPY package*.json ./
RUN npm install

# Copia o resto do código do projeto
COPY . .

# Compila o frontend (Vite)
RUN npm run build

# Expõe a porta
EXPOSE 3000

# Inicia o servidor
CMD ["npm", "start"]
