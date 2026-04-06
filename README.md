# 📚 Guía Rápida de Clasp (Google Apps Script)

Esta pequeña guía sirve como recordatorio para trabajar con proyectos de Google Apps Script de forma local utilizando la herramienta `clasp`.

## ⚙️ 1. Autenticación (Cuando la sesión caduca)
Para poder comunicarte con los servidores de Google, siempre debes estar logueado asociado a tu cuenta. Si tras unos meses vuelves y te da error de autenticación, ejecuta el siguiente comando:
```bash
clasp login
```
Esto abrirá tu navegador para renovar los permisos con tu cuenta de Google.

## 📥 2. Iniciar un Proyecto
Siempre es recomendable crear una carpeta por cada proyecto antes de inicializarlo para mantenerlo todo ordenado en vez de hacerlo en el directorio raíz.

### Crear un nuevo proyecto desde cero
```bash
mkdir mi-nuevo-proyecto && cd mi-nuevo-proyecto
clasp create --title "Nombre del Proyecto en Google"
```

### Clonar un proyecto que ya existe en la nube
Para proyectos que ya creaste en el navegador, necesitarás su `ID de Proyecto`. Se encuentra en la URL del editor web de Apps Script (es la cadena larga de texto y números que aparece entre `/d/` y `/edit`).
```bash
mkdir mi-proyecto && cd mi-proyecto
clasp clone <PEGAR_ID_AQUI>
```

## 🔄 3. Flujo de Trabajo Diario

Dado que Apps Script usa servicios nativos de Google y no se puede ejecutar "estrictamente" en tu ordenador, el flujo común de trabajo se basa en el ciclo de **editar, sincronizar y probar en la web**.

- **Subir tus cambios (Local → Nube):**
  Ejecuta esto para mandar los archivos locales a Google:
  ```bash
  clasp push
  ```

- **Modo Observador Automático 🔥 (Muy recomendado):**
  Para ahorrarte tener que ejecutar comandos en todo momento, puedes dejar este en la base de la terminal. Subirá automáticamente a la nube cada archivo justo cuando pulses en guardar (`Ctrl + S` / `Cmd + S`):
  ```bash
  clasp push -w
  ```

- **Descargar cambios (Nube → Local):**
  Si por algún motivo modificaste el proyecto en la interfaz web de Google, tienes que forzar descargarlo a tu ordenador antes de seguir desarrollando localmente para evitar sobrescribir cosas sin querer:
  ```bash
  clasp pull
  ```

## 🛠️ 4. Comandos extra muy útiles

- **Abrir el proyecto:** Abre automáticamente tu navegador directamente en este proyecto para probar la ejecución de la función o configurar su "Activador" temporal.
  ```bash
  clasp open
  ```
- **Ver los registros (Logs):** Muestra los `Logger.log()` o `console.log()` resultantes de las ejecuciones que ocurren en la nube, pero te las imprime directamente en tu consola local.
  ```bash
  clasp logs
  ```
