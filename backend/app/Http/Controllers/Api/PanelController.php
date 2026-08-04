<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\EstanciaResource;
use App\Models\Payment;
use App\Models\Room;
use App\Models\Stay;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

/** Indicadores del panel principal. */
class PanelController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $hoy = now()->toDateString();
        $porEstado = Room::selectRaw('estado, COUNT(*) as total')
            ->groupBy('estado')->pluck('total', 'estado');

        $activas = Stay::with(['guest', 'room', 'payments'])->where('estado', 'activa')->get();

        return response()->json([
            'resumen' => [
                'disponibles' => (int) ($porEstado['Disponible'] ?? 0),
                'ocupadas' => (int) ($porEstado['Ocupada'] ?? 0),
                'limpieza' => (int) ($porEstado['Limpieza'] ?? 0),
                'mantenimiento' => (int) ($porEstado['Mantenimiento'] ?? 0),
                'huespedes_hospedados' => (int) $activas->sum(fn ($e) => $e->adultos + $e->ninos),
                'checkins_hoy' => Stay::whereDate('fecha_ingreso', $hoy)->count(),
                'checkouts_hoy' => Stay::whereDate('fecha_salida_real', $hoy)->count(),
                'ingresos_hoy' => (float) Payment::whereDate('fecha', $hoy)->sum('monto'),
            ],
            'hospedados' => EstanciaResource::collection($activas),
        ]);
    }
}
