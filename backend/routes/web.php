<?php

use Illuminate\Support\Facades\Route;

/**
 * El frontend React se sirve como sitio estatico. Esta ruta solo confirma
 * que la API esta arriba cuando se abre la IP del servidor en el navegador.
 */
Route::get('/', fn () => response()->json([
    'sistema' => 'Hotel Chibchacum - API PMS',
    'estado' => 'operativa',
]));
