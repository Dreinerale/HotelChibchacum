<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Habitacion del hotel. */
class Room extends Model
{
    use HasFactory;

    protected $fillable = ['numero', 'tipo', 'precio_noche', 'estado', 'observaciones'];

    protected $casts = ['precio_noche' => 'decimal:2'];

    public function stays()
    {
        return $this->hasMany(Stay::class);
    }

    /** Estancia activa (si la habitacion esta ocupada). */
    public function estanciaActiva()
    {
        return $this->hasOne(Stay::class)->where('estado', 'activa');
    }
}
