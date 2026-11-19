# Panel Sección 80 · Configuración (una sola vez)

El panel sube los archivos al repositorio privado **Seccion80-sistema**. Ahí GitHub Actions los revisa, y si todo cuadra los publica en la app.
Se necesitan **dos llaves** de GitHub. Las dos se hacen en: GitHub › foto de perfil › **Settings** › **Developer settings** › **Personal access tokens** › **Fine-grained tokens** › **Generate new token**.

## 1. Llave para publicar (la usa GitHub, no tú)

| Campo | Valor |
|---|---|
| Token name | `Seccion80 publicar` |
| Expiration | 1 año (366 días) |
| Repository access | **Only select repositories** › `molinishky/Seccion80` |
| Permissions › Repository › Contents | **Read and write** |

Copia la llave (`github_pat_…`) y guárdala como secreto:

1. Abre `github.com/molinishky/Seccion80-sistema` › **Settings** › **Secrets and variables** › **Actions**.
2. **New repository secret** › Name: `PUBLICO_TOKEN` › Secret: pega la llave › **Add secret**.

## 2. Llave del panel (la pegas en tu teléfono o en el .exe)

| Campo | Valor |
|---|---|
| Token name | `Seccion80 panel` |
| Expiration | 1 año (366 días) |
| Repository access | **Only select repositories** › `molinishky/Seccion80-sistema` |
| Permissions › Repository › Contents | **Read and write** |
| Permissions › Repository › Actions | **Read-only** |

Abre `https://molinishky.github.io/Seccion80/panel/` (o el **Panel-Seccion80.exe**), entra con tu **IBM y el PIN de la app**, y la primera vez en cada equipo pega la llave. Queda guardada solo en ese equipo, cifrada con tu PIN: las siguientes veces solo pides IBM y PIN.

## Uso

- Inicio › toca el tipo de archivo › elige el PDF o Excel › revisa «Lo que encontré» › **Subir y publicar**.
- Tarda 2 o 3 minutos. Si algo no cuadra **no se publica nada**, el panel dice el motivo y GitHub te manda un correo.
- La lista de raya se lee en el equipo: solo se sube el mes y día de cumpleaños (sin CURP, RFC ni IMSS).
- Para Windows: Releases › **Panel Sección 80 para Windows** › `Panel-Seccion80.exe`. Si sale «Windows protegió su PC»: **Más información** › **Ejecutar de todas formas**.

## Si una llave vence o se pierde el teléfono

Bórrala en Fine-grained tokens (deja de servir al instante) y crea otra igual. Para la de publicar, actualiza el secreto `PUBLICO_TOKEN`.
