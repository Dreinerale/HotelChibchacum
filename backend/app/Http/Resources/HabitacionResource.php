<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class HabitacionResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'numero' => $this->numero,
            'tipo' => $this->tipo,
            'precio_noche' => (float) $this->precio_noche,
            'estado' => $this->estado,
            'observaciones' => (string) $this->observaciones,
        ];
    }
}
