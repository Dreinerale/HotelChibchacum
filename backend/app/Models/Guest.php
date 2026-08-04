<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Huesped registrado en el hotel. */
class Guest extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre_completo', 'tipo_documento', 'numero_documento', 'nacionalidad',
        'fecha_nacimiento', 'telefono', 'correo', 'direccion', 'ciudad',
        'profesion', 'placa_vehiculo',
    ];

    protected $casts = ['fecha_nacimiento' => 'date:Y-m-d'];

    public function stays()
    {
        return $this->hasMany(Stay::class);
    }
}
