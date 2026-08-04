<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class HuespedResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'nombre_completo' => $this->nombre_completo,
            'tipo_documento' => $this->tipo_documento,
            'numero_documento' => $this->numero_documento,
            'nacionalidad' => (string) $this->nacionalidad,
            'fecha_nacimiento' => optional($this->fecha_nacimiento)->format('Y-m-d') ?? '',
            'telefono' => (string) $this->telefono,
            'correo' => (string) $this->correo,
            'direccion' => (string) $this->direccion,
            'ciudad' => (string) $this->ciudad,
            'profesion' => (string) $this->profesion,
            'placa_vehiculo' => (string) $this->placa_vehiculo,
        ];
    }
}
