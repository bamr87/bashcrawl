FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x main.sh setup.sh \
    && find entrance -type f \( -name "treasure" -o -name "potion" -o -name "statue" \) -exec chmod +x {} + 2>/dev/null || true

RUN bash setup.sh --quick 2>/dev/null || true

RUN mkdir -p .game_data/sessions

EXPOSE 8080

ENV PYTHONPATH=/app/src/terminal-illness
CMD ["python", "-m", "ti", "--web", "--game-root", "/app"]
