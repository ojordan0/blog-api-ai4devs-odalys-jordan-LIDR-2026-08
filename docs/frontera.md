# Frontera

1. Implementar la regla utilizando como disparador un hook de pre-commit: .githooks/pre-commit que invoca git antes de crear cada commit. La comprobacion esta en scripts/contrato_en_el_commit.mjs. Pero por sí solo no se ejecuta nunca; es un script que alguien tiene que llamar.
Lo que conecta una cosa con la otra es una línea de configuración en el Makefile:
git config core.hooksPath .githooks   # la ejecuta el target `hooks` del Makefile

2. El commit se pudo crear, confirmando que en blog-ai la regla no está en vigor, y git commit no dijo nada. Salió con 0, sin aviso, sin ruido. La deriva solo aparece si vas a buscarla: El contrato versionado NO coincide con el codigo (contrato/openapi.json). Pero cuando la regla dejó de estar en vigor fue en el instante en que el punto de ejecución cambió de repositorio, porque el mecanismo estaba atado a la configuración local de un .git concreto. El commit materializado fue solo la prueba. Lo comprobe ademas corriendo: git config --get core.hooksPath, y no devolvió nada. No hay nada que ejecutar.