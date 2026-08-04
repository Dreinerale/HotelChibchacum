<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\HabitacionRequest;
use App\Http\Resources\HabitacionResource;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

/** CRUD de habitaciones con busqueda por numero, tipo y estado. */
class HabitacionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $consulta = Room::query();

        // Los parametros se enlazan como bindings: no hay riesgo de inyeccion SQL.
        if ($busqueda = $request->query('buscar')) {
            $consulta->where(function ($q) use ($busqueda) {
                $q->where('numero', 'like', "%{$busqueda}%")
                  ->orWhere('tipo', 'like', "%{$busqueda}%")
                  ->orWhere('observaciones', 'like', "%{$busqueda}%");
            });
        }

        if ($estado = $request->query('estado')) {
            $consulta->where('estado', $estado);
        }

        return HabitacionResource::collection($consulta->orderBy('numero')->get());
    }

    public function store(HabitacionRequest $request): HabitacionResource
    {
        return new HabitacionResource(Room::create($request->validated()));
    }

    public function show(Room $habitacione): HabitacionResource
    {
        return new HabitacionResource($habitacione);
    }

    public function update(HabitacionRequest $request, Room $habitacione): HabitacionResource
    {
        $datos = $request->validated();

        if ($habitacione->estanciaActiva()->exists() && $datos['estado'] !== 'Ocupada') {
            throw ValidationException::withMessages([
                'estado' => 'La habitacion tiene una estancia activa; realice el check-out primero.',
            ]);
        }

        $habitacione->update($datos);

        return new HabitacionResource($habitacione->fresh());
    }

    public function destroy(Room $habitacione): JsonResponse
    {
        if ($habitacione->stays()->exists()) {
            throw ValidationException::withMessages([
                'id' => 'No se puede eliminar: la habitacion tiene estancias en el historial.',
            ]);
        }

        $habitacione->delete();

        return response()->json(null, 204);
    }
}
