# Hotel Chibchacum — Instalación

Sistema de gestión hotelera (PMS) para operar en la red local del hotel, sin Internet, y migrable a la nube.

---

## 0. Cómo está organizado el proyecto

```
/                      Frontend React + Vite + Tailwind
  src/domain/          Tipos y reglas de cálculo del negocio
  src/data/            Capa de datos (puerto + 2 adaptadores)
  src/paginas/         Módulos: panel, habitaciones, huéspedes, check-in/out, historial, reportes, usuarios
  src/components/      Interfaz compartida (menú lateral, tablas, modales)
/backend/              API REST Laravel 12 + MySQL
```

El frontend **nunca** habla con la base de datos directamente: usa el contrato
`src/data/repositorio.ts`. Hay dos implementaciones:

| Modo | Cuándo | Cómo se activa |
|---|---|---|
| **Autónomo** | Un solo equipo de recepción, sin servidor | No definir `VITE_API_URL` |
| **Red local / nube** | Varios equipos comparten datos | Definir `VITE_API_URL` apuntando a Laravel |

Cambiar de modo no requiere tocar una sola línea de la interfaz.

---

## 1. Modo autónomo (arranque inmediato, un solo equipo)

1. Instalar [Node.js 20+](https://nodejs.org).
2. En la carpeta del proyecto:
   ```bat
   npm install
   npm run build
   npm run preview -- --host 0.0.0.0 --port 5173
   ```
3. Abrir `http://localhost:5173`.
4. Ingresar con `admin@chibchacum.co` / `Chibchacum2026*` y **cambiar la contraseña** en *Usuarios*.

Los datos quedan en el navegador de ese equipo. Para operar con varios computadores, siga la sección 2.

---

## 2. Instalación en Windows con XAMPP (red local del hotel)

### 2.1 Instalar XAMPP

1. Descargar XAMPP con **PHP 8.2 o superior** desde <https://www.apachefriends.org>.
2. Instalar en `C:\xampp`.
3. Abrir **XAMPP Control Panel** → *Start* en **Apache** y **MySQL**.
4. Marcar Apache y MySQL como servicios (casillas a la izquierda) para que arranquen solos al encender el equipo.

### 2.2 Habilitar extensiones de PHP

Editar `C:\xampp\php\php.ini` y verificar que estas líneas **no** tengan `;` al inicio:

```ini
extension=pdo_mysql
extension=mbstring
extension=openssl
extension=fileinfo
extension=curl
extension=zip
```

Reiniciar Apache desde el panel.

### 2.3 Crear la base de datos

1. Abrir <http://localhost/phpmyadmin>.
2. Pestaña **Bases de datos** → nombre `chibchacum_pms` → cotejamiento `utf8mb4_unicode_ci` → **Crear**.
3. Pestaña **Cuentas de usuario** → *Agregar cuenta*:
   - Nombre: `chibchacum`
   - Servidor: `localhost`
   - Contraseña: una clave fuerte (anótela)
   - Marcar *Otorgar todos los privilegios a la base `chibchacum_pms`*.

> Deje `root` sin uso para la aplicación y asígnele contraseña desde phpMyAdmin.

### 2.4 Instalar Composer y el backend

1. Instalar [Composer](https://getcomposer.org/Composer-Setup.exe) apuntando a `C:\xampp\php\php.exe`.
2. Copiar la carpeta `backend` del proyecto a `C:\xampp\htdocs\chibchacum-api`.
3. Abrir **CMD** y ejecutar:

```bat
cd C:\xampp\htdocs\chibchacum-api
composer install --optimize-autoloader --no-dev
copy .env.example .env
php artisan key:generate
```

4. Editar `.env` con el Bloc de notas y ajustar:

```ini
APP_URL=http://192.168.1.10
DB_DATABASE=chibchacum_pms
DB_USERNAME=chibchacum
DB_PASSWORD=la_clave_que_anoto
FRONTEND_URL=http://192.168.1.10
```

5. Crear las tablas y el usuario administrador:

```bat
php artisan migrate --force
php artisan db:seed --force
php artisan config:cache
php artisan route:cache
```

### 2.5 Publicar la API en Apache

Editar `C:\xampp\apache\conf\extra\httpd-vhosts.conf` y agregar al final:

```apache
<VirtualHost *:80>
    DocumentRoot "C:/xampp/htdocs/chibchacum-api/public"
    ServerName chibchacum.local

    <Directory "C:/xampp/htdocs/chibchacum-api/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Verificar que `mod_rewrite` esté activo en `C:\xampp\apache\conf\httpd.conf`
(línea `LoadModule rewrite_module modules/mod_rewrite.so` sin `#`) y reiniciar Apache.

Probar en el navegador: `http://localhost/api/panel` debe responder
`{"message":"Unauthenticated."}` — eso confirma que la API está viva y protegida.

### 2.6 Compilar y publicar el frontend

En el equipo de desarrollo (o en el mismo servidor con Node instalado):

1. Crear el archivo `.env` en la raíz del proyecto React:

```ini
VITE_API_URL=http://192.168.1.10/api
```

2. Compilar y copiar:

```bat
npm install
npm run build
xcopy /E /I /Y dist C:\xampp\htdocs\chibchacum
```

3. Crear `C:\xampp\htdocs\chibchacum\.htaccess` con:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /chibchacum/
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /chibchacum/index.html [L]
</IfModule>
```

El sistema queda en `http://192.168.1.10/chibchacum`.

---

## 3. Configurar la red local del hotel

### 3.1 IP fija en el servidor

1. *Panel de control → Redes → Cambiar configuración del adaptador*.
2. Clic derecho en la conexión → *Propiedades* → **Protocolo de Internet versión 4 (TCP/IPv4)**.
3. Asignar, por ejemplo:
   - Dirección IP: `192.168.1.10`
   - Máscara: `255.255.255.0`
   - Puerta de enlace: la IP del router (`192.168.1.1`)
   - DNS: `192.168.1.1`

### 3.2 Abrir el puerto 80 en el Firewall de Windows

En **CMD como administrador**:

```bat
netsh advfirewall firewall add rule name="Chibchacum PMS" dir=in action=allow protocol=TCP localport=80
```

### 3.3 Acceso desde recepción y administración

Desde cualquier computador o tablet conectado a la misma red Wi-Fi/cableada:

```
http://192.168.1.10/chibchacum
```

Recomendación: en cada equipo, crear un acceso directo del navegador a esa URL.

### 3.4 Copia de seguridad diaria

Crear `C:\xampp\backup-chibchacum.bat`:

```bat
@echo off
set FECHA=%date:~-4%-%date:~3,2%-%date:~0,2%
"C:\xampp\mysql\bin\mysqldump.exe" -u chibchacum -pLA_CLAVE chibchacum_pms > "D:\Respaldos\chibchacum_%FECHA%.sql"
```

Programarlo en el **Programador de tareas de Windows** para las 11:00 p. m. y copiar
`D:\Respaldos` a una USB o disco externo cada semana.

---

## 4. Migración a la nube (más adelante)

No hay cambios de código, solo de configuración:

1. Contratar un servidor con PHP 8.2 + MySQL 8 (o un servicio administrado).
2. Subir la carpeta `backend`, ejecutar `composer install` y `php artisan migrate --force`.
3. Ajustar `.env` del backend: `APP_URL`, credenciales de base de datos y `FRONTEND_URL`.
4. En el frontend, cambiar `VITE_API_URL=https://api.suhotel.com/api`, recompilar y publicar.
5. Instalar certificado HTTPS y poner `APP_ENV=production`, `APP_DEBUG=false`.

Restaurar los datos de la operación local:

```bash
mysql -u usuario -p base_nube < chibchacum_2026-08-02.sql
```

---

## 5. Seguridad implementada

- **Contraseñas cifradas** con bcrypt (`cast 'hashed'` en el modelo `User`); nunca se almacenan ni se devuelven en texto plano.
- **Autenticación por token** Laravel Sanctum; el token se revoca al cerrar sesión.
- **Roles**: el middleware `rol:administrador` protege reportes y gestión de usuarios en el servidor, no solo en la interfaz.
- **Protección contra inyección SQL**: todas las consultas usan Eloquent y Query Builder, que envían los valores como *bindings* preparados. No hay concatenación de SQL.
- **Validación** en `FormRequest` por cada operación, con mensajes en español.
- **Límite de intentos** (`throttle`) en login y recuperación de contraseña.
- **Transacciones con bloqueo de fila** en check-in y check-out, para que dos recepcionistas no ocupen la misma habitación al tiempo.
- **CORS restringido** al segmento de la red local del hotel.

Recomendaciones operativas: cambiar la contraseña del administrador en el primer ingreso, crear una cuenta de *recepción* por persona (no compartir usuarios) y mantener `APP_DEBUG=false`.

---

## 6. Solución de problemas

| Síntoma | Causa habitual | Solución |
|---|---|---|
| `No fue posible conectar con el servidor del hotel` | Apache apagado o IP incorrecta | Iniciar Apache; verificar `VITE_API_URL` |
| Error 500 al abrir la API | Falta `php artisan key:generate` o permisos | Ejecutarlo y revisar `storage/logs/laravel.log` |
| `SQLSTATE[HY000] [1045]` | Credenciales de MySQL erradas | Corregir `DB_USERNAME` / `DB_PASSWORD` en `.env` |
| Página en blanco al recargar una sección | Falta el `.htaccess` del frontend | Crear el archivo de la sección 2.6 |
| Otros equipos no acceden | Firewall o red distinta | Regla del puerto 80; confirmar el mismo segmento de red |
| No llega el correo de recuperación | Hotel sin Internet | Con `MAIL_MAILER=log`, el código queda en `storage/logs/laravel.log` para que el administrador lo entregue |
