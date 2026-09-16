# Atajos de arranque de blog-api. Los tres repositorios del modulo traen los mismos:
#
#   make check  - comprueba que la maquina esta lista (no toca nada)
#   make setup  - instala y prepara la base de datos (solo la primera vez)
#   make up     - arranca el servicio
#
# Si algo falla, el mensaje dice que falta. No hace falta leer este archivo.

SHELL := /bin/bash
CARPETA := blog-api
REPO := blog-api-ai4devs

.PHONY: ayuda check setup up test contrato hooks

ayuda:
	@echo "make check     comprueba que la maquina esta lista"
	@echo "make setup     instala dependencias, crea el .env y prepara la base de datos"
	@echo "make up        arranca la API en http://localhost:3402"
	@echo "make test      ejecuta las pruebas"
	@echo "make contrato  verifica el contrato contra blog-ai"
	@echo "make hooks     instala el hook que vigila que el contrato viaje en el commit"

check:
	@if [ "$$(basename $$PWD)" != "$(CARPETA)" ]; then \
	  echo "ERROR: esta carpeta se llama '$$(basename $$PWD)' y tiene que llamarse '$(CARPETA)'."; \
	  echo "       Los tres repositorios viven como carpetas hermanas con el nombre corto,"; \
	  echo "       y todo lo demas (las rutas relativas entre ellos) lo da por hecho."; \
	  echo "       Vuelve a clonar poniendo la carpeta destino al final:"; \
	  echo "         git clone git@github.com:<tu-usuario>/$(REPO).git $(CARPETA)"; \
	  exit 1; \
	fi
	@command -v node >/dev/null 2>&1 || { \
	  echo "ERROR: no encuentro 'node'."; \
	  echo "       Instala Node.js 20 o superior (version LTS) desde nodejs.org/en/download."; \
	  exit 1; }
	@node -e 'var v=+process.versions.node.split(".")[0]; if(v<20){console.error("ERROR: tienes Node "+process.versions.node+" y hace falta 20 o superior.");process.exit(1)}'
	@echo "OK  blog-api: carpeta correcta y Node $$(node -v)."

setup: check hooks
	npm ci
	@if [ ! -f .env ]; then cp .env.example .env; echo "OK  .env creado a partir de .env.example."; fi
	node ace generate:key
	@mkdir -p tmp
	node ace migration:run
	node ace db:seed
	@echo ""
	@echo "OK  blog-api listo. Arrancalo con 'make up' (http://localhost:3402)."

up:
	node ace serve

test:
	node ace test

contrato:
	node ace contrato:verificar

# La regla «el contrato viaja en el mismo commit» se ejecuta en git, no en la sesion
# de ninguna herramienta. Los hooks no se clonan, asi que hay que apuntar git a los
# que vienen versionados en .githooks/. Es idempotente: repetirlo no hace dano.
hooks:
	@git config core.hooksPath .githooks
	@echo "OK  hook instalado: .githooks/pre-commit"
	@echo "    Vigila que un cambio de campo en la frontera con blog-ai lleve"
	@echo "    contracts/blog-ai.openapi.json en el mismo commit."
