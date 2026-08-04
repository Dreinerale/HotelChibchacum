<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Crea unicamente la cuenta de administrador inicial. No se cargan datos
 * de prueba: el hotel registra su propia informacion desde el sistema.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@chibchacum.co'],
            [
                'name' => 'Administrador',
                'password' => 'Chibchacum2026*', // se cifra con bcrypt automaticamente
                'rol' => 'administrador',
                'activo' => true,
            ]
        );
    }
}
