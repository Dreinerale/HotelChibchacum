<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Huespedes registrados. Se reutilizan entre estancias. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guests', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_completo');
            $table->enum('tipo_documento', ['CC', 'CE', 'TI', 'Pasaporte', 'NIT', 'PPT']);
            $table->string('numero_documento', 30);
            $table->string('nacionalidad', 60)->default('Colombiana');
            $table->date('fecha_nacimiento')->nullable();
            $table->string('telefono', 30);
            $table->string('correo')->nullable();
            $table->string('direccion')->nullable();
            $table->string('ciudad', 80)->nullable();
            $table->string('profesion', 80)->nullable();
            $table->string('placa_vehiculo', 10)->nullable();
            $table->timestamps();

            // Un documento no puede repetirse dentro del mismo tipo.
            $table->unique(['tipo_documento', 'numero_documento']);
            $table->index('nombre_completo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guests');
    }
};
