# Usa uma imagem base do Node.js
FROM node:22-slim

# Evita perguntas interativas durante a instalação
ENV DEBIAN_FRONTEND=noninteractive

# Instala Python 3, pip, venv, MuseScore 3, Xvfb para modo headless, Java 17, Tesseract OCR e bibliotecas necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    musescore3 \
    xvfb \
    xauth \
    openjdk-17-jre-headless \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    libgtk-3-0 \
    wget \
    ca-certificates \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Baixa e instala a release oficial do Audiveris para /opt/audiveris
RUN mkdir -p /tmp/audiveris_install && \
    wget -q https://github.com/Audiveris/audiveris/releases/download/5.11.0/Audiveris-5.11.0-ubuntu22.04-x86_64.deb -O /tmp/audiveris_install/audiveris.deb && \
    mkdir -p /usr/share/desktop-directories && \
    (dpkg -i /tmp/audiveris_install/audiveris.deb || true) && \
    chmod +x /opt/audiveris/bin/Audiveris && \
    mkdir -p /root/.config/AudiverisLtd/audiveris/tessdata && \
    ln -sf /usr/share/tesseract-ocr/5/tessdata/*.traineddata /root/.config/AudiverisLtd/audiveris/tessdata/ 2>/dev/null || true && \
    rm -rf /tmp/audiveris_install

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
