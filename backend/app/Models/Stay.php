<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Estancia: ocupacion de una habitacion por un huesped. */
class Stay extends Model
{
    use HasFactory;

    protected $fillable = [
        'guest_id', 'room_id', 'user_id', 'fecha_ingreso', 'fecha_salida_estimada',
        'fecha_salida_real', 'adultos', 'ninos', 'valor_noche', 'metodo_pago',
        'observaciones', 'observaciones_salida', 'noches', 'total', 'estado',
    ];

    protected $casts = [
        'fecha_ingreso' => 'datetime',
        'fecha_salida_estimada' => 'datetime',
        'fecha_salida_real' => 'datetime',
        'valor_noche' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function guest()
    {
        return $this->belongsTo(Guest::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Noches facturables: se cobra minimo una noche y se redondea hacia
     * arriba cualquier fraccion de dia.
     */
    public function calcularNoches(\DateTimeInterface $salida): int
    {
        $minutos = $this->fecha_ingreso->diffInMinutes($salida, false);

        return max(1, (int) ceil($minutos / 1440));
    }
}
