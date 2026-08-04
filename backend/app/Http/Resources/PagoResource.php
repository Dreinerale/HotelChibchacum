<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PagoResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'estancia_id' => $this->stay_id,
            'monto' => (float) $this->monto,
            'metodo_pago' => $this->metodo_pago,
            'tipo' => $this->tipo,
            'referencia' => (string) $this->referencia,
            'fecha' => $this->fecha->toIso8601String(),
        ];
    }
}
