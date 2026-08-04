<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Pago recibido por una estancia. */
class Payment extends Model
{
    use HasFactory;

    protected $fillable = ['stay_id', 'monto', 'metodo_pago', 'tipo', 'referencia', 'fecha'];

    protected $casts = ['monto' => 'decimal:2', 'fecha' => 'datetime'];

    public function stay()
    {
        return $this->belongsTo(Stay::class);
    }
}
