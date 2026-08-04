<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EstanciaController;
use App\Http\Controllers\Api\HabitacionController;
use App\Http\Controllers\Api\HuespedController;
use App\Http\Controllers\Api\PagoController;
use App\Http\Controllers\Api\PanelController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\UsuarioController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API del PMS Hotel Chibchacum
|--------------------------------------------------------------------------
| Prefijo /api. Autenticacion por token Sanctum en el encabezado
| Authorization: Bearer <token>.
*/

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:6,1');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::put('password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('panel', PanelController::class);

    Route::apiResource('habitaciones', HabitacionController::class)
        ->parameters(['habitaciones' => 'habitacione']);
    Route::apiResource('huespedes', HuespedController::class)
        ->parameters(['huespedes' => 'huespede']);

    Route::get('estancias', [EstanciaController::class, 'index']);
    Route::post('estancias/check-in', [EstanciaController::class, 'checkIn']);
    Route::post('estancias/{estancia}/check-out', [EstanciaController::class, 'checkOut']);
    Route::post('estancias/{estancia}/pagos', [EstanciaController::class, 'registrarPago']);

    Route::get('pagos', [PagoController::class, 'index']);

    // Modulos exclusivos del administrador.
    Route::middleware('rol:administrador')->group(function () {
        Route::apiResource('usuarios', UsuarioController::class)->except(['show']);

        Route::prefix('reportes')->group(function () {
            Route::get('ocupacion-diaria', [ReporteController::class, 'ocupacionDiaria']);
            Route::get('ocupacion-mensual', [ReporteController::class, 'ocupacionMensual']);
            Route::get('ingresos', [ReporteController::class, 'ingresos']);
            Route::get('historial-huespedes', [ReporteController::class, 'historialHuespedes']);
        });
    });
});
