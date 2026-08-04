<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\HuespedRequest;
use App\Http\Resources\HuespedResource;
use App\Models\Guest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

/** CRUD de huespedes. La busqueda permite reutilizar registros anteriores. */
class HuespedController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $consulta = Guest::query();

        if ($busqueda = $request->query('buscar')) {
            $consulta->where(function ($q) use ($busqueda) {
                $q->where('nombre_completo', 'like', "%{$busqueda}%")
                  ->orWhere('numero_documento', 'like', "%{$busqueda}%")
                  ->orWhere('telefono', 'like', "%{$busqueda}%")
                  ->orWhere('placa_vehiculo', 'like', "%{$busqueda}%");
            });
        }

        return HuespedResource::collection($consulta->orderBy('nombre_completo')->get());
    }

    public function store(HuespedRequest $request): HuespedResource
    {
        return new HuespedResource(Guest::create($request->validated()));
    }

    public function show(Guest $huespede): HuespedResource
    {
        return new HuespedResource($huespede);
    }

    public function update(HuespedRequest $request, Guest $huespede): HuespedResource
    {
        $huespede->update($request->validated());

        return new HuespedResource($huespede->fresh());
    }

    public function destroy(Guest $huespede): JsonResponse
    {
        if ($huespede->stays()->exists()) {
            throw ValidationException::withMessages([
                'id' => 'No se puede eliminar: el huesped tiene estancias en el historial.',
            ]);
        }

        $huespede->delete();

        return response()->json(null, 204);
    }
}
