# Casa de Cambio Juniors

Sistema temporal para una casa de cambio de divisas físicas. Reemplaza el flujo manual de cotización del operador: se configura la tasa de un tipo de cambio, se ingresa el monto que el cliente quiere cambiar, y el resultado se calcula y muestra en vivo. Confirmar una operación queda registrado en un historial local.

El sistema está pensado para un solo equipo con dos ventanas abiertas al mismo tiempo, sin backend ni base de datos:

- La **Pantalla Principal** es la que usa el operador. Ahí se elige el tipo de cambio (CLP↔PEN, USD↔PEN), se configura la tasa y el operador matemático (multiplicar o dividir), y se confirma cada operación manteniendo Enter presionado dos segundos.
- La **Pantalla Secundaria** se abre como popup y es la que ve el cliente desde el otro lado del mostrador. Mientras el operador está tipeando muestra el detalle de la operación en vivo; en los momentos de inactividad muestra publicidad, y siempre tiene visible el precio del día para CLP→PEN en una esquina.

Ambas pantallas se sincronizan en tiempo real usando `BroadcastChannel`, la API nativa del navegador para comunicar pestañas/ventanas del mismo origen. No hay servidor de por medio: el historial de cambios confirmados se guarda en el `localStorage` del navegador (con la opción de vincular además un archivo local en navegadores Chromium, vía File System Access API).

Está construido en Angular 20 con componentes standalone y signals para todo el manejo de estado — no se usa RxJS salvo donde Angular lo requiere internamente.

Es un proyecto explícitamente temporal (de ahí el nombre de la carpeta original, `fexchange_temp`): resuelve una necesidad puntual mientras no exista un sistema definitivo, por lo que se priorizó simplicidad y que funcione sin infraestructura por encima de dejarlo preparado para crecer a futuro.

El proyecto se despliega en GitHub Pages, en `https://kichitano.github.io/fexchange-juniors-temp/`, de forma automática con cada cambio en la rama principal.

Algo para tener en cuenta: como no hay backend, el historial de cambios vive en el navegador donde se usa la app. Si se abre desde otra computadora u otro navegador, no va a compartir ese historial — es el comportamiento esperado, no una falla.
