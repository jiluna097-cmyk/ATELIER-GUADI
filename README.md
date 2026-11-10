# Atelier Guadi — cómo subirla a Netlify

## Opción rápida (arrastrar y soltar)
1. Entrá a https://app.netlify.com y creá una cuenta (gratis).
2. Andá a **Add new site → Deploy manually**.
3. Arrastrá **la carpeta completa** (descomprimida) a la página.
4. Listo: Netlify te da un link tipo `https://algo.netlify.app`. Desde *Site configuration → Change site name* podés ponerle `atelier-guadi`.

> Con arrastrar y soltar la app funciona completa **menos la IA** (Idear con Claude, recorte de fotos, dibujos y paso a paso generados). Para activarla, seguí la opción con IA.

## Opción con IA (Claude)
La IA necesita una clave de API de Anthropic, que se guarda en Netlify y nunca queda a la vista en la app.

1. Creá la clave en https://console.anthropic.com → **API Keys** (requiere cargar crédito; se cobra por uso).
2. Subí la carpeta a un repositorio de GitHub y en Netlify elegí **Add new site → Import an existing project** (así Netlify instala la función de `netlify/functions`). También funciona con la CLI: `npm i -g netlify-cli` y después `netlify deploy --prod` desde esta carpeta.
3. En Netlify: **Site configuration → Environment variables → Add a variable**
   - `ANTHROPIC_API_KEY` = tu clave
   - (opcional) `ALLOWED_ORIGIN` = tu dominio, por ejemplo `https://atelier-guadi.netlify.app`
   - (opcional) `CLAUDE_MODEL` / `CLAUDE_MODEL_QUICK` para cambiar de modelo
4. Volvé a publicar (**Deploys → Trigger deploy**).

Cuidado: cualquiera que tenga el link puede usar la IA y eso consume tu crédito. Compartí el link solo con Guadi y poné un límite de gasto en la consola de Anthropic.

## Qué cambia respecto de la versión en claude.ai
- **Guardado:** "Mi lista", las fotos y los diseños se guardan en el navegador del celular (hasta 12 fotos y 12 diseños). Si se borran los datos del navegador, se pierden.
- **Cámara en vivo (Calcar):** en Netlify suele funcionar, porque la página no está dentro de otra.
- **Instalar como app:** en el celular, abrí el link y elegí *Agregar a pantalla de inicio*.

## Archivos
- `index.html` — toda la app
- `claude-shim.js` — conecta la app con la función de IA
- `netlify/functions/claude.mjs` — función que llama a la API de Claude
- `netlify.toml` — configuración de Netlify
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png` — ícono para el celular


## Fotos reales (fotos.mjs)
En la ficha de cada idea, la app busca fotos reales en la web con la herramienta de búsqueda de Claude y muestra la foto principal de cada página, con link a la fuente.
- Usa la misma ANTHROPIC_API_KEY. Cada búsqueda web se cobra aparte (alrededor de USD 10 cada 1000 búsquedas) más los tokens; la app hace 1 o 2 búsquedas por pieza y guarda el resultado en el teléfono para no repetir.
- Si la consola de Anthropic tiene la búsqueda web desactivada, activala en Settings → Privacy (o la función devuelve error y la app muestra los links a Google y Pinterest).
- Solo funciona en Netlify: dentro de claude.ai las páginas no pueden mostrar imágenes de otros sitios.
