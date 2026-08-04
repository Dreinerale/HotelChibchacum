<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\PagoResource;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;

/** Consulta de pagos, opcionalmente filtrada por rango de fechas. */
class PagoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $consulta = Payment::query();

        if ($desde = $request->query('desde')) {
            $consulta->whereDate('fecha', '>=', $desde);
        }
        if ($hasta = $request->query('hasta')) {
            $consulta->whereDate('fecha', '<=', $hasta);
        }

        return PagoResource::collection($consulta->orderByDesc('fecha')->get());
    }
}
