<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class EstanciaResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'huesped_id' => $this->guest_id,
            'habitacion_id' => $this->room_id,
            'usuario_id' => $this->user_id,
            'fecha_ingreso' => $this->fecha_ingreso->toIso8601String(),
            'fecha_salida_estimada' => $this->fecha_salida_estimada->toIso8601String(),
            'fecha_salida_real' => optional($this->fecha_salida_real)->toIso8601String(),
            'adultos' => (int) $this->adultos,
            'ninos' => (int) $this->ninos,
            'valor_noche' => (float) $this->valor_noche,
            'metodo_pago' => $this->metodo_pago,
            'observaciones' => (string) $this->observaciones,
            'observaciones_salida' => (string) $this->observaciones_salida,
            'noches' => $this->noches !== null ? (int) $this->noches : null,
            'total' => $this->total !== null ? (float) $this->total : null,
            'estado' => $this->estado,
            'huesped' => new HuespedResource($this->whenLoaded('guest')),
            'habitacion' => new HabitacionResource($this->whenLoaded('room')),
            'pagos' => PagoResource::collection($this->whenLoaded('payments')),
        ];
    }
}
