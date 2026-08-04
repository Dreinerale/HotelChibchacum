<?php

namespace App\Http\Controllers\Api;

use App\Models\Guest;
use App\Models\Payment;
use App\Models\Room;
use App\Models\Stay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;

/** Reportes de ocupacion, ingresos e historial de huespedes. */
class ReporteController extends Controller
{
    /** Ocupacion diaria: habitaciones-noche vendidas por dia del rango. */
    public function ocupacionDiaria(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->rango($request);
        $totalHabitaciones = max(1, Room::count());

        $estancias = Stay::whereDate('fecha_ingreso', '<=', $hasta)->get();
        $filas = [];

        for ($dia = $desde->copy(); $dia->lessThanOrEqualTo($hasta); $dia->addDay()) {
            $ocupadas = $estancias->filter(function (Stay $e) use ($dia) {
                $salida = $e->fecha_salida_real ?? $e->fecha_salida_estimada;

                return $e->fecha_ingreso->startOfDay()->lessThanOrEqualTo($dia)
                    && $salida->greaterThan($dia);
            })->count();

            $filas[] = [
                'fecha' => $dia->toDateString(),
                'ocupadas' => $ocupadas,
                'total_habitaciones' => $totalHabitaciones,
                'porcentaje' => (int) round($ocupadas / $totalHabitaciones * 100),
            ];
        }

        return response()->json(['data' => $filas]);
    }

    /** Ocupacion mensual: promedio de los porcentajes diarios de cada mes. */
    public function ocupacionMensual(Request $request): JsonResponse
    {
        $diarias = collect($this->ocupacionDiaria($request)->getData(true)['data']);

        $filas = $diarias->groupBy(fn ($f) => substr($f['fecha'], 0, 7))
            ->map(fn ($grupo, $mes) => [
                'mes' => $mes,
                'dias' => $grupo->count(),
                'promedio' => (int) round($grupo->avg('porcentaje')),
            ])->values();

        return response()->json(['data' => $filas]);
    }

    public function ingresos(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->rango($request);

        $pagos = Payment::whereBetween('fecha', [$desde->startOfDay(), $hasta->endOfDay()])->get();

        return response()->json([
            'total' => (float) $pagos->sum('monto'),
            'cantidad' => $pagos->count(),
            'por_dia' => $pagos->groupBy(fn ($p) => $p->fecha->toDateString())
                ->map(fn ($g, $dia) => ['fecha' => $dia, 'monto' => (float) $g->sum('monto')])
                ->values(),
            'por_metodo' => $pagos->groupBy('metodo_pago')
                ->map(fn ($g, $metodo) => ['metodo' => $metodo, 'monto' => (float) $g->sum('monto')])
                ->values(),
        ]);
    }

    public function historialHuespedes(): JsonResponse
    {
        $filas = Guest::withCount('stays')
            ->with('stays:id,guest_id,noches,total,fecha_ingreso')
            ->get()
            ->filter(fn ($h) => $h->stays_count > 0)
            ->map(fn ($h) => [
                'huesped' => $h->nombre_completo,
                'documento' => $h->tipo_documento.' '.$h->numero_documento,
                'ciudad' => $h->ciudad,
                'estancias' => $h->stays_count,
                'noches' => (int) $h->stays->sum('noches'),
                'facturado' => (float) $h->stays->sum('total'),
                'ultima_visita' => optional($h->stays->max('fecha_ingreso'))->toDateString(),
            ])
            ->sortByDesc('facturado')
            ->values();

        return response()->json(['data' => $filas]);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function rango(Request $request): array
    {
        $request->validate([
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date'],
        ]);

        return [
            Carbon::parse($request->query('desde', now()->startOfMonth()->toDateString()))->startOfDay(),
            Carbon::parse($request->query('hasta', now()->toDateString()))->startOfDay(),
        ];
    }
}
