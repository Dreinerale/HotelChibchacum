# Hotel Chibchacum · Sistema de gestión hotelera

Aplicación web para operar la recepción del **Hotel Chibchacum** (Zetaquirá, Boyacá): habitaciones, huéspedes, check-in, check-out, pagos, reportes y registro de huéspedes ante el TRA.

**En producción:** [app.hotelchibchacum.co](https://app.hotelchibchacum.co) · Sitio web del hotel: [hotelchibchacum.co](https://hotelchibchacum.co)

## Qué hace

| Módulo | Para qué sirve |
|---|---|
| Panel | Ocupación del día y estado de cada habitación |
| Habitaciones | Estados (libre, ocupada, aseo, mantenimiento) con historial de cambios |
| Huéspedes | Ficha de cada huésped y su historial de estadías |
| Check-in / Check-out | Ingreso y salida con cálculo de noches, pagos y saldo |
| Reportes | Ingresos y ocupación por período, con exportación |
| Registro TRA | Datos de huéspedes listos para el reporte obligatorio de turismo |
| Usuarios | Roles de administrador y recepción |

## Stack

- **Frontend:** React 19, TypeScript, Vite y Tailwind CSS v4.
- **Datos y autenticación:** Supabase (PostgreSQL + Auth).
- **Publicación:** Vercel, con dominio propio.
- **Alternativa en red local:** API REST en Laravel 12 + MySQL (carpeta `backend/`) para hoteles sin Internet estable.

## Decisiones técnicas

- **Una sola interfaz, tres formas de guardar datos.** La aplicación nunca habla directo con la base de datos: usa el contrato `src/data/repositorio.ts`, con tres implementaciones (Supabase, API Laravel y almacenamiento local). Cambiar de una a otra no toca la interfaz.
- **Seguridad en la base de datos.** Todas las tablas tienen Row Level Security. Recepción y administración tienen permisos distintos, y las estadías y los pagos no se pueden crear ni modificar directamente: solo con funciones controladas.
- **Trazabilidad.** Los cambios de estado de las habitaciones y las exportaciones de datos quedan registrados en tablas de auditoría.

## Correr en local

```bash
npm install
npm run dev
```

Guía completa de instalación (modo autónomo, red local con XAMPP y nube): [INSTALL.md](INSTALL.md).

---

Desarrollado por **Dreiner Rodríguez** · [GitHub](https://github.com/Dreinerale)
