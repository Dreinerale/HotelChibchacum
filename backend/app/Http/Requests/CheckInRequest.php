<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckInRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'huesped_id' => ['required', 'integer', 'exists:guests,id'],
            'habitacion_id' => ['required', 'integer', 'exists:rooms,id'],
            'fecha_ingreso' => ['required', 'date'],
            'fecha_salida_estimada' => ['required', 'date', 'after:fecha_ingreso'],
            'adultos' => ['required', 'integer', 'min:1', 'max:20'],
            'ninos' => ['nullable', 'integer', 'min:0', 'max:20'],
            'valor_noche' => ['required', 'numeric', 'min:1'],
            'metodo_pago' => ['required', Rule::in(['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'])],
            'observaciones' => ['nullable', 'string', 'max:1000'],
            'anticipo' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'fecha_salida_estimada.after' => 'La salida debe ser posterior al ingreso.',
            'adultos.min' => 'Debe haber al menos un adulto.',
        ];
    }
}
