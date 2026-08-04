<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Validacion de creacion y edicion de habitaciones. */
class HabitacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $id = $this->route('habitacione')?->id ?? $this->route('room')?->id;

        return [
            'numero' => ['required', 'string', 'max:10', Rule::unique('rooms', 'numero')->ignore($id)],
            'tipo' => ['required', Rule::in(['Sencilla', 'Doble', 'Triple', 'Suite'])],
            'precio_noche' => ['required', 'numeric', 'min:1', 'max:99999999'],
            'estado' => ['required', Rule::in(['Disponible', 'Ocupada', 'Limpieza', 'Mantenimiento'])],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'numero.unique' => 'Ya existe una habitacion con ese numero.',
            'precio_noche.min' => 'Ingrese un precio mayor a cero.',
        ];
    }
}
