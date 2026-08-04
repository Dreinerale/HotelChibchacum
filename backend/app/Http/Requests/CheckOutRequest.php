<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'fecha_salida_real' => ['required', 'date'],
            'metodo_pago' => ['required', Rule::in(['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata'])],
            'observaciones_salida' => ['nullable', 'string', 'max:1000'],
            'monto_pagado' => ['nullable', 'numeric', 'min:0'],
            'dejar_en_limpieza' => ['boolean'],
        ];
    }
}
