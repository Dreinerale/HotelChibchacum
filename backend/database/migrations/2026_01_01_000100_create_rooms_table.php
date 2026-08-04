<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Inventario de habitaciones del hotel. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 10)->unique();
            $table->enum('tipo', ['Sencilla', 'Doble', 'Triple', 'Suite']);
            $table->decimal('precio_noche', 12, 2);
            $table->enum('estado', ['Disponible', 'Ocupada', 'Limpieza', 'Mantenimiento'])
                  ->default('Disponible');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
