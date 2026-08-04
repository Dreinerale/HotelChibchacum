<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Estancias: relacion huesped-habitacion entre check-in y check-out. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guest_id')->constrained('guests')->restrictOnDelete();
            $table->foreignId('room_id')->constrained('rooms')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->dateTime('fecha_ingreso');
            $table->dateTime('fecha_salida_estimada');
            $table->dateTime('fecha_salida_real')->nullable();

            $table->unsignedTinyInteger('adultos')->default(1);
            $table->unsignedTinyInteger('ninos')->default(0);
            $table->decimal('valor_noche', 12, 2);
            $table->enum('metodo_pago', ['Efectivo', 'Tarjeta', 'Transferencia', 'Nequi', 'Daviplata']);
            $table->text('observaciones')->nullable();
            $table->text('observaciones_salida')->nullable();

            $table->unsignedSmallInteger('noches')->nullable();
            $table->decimal('total', 12, 2)->nullable();
            $table->enum('estado', ['activa', 'finalizada'])->default('activa');
            $table->timestamps();

            $table->index(['estado', 'fecha_ingreso']);
            $table->index('fecha_salida_real');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stays');
    }
};
