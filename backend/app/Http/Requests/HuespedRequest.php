<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Validacion del registro de huespedes. */
class HuespedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $id = $this->route('huespede')?->id ?? $this->route('guest')?->id;

        return [
            'nombre_completo' => ['required', 'string', 'max:150'],
            'tipo_documento' => ['required', Rule::in(['CC', 'CE', 'TI', 'Pasaporte', 'NIT', 'PPT'])],
            'numero_documento' => [
                'required', 'string', 'max:30',
                Rule::unique('guests', 'numero_documento')
                    ->where(fn ($q) => $q->where('tipo_documento', $this->input('tipo_documento')))
                    ->ignore($id),
            ],
            'nacionalidad' => ['nullable', 'string', 'max:60'],
            'fecha_nacimiento' => ['nullable', 'date', 'before:today'],
            'telefono' => ['required', 'string', 'max:30'],
            'correo' => ['nullable', 'email', 'max:150'],
            'direccion' => ['nullable', 'string', 'max:150'],
            'ciudad' => ['nullable', 'string', 'max:80'],
            'profesion' => ['nullable', 'string', 'max:80'],
            'placa_vehiculo' => ['nullable', 'string', 'max:10'],
        ];
    }

    public function messages(): array
    {
        return ['numero_documento.unique' => 'Ya existe un huesped con ese documento.'];
    }
}
