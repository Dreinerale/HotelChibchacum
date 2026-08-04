<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\CheckInRequest;
use App\Http\Requests\CheckOutRequest;
use App\Http\Resources\EstanciaResource;
use App\Http\Resources\PagoResource;
use App\Models\Payment;
use App\Models\Room;
use App\Models\Stay;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Estancias: listado, check-in y check-out.
 *
 * Check-in y check-out corren dentro de una transaccion con bloqueo de fila
 * sobre la habitacion, de modo que dos recepcionistas en la red local no
 * puedan ocupar la misma habitacion al mismo tiempo.
 */
class EstanciaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $consulta = Stay::with(['guest', 'room', 'payments']);

        if ($estado = $request->query('estado')) {
            $consulta->where('estado', $estado);
        }
        if ($desde = $request->query('desde')) {
            $consulta->whereDate('fecha_ingreso', '>=', $desde);
        }
        if ($hasta = $request->query('hasta')) {
            $consulta->whereDate('fecha_ingreso', '<=', $hasta);
        }
        if ($habitacion = $request->query('habitacion_id')) {
            $consulta->where('room_id', $habitacion);
        }

        return EstanciaResource::collection(
            $consulta->orderByDesc('fecha_ingreso')->get()
        );
    }

    public function checkIn(CheckInRequest $request): EstanciaResource
    {
        $datos = $request->validated();

        $estancia = DB::transaction(function () use ($datos, $request) {
            $habitacion = Room::lockForUpdate()->findOrFail($datos['habitacion_id']);

            if ($habitacion->estado !== 'Disponible') {
                throw ValidationException::withMessages([
                    'habitacion_id' => "La habitacion {$habitacion->numero} esta en estado {$habitacion->estado}.",
                ]);
            }

            $activa = Stay::where('guest_id', $datos['huesped_id'])
                ->where('estado', 'activa')->exists();

            if ($activa) {
                throw ValidationException::withMessages([
                    'huesped_id' => 'El huesped ya tiene una estancia activa.',
                ]);
            }

            $estancia = Stay::create([
                'guest_id' => $datos['huesped_id'],
                'room_id' => $habitacion->id,
                'user_id' => $request->user()->id,
                'fecha_ingreso' => $datos['fecha_ingreso'],
                'fecha_salida_estimada' => $datos['fecha_salida_estimada'],
                'adultos' => $datos['adultos'],
                'ninos' => $datos['ninos'] ?? 0,
                'valor_noche' => $datos['valor_noche'],
                'metodo_pago' => $datos['metodo_pago'],
                'observaciones' => $datos['observaciones'] ?? null,
                'estado' => 'activa',
            ]);

            // Regla de negocio: la habitacion pasa a Ocupada al hacer check-in.
            $habitacion->update(['estado' => 'Ocupada']);

            if (($datos['anticipo'] ?? 0) > 0) {
                Payment::create([
                    'stay_id' => $estancia->id,
                    'monto' => $datos['anticipo'],
                    'metodo_pago' => $datos['metodo_pago'],
                    'tipo' => 'anticipo',
                    'referencia' => 'ANT-'.$estancia->id,
                    'fecha' => $datos['fecha_ingreso'],
                ]);
            }

            return $estancia;
        });

        return new EstanciaResource($estancia->load(['guest', 'room', 'payments']));
    }

    public function checkOut(CheckOutRequest $request, Stay $estancia): EstanciaResource
    {
        $datos = $request->validated();

        DB::transaction(function () use ($datos, $estancia) {
            $estancia->refresh();

            if ($estancia->estado === 'finalizada') {
                throw ValidationException::withMessages(['id' => 'La estancia ya fue cerrada.']);
            }

            $salida = Carbon::parse($datos['fecha_salida_real']);

            if ($salida->lessThanOrEqualTo($estancia->fecha_ingreso)) {
                throw ValidationException::withMessages([
                    'fecha_salida_real' => 'La fecha de salida debe ser posterior al ingreso.',
                ]);
            }

            $noches = $estancia->calcularNoches($salida);

            $estancia->update([
                'fecha_salida_real' => $salida,
                'noches' => $noches,
                'total' => $noches * (float) $estancia->valor_noche,
                'metodo_pago' => $datos['metodo_pago'],
                'observaciones_salida' => $datos['observaciones_salida'] ?? null,
                'estado' => 'finalizada',
            ]);

            if (($datos['monto_pagado'] ?? 0) > 0) {
                Payment::create([
                    'stay_id' => $estancia->id,
                    'monto' => $datos['monto_pagado'],
                    'metodo_pago' => $datos['metodo_pago'],
                    'tipo' => 'saldo',
                    'referencia' => 'SAL-'.$estancia->id,
                    'fecha' => $salida,
                ]);
            }

            // La habitacion vuelve a estar disponible (o pasa a limpieza).
            $estancia->room()->update([
                'estado' => ($datos['dejar_en_limpieza'] ?? false) ? 'Limpieza' : 'Disponible',
            ]);
        });

        return new EstanciaResource($estancia->fresh()->load(['guest', 'room', 'payments']));
    }

    public function registrarPago(Request $request, Stay $estancia): PagoResource
    {
        $datos = $request->validate([
            'monto' => ['required', 'numeric', 'min:1'],
            'metodo_pago' => ['required', Rule::in(['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'])],
        ]);

        $pago = Payment::create([
            'stay_id' => $estancia->id,
            'monto' => $datos['monto'],
            'metodo_pago' => $datos['metodo_pago'],
            'tipo' => $estancia->estado === 'activa' ? 'anticipo' : 'saldo',
            'referencia' => 'PAG-'.$estancia->id,
            'fecha' => now(),
        ]);

        return new PagoResource($pago);
    }
}
